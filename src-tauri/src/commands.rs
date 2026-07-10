//! Tauri Commands（IPC ハンドラー）
//!
//! 計画書: docs/plans/rearch-phase3.md 3.2 節（＋鮮度更新節の20チャンネル一覧）
//! 意味論の原本: src/main/funcs/events.ts（各コマンドに該当行を注記）
//!
//! Electron チャンネル名 → Tauri command 名の対応（snake_case 化）:
//!
//! | Electron チャンネル   | Tauri command          |
//! |-----------------------|------------------------|
//! | windowReady           | window_ready           |
//! | setOptions            | set_options            |
//! | getLabeledFilters     | get_labeled_filters    |
//! | setLabeledFilters     | set_labeled_filters    |
//! | addFilter             | add_filter             |
//! | getExcludeWindows     | get_exclude_windows    |
//! | activeWindow          | active_window          |
//! | closeWindow           | close_window           |
//! | grantPermission       | grant_permission       |
//! | checkPermissions      | check_permissions      |
//! | openSystemPreferences | open_system_preferences|
//! | contextLogo           | context_logo           |
//! | contextTask           | context_task           |
//! | openOption            | open_option            |
//! | openFullWindowList    | open_full_window_list  |
//! | closeMenu             | close_menu             |
//! | restart               | restart                |
//! | exit                  | exit                   |
//! | restartHelper         | restart_helper         |
//! | clearSetting          | clear_setting          |
//! | dumpTaskbarInfo       | dump_taskbar_info      |

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::filter::{Filter, LabeledFilters};
use crate::permission_manager;
use crate::store::{self, Options};
use crate::window_actions;
use crate::window_manager::{self, MacWindow};
use crate::window_observer;

// ---------------------------------------------------------------------------
// ウィンドウリスト
// ---------------------------------------------------------------------------

/// ウィンドウ一覧を返す（window_manager::get_window_list の薄いラッパー）
#[tauri::command]
pub async fn get_windows() -> Result<Vec<MacWindow>, String> {
    window_manager::get_window_list().await
}

// ---------------------------------------------------------------------------
// 初期化プロトコル
// ---------------------------------------------------------------------------

/// 'displayInfo' イベントの形。Electron 原本（windows.ts:105-109）の
/// { label, id, workArea } に対応する。id は Tauri の Monitor に安定した数値 ID が
/// 無いため省略（フロントは workArea のみ参照: src/renderer/src/pages/index.vue:127-129）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub label: String,
    pub work_area: WorkArea,
}

