//! タスク右クリックのネイティブコンテキストメニュー
//!
//! Electron 原本: src/main/funcs/events.ts:211-266（contextTask）＋
//! moveAreaMenu / deleteFromAreaMenu / updateOptions（events.ts:270-308）。
//! メニュー項目は原本と同じ4つ:
//! 1. 先頭へ追加 / 先頭から削除（options.headers トグル）
//! 2. 末尾へ追加 / 末尾から削除（options.footers トグル）
//! 3. 閉じる（activate → close）
//! 4. 強制終了（SIGTERM。原本の process.kill(pid) と同じシグナル）
//!
//! スレッド設計メモ:
//! - tauri のメニュー API は内部で `run_item_main_thread!`（main thread へ
//!   ディスパッチして rx.recv() で待つ）を使うが、macOS の popup
//!   （muda の show_context_menu_for_nsview → NSMenu トラッキングループ）は
//!   メニューが閉じるまでブロックする。呼び出し元スレッドを塞がないよう、
//!   コマンドからは `run_on_main_thread` で構築〜popup を丸ごと main thread に
//!   投げて即 return する（tauri-runtime-wry は main thread 上からの呼び出しを
//!   直接実行するためデッドロックしない。tauri-runtime-wry 2.11 の
//!   send_user_message 実装で確認済み）。
//! - `AppHandle::on_menu_event` は登録がグローバルな Vec への追記
//!   （tauri 2.11 manager/menu.rs:97-103）で、popup のたびに登録すると
//!   ハンドラが増殖する。lib.rs の setup で1回だけ登録し、対象ウィンドウは
//!   managed state（`ContextTaskTarget`）経由で受け渡す。

use std::sync::Mutex;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::{AppHandle, Emitter, Manager};

use crate::store::{self, Options};
use crate::window_actions;
use crate::window_manager::MacWindow;

/// メニュー項目 ID。on_menu_event はアプリ全体で共有されるため、
/// 他のメニューと衝突しないよう接頭辞を付ける
pub const MENU_ID_HEADERS: &str = "context-task-headers";
pub const MENU_ID_FOOTERS: &str = "context-task-footers";
pub const MENU_ID_CLOSE: &str = "context-task-close";
pub const MENU_ID_KILL: &str = "context-task-kill";

/// 直近に右クリックされたウィンドウ（メニュー表示 → 項目選択の間だけ有効）。
/// lib.rs の setup で `app.manage()` する
#[derive(Default)]
pub struct ContextTaskTarget(pub Mutex<Option<MacWindow>>);

/// headers / footers のトグル対象エリア
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Area {
    Headers,
    Footers,
}

/// エリアトグルの純関数（Electron 原本 events.ts:270-293 moveAreaMenu の click ＋
/// deleteFromAreaMenu:301-308）:
/// - 対象エリアに owner が無ければ末尾へ追加し、反対エリアに居れば先頭の1件を削除
/// - 対象エリアに owner が有れば先頭の1件を削除（原本の indexOf + splice(pos, 1) と同じ）
pub fn toggle_area(options: &mut Options, owner: &str, area: Area) {
    let Options {
        headers, footers, ..
    } = options;
    let (target, opposite) = match area {
        Area::Headers => (headers, footers),
        Area::Footers => (footers, headers),
    };
    match target.iter().position(|name| name == owner) {
        None => {
            target.push(owner.to_string());
            // 先頭に追加している状態で末尾に追加する場合は先頭から削除（逆も同様）
            if let Some(pos) = opposite.iter().position(|name| name == owner) {
                opposite.remove(pos);
            }
        }
        Some(pos) => {
            target.remove(pos);
        }
    }
}

/// メニュー項目のラベル（原本 events.ts:294 の position < 0 ? へ追加 : から削除）
pub fn item_label(options: &Options, owner: &str, area: Area) -> &'static str {
    let (list, add, remove) = match area {
        Area::Headers => (&options.headers, "先頭へ追加", "先頭から削除"),
        Area::Footers => (&options.footers, "末尾へ追加", "末尾から削除"),
    };
    if list.iter().any(|name| name == owner) {
        remove
    } else {
        add
    }
}

/// コンテキストメニューを表示する（commands::context_task から呼ばれる）。
/// メニュー構築と popup を main thread に投げ、即座に return する
pub fn show(app: &AppHandle, window: tauri::WebviewWindow, win: MacWindow) -> Result<(), String> {
    let app_for_task = app.clone();
    app.run_on_main_thread(move || {
        if let Err(e) = show_on_main_thread(&app_for_task, &window, win) {
            log::error!("context_task メニューの表示に失敗: {e}");
        }
    })
    .map_err(|e| format!("failed to dispatch context menu to main thread: {e}"))
}

