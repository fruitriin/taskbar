pub mod commands;
pub mod filter;
pub mod permission_manager;
pub mod store;
pub mod window_actions;
pub mod window_manager;
pub mod window_observer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::get_windows,
            commands::window_ready,
            commands::set_options,
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
            commands::open_option,
            commands::open_full_window_list,
            commands::close_menu,
            commands::restart,
            commands::exit,
            commands::restart_helper,
            commands::clear_setting,
            commands::dump_taskbar_info,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // NSWorkspace 通知の監視を開始（setup はメインスレッドで実行される）
            window_observer::start_observation(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