/// Electron の display.workArea（DIP 座標）に一致する形
#[derive(Debug, Clone, Serialize)]
pub struct WorkArea {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// レンダラー準備完了通知。初期データ一式を emit する。
///
/// Electron 原本: events.ts:68-76（windowReady）＋ windows.ts:102-112
/// （windowReady リスナーが displayInfo を send）。
/// 原本の macWindowProcesses クリア（events.ts:72）は差分検知の
/// リセットが目的だが、Rust 版は毎回全量 emit なので不要。
#[tauri::command]
pub async fn window_ready(app: AppHandle) -> Result<(), String> {
    // 1. 'process': observer の refresh_and_emit 相当を即時1回
    let _ = window_observer::refresh_and_emit(&app).await;

    // 2. 'updateOptions': store の options を送る
    let options = store::get_options(&app)?;
    app.emit("updateOptions", &options)
        .map_err(|e| format!("failed to emit 'updateOptions': {e}"))?;

    // 3. 'displayInfo': 暫定でメインモニタの情報を送る。
    // TODO(3.3 マルチディスプレイ対応): Electron 原本はタスクバーごとに
    // 「そのウィンドウが属するディスプレイ」の workArea を送っていた
    // （windows.ts:102-112）。各ディスプレイへの WebviewWindow 動的生成と
    // あわせて 3.3 で置き換える
    let info = primary_display_info(&app)?;
    app.emit("displayInfo", &info)
        .map_err(|e| format!("failed to emit 'displayInfo': {e}"))?;

    // TODO(3.3 icon_manager.rs): 'iconUpdate'（アイコンキャッシュの初期送信）。
    // Electron 原本では helper の iconUpdate 通知（helper.ts:32-56）が担っていた

    Ok(())
}

/// メインモニタの workArea を Electron の DIP 座標系（論理ピクセル）で組む
fn primary_display_info(app: &AppHandle) -> Result<DisplayInfo, String> {
    let monitor = app
        .primary_monitor()
        .map_err(|e| format!("failed to get primary monitor: {e}"))?
        .ok_or_else(|| "no primary monitor found".to_string())?;

    // Tauri の Monitor は物理ピクセル。Electron の workArea は DIP（論理）なので変換する
    let scale = monitor.scale_factor();
    let position = monitor.work_area().position.to_logical::<f64>(scale);
    let size = monitor.work_area().size.to_logical::<f64>(scale);

    Ok(DisplayInfo {
        label: monitor.name().cloned().unwrap_or_default(),
        work_area: WorkArea {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        },
    })
}

// ---------------------------------------------------------------------------
// 設定（options / labeledFilters）
// ---------------------------------------------------------------------------

/// 設定を保存し、全ウィンドウへ 'updateOptions' を emit する。
///
/// Electron 原本: events.ts:78-97（setOptions）
#[tauri::command]
pub fn set_options(app: AppHandle, options: Options) -> Result<(), String> {
    store::set_options(&app, &options)?;

    // app.emit は全ウィンドウへブロードキャスト（原本の taskbars 全走査 send に対応）
    app.emit("updateOptions", &options)
        .map_err(|e| format!("failed to emit 'updateOptions': {e}"))?;

    // TODO(3.3 マルチディスプレイ対応): layout 変更時のタスクバーウィンドウの
    // 位置・サイズ再計算（events.ts:87-95 の setBounds(windowPosition(...)) 相当）。
    // タスクバーウィンドウの動的生成とあわせて 3.3 で実装する
    Ok(())
}

/// フィルター設定の取得。
///
/// Electron 原本: events.ts:138-140（getLabeledFilters）
#[tauri::command]
pub fn get_labeled_filters(app: AppHandle) -> Result<Vec<LabeledFilters>, String> {
    store::get_labeled_filters(&app)
}

/// フィルター設定の保存＋observer 再評価＋'labeledFiltersUpdated' emit。
///
/// Electron 原本: events.ts:133-135（setLabeledFilters）は保存のみだったが、
/// Rust 版はフィルタ変更を即座にタスクバーへ反映する（Swift 原本の
/// FiltersChanged 通知 → 再取得の流れを Tauri コマンド側に寄せた形）
#[tauri::command]
pub async fn set_labeled_filters(
    app: AppHandle,
    filters: Vec<LabeledFilters>,
) -> Result<(), String> {
    store::set_labeled_filters(&app, &filters)?;

    // 新しいフィルタでウィンドウリストを再評価して 'process' を emit
    let _ = window_observer::refresh_and_emit(&app).await;

    app.emit("labeledFiltersUpdated", &filters)
        .map_err(|e| format!("failed to emit 'labeledFiltersUpdated': {e}"))
}

/// addFilter の引数。Electron 原本の data: { filter, label }（events.ts:143）と同形
#[derive(Debug, Clone, Deserialize)]
pub struct AddFilterPayload {
    pub filter: Filter,
    pub label: String,
}

/// 新しいフィルターグループを追加（labeledFilters に追記→保存→emit）。
///
/// Electron 原本: events.ts:143-160（addFilter）。
/// 原本どおり既存ラベルとの重複はマージせず末尾に追記する
#[tauri::command]
pub fn add_filter(app: AppHandle, payload: AddFilterPayload) -> Result<(), String> {
    let current = store::get_labeled_filters(&app)?;
    let updated = store::push_filter_group(current, payload.label, payload.filter);
    store::set_labeled_filters(&app, &updated)?;

    // 原本はオプションウィンドウ群に send していた（events.ts:151-159）。
    // Tauri 版は全ウィンドウへブロードキャスト（リスナーがいる画面だけが反応する）
    app.emit("labeledFiltersUpdated", &updated)
        .map_err(|e| format!("failed to emit 'labeledFiltersUpdated': {e}"))
}

/// 除外プロセスの取得。ウィンドウリストを再取得・フィルタし、
/// 除外リストを 'catchExcludeWindow'、通過リストを 'allProcesses' で emit する。
///
/// Electron 原本: events.ts:163-184（getExcludeWindows。helper の exclude
/// コマンドを毎回起動して再計算していたのに合わせ、Rust 版も都度リフレッシュする。
/// 結果は window_observer の ExcludedWindows State にも保持される）。
/// 'allProcesses' は原本では applyProcessChange（helper.ts:539-541）が
/// fullWindowList ウィンドウに送っていたフィルタ通過済みリスト。
///
/// TODO(3.3 icon_manager.rs): 原本の除外プロセスへのアイコン付与
/// （events.ts:169-180）。現状 appIcon は常に空文字
#[tauri::command]
pub async fn get_exclude_windows(app: AppHandle) -> Result<(), String> {
    let Some((passed, excluded)) = window_observer::refresh_and_emit(&app).await else {
        return Err("failed to refresh window list".to_string());
    };

    app.emit("catchExcludeWindow", &excluded)
        .map_err(|e| format!("failed to emit 'catchExcludeWindow': {e}"))?;
    app.emit("allProcesses", &passed)
        .map_err(|e| format!("failed to emit 'allProcesses': {e}"))
}

// ---------------------------------------------------------------------------
// ウィンドウ操作
// ---------------------------------------------------------------------------

/// ウィンドウのアクティブ化。
///
/// Electron 原本: events.ts:54-56 → helper.ts:551-573（AppleScript 実行）。
/// Rust 版は window_actions.rs の AXUIElement 実装に委譲する
#[tauri::command]
pub async fn active_window(win: MacWindow) -> Result<(), String> {
    window_actions::activate(win).await
}

/// ウィンドウのクローズ。
///
/// Electron 原本: contextTask メニューの「閉じる」（events.ts:216-223）→
/// helper.ts:576-616（AppleScript 実行）。
/// Rust 版は window_actions.rs の AXCloseButton + AXPress 実装に委譲する
#[tauri::command]
pub async fn close_window(win: MacWindow) -> Result<(), String> {
    window_actions::close(win).await
}

// ---------------------------------------------------------------------------
// 権限
// ---------------------------------------------------------------------------

/// checkPermissions の戻り値。Electron 原本（helper.ts:428-431）と同形
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub accessibility: bool,
    pub screen_recording: bool,
}

