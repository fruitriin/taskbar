//! ウィンドウ操作（AXUIElement によるアクティブ化・クローズ）
//!
//! Electron 原本: src/main/funcs/helper.ts:551-573（activateWindow）/
//! helper.ts:575-616（closeWindow）。原本は osascript（System Events）経由で
//! - activate: `set frontmost of targetProcess to true` ＋ 名前が
//!   contains 一致する全ウィンドウへ `perform action "AXRaise"`
//! - close: 名前が contains 一致するウィンドウの AXCloseButton へ
//!   `perform action "AXPress"`（Finder のみ Finder スクリプティングで front window を close）
//!
//! を行っていた。Rust 版は同じ AX 操作を AXUIElement API で直接行う。
//!
//! AX バインディングの選定メモ:
//! - objc2-application-services 0.3（HIServices）を採用。既存モジュールが
//!   objc2 エコシステム（objc2-core-foundation / objc2-core-graphics /
//!   objc2-app-kit）で統一されており、AXUIElementCopyAttributeValue が返す
//!   CF 値を CFRetained/CFType のままダウンキャストできる（window_manager.rs の
//!   選定メモと同じ理由）。accessibility crate 等の別エコシステムは
//!   core-foundation crate の型と混ざり生ポインタキャストが増えるため不採用。
//! - AXUIElement → CGWindowID の対応付けだけは公開 API が存在しないため、
//!   非公開関数 _AXUIElementGetWindow を直接 FFI 宣言して使う（yabai /
//!   AltTab 等の常用手段）。失敗時はタイトル一致へフォールバックする。
//!
//! UE 対策: window_manager.rs と同様に spawn_blocking + tokio::time::timeout(2秒)。
//! さらに AXUIElementSetMessagingTimeout(1秒) で無応答アプリへの AX メッセージ
//! 自体も打ち切り、タイムアウト後の blocking スレッド残留を短くする。

use std::ptr::NonNull;
use std::time::Duration;

use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication};
use objc2_application_services::{AXError, AXUIElement};
use objc2_core_foundation::{CFArray, CFBoolean, CFRetained, CFString, CFType};

use crate::window_manager::MacWindow;

/// AX 操作全体のタイムアウト（原本の osascript は無制限だったが、
/// Swift ヘルパーの WatchdogTimer 慣行に合わせて上限を設ける）
const ACTION_TIMEOUT: Duration = Duration::from_secs(2);

/// 個々の AX メッセージ（プロセス間通信）のタイムアウト秒
const AX_MESSAGING_TIMEOUT_SECS: f32 = 1.0;

// AX 属性・アクション名。ヘッダでは CFSTR マクロ（kAXWindowsAttribute 等）で
// 定義されており Rust バインディングに定数が生成されないため、文字列で持つ
const AX_WINDOWS: &str = "AXWindows";
const AX_TITLE: &str = "AXTitle";
const AX_MAIN: &str = "AXMain";
const AX_CLOSE_BUTTON: &str = "AXCloseButton";
const AX_RAISE_ACTION: &str = "AXRaise";
const AX_PRESS_ACTION: &str = "AXPress";

extern "C-unwind" {
    /// 非公開 API: AXUIElement（ウィンドウ要素）から CGWindowID を取得する。
    /// kCGWindowNumber と突き合わせてウィンドウを一意に特定するために使う。
    /// ApplicationServices に実体があり macOS 10.10 以降実質安定しているが、
    /// 非公開のため失敗（非 Success）時はタイトル一致にフォールバックする
    fn _AXUIElementGetWindow(element: &AXUIElement, out: *mut u32) -> AXError;
}

