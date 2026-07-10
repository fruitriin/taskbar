//! ウィンドウ変更の監視（NSWorkspace 通知 → デバウンス → 'process' イベント emit）
//!
//! Swift 原本: nativeSrc/taskbar.helper/main.swift:873-964（WindowObserver）
//!
//! 原本との対応:
//! - didActivate / didLaunch / didTerminate ApplicationNotification の監視
//!   （main.swift:880-905）→ NSNotificationCenter のブロック版 API で登録
//! - 通知後 500ms 遅延して再取得（main.swift:922-944）→ tokio 側でデバウンス。
//!   原本は通知ごとに独立した 500ms 遅延実行（連続通知で複数回実行される）だが、
//!   Rust 版は「最後の通知から 500ms 静穏」でまとめる trailing デバウンスに改善
//!   （原本コメントの意図「開いたウィンドウの登録を待つ」は保たれる）
//! - FiltersChanged 通知（main.swift:907-913, 947-963）→ フィルタ設定の主管が
//!   tauri-plugin-store に移るため未移植（下記 TODO 参照）
//! - 定期ポーリングは原本に存在しない（watch モードの RunLoop 0.5s ループは
//!   プロセス生存チェックのみ。Timer は ProgressiveIconLoader / heartbeat 用）ため
//!   Rust 版でも実装しない
//!
//! 実装方式（observer 登録）:
//! NSWorkspace.shared.notificationCenter に対して
//! `addObserverForName:object:queue:usingBlock:`（objc2-foundation + block2）で
//! クロージャを登録する。Swift 原本の #selector 方式と違い ObjC クラス定義が不要。
//! ブロック内では mpsc チャンネルへのシグナル送信のみ行い（非ブロッキング）、
//! ウィンドウリスト取得・フィルタ・emit は tokio タスク側で行う。

use std::future::Future;
use std::ptr::NonNull;
use std::sync::Mutex;
use std::time::Duration;

use block2::RcBlock;
use objc2_app_kit::{
    NSWorkspace, NSWorkspaceDidActivateApplicationNotification,
    NSWorkspaceDidLaunchApplicationNotification, NSWorkspaceDidTerminateApplicationNotification,
};
use objc2_foundation::{NSNotification, NSNotificationName};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc::{self, UnboundedReceiver};

use crate::filter::{self, LabeledFilters};
use crate::icon_manager;
use crate::store;
use crate::window_manager::{self, MacWindow};

/// デバウンス時間（Swift 原本 main.swift:926 の 500ms 遅延に対応）
const DEBOUNCE: Duration = Duration::from_millis(500);

/// 直近の除外ウィンドウリスト（tauri State として保持）。
/// フロントの 'catchExcludeWindow' イベント / getExcludeWindows コマンド
/// （後続タスクで実装）がここを参照する。
/// Swift 原本では exclude コマンド（main.swift:1116-1128）が毎回差集合を
/// 再計算していたが、Rust 版は filter_windows の除外リストをそのまま保持する
pub struct ExcludedWindows(pub Mutex<Vec<MacWindow>>);