/// 権限のリクエスト（未許可なら OS のダイアログ表示＋システム設定への登録）。
///
/// Electron 原本: events.ts:99-102（grantPermission。helper の grant コマンド起動
/// ＝スクリーン収録のみ）。Rust 版はアクセシビリティも合わせて要求する
/// （原本ではヘルパー側の osascript 実行時に OS が自動プロンプトしていたが、
/// Tauri 版は AX API 直叩きのため明示リクエストが必要）。
/// 原本の store.set('granted', true)（events.ts:101）は、granted キーが
/// どこからも読まれていない書き込み専用キーだったため移植しない
#[tauri::command]
pub fn grant_permission() {
    let screen_recording = permission_manager::request_screen_recording();
    let accessibility = permission_manager::request_accessibility();
    log::info!(
        "grant_permission: screenRecording={screen_recording} accessibility={accessibility}"
    );
}

/// 権限状態の確認。
///
/// Electron 原本: events.ts:104-106 → helper.ts:428-480（check-permissions
/// コマンドの JSON から accessibility / screenRecording を取り出して返す）。
/// フロント（PermissionStatus.vue:61-65 / MainPermissionStatus.vue:46-53）は
/// { accessibility, screenRecording } の bool 2キーを参照する
#[tauri::command]
pub fn check_permissions() -> PermissionStatus {
    PermissionStatus {
        accessibility: permission_manager::check_accessibility(),
        screen_recording: permission_manager::check_screen_recording(),
    }
}

/// システム環境設定（画面収録のプライバシー設定）を開く。
///
/// Electron 原本: events.ts:108-113（shell.openExternal で
/// x-apple.systempreferences:...Privacy_ScreenCapture を開く）。
/// Rust 版はこの1箇所のために tauri-plugin-opener を足さず、
/// macOS 標準の /usr/bin/open コマンドで同じ URL を開く
#[tauri::command]
pub fn open_system_preferences() -> Result<(), String> {
    const URL: &str =
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
    std::process::Command::new("open")
        .arg(URL)
        .spawn()
        .map_err(|e| format!("failed to open system preferences: {e}"))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// ウィンドウ生成系
// ---------------------------------------------------------------------------

/// メニューウィンドウのラベル・サイズ（optionWindows.ts:64-66）
const MENU_LABEL: &str = "menu";
const MENU_WIDTH: f64 = 300.0;
const MENU_HEIGHT: f64 = 260.0;

/// 設定ウィンドウのラベル
const OPTION_LABEL: &str = "option";

/// 全ウィンドウリストのラベル・サイズ（optionWindows.ts:38-41）
const FULL_WINDOW_LIST_LABEL: &str = "fullWindowList";
const FULL_WINDOW_LIST_WIDTH: f64 = 1400.0;
const FULL_WINDOW_LIST_HEIGHT: f64 = 900.0;

/// 設定ウィンドウを開く（既存ラベルがあればフォーカス）。
///
/// Electron 原本: events.ts:57-59 → optionWindows.ts:8-28（createOptionWindow）
#[tauri::command]
pub fn open_option(app: AppHandle) -> Result<(), String> {
    // すでに開いているならそれをアクティブにする（optionWindows.ts:10-13）
    if let Some(window) = app.get_webview_window(OPTION_LABEL) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, OPTION_LABEL, WebviewUrl::App("/?view=option".into()))
        .title("taskbar.fm")
        .build()
        .map_err(|e| format!("failed to create option window: {e}"))?;
    Ok(())
}

