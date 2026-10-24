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
//!   （原本コメントの意図「開いたウィンドウの登録を待つ」は保たれる）。
//!   さらに通知が途切れず続いても実行されなくならないよう、最初の通知から
//!   MAX_WAIT 経過で強制実行する上限を設けている（AX のタイトル変化通知の
//!   導入に備えた starvation 対策。docs: .claude/addf/plans/ax-title-observer.md）
//! - observer 経由の再取得では、フィルタ通過リストが前回 emit と同一なら
//!   'process' を送らない（EmitPolicy::IfChanged）。初期化・フィルタ変更など
//!   コマンド経由の呼び出しは常に emit する（EmitPolicy::Always）
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
    NSApplicationActivationPolicy, NSRunningApplication, NSWorkspace, NSWorkspaceApplicationKey,
    NSWorkspaceDidActivateApplicationNotification, NSWorkspaceDidLaunchApplicationNotification,
    NSWorkspaceDidTerminateApplicationNotification,
};
use objc2_foundation::{NSNotification, NSNotificationName};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc::{self, UnboundedReceiver};

use crate::ax_observer::{self, AxObserverHandle};
use crate::filter::{self, LabeledFilters};
use crate::icon_manager;
use crate::store;
use crate::window_manager::{self, MacWindow};

/// デバウンス時間（Swift 原本 main.swift:926 の 500ms 遅延に対応）
const DEBOUNCE: Duration = Duration::from_millis(500);

/// デバウンスの最大待ち時間。通知が DEBOUNCE 未満の間隔で続いても、
/// 最初の通知からこの時間が経てば1回実行する
const MAX_WAIT: Duration = Duration::from_secs(1);

/// 直近の除外ウィンドウリスト（tauri State として保持）。
/// フロントの 'catchExcludeWindow' イベント / getExcludeWindows コマンド
/// （後続タスクで実装）がここを参照する。
/// Swift 原本では exclude コマンド（main.swift:1116-1128）が毎回差集合を
/// 再計算していたが、Rust 版は filter_windows の除外リストをそのまま保持する
pub struct ExcludedWindows(pub Mutex<Vec<MacWindow>>);

/// 直近に 'process' で emit したフィルタ通過リスト（アイコン適用前）。
/// EmitPolicy::IfChanged の差分判定に使う。
/// 前提: 'process' を購読するビューは初期化時に windowReady コマンドを呼ぶ
/// （window_ready は Always で emit する）。呼ばない購読者を足すと、
/// IfChanged の抑止で初期データが届かないことがある
struct LastEmitted(Mutex<Option<Vec<MacWindow>>>);

/// refresh_and_emit の直列化用ロック。observer 経由（IfChanged）とコマンド経由
/// （Always）が並行すると、古い取得結果が後から emit され LastEmitted も
/// 巻き戻る順序逆転が起こり得るため、取得から emit までを1本ずつ実行する
static REFRESH_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// refresh_and_emit の 'process' 送信方針
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmitPolicy {
    /// 常に emit する（新規ビューの初期化・フィルタ変更の反映など）
    Always,
    /// フィルタ通過リストが前回 emit と同一なら emit しない（observer 経由の再取得）
    IfChanged,
}