/// NSWorkspace 通知の監視を開始する。lib.rs の setup（メインスレッド）から呼ぶ。
///
/// Swift 原本: observeWindowChanges（main.swift:880-914）
pub fn start_observation(app: AppHandle) {
    // 除外リスト保持用の State を登録
    app.manage(ExcludedWindows(Mutex::new(Vec::new())));

    let (tx, rx) = mpsc::unbounded_channel::<()>();

    // 監視対象の通知（main.swift:884-905 と同じ3種）
    // SAFETY: extern static の参照。AppKit がプロセス起動時に初期化を保証する
    let names: [&NSNotificationName; 3] = unsafe {
        [
            NSWorkspaceDidActivateApplicationNotification,
            NSWorkspaceDidLaunchApplicationNotification,
            NSWorkspaceDidTerminateApplicationNotification,
        ]
    };

    let workspace = NSWorkspace::sharedWorkspace();
    let center = workspace.notificationCenter();
    for name in names {
        let tx = tx.clone();
        // 通知ブロックはシグナル送信のみ（unbounded send は非ブロッキング）。
        // 重い処理（ウィンドウリスト取得）は tokio 側のデバウンスループで行う
        let block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
            let _ = tx.send(());
        });
        // SAFETY: name は AppKit の静的な通知名、block は 'static クロージャ。
        // queue=None のためブロックは通知を post したスレッドで実行されるが、
        // 中身はチャンネル送信のみでスレッド安全
        let token = unsafe {
            center.addObserverForName_object_queue_usingBlock(Some(name), None, None, &block)
        };
        // アプリ寿命いっぱい監視し続けるため observer トークンは意図的にリークする
        // （Swift 原本もシングルトンに登録したまま removeObserver しない）
        std::mem::forget(token);
    }

    // TODO(3.4): フィルタ設定変更の監視（Swift 原本 main.swift:907-913 の
    // FiltersChanged 通知に対応）。tauri-plugin-store の変更イベントを購読して
    // 即時 refresh_and_emit する形で後続タスクで実装する

    tauri::async_runtime::spawn(async move {
        // 初回のウィンドウ情報を遅延なしで送信
        // （Swift 原本 main.swift:1161-1162 の watch モード初回出力に対応）
        let _ = refresh_and_emit(&app).await;

        let app_for_action = app.clone();
        debounce_loop(rx, DEBOUNCE, move || {
            let app = app_for_action.clone();
            async move {
                let _ = refresh_and_emit(&app).await;
            }
        })
        .await;
    });
}

/// trailing デバウンス: 最初のシグナルを受けてから、`delay` の間シグナルが
/// 来なくなるまで待ち、1回だけ action を実行する。チャンネルが閉じたら終了する
/// （閉鎖時にシグナルが溜まっていれば最後の1回を実行してから終了）。
///
/// 時間は tokio の仮想時計に依存するため、テストでは start_paused で検証できる。
/// display_manager のスクリーン構成変更監視からも共用される
pub(crate) async fn debounce_loop<F, Fut>(
    mut rx: UnboundedReceiver<()>,
    delay: Duration,
    mut action: F,
) where
    F: FnMut() -> Fut,
    Fut: Future<Output = ()>,
{
    while rx.recv().await.is_some() {
        // 最後のシグナルから delay 経過するまで待つ（追加シグナルでリセット）
        loop {
            match tokio::time::timeout(delay, rx.recv()).await {
                Ok(Some(())) => continue, // シグナル追加 → デバウンス窓をリセット
                Ok(None) => break,        // チャンネル閉鎖 → 最後の1回を実行して終了へ
                Err(_) => break,          // delay 静穏 → 実行
            }
        }
        action().await;
    }
}