/// 全ウィンドウリスト（フィルター作成用の補助画面）を開く。
///
/// Electron 原本: events.ts:60-62 → optionWindows.ts:32-61
/// （createFullWindowListWindow）。原本の ready-to-show 後の
/// updateProcessList は、フロント側の windowReady / getExcludeWindows
/// 呼び出しで代替される（3.4 で配線）
#[tauri::command]
pub fn open_full_window_list(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(FULL_WINDOW_LIST_LABEL) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(
        &app,
        FULL_WINDOW_LIST_LABEL,
        WebviewUrl::App("/?view=fullWindowList".into()),
    )
    .title("Taskbar.fm - ウィンドウ一覧")
    .inner_size(FULL_WINDOW_LIST_WIDTH, FULL_WINDOW_LIST_HEIGHT)
    .build()
    .map_err(|e| format!("failed to create fullWindowList window: {e}"))?;
    Ok(())
}

/// ロゴクリック時のメニューウィンドウ表示。
///
/// Electron 原本: events.ts:187-200（contextLogo。送信元タスクバーの bounds と
/// layout からメニュー位置を計算）→ optionWindows.ts:111-171（createMenuWindow）
///
/// TODO(3.4 マルチウィンドウ結合): タスクバー位置・layout に応じた配置
/// （optionWindows.ts:123-160）と blur 時の自動クローズ。暫定で固定位置に生成する
#[tauri::command]
pub fn context_logo(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MENU_LABEL) {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, MENU_LABEL, WebviewUrl::App("/?view=menu".into()))
        .title("Taskbar.fm - メニュー")
        .inner_size(MENU_WIDTH, MENU_HEIGHT)
        .position(100.0, 100.0) // TODO(3.4): 暫定の固定位置
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| format!("failed to create menu window: {e}"))?;
    Ok(())
}

/// タスク右クリック時のコンテキストメニュー。
///
/// Electron 原本: events.ts:211-266（contextTask。ネイティブ Menu で
/// 先頭へ追加/末尾へ追加/閉じる/強制終了を表示）
///
/// TODO(3.4 マルチウィンドウ結合): Tauri の Menu API（またはフロント実装の
/// コンテキストメニュー）で移植する。現状はログのみのスタブ
#[tauri::command]
pub fn context_task(win: MacWindow) {
    log::info!(
        "context_task called (stub): {} ({}) TODO(3.4)",
        win.owner_name,
        win.window_number
    );
}

/// メニューウィンドウを閉じる。
///
/// Electron 原本: events.ts:203-205 → optionWindows.ts:103-108
/// （原本は hide だが、Tauri 版は context_logo が都度生成するため close する）
#[tauri::command]
pub fn close_menu(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MENU_LABEL) {
        window
            .close()
            .map_err(|e| format!("failed to close menu window: {e}"))?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// アプリライフサイクル
// ---------------------------------------------------------------------------

/// アプリを再起動する。
///
/// Electron 原本: events.ts:119-122（App.relaunch() + App.quit()）
#[tauri::command]
pub fn restart(app: AppHandle) {
    app.restart()
}

/// アプリを終了する。
///
/// Electron 原本: events.ts:123-125（App.quit()）
#[tauri::command]
pub fn exit(app: AppHandle) {
    app.exit(0)
}

/// Helper プロセスの再起動。Tauri 版は helper プロセス自体が存在しないため no-op。
///
/// Electron 原本: events.ts:127-130（recreateAllWindows + scheduleHelperRestart）
///
/// TODO(3.5): フロント側の restartHelper 導線（メニュー等）ごと整理して削除する
#[tauri::command]
pub fn restart_helper(delay: Option<u64>) {
    log::info!("restart_helper called: no-op on Tauri (delay={delay:?}). TODO(3.5) remove");
}

/// 設定を全消去して再起動する。
///
/// Electron 原本: events.ts:114-118（store.clear() + relaunch + quit）
#[tauri::command]
pub fn clear_setting(app: AppHandle) -> Result<(), String> {
    store::clear(&app)?;
    app.restart()
}

/// タスクバーの状態をログにダンプする（開発用）。
///
/// Electron 原本: events.ts:28-46, 64-66（dumpTaskbarInfo。taskbars /
/// BrowserWindow 一覧 / ディスプレイ一覧を console.log）
#[tauri::command]
pub fn dump_taskbar_info(app: AppHandle) {
    let labels: Vec<String> = app.webview_windows().keys().cloned().collect();
    let monitors = app
        .available_monitors()
        .map(|monitors| {
            monitors
                .iter()
                .map(|m| m.name().cloned().unwrap_or_default())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    log::info!("dump_taskbar_info: windows={labels:?} monitors={monitors:?}");
}
