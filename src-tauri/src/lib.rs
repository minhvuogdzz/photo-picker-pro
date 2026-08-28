mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![
            commands::auth::save_auth_session,
            commands::auth::load_auth_session,
            commands::auth::clear_auth_session,
            commands::auth::get_device_fingerprint,
            commands::auth::is_offline_period_valid,
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
            commands::system_utils::sync_subfolder_names,
            commands::system_utils::launch_photoshop,
            commands::system_utils::save_file_bytes,
            commands::converter::run_convert_batch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