/// ウィンドウリストを再取得・フィルタし、通過リストを Tauri イベント 'process' で
/// 全ウィンドウへ emit する。除外リストは ExcludedWindows State に保持する。
/// 成功時は (通過リスト, 除外リスト) を返す（getExcludeWindows コマンド等が
/// emit 後のリストを再利用するため）。
///
/// Swift 原本: windowDidChange の遅延実行部（main.swift:928-944）＋
/// getWindowInfoListData のフィルタ適用（main.swift:844-848）
pub async fn refresh_and_emit(app: &AppHandle) -> Option<(Vec<MacWindow>, Vec<MacWindow>)> {
    // フィルタ設定を tauri-plugin-store（config.json の labeledFilters）から読む。
    // Electron 原本では updateProcessList のたびに exportFiltersToSwift で
    // filter.json に書き出していた（helper.ts:134-151）のと同じく、毎回最新値を読む
    let filters: Vec<LabeledFilters> = match store::get_labeled_filters(app) {
        Ok(filters) => filters,
        Err(e) => {
            // ストアが読めない場合はフィルタなし（サイズフィルタのみ）で続行
            log::warn!("failed to load labeledFilters from store: {e}");
            Vec::new()
        }
    };

    match window_manager::get_window_list().await {
        Ok(windows) => {
            let (mut passed, excluded) = filter::filter_windows(windows, &filters);

            // FS キャッシュ済みアイコンを appIcon に適用してから emit する
            // （Electron 原本 helper.ts:513-529 applyProcessChange と同じ順序。
            // キャッシュ済みアプリは 'process' の時点でアイコン付きになる）
            icon_manager::apply_cached_icons(&mut passed).await;

            // 除外リストを保持（'catchExcludeWindow' / getExcludeWindows 用）
            if let Some(state) = app.try_state::<ExcludedWindows>() {
                if let Ok(mut guard) = state.0.lock() {
                    guard.clone_from(&excluded);
                }
            }

            // イベント名 'process' は現行フロントの契約
            // （src/renderer の ipcListen('process', ...) に対応）
            if let Err(e) = app.emit("process", &passed) {
                log::warn!("failed to emit 'process' event: {e}");
            }

            // キャッシュミス分のアイコンを非同期で取得して 'iconUpdate' で後追い送信
            // （段階ロード。Swift 原本 ProgressiveIconLoader の簡素化版 —
            // 判断コメントは icon_manager.rs 冒頭参照）
            icon_manager::load_missing_icons_and_emit(app.clone(), &passed);

            Some((passed, excluded))
        }
        Err(e) => {
            // 取得失敗はログのみ（Swift 原本もエラー時は出力せず次の通知を待つ）
            log::warn!("get_window_list failed in observer: {e}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use tokio::time::sleep;

    /// カウンタを増やすだけの action を挟んだ debounce_loop を起動する
    fn spawn_counting_loop(
        rx: UnboundedReceiver<()>,
    ) -> (Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
        let count = Arc::new(AtomicUsize::new(0));
        let c = Arc::clone(&count);
        let handle = tokio::spawn(debounce_loop(rx, DEBOUNCE, move || {
            let c = Arc::clone(&c);
            async move {
                c.fetch_add(1, Ordering::SeqCst);
            }
        }));
        (count, handle)
    }

    #[tokio::test(start_paused = true)]
    async fn 連続シグナルは1回のアクションにまとめられる() {
        let (tx, rx) = mpsc::unbounded_channel();
        let (count, handle) = spawn_counting_loop(rx);

        // 500ms 窓内の連続シグナル（アプリ起動時の didLaunch + didActivate 連発を想定）
        for _ in 0..5 {
            tx.send(()).unwrap();
        }
        sleep(Duration::from_millis(600)).await;
        assert_eq!(count.load(Ordering::SeqCst), 1, "5連発が1回にまとまる");

        // 静穏後の次のバーストは別の1回になる
        for _ in 0..3 {
            tx.send(()).unwrap();
        }
        sleep(Duration::from_millis(600)).await;
        assert_eq!(count.load(Ordering::SeqCst), 2);

        drop(tx);
        handle.await.unwrap();
        assert_eq!(
            count.load(Ordering::SeqCst),
            2,
            "閉鎖時に余計な実行をしない"
        );
    }

    #[tokio::test(start_paused = true)]
    async fn デバウンス窓内の追加シグナルでタイマーがリセットされる() {
        let (tx, rx) = mpsc::unbounded_channel();
        let (count, handle) = spawn_counting_loop(rx);

        tx.send(()).unwrap();
        sleep(Duration::from_millis(300)).await;
        assert_eq!(
            count.load(Ordering::SeqCst),
            0,
            "300ms 時点ではまだ実行されない"
        );

        // 窓内の追加シグナル → 500ms タイマーがリセットされる
        tx.send(()).unwrap();
        sleep(Duration::from_millis(300)).await;
        // 最初のシグナルから 600ms 経過しているが、最後のシグナルからは 300ms
        assert_eq!(
            count.load(Ordering::SeqCst),
            0,
            "リセット後はまだ実行されない"
        );

        sleep(Duration::from_millis(300)).await;
        assert_eq!(
            count.load(Ordering::SeqCst),
            1,
            "最後のシグナルから 500ms 後に実行"
        );

        drop(tx);
        handle.await.unwrap();
    }

    #[tokio::test(start_paused = true)]
    async fn シグナルが無ければ何も実行されない() {
        let (tx, rx) = mpsc::unbounded_channel::<()>();
        let (count, handle) = spawn_counting_loop(rx);

        sleep(Duration::from_secs(5)).await;
        assert_eq!(count.load(Ordering::SeqCst), 0);

        drop(tx);
        handle.await.unwrap();
        assert_eq!(count.load(Ordering::SeqCst), 0);
    }
}
