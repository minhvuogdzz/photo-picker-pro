use tauri::Manager;

mod bridge;
mod commands;
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let is_background = args.iter().any(|a| a == "--background");
    let is_autostart = args.iter().any(|a| a == "--autostart");
    let start_hidden = is_background || is_autostart;

    let bridge_state = std::sync::Arc::new(bridge::BridgeState::new(is_background));
    let bridge_state_for_setup = std::sync::Arc::clone(&bridge_state);
    let bridge_state_for_window = std::sync::Arc::clone(&bridge_state);
    let bridge_state_for_exit = std::sync::Arc::clone(&bridge_state);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .manage(std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)))
        .manage(commands::system_monitor::SystemMonitorState::new())
        .manage(bridge_state)
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            if is_background {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            }

            if !is_background {
                commands::system_utils::update_system_theme_icon("system".to_string()).ok();
                commands::system_utils::request_os_notification_permission().ok();
            }
            tray::create_tray(app.handle())?;

            let settings = commands::config::load_settings().unwrap_or_default();
            if settings.auto_start {
                use tauri_plugin_autostart::ManagerExt;
                let _ = app.autolaunch().enable();
            }

            if start_hidden {
                bridge_state_for_setup.set_main_window_visible(false);
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
            } else {
                tray::show_main_window(app.handle());
            }

            bridge::start_bridge_server(
                app.handle().clone(),
                std::sync::Arc::clone(&bridge_state_for_setup),
            );

            Ok(())
        })
        .on_window_event(move |window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if label == "tray-panel" {
                    let _ = window.hide();
                    api.prevent_close();
                    return;
                }

                if label == "main" {
                    let should_hide = commands::config::load_settings()
                        .map(|s| s.close_to_tray)
                        .unwrap_or(true);
                    if should_hide {
                        bridge_state_for_window.set_main_window_visible(false);
                        api.prevent_close();
                        if bridge_state_for_window.has_active_requests() {
                            bridge::keep_hidden_window_awake_on_macos();
                        } else {
                            let _ = window.hide();
                        }
                    } else {
                        // Never leave the hidden "tray-panel" keeping a headless zombie process alive
                        // with a destroyed "main" window that can no longer be reopened.
                        api.prevent_close();
                        bridge_state_for_window.cleanup_socket();
                        window.app_handle().exit(0);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::save_auth_session,
            commands::auth::load_auth_session,
            commands::auth::clear_auth_session,
            commands::auth::get_device_fingerprint,
            commands::auth::is_offline_period_valid,
            commands::auth::save_login_password,
            commands::auth::get_login_password,
            commands::auth::delete_login_password,
            commands::config::load_settings,
            commands::config::save_settings,
            commands::config::load_history,
            commands::config::add_history,
            commands::config::clear_history,
            commands::config::auto_detect_studio_output,
            commands::scanner::scan_folders,
            commands::scanner::cancel_scan,
            commands::parser::parse_customer_codes,
            commands::matcher::match_photos,
            commands::copy::copy_files,
            commands::copy::cancel_copy,
            commands::logger::export_log,
            commands::logger::export_missing,
            commands::system_utils::resolve_smart_input_folders,
            commands::system_utils::launch_photoshop,
            commands::system_utils::save_file_bytes,
            commands::system_utils::is_system_dark_mode,
            commands::system_utils::update_system_theme_icon,
            commands::system_utils::set_autostart,
            commands::system_utils::is_autostart_enabled,
            commands::system_utils::send_os_notification,
            commands::system_utils::request_os_notification_permission,
            commands::system_utils::open_system_notification_settings,
            commands::system_utils::hide_tray_panel,
            commands::system_utils::show_main_window_from_tray,
            commands::system_utils::exit_app_cleanly,
            commands::converter::run_convert_batch,
            commands::converter::scan_exif_batch,
            commands::converter::read_reference_photo_exif,
            commands::converter::cancel_convert_batch,
            commands::sheet_auth::start_google_oauth_loopback,
            commands::sheet_auth::wait_for_google_oauth_code,
            commands::sheet_auth::save_google_secure_token,
            commands::sheet_auth::get_google_secure_token,
            commands::sheet_auth::delete_google_secure_token,
            commands::sheet_auth::save_google_active_account,
            commands::sheet_auth::get_google_active_account,
            commands::sheet_auth::clear_google_active_account,
            commands::sheet_fs::scan_folder_topology,
            commands::photo_counter::scan_month_photos,
            commands::scanner::expand_batch_customer_folders,
            commands::preview::list_folder_photos,
            commands::preview::get_photo_thumbnail,
            commands::preview::get_photo_thumbnails_batch,
            commands::preview::clear_thumbnail_cache,
            commands::preview::copy_photo_files,
            commands::system_monitor::get_system_performance_metrics,
            tray::update_tray_language,
            bridge::bridge_mark_ready,
            bridge::bridge_emit_progress,
            bridge::bridge_reply,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            bridge_state_for_exit.cleanup_socket();
        }
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows,
            ..
        } = event
        {
            if !has_visible_windows || !bridge_state_for_exit.is_main_window_visible() {
                tray::show_main_window(app_handle);
            }
        }
    });
}
