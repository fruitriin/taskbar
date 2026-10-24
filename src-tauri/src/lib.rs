pub mod ax_observer;
pub mod commands;
pub mod context_menu;
pub mod display_manager;
pub mod filter;
pub mod icon_manager;
pub mod overlap;
pub mod permission_manager;
pub mod store;
pub mod window_actions;
pub mod window_manager;
pub mod window_observer;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::get_windows,
            commands::window_ready,
            commands::set_options,
            commands::get_options,
            commands::get_labeled_filters,
            commands::set_labeled_filters,
            commands::add_filter,
            commands::get_exclude_windows,
            commands::active_window,
            commands::close_window,
            commands::grant_permission,
            commands::check_permissions,
            commands::open_system_preferences,
            commands::context_logo,
            commands::context_task,
            commands::context_taskbar,
            commands::open_option,
            commands::open_full_window_list,
            commands::close_menu,
            commands::restart,
            commands::exit,
            commands::clear_setting,
            commands::dump_taskbar_info,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                // TASKBAR_DEBUG_LOG を設定すると本アプリのモジュールだけ debug ログを出す
                // （AX 通知・'process' emit の発生状況を実機で追うため）
                let app_level = if std::env::var_os("TASKBAR_DEBUG_LOG").is_some() {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                };
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .level_for("app_lib", app_level)
                        .build(),
                )?;
            }
            // 全モニタ分のタスクバーウィンドウを生成
            // （tauri.conf.json の静的定義は動的生成へ一本化するため削除済み —
            // 判断コメントは display_manager.rs 冒頭参照）
            display_manager::sync_taskbar_windows(app.handle())?;
            // スクリーン構成変更（モニタ増減・解像度変更）の監視を開始
            display_manager::start_screen_observation(app.handle().clone());
            // Electron 版からの設定ワンショット移行（冪等。Phase 3.4）
            store::migrate_from_electron(app.handle());

            // NSWorkspace 通知の監視を開始（setup はメインスレッドで実行される）
            // タスクバーと重なるウィンドウの自動回避（AX 通知を受けて動く）
            let adjust_tx = overlap::start(app.handle().clone());
            window_observer::start_observation(app.handle().clone(), adjust_tx);

            // タスク右クリックメニュー: 対象ウィンドウの受け渡し用 state と
            // メニューイベントハンドラ（on_menu_event は追記型のため登録はここで1回だけ。
            // 設計メモは context_menu.rs 冒頭参照）
            app.manage(context_menu::ContextTaskState::default());
            app.on_menu_event(|app, event| context_menu::handle_menu_event(app, &event));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
