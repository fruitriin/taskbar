//! 権限チェック・リクエスト（アクセシビリティ / スクリーン収録）
//!
//! Swift 原本: nativeSrc/taskbar.helper/main.swift:532-621（Permission Management）
//! ＋ grant コマンド（main.swift:1067-1070）。
//! Electron 側の意味論: events.ts:99-113（grantPermission / checkPermissions /
//! openSystemPreferences）→ helper.ts:428-480（check-permissions の JSON パース）。
//!
//! スクリーン収録チェックの簡素化判断:
//! Swift 原本は SCShareableContent.getExcludingDesktopWindows ＋ 100ms タイムアウト
//! （main.swift:563-591）を使っていた。これは「権限が無いと error が返る」という
//! 副作用を利用した間接チェックで、非同期コールバック＋セマフォ待ちの複雑さと
//! UE リスク調査コメント（main.swift:544-562）を伴っていた。
//! Rust 版は CGPreflightScreenCaptureAccess（macOS 10.15+）に簡素化する:
//! - TCC の権限状態を返す専用 API で、同期・軽量・ダイアログ非表示・ブロックなし
//!   （UE リスクの根源だったコールバック待ちが存在しない）
//! - 原本が SCShareableContent を選んだ明確な理由はコメントに残っておらず、
//!   「実際に画面情報を取得できるか」の実挙動チェックを兼ねていたとみられるが、
//!   本アプリの用途（UI の権限警告表示）には TCC 状態の取得で足りる
//! - 制約: TCC はプロセス起動時に評価されるため、付与/剥奪後はアプリ再起動まで
//!   古い値が返り得る。ただしこれは SCShareableContent 方式でも同じ挙動で、
//!   旧構成では都度ヘルパープロセスを起動していたため常に新鮮だっただけ。
//!   権限変更が反映されないときにアプリ再起動が必要なのは macOS の仕様どおり

use objc2_application_services::{
    kAXTrustedCheckOptionPrompt, AXIsProcessTrusted, AXIsProcessTrustedWithOptions,
};
use objc2_core_foundation::{CFBoolean, CFDictionary, CFString};
use objc2_core_graphics::{CGPreflightScreenCaptureAccess, CGRequestScreenCaptureAccess};

/// アクセシビリティ権限の有無を返す。
///
/// Swift 原本: checkAccessibilityPermission（main.swift:535-537）
pub fn check_accessibility() -> bool {
    // SAFETY: 引数なしの状態問い合わせで、副作用（ダイアログ表示）もない
    unsafe { AXIsProcessTrusted() }
}

/// スクリーン収録権限の有無を返す。
///
/// Swift 原本: checkScreenRecordingPermission（main.swift:539-600）。
/// SCShareableContent → CGPreflightScreenCaptureAccess への簡素化判断は
/// モジュールコメント参照
pub fn check_screen_recording() -> bool {
    CGPreflightScreenCaptureAccess()
}

/// スクリーン収録権限をリクエストする（未許可なら OS がダイアログを表示し、
/// システム設定の「画面収録」にアプリを登録する）。
///
/// Swift 原本: grant コマンドの CGRequestScreenCaptureAccess（main.swift:1067-1070）
pub fn request_screen_recording() -> bool {
    CGRequestScreenCaptureAccess()
}

/// アクセシビリティ権限をリクエストする（未許可なら OS がダイアログを表示し、
/// システム設定の「アクセシビリティ」にアプリを登録する）。現在の許可状態を返す。
///
/// 原本には存在しない追加分: Electron 版はアクセシビリティを AppleScript
/// （osascript）実行時に OS が自動プロンプトしていたため明示リクエスト不要
/// だったが、Tauri 版は window_actions.rs が AX API を直接叩くため、
/// AXIsProcessTrustedWithOptions(prompt=true) で明示的に要求する
pub fn request_accessibility() -> bool {
    // SAFETY: kAXTrustedCheckOptionPrompt は ApplicationServices の静的 CFString
    let prompt_key: &CFString = unsafe { kAXTrustedCheckOptionPrompt };
    let options = CFDictionary::from_slices(&[prompt_key], &[CFBoolean::new(true)]);
    // SAFETY: options は {kAXTrustedCheckOptionPrompt: true} の有効な CFDictionary
    unsafe { AXIsProcessTrustedWithOptions(Some(options.as_opaque())) }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 実機確認用: `cargo test -- --ignored 実機で権限状態を取得できる`。
    /// どちらの API も（権限の有無にかかわらず）パニックせず bool を返すことを確認する
    #[test]
    #[ignore = "実際の TCC / AX API に問い合わせるため実機で手動実行"]
    fn 実機で権限状態を取得できる() {
        let accessibility = check_accessibility();
        let screen_recording = check_screen_recording();
        // 権限の有無は環境依存なので値は検証せず、到達すること自体を確認する
        println!("accessibility={accessibility} screenRecording={screen_recording}");
    }
}