/// ウィンドウをアクティブ化する。
///
/// Electron 原本: helper.ts:551-573（activateWindow）
/// 1. NSRunningApplication.activate でアプリを前面化
///    （原本 AppleScript の `set frontmost of targetProcess to true`）
/// 2. AX でウィンドウを特定し kAXMain=true ＋ AXRaise
///    （原本の `perform action "AXRaise"`。kAXMain はアプリ内の
///    メインウィンドウ切り替えで、AXRaise だけでは他ウィンドウの背後に
///    残るケースを防ぐ。kAXFocusedAttribute はウィンドウ要素では
///    書き込み不可のため kAXMain を使う）
pub async fn activate(win: MacWindow) -> Result<(), String> {
    run_blocking("activate", move || activate_blocking(&win)).await
}

/// ウィンドウを閉じる。
///
/// Electron 原本: helper.ts:575-616（closeWindow）。
/// AX でウィンドウを特定 → kAXCloseButtonAttribute → AXPress。
/// 原本にあった Finder の特別扱い（Finder スクリプティングで front window を
/// close）は、System Events の name 一致が Finder で不安定だったことへの
/// 回避策とみられる。AX 直叩きでは対象ウィンドウの CloseButton を直接
/// 押せるため共通処理に統一した（実機確認: ignored テスト参照）
pub async fn close(win: MacWindow) -> Result<(), String> {
    run_blocking("close", move || close_blocking(&win)).await
}

