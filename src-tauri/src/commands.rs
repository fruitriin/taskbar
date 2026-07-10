//! Tauri Commands（IPC ハンドラー）
//!
//! 計画書: docs/plans/rearch-phase3.md 3.2 節
//! 縦切り第1弾として get_windows のみ実装。残りのコマンドは順次追加する。

use crate::window_manager::{self, MacWindow};

/// ウィンドウ一覧を返す（window_manager::get_window_list の薄いラッパー）
#[tauri::command]
pub async fn get_windows() -> Result<Vec<MacWindow>, String> {
    window_manager::get_window_list().await
}
