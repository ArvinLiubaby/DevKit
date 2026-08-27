use tauri::{Emitter, Manager};

mod programs;
mod shortcuts;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 禁用 WebKitGTK DMABUF 渲染器：部分 Linux 显卡/驱动（如 Linux Mint）下
    // 默认启用会白屏，退回软件渲染保证界面稳定显示（必须在 WebKit 初始化前设置）
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    tauri::Builder::default()
        // 单实例：重复启动时激活已有主窗口（切换到它而非新开实例）
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 依次：恢复最小化 → 显示 → 置前聚焦；再通知前端（如需联动）
            tray::show_main_window(app);
            let _ = app.emit("devkit://activate", ());
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
            // 系统托盘：点击关闭按钮时窗口隐藏到托盘，由托盘菜单/点击恢复或退出
            tray::init(app)?;
            Ok(())
        })
        // 点击关闭按钮（或 Alt+F4）：不退出程序，隐藏到系统托盘
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            shortcuts::list_shortcuts,
            shortcuts::update_shortcut,
            shortcuts::reset_shortcut,
            shortcuts::reset_all_shortcuts,
            programs::list_programs,
            programs::launch_program,
            programs::get_program_icon,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