/// main thread 上でのメニュー構築＋popup（popup はメニューが閉じるまでブロックする）
fn show_on_main_thread(
    app: &AppHandle,
    window: &tauri::WebviewWindow,
    win: MacWindow,
) -> Result<(), String> {
    let options = store::get_options(app)?;
    let owner = &win.owner_name;

    let headers_item =
        MenuItemBuilder::with_id(MENU_ID_HEADERS, item_label(&options, owner, Area::Headers))
            .build(app)
            .map_err(|e| e.to_string())?;
    let footers_item =
        MenuItemBuilder::with_id(MENU_ID_FOOTERS, item_label(&options, owner, Area::Footers))
            .build(app)
            .map_err(|e| e.to_string())?;
    let close_item = MenuItemBuilder::with_id(MENU_ID_CLOSE, "閉じる")
        .build(app)
        .map_err(|e| e.to_string())?;
    let kill_item = MenuItemBuilder::with_id(MENU_ID_KILL, "強制終了")
        .build(app)
        .map_err(|e| e.to_string())?;

    let menu = MenuBuilder::new(app)
        .items(&[&headers_item, &footers_item, &close_item, &kill_item])
        .build()
        .map_err(|e| e.to_string())?;

    // 項目選択時に on_menu_event ハンドラが参照する対象を popup 前に保存する
    *app.state::<ContextTaskTarget>()
        .0
        .lock()
        .map_err(|_| "ContextTaskTarget mutex poisoned".to_string())? = Some(win);

    // 位置指定なしの popup はカーソル位置に表示される
    // （原本 events.ts:236-265 の Screen.getCursorScreenPoint ベース popup に対応）
    window.popup_menu(&menu).map_err(|e| e.to_string())
}

/// メニューイベントハンドラ（lib.rs の setup で1回だけ登録する）。
/// contextTask 以外のメニュー ID は無視する
pub fn handle_menu_event(app: &AppHandle, event: &tauri::menu::MenuEvent) {
    let id = event.id().0.as_str();
    if !matches!(
        id,
        MENU_ID_HEADERS | MENU_ID_FOOTERS | MENU_ID_CLOSE | MENU_ID_KILL
    ) {
        return;
    }

    let target = match app.state::<ContextTaskTarget>().0.lock() {
        Ok(guard) => guard.clone(),
        Err(_) => {
            log::warn!("ContextTaskTarget mutex poisoned");
            return;
        }
    };
    let Some(win) = target else {
        log::warn!("context_task menu event without target window: {id}");
        return;
    };

    match id {
        MENU_ID_HEADERS => toggle_and_notify(app, &win.owner_name, Area::Headers),
        MENU_ID_FOOTERS => toggle_and_notify(app, &win.owner_name, Area::Footers),
        MENU_ID_CLOSE => {
            // 原本（events.ts:216-223）: activateWindow → closeWindow の順に実行
            tauri::async_runtime::spawn(async move {
                if let Err(e) = window_actions::activate(win.clone()).await {
                    log::warn!("context_task 閉じる: activate 失敗（close は続行）: {e}");
                }
                if let Err(e) = window_actions::close(win).await {
                    log::warn!("context_task 閉じる: close 失敗: {e}");
                }
            });
        }
        MENU_ID_KILL => {
            if let Err(e) = force_terminate(&win) {
                log::warn!("context_task 強制終了に失敗: {e}");
            }
        }
        _ => unreachable!("guarded above"),
    }
}

/// headers/footers をトグルして保存し、全ウィンドウへ 'updateOptions' を emit する
/// （commands::set_options と同じ保存＋emit パターン。layout は変わらないため
/// 再配置は不要）
fn toggle_and_notify(app: &AppHandle, owner: &str, area: Area) {
    let result = (|| -> Result<(), String> {
        let mut options = store::get_options(app)?;
        toggle_area(&mut options, owner, area);
        store::set_options(app, &options)?;
        app.emit("updateOptions", &options)
            .map_err(|e| format!("failed to emit 'updateOptions': {e}"))
    })();
    if let Err(e) = result {
        log::warn!("context_task {area:?} トグルに失敗: {e}");
    }
}