/// NSWorkspace 通知の監視を開始する。lib.rs の setup（メインスレッド）から呼ぶ。
/// `adjust_tx` は overlap.rs の送信端（AX のウィンドウ生成・移動・リサイズ通知の送り先）。
///
/// Swift 原本: observeWindowChanges（main.swift:880-914）
pub fn start_observation(app: AppHandle, adjust_tx: mpsc::UnboundedSender<()>) {
    // 除外リスト保持用の State を登録
    app.manage(ExcludedWindows(Mutex::new(Vec::new())));
    app.manage(LastEmitted(Mutex::new(None)));

    let (tx, rx) = mpsc::unbounded_channel::<()>();

    // ウィンドウ単位の AX 通知（タイトル変化・ウィンドウ増減）も同じチャンネルに流す。
    // 監視対象の pid は通知の登録後に初期列挙し、以降は didLaunch / didActivate / didTerminate で増減させる
    let ax = ax_observer::start(tx.clone(), adjust_tx);
    let workspace = NSWorkspace::sharedWorkspace();

    // 監視対象の通知（main.swift:884-905 と同じ3種）。
    // 2 番目の値は AX observer への指示に変換する通知の種類
    // SAFETY: extern static の参照。AppKit がプロセス起動時に初期化を保証する
    let names: [(&NSNotificationName, AxForward); 3] = unsafe {
        [
            (
                NSWorkspaceDidActivateApplicationNotification,
                AxForward::Activate,
            ),
            (NSWorkspaceDidLaunchApplicationNotification, AxForward::Add),
            (
                NSWorkspaceDidTerminateApplicationNotification,
                AxForward::Terminate,
            ),
        ]
    };

    let center = workspace.notificationCenter();
    for (name, forward) in names {
        let tx = tx.clone();
        let ax = ax.clone();
        // 通知ブロックはシグナル送信のみ（unbounded send は非ブロッキング）。
        // 重い処理（ウィンドウリスト取得）は tokio 側のデバウンスループで行う
        let block = RcBlock::new(move |notification: NonNull<NSNotification>| {
            let _ = tx.send(());
            // SAFETY: 通知ブロックの実行中は notification が有効
            forward_to_ax(&ax, forward, unsafe { notification.as_ref() });
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

    // 起動済みの通常アプリを AX observer に初期登録する。通知の登録後に列挙するので、
    // その間に起動したアプリも didLaunch か列挙のどちらかで拾える（Add は冪等）
    for app in workspace.runningApplications() {
        if app.activationPolicy() == NSApplicationActivationPolicy::Regular {
            ax.send(ax_observer::Command::Add(app.processIdentifier()));
        }
    }

    // TODO(3.4): フィルタ設定変更の監視（Swift 原本 main.swift:907-913 の
    // FiltersChanged 通知に対応）。tauri-plugin-store の変更イベントを購読して
    // 即時 refresh_and_emit する形で後続タスクで実装する

    tauri::async_runtime::spawn(async move {
        // 初回のウィンドウ情報を遅延なしで送信
        // （Swift 原本 main.swift:1161-1162 の watch モード初回出力に対応）
        let _ = refresh_and_emit(&app, EmitPolicy::Always).await;

        let app_for_action = app.clone();
        debounce_loop(rx, DEBOUNCE, Some(MAX_WAIT), move || {
            let app = app_for_action.clone();
            async move {
                let _ = refresh_and_emit(&app, EmitPolicy::IfChanged).await;
            }
        })
        .await;
    });
}

/// NSWorkspace 通知を AX observer への指示に変換する種類
#[derive(Clone, Copy)]
enum AxForward {
    /// didLaunch: 登録する
    Add,
    /// didActivate: 未登録なら登録する（起動が遅く登録を諦めたアプリの再試行を兼ねる）
    Activate,
    /// didTerminate: 解除する
    Terminate,
}

/// NSWorkspace 通知の対象アプリ（userInfo の NSWorkspaceApplicationKey）を
/// AX observer の登録・解除指示として送る。通常アプリ以外は登録しない
fn forward_to_ax(ax: &AxObserverHandle, forward: AxForward, notification: &NSNotification) {
    let Some(app) = notification
        .userInfo()
        // SAFETY: extern static の参照。AppKit がプロセス起動時に初期化を保証する
        .and_then(|info| info.objectForKey(unsafe { NSWorkspaceApplicationKey }))
        .and_then(|obj| obj.downcast::<NSRunningApplication>().ok())
    else {
        return;
    };
    let pid = app.processIdentifier();
    match forward {
        AxForward::Add | AxForward::Activate => {
            if app.activationPolicy() == NSApplicationActivationPolicy::Regular {
                ax.send(ax_observer::Command::Add(pid));
            }
        }
        AxForward::Terminate => ax.send(ax_observer::Command::Remove(pid)),
    }
}

/// trailing デバウンス: 最初のシグナルを受けてから、`delay` の間シグナルが
/// 来なくなるまで待ち、1回だけ action を実行する。チャンネルが閉じたら終了する
/// （閉鎖時にシグナルが溜まっていれば最後の1回を実行してから終了）。
///
/// `max_wait` を指定すると、シグナルが `delay` 未満の間隔で続いても最初の
/// シグナルから `max_wait` 経過した時点で実行する（starvation 防止）。
/// `max_wait` は `delay` 以上を指定する（未満だと実質 `max_wait` がデバウンス時間になる）。
/// `None` なら上限なし（純粋な trailing デバウンス）。
///
/// 時間は tokio の仮想時計に依存するため、テストでは start_paused で検証できる。
/// display_manager のスクリーン構成変更監視からも共用される
pub(crate) async fn debounce_loop<F, Fut>(
    mut rx: UnboundedReceiver<()>,
    delay: Duration,
    max_wait: Option<Duration>,
    mut action: F,
) where
    F: FnMut() -> Fut,
    Fut: Future<Output = ()>,
{
    debug_assert!(max_wait.map_or(true, |m| m >= delay));
    while rx.recv().await.is_some() {
        let deadline = max_wait.map(|m| tokio::time::Instant::now() + m);
        // 最後のシグナルから delay 経過するまで待つ（追加シグナルでリセット）。
        // ただし deadline を越えては待たない
        loop {
            let wait = match deadline {
                Some(d) => delay.min(d.saturating_duration_since(tokio::time::Instant::now())),
                None => delay,
            };
            if wait.is_zero() {
                break; // max_wait 到達 → 実行
            }
            match tokio::time::timeout(wait, rx.recv()).await {
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
/// `policy` が IfChanged で通過リストが前回 emit と同一なら、'process' と
/// アイコンの段階ロードを省く（除外リストの更新は常に行う）。
///
/// Swift 原本: windowDidChange の遅延実行部（main.swift:928-944）＋
/// getWindowInfoListData のフィルタ適用（main.swift:844-848）
pub async fn refresh_and_emit(
    app: &AppHandle,
    policy: EmitPolicy,
) -> Option<(Vec<MacWindow>, Vec<MacWindow>)> {
    let _guard = REFRESH_LOCK.lock().await;

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

            // 除外リストを保持（'catchExcludeWindow' / getExcludeWindows 用）
            if let Some(state) = app.try_state::<ExcludedWindows>() {
                if let Ok(mut guard) = state.0.lock() {
                    guard.clone_from(&excluded);
                }
            }

            // 差分判定はアイコン適用前のリストで行う（appIcon は段階ロードで
            // 後から埋まるため比較対象に含めない）
            let emit = match app.try_state::<LastEmitted>() {
                Some(state) => match state.0.lock() {
                    Ok(mut last) => should_emit(&mut last, &passed, policy),
                    Err(_) => true,
                },
                None => true,
            };

            // FS キャッシュ済みアイコンを appIcon に適用してから emit する
            // （Electron 原本 helper.ts:513-529 applyProcessChange と同じ順序。
            // キャッシュ済みアプリは 'process' の時点でアイコン付きになる）
            icon_manager::apply_cached_icons(&mut passed).await;

            if emit {
                // イベント名 'process' は現行フロントの契約
                // （src/renderer の ipcListen('process', ...) に対応）
                log::debug!("'process' emitted ({policy:?}, {} windows)", passed.len());
                if let Err(e) = app.emit("process", &passed) {
                    log::warn!("failed to emit 'process' event: {e}");
                    // 未配信のまま次回の IfChanged で抑止されないよう記録を消す
                    if let Some(state) = app.try_state::<LastEmitted>() {
                        if let Ok(mut last) = state.0.lock() {
                            *last = None;
                        }
                    }
                }
            } else {
                log::debug!("'process' suppressed (no change)");
            }

            // キャッシュミス分のアイコンを非同期で取得して 'iconUpdate' で後追い送信
            // （段階ロード。Swift 原本 ProgressiveIconLoader の簡素化版 —
            // 判断コメントは icon_manager.rs 冒頭参照）。
            // 'process' を抑止した回も呼ぶ: 取得に失敗したアイコンの再試行を
            // ウィンドウ構成が変わるまで止めないため（従来の再試行タイミングを維持）
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

/// 'process' を emit すべきか判定し、emit する場合は `last` を `current` で更新する。
/// Always は常に true、IfChanged は前回と異なる（または前回が無い）ときのみ true
fn should_emit(
    last: &mut Option<Vec<MacWindow>>,
    current: &[MacWindow],
    policy: EmitPolicy,
) -> bool {
    if policy == EmitPolicy::IfChanged && last.as_deref() == Some(current) {
        return false;
    }
    *last = Some(current.to_vec());
    true
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
        spawn_counting_loop_with(rx, None)
    }

    /// max_wait 付きの debounce_loop を起動する
    fn spawn_counting_loop_with(
        rx: UnboundedReceiver<()>,
        max_wait: Option<Duration>,
    ) -> (Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
        let count = Arc::new(AtomicUsize::new(0));
        let c = Arc::clone(&count);
        let handle = tokio::spawn(debounce_loop(rx, DEBOUNCE, max_wait, move || {
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

    #[tokio::test(start_paused = true)]
    async fn シグナルが途切れなくても_max_wait_ごとに実行される() {
        let (tx, rx) = mpsc::unbounded_channel();
        let (count, handle) = spawn_counting_loop_with(rx, Some(MAX_WAIT));

        // 300ms 間隔（DEBOUNCE 未満）でシグナルを 5 秒間送り続ける
        for _ in 0..17 {
            tx.send(()).unwrap();
            sleep(Duration::from_millis(300)).await;
        }
        // 純 trailing デバウンスなら 0 回のまま。max_wait=1s なら約1秒ごとに実行される
        // 仮想時計で決定論的: t=1000/2200/3400/4600ms の4回
        // （実行後の次シグナルから新しい max_wait 窓が始まる）
        assert_eq!(count.load(Ordering::SeqCst), 4);

        drop(tx);
        handle.await.unwrap();
    }

    #[tokio::test(start_paused = true)]
    async fn max_wait_なしでは途切れないシグナルの間は実行されない() {
        let (tx, rx) = mpsc::unbounded_channel();
        let (count, handle) = spawn_counting_loop(rx);

        for _ in 0..10 {
            tx.send(()).unwrap();
            sleep(Duration::from_millis(300)).await;
        }
        assert_eq!(
            count.load(Ordering::SeqCst),
            0,
            "display_manager 用の現挙動を維持"
        );

        sleep(Duration::from_millis(300)).await;
        assert_eq!(count.load(Ordering::SeqCst), 1, "静穏になれば1回実行");

        drop(tx);
        handle.await.unwrap();
    }

    #[tokio::test(start_paused = true)]
    async fn max_wait_より早く静穏になればデバウンス時間で実行される() {
        let (tx, rx) = mpsc::unbounded_channel();
        let (count, handle) = spawn_counting_loop_with(rx, Some(MAX_WAIT));

        tx.send(()).unwrap();
        sleep(Duration::from_millis(450)).await;
        assert_eq!(count.load(Ordering::SeqCst), 0);
        sleep(Duration::from_millis(100)).await;
        assert_eq!(count.load(Ordering::SeqCst), 1, "500ms 静穏で実行される");

        drop(tx);
        handle.await.unwrap();
    }

    fn window(number: i64, name: &str) -> MacWindow {
        MacWindow {
            layer: 0,
            name: Some(name.to_string()),
            memory_usage: 0,
            is_onscreen: Some(1),
            sharing_state: 1,
            owner_pid: 100,
            owner_name: "App".to_string(),
            window_number: number,
            store_type: None,
            bounds: crate::window_manager::WindowBounds {
                x: 0.0,
                y: 0.0,
                width: 800.0,
                height: 600.0,
            },
            app_icon: String::new(),
        }
    }

    #[test]
    fn 初回は_if_changed_でも_emit_する() {
        let mut last = None;
        assert!(should_emit(
            &mut last,
            &[window(1, "a")],
            EmitPolicy::IfChanged
        ));
        assert_eq!(last, Some(vec![window(1, "a")]));
    }

    #[test]
    fn 同一リストなら_if_changed_は_emit_しない() {
        let mut last = Some(vec![window(1, "a")]);
        assert!(!should_emit(
            &mut last,
            &[window(1, "a")],
            EmitPolicy::IfChanged
        ));
    }

    #[test]
    fn タイトルが変われば_emit_して記録を更新する() {
        let mut last = Some(vec![window(1, "a")]);
        assert!(should_emit(
            &mut last,
            &[window(1, "b")],
            EmitPolicy::IfChanged
        ));
        assert_eq!(last, Some(vec![window(1, "b")]));
    }

    #[test]
    fn ウィンドウの増減で_emit_する() {
        let mut last = Some(vec![window(1, "a")]);
        let added = [window(1, "a"), window(2, "b")];
        assert!(should_emit(&mut last, &added, EmitPolicy::IfChanged));
        assert!(should_emit(
            &mut last,
            &[window(2, "b")],
            EmitPolicy::IfChanged
        ));
    }

    #[test]
    fn always_は同一リストでも_emit_する() {
        let mut last = Some(vec![window(1, "a")]);
        assert!(should_emit(
            &mut last,
            &[window(1, "a")],
            EmitPolicy::Always
        ));
    }

    #[test]
    fn always_の_emit_は記録を更新し後続の_if_changed_を抑止する() {
        let mut last = Some(vec![window(1, "a")]);
        assert!(should_emit(
            &mut last,
            &[window(1, "b")],
            EmitPolicy::Always
        ));
        assert_eq!(last, Some(vec![window(1, "b")]));
        assert!(!should_emit(
            &mut last,
            &[window(1, "b")],
            EmitPolicy::IfChanged
        ));
    }
}
