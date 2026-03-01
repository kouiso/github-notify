mod audio;
mod background;
mod commands;
mod error;
mod github;
mod storage;

use background::AppState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::new())
        .setup(|app| {
            // Setup logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;

                // Open DevTools in debug mode
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }

            // Start background polling if token is available
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(Some(_token)) = storage::get_token(&handle) {
                    let state = handle.state::<AppState>();
                    let mut polling = state.polling.lock().await;
                    if let Err(e) = polling.start(handle.clone()).await {
                        log::error!("Failed to start background polling: {}", e);
                    }
                }
            });

            // System tray setup
            let show = MenuItem::with_id(app, "show", "表示", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("GitHub Notify")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            commands::start_device_flow,
            commands::poll_device_flow,
            commands::save_github_token,
            commands::get_github_token,
            commands::verify_github_token,
            commands::clear_github_token,
            // Stream commands
            commands::get_streams,
            commands::create_stream,
            commands::update_stream,
            commands::delete_stream,
            commands::reorder_streams,
            commands::update_stream_unread_count,
            // Notification commands
            commands::fetch_notifications,
            commands::mark_as_read,
            commands::mark_all_as_read,
            commands::clear_read_items,
            commands::send_notification,
            commands::send_notification_with_sound,
            commands::play_sound,
            // Inbox commands (REST API - no query needed!)
            commands::fetch_inbox,
            commands::mark_inbox_read,
            commands::mark_all_inbox_read,
            // Settings commands
            commands::get_app_settings,
            commands::save_app_settings,
            // Tray commands
            commands::update_tray_badge,
            // Background polling commands
            background::start_polling,
            background::stop_polling,
            background::is_polling_running,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
