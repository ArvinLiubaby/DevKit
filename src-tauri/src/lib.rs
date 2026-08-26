use tauri::Manager;

mod shortcuts;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 单实例：重复启动时唤起已有主窗口，避免多开抢占全局快捷键
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(shortcuts::ShortcutManager::new())
        .setup(|app| {
            // 加载持久化配置并注册全部全局快捷键（单个失败不影响其他动作）
            shortcuts::register_all(app.handle(), &app.state::<shortcuts::ShortcutManager>());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            shortcuts::list_shortcuts,
            shortcuts::update_shortcut,
            shortcuts::reset_shortcut,
            shortcuts::reset_all_shortcuts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