/// 対象ウィンドウの所有プロセスへ SIGTERM を送る（原本の process.kill(pid)）。
/// pid <= 0 は kill(2) がプロセスグループ宛てになるため拒否する
fn force_terminate(win: &MacWindow) -> Result<(), String> {
    let pid = libc::pid_t::try_from(win.owner_pid)
        .ok()
        .filter(|pid| *pid > 0)
        .ok_or_else(|| format!("invalid pid: {} ({})", win.owner_pid, win.owner_name))?;
    // SAFETY: pid > 0 を保証済み。存在しない pid でも ESRCH が返るだけで安全
    let ret = unsafe { libc::kill(pid, libc::SIGTERM) };
    if ret == 0 {
        Ok(())
    } else {
        Err(format!(
            "kill({pid}, SIGTERM) failed: {}",
            std::io::Error::last_os_error()
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::window_manager::WindowBounds;

    fn options_with(headers: &[&str], footers: &[&str]) -> Options {
        Options {
            headers: headers.iter().map(|s| s.to_string()).collect(),
            footers: footers.iter().map(|s| s.to_string()).collect(),
            ..Options::default()
        }
    }

    #[test]
    fn 未登録のownerはheadersの末尾へ追加される() {
        let mut options = options_with(&["Finder"], &[]);
        toggle_area(&mut options, "Safari", Area::Headers);
        assert_eq!(options.headers, vec!["Finder", "Safari"]);
        assert!(options.footers.is_empty());
    }

    #[test]
    fn 登録済みのownerはheadersから削除される() {
        let mut options = options_with(&["Finder", "Safari"], &[]);
        toggle_area(&mut options, "Finder", Area::Headers);
        assert_eq!(options.headers, vec!["Safari"]);
    }

    #[test]
    fn footersに居るownerをheadersへ追加するとfootersから消える() {
        // 原本コメント「先頭に追加している状態で末尾に追加する場合は先頭から削除（逆も同様）」
        let mut options = options_with(&[], &["Safari", "Terminal"]);
        toggle_area(&mut options, "Safari", Area::Headers);
        assert_eq!(options.headers, vec!["Safari"]);
        assert_eq!(options.footers, vec!["Terminal"]);
    }

    #[test]
    fn headersに居るownerをfootersへ追加するとheadersから消える() {
        let mut options = options_with(&["Safari"], &[]);
        toggle_area(&mut options, "Safari", Area::Footers);
        assert!(options.headers.is_empty());
        assert_eq!(options.footers, vec!["Safari"]);
    }

    #[test]
    fn footersのトグルも追加と削除が対称である() {
        let mut options = options_with(&[], &[]);
        toggle_area(&mut options, "Safari", Area::Footers);
        assert_eq!(options.footers, vec!["Safari"]);
        toggle_area(&mut options, "Safari", Area::Footers);
        assert!(options.footers.is_empty());
    }

    #[test]
    fn 重複登録があっても削除は先頭の1件のみ() {
        // 原本の indexOf + splice(pos, 1) と同じ挙動
        let mut options = options_with(&["Safari", "Safari"], &[]);
        toggle_area(&mut options, "Safari", Area::Headers);
        assert_eq!(options.headers, vec!["Safari"]);
    }

    #[test]
    fn ラベルは登録状態に応じて追加と削除が切り替わる() {
        let options = options_with(&["Finder"], &["Safari"]);
        assert_eq!(
            item_label(&options, "Finder", Area::Headers),
            "先頭から削除"
        );
        assert_eq!(item_label(&options, "Safari", Area::Headers), "先頭へ追加");
        assert_eq!(
            item_label(&options, "Safari", Area::Footers),
            "末尾から削除"
        );
        assert_eq!(item_label(&options, "Finder", Area::Footers), "末尾へ追加");
    }

    fn make_window(pid: i64) -> MacWindow {
        MacWindow {
            layer: 0,
            name: None,
            memory_usage: 0,
            is_onscreen: Some(1),
            sharing_state: 1,
            owner_pid: pid,
            owner_name: "TestApp".to_string(),
            window_number: 1,
            store_type: Some(1),
            bounds: WindowBounds {
                x: 0.0,
                y: 0.0,
                width: 100.0,
                height: 100.0,
            },
            app_icon: String::new(),
        }
    }

    #[test]
    fn 強制終了は不正なpidを拒否する() {
        // pid 0 はプロセスグループ宛て、負値もグループ宛てになるため拒否する
        assert!(force_terminate(&make_window(0)).is_err());
        assert!(force_terminate(&make_window(-1)).is_err());
        assert!(force_terminate(&make_window(i64::MAX)).is_err());
    }

    #[test]
    fn 存在しないpidへの強制終了はesrchエラーになる() {
        // pid_max 相当の存在しないプロセス（macOS の pid 上限は 99998）
        let result = force_terminate(&make_window(0x7FFF_FFF0));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("SIGTERM"));
    }
}