/// spawn_blocking + タイムアウトで AX 操作を包む（window_manager.rs:80-88 と同型）。
/// タイムアウト時は blocking スレッドが残り得るが、AXUIElementSetMessagingTimeout
/// により AX メッセージ側も最大約1秒で打ち切られる
async fn run_blocking<F>(op: &'static str, f: F) -> Result<(), String>
where
    F: FnOnce() -> Result<(), String> + Send + 'static,
{
    tokio::time::timeout(ACTION_TIMEOUT, tokio::task::spawn_blocking(f))
        .await
        .map_err(|_| format!("window_actions::{op} timed out (2s)"))?
        .map_err(|e| format!("Thread error: {e}"))?
}

/// アクティブ化のブロッキング本体
fn activate_blocking(win: &MacWindow) -> Result<(), String> {
    let pid = pid_of(win)?;

    // 1. アプリ自体を前面化（原本の frontmost=true に対応）。
    // ActivateIgnoringOtherApps は macOS 14 で非推奨（14 以降は指定しても
    // 無視され協調的アクティベーションになる）が、macOS 13 以前で他アプリから
    // フォーカスを奪うためには依然必要なので allow して使い続ける
    let app = NSRunningApplication::runningApplicationWithProcessIdentifier(pid)
        .ok_or_else(|| format!("no running application with pid {pid}"))?;
    #[allow(deprecated)]
    app.activateWithOptions(NSApplicationActivationOptions::ActivateIgnoringOtherApps);

    // 2. 対象ウィンドウを AX で特定して前面化
    let ax_window = find_ax_window(pid, win)?;
    unsafe {
        // kAXMain=true: アプリ内のメインウィンドウを切り替える。
        // 失敗してもアプリ前面化＋AXRaise で目的は概ね達成されるため続行する
        let err = ax_window.set_attribute_value(
            &CFString::from_static_str(AX_MAIN),
            CFBoolean::new(true).as_ref(),
        );
        if err != AXError::Success {
            log::warn!("AXUIElementSetAttributeValue(AXMain) failed: {err:?}");
        }

        // AXRaise: 原本 AppleScript の perform action "AXRaise" と同じ
        let err = ax_window.perform_action(&CFString::from_static_str(AX_RAISE_ACTION));
        if err != AXError::Success {
            return Err(format!("AXUIElementPerformAction(AXRaise) failed: {err:?}"));
        }
    }
    Ok(())
}

/// クローズのブロッキング本体
fn close_blocking(win: &MacWindow) -> Result<(), String> {
    let pid = pid_of(win)?;
    let ax_window = find_ax_window(pid, win)?;

    // kAXCloseButtonAttribute → AXPress
    // （原本の perform action "AXPress" of (first button ... whose subrole is
    // "AXCloseButton")。AX 属性として直接取れるため subrole 検索は不要）
    let close_button = copy_attribute(&ax_window, AX_CLOSE_BUTTON)?
        .downcast::<AXUIElement>()
        .map_err(|_| "AXCloseButton attribute is not an AXUIElement".to_string())?;

    let err = unsafe { close_button.perform_action(&CFString::from_static_str(AX_PRESS_ACTION)) };
    if err != AXError::Success {
        return Err(format!(
            "AXUIElementPerformAction(AXPress) on close button failed: {err:?}"
        ));
    }
    Ok(())
}

/// MacWindow の kCGWindowOwnerPID を pid_t に変換する
fn pid_of(win: &MacWindow) -> Result<libc::pid_t, String> {
    libc::pid_t::try_from(win.owner_pid)
        .map_err(|_| format!("invalid pid: {} ({})", win.owner_pid, win.owner_name))
}

/// アプリの AXWindows から対象ウィンドウを特定する。
///
/// 特定順序:
/// 1. _AXUIElementGetWindow の CGWindowID と kCGWindowNumber の一致（一意）
/// 2. フォールバック: AXTitle が kCGWindowName を含む最初のウィンドウ
///    （原本 AppleScript の `name of currentWindow contains "..."` に対応。
///    原本は一致した全ウィンドウを操作していたが、Rust 版は誤爆を避けるため
///    最初の1つに絞る。また原本では kCGWindowName が空文字だと全ウィンドウに
///    一致してしまっていたが、Rust 版は空タイトルをフォールバック対象外とする）
fn find_ax_window(pid: libc::pid_t, win: &MacWindow) -> Result<CFRetained<AXUIElement>, String> {
    // SAFETY: pid は正の値で、対象プロセスが存在しなくても API は安全に
    // エラー（後段の copy_attribute_value が非 Success）を返す
    let app_element = unsafe { AXUIElement::new_application(pid) };

    // 無応答アプリ対策: この要素（と子要素）への AX メッセージを1秒で打ち切る
    // SAFETY: 正のタイムアウト値を渡している
    let err = unsafe { app_element.set_messaging_timeout(AX_MESSAGING_TIMEOUT_SECS) };
    if err != AXError::Success {
        log::warn!("AXUIElementSetMessagingTimeout failed: {err:?}");
    }

    let windows = copy_attribute(&app_element, AX_WINDOWS)?
        .downcast::<CFArray>()
        .map_err(|_| "AXWindows attribute is not a CFArray".to_string())?;
    // SAFETY: kAXWindowsAttribute は AXUIElement の CFArray を返すと
    // API 契約で保証されている
    let windows: CFRetained<CFArray<AXUIElement>> = unsafe { CFRetained::cast_unchecked(windows) };

    // 1. kCGWindowNumber（CGWindowID）一致
    let target_id = u32::try_from(win.window_number).ok();
    if let Some(target_id) = target_id {
        for ax_window in windows.iter() {
            let mut window_id: u32 = 0;
            // SAFETY: out ポインタはローカル変数への有効なポインタ
            let err = unsafe { _AXUIElementGetWindow(&ax_window, &mut window_id) };
            if err == AXError::Success && window_id == target_id {
                return Ok(ax_window);
            }
        }
    }

    // 2. タイトル一致フォールバック（非公開 API が失敗した場合や、
    // ウィンドウリスト取得時から AX 側の構成が変わった場合の保険）
    if let Some(name) = win.name.as_deref().filter(|n| !n.is_empty()) {
        for ax_window in windows.iter() {
            let Ok(title) = copy_attribute(&ax_window, AX_TITLE) else {
                continue;
            };
            let Some(title) = title.downcast_ref::<CFString>().map(|s| s.to_string()) else {
                continue;
            };
            if title.contains(name) {
                return Ok(ax_window);
            }
        }
    }

    Err(format!(
        "target window not found via AX: {} ({}) window_number={}",
        win.owner_name,
        win.name.as_deref().unwrap_or(""),
        win.window_number
    ))
}

/// AXUIElementCopyAttributeValue の安全なラッパー。
/// Copy ルールに従い +1 参照で返る値を CFRetained が引き取る
fn copy_attribute(element: &AXUIElement, name: &str) -> Result<CFRetained<CFType>, String> {
    let mut value: *const CFType = std::ptr::null();
    // SAFETY: value はローカル変数への有効なポインタ
    let err = unsafe {
        element.copy_attribute_value(&CFString::from_str(name), NonNull::from(&mut value))
    };
    if err != AXError::Success {
        return Err(format!(
            "AXUIElementCopyAttributeValue({name}) failed: {err:?}"
        ));
    }
    let ptr = NonNull::new(value.cast_mut())
        .ok_or_else(|| format!("AXUIElementCopyAttributeValue({name}) returned NULL"))?;
    // SAFETY: 非 NULL の +1 参照（Copy ルール）を所有権ごと受け取る
    Ok(unsafe { CFRetained::from_raw(ptr) })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::window_manager::WindowBounds;

    /// テスト用の MacWindow を作る
    fn make_window(pid: i64, name: Option<&str>, window_number: i64) -> MacWindow {
        MacWindow {
            layer: 0,
            name: name.map(String::from),
            memory_usage: 0,
            is_onscreen: Some(1),
            sharing_state: 1,
            owner_pid: pid,
            owner_name: "TestApp".to_string(),
            window_number,
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
    fn 不正なpidはエラーになる() {
        // pid_t（i32）に収まらない値はエラー（AX 呼び出しまで進まない）
        let win = make_window(i64::MAX, Some("x"), 1);
        assert!(pid_of(&win).is_err());

        let win = make_window(4242, Some("x"), 1);
        assert_eq!(pid_of(&win).unwrap(), 4242);
    }

    #[tokio::test]
    async fn 存在しないpidのactivateはタイムアウト内にエラーを返す() {
        // AX 実挙動は実機必須だが、「存在しないプロセス → 即エラー」の経路は
        // どの環境でも成立する（NSRunningApplication が nil を返す）
        let win = make_window(0x7FFF_FFF0, Some("no such window"), 999_999);
        let result = activate(win).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn 存在しないpidのcloseはタイムアウト内にエラーを返す() {
        // close は AXUIElementCreateApplication 経由だが、存在しない pid では
        // copy_attribute_value が非 Success を返しエラーになる
        let win = make_window(0x7FFF_FFF0, Some("no such window"), 999_999);
        let result = close(win).await;
        assert!(result.is_err());
    }

    /// 実機確認用: TextEdit を起動した状態で
    /// `cargo test -- --ignored 実機でウィンドウをアクティブ化できる` を実行する
    #[tokio::test]
    #[ignore = "実際の AX API・アクセシビリティ権限が必要（実機で手動実行）"]
    async fn 実機でウィンドウをアクティブ化できる() {
        // 実際のウィンドウリストから TextEdit を探して activate する
        let windows = crate::window_manager::get_window_list()
            .await
            .expect("should fetch window list");
        let target = windows
            .into_iter()
            .find(|w| w.owner_name == "TextEdit")
            .expect("TextEdit を起動しておくこと");
        activate(target).await.expect("activate should succeed");
    }

    /// 実機確認用: TextEdit を起動した状態で
    /// `cargo test -- --ignored 実機でウィンドウを閉じられる` を実行する
    /// （TextEdit のウィンドウが実際に閉じる点に注意）
    #[tokio::test]
    #[ignore = "実際の AX API・アクセシビリティ権限が必要（実機で手動実行。ウィンドウが実際に閉じる）"]
    async fn 実機でウィンドウを閉じられる() {
        let windows = crate::window_manager::get_window_list()
            .await
            .expect("should fetch window list");
        let target = windows
            .into_iter()
            .find(|w| w.owner_name == "TextEdit")
            .expect("TextEdit を起動しておくこと");
        close(target).await.expect("close should succeed");
    }
}
