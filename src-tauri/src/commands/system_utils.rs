use std::fs;
use std::path::Path;
use std::process::Command;

/// Sync subfolder names to match the parent folder name.
/// mode: "all" = rename all subfolders, "last" = rename only the deepest subfolder
#[tauri::command]
pub fn sync_subfolder_names(folder_path: String, mode: String) -> Result<String, String> {
    let root = Path::new(&folder_path);
    
    if !root.exists() || !root.is_dir() {
        return Err("Thư mục không tồn tại".to_string());
    }

    let parent_name = root
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Không thể đọc tên thư mục cha")?
        .to_string();

    // Collect the chain of single-child subdirectories
    let mut chain: Vec<std::path::PathBuf> = Vec::new();
    let mut current = root.to_path_buf();

    loop {
        let subdirs: Vec<std::path::PathBuf> = fs::read_dir(&current)
            .map_err(|e| format!("Không thể đọc thư mục: {}", e))?
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .filter(|p| {
                if !p.is_dir() {
                    return false;
                }
                let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                !name.starts_with('.')
            })
            .collect();

        if subdirs.len() == 1 {
            chain.push(subdirs[0].clone());
            current = subdirs[0].clone();
        } else {
            break;
        }
    }

    if chain.is_empty() {
        return Err("Không tìm thấy thư mục con nào bên trong".to_string());
    }

    let mut renamed_count = 0;

    match mode.as_str() {
        "all" => {
            // Rename from deepest to shallowest to avoid path invalidation
            for i in (0..chain.len()).rev() {
                let folder = &chain[i];
                let current_name = folder
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("");

                if current_name != parent_name {
                    let new_path = folder.parent().unwrap().join(&parent_name);
                    fs::rename(folder, &new_path)
                        .map_err(|e| format!("Không thể đổi tên '{}': {}", current_name, e))?;
                    renamed_count += 1;
                }
            }
            Ok(format!(
                "Đã đồng bộ {} thư mục con thành '{}'",
                renamed_count, parent_name
            ))
        }
        "last" => {
            // Rename only the deepest subfolder
            let deepest = chain.last().unwrap();
            let current_name = deepest
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");

            if current_name == parent_name {
                Ok("Thư mục cuối đã có cùng tên với thư mục cha rồi".to_string())
            } else {
                let new_path = deepest.parent().unwrap().join(&parent_name);
                fs::rename(deepest, &new_path)
                    .map_err(|e| format!("Không thể đổi tên '{}': {}", current_name, e))?;
                Ok(format!(
                    "Đã đổi tên thư mục cuối thành '{}'",
                    parent_name
                ))
            }
        }
        _ => Err("Chế độ không hợp lệ. Dùng 'all' hoặc 'last'".to_string()),
    }
}

#[tauri::command]
pub fn launch_photoshop() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        // Try using bundle identifier first
        let status = Command::new("open")
            .args(["-b", "com.adobe.Photoshop"])
            .status();
        
        if let Ok(st) = &status {
            if st.success() {
                return Ok("Mở Photoshop thành công".to_string());
            }
        }
        
        // Fallback to app name
        let status2 = Command::new("open")
            .args(["-a", "Adobe Photoshop"])
            .status();

        if let Ok(st) = status2 {
            if st.success() {
                return Ok("Mở Photoshop thành công".to_string());
            }
        }

        Err("Không thể mở Photoshop. Vui lòng kiểm tra xem bạn đã cài đặt chưa.".to_string())
    }

    #[cfg(target_os = "windows")]
    {
        let status = Command::new("cmd")
            .args(["/C", "start", "photoshop"])
            .status();
        
        if let Ok(st) = status {
            if st.success() {
                return Ok("Mở Photoshop thành công".to_string());
            }
        }
        
        Err("Không thể mở Photoshop. Vui lòng kiểm tra xem bạn đã cài đặt chưa.".to_string())
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Hệ điều hành không được hỗ trợ.".to_string())
    }
}

#[tauri::command]
pub fn save_file_bytes(file_path: String, bytes: Vec<u8>) -> Result<String, String> {
    let path = Path::new(&file_path);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(path, bytes).map_err(|e| format!("Không thể ghi tệp vào đĩa: {}", e))?;
    Ok("Đã lưu tệp thành công".to_string())
}

#[cfg(target_os = "macos")]
extern "C" {
    fn macos_set_dock_icon_png(bytes: *const u8, length: usize);
    fn macos_is_system_dark_mode() -> i32;
    fn macos_set_window_theme(is_dark: i32);
}

#[cfg(target_os = "macos")]
const DOCK_ICON_DARK_PNG: &[u8] = include_bytes!("../../../public/brand/dh_app_icon_dock_dark.png");
#[cfg(target_os = "macos")]
const DOCK_ICON_LIGHT_PNG: &[u8] = include_bytes!("../../../public/brand/dh_app_icon_dock_light.png");

#[tauri::command]
pub fn is_system_dark_mode() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(unsafe { macos_is_system_dark_mode() == 1 })
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub fn update_system_theme_icon(_theme: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let is_dark = if _theme.to_lowercase() == "system" {
            unsafe { macos_is_system_dark_mode() == 1 }
        } else {
            _theme.to_lowercase() == "dark"
        };
        let bytes = if is_dark {
            DOCK_ICON_DARK_PNG
        } else {
            DOCK_ICON_LIGHT_PNG
        };

        unsafe {
            macos_set_dock_icon_png(bytes.as_ptr(), bytes.len());
            macos_set_window_theme(if is_dark { 1 } else { 0 });
        }
    }
    Ok(())
}

/// Smart folder expansion for Studio workflows (Contact The Sheet / Batch Runner):
/// For each path in `paths`:
/// - If the folder contains > 1 immediate non-hidden subdirectories:
///   expand it into all its immediate non-hidden subdirectories.
/// - If the folder contains <= 1 immediate non-hidden subdirectories (or 0):
///   keep the folder itself as the starting point.
#[tauri::command]
pub fn resolve_smart_input_folders(paths: Vec<String>) -> Result<Vec<String>, String> {
    use std::collections::HashSet;
    let mut resolved_paths: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for path_str in paths {
        let root = Path::new(&path_str);
        if !root.exists() || !root.is_dir() {
            continue;
        }

        // Read immediate non-hidden subdirectories
        let mut subdirs: Vec<std::path::PathBuf> = match fs::read_dir(root) {
            Ok(entries) => entries
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| {
                    if !p.is_dir() {
                        return false;
                    }
                    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    !name.starts_with('.')
                })
                .collect(),
            Err(_) => Vec::new(),
        };

        subdirs.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

        if subdirs.len() > 1 {
            // More than 1 subfolder -> unpack all child subfolders
            for sub in subdirs {
                let sub_str = sub.to_string_lossy().to_string();
                if seen.insert(sub_str.clone()) {
                    resolved_paths.push(sub_str);
                }
            }
        } else {
            // <= 1 subfolder (or 0) -> keep the folder itself as starting point
            let root_str = root.to_string_lossy().to_string();
            if seen.insert(root_str.clone()) {
                resolved_paths.push(root_str);
            }
        }
    }

    Ok(resolved_paths)
}

#[tauri::command]
pub fn set_autostart(app: tauri::AppHandle, enable: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let autolaunch = app.autolaunch();
    if enable {
        autolaunch.enable().map_err(|e| e.to_string())?;
    } else {
        autolaunch.disable().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn is_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hide_tray_panel(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(panel) = app.get_webview_window("tray-panel") {
        let _ = panel.hide();
    }
    Ok(())
}

#[tauri::command]
pub fn show_main_window_from_tray(app: tauri::AppHandle, target_module: Option<String>) -> Result<(), String> {
    use tauri::{Emitter, Manager};
    if let Some(panel) = app.get_webview_window("tray-panel") {
        let _ = panel.hide();
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        if let Some(module) = target_module {
            let _ = window.emit("navigate-to-module", serde_json::json!({ "module": module }));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn exit_app_cleanly(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn open_system_notification_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.Notifications-Settings.extension")
            .spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "ms-settings:notifications"])
            .spawn();
    }
    Ok(())
}

#[cfg(target_os = "macos")]
extern "C" {
    fn macos_request_notification_permission();
    fn macos_send_native_notification(title: *const std::os::raw::c_char, body: *const std::os::raw::c_char);
}

#[tauri::command]
pub fn request_os_notification_permission() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    unsafe {
        macos_request_notification_permission();
    }
    Ok(())
}

#[tauri::command]
pub fn send_os_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    // 1. On macOS, play chime sound and trigger native UNUserNotificationCenter banner
    #[cfg(target_os = "macos")]
    {
        // Play system chime sound
        let _ = std::process::Command::new("afplay")
            .arg("/System/Library/Sounds/Glass.aiff")
            .spawn();

        let c_title = std::ffi::CString::new(title.clone()).unwrap_or_default();
        let c_body = std::ffi::CString::new(body.clone()).unwrap_or_default();
        unsafe {
            macos_send_native_notification(c_title.as_ptr(), c_body.as_ptr());
        }
    }

    // 2. Native Tauri plugin notification
    use tauri_plugin_notification::NotificationExt;
    let _ = app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show();

    // 3. Emit event to webview so in-app banner immediately pops up
    use tauri::Emitter;
    let _ = app.emit("native-os-notification-fired", serde_json::json!({
        "title": title,
        "body": body,
        "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()
    }));

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, File};

    #[test]
    fn test_resolve_smart_input_folders_expands_multiple_subfolders() {
        let temp_dir = std::env::temp_dir().join(format!("mvd_smart_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let parent_folder = temp_dir.join("28-8 V");
        let cust1 = parent_folder.join("18-8 10h Hoa Anh Nguyễn");
        let cust2 = parent_folder.join("20-8 8h Lee Thị Thu 1cc");
        let cust3 = parent_folder.join("22-8 9h Khánh Vy 1cc");

        create_dir_all(&cust1).unwrap();
        create_dir_all(&cust2).unwrap();
        create_dir_all(&cust3).unwrap();

        // Also add hidden dir in parent to ensure it is ignored
        create_dir_all(parent_folder.join(".DS_Store_dir")).unwrap();

        let parent_str = parent_folder.to_string_lossy().to_string();
        let res = resolve_smart_input_folders(vec![parent_str]).unwrap();

        assert_eq!(res.len(), 3);
        assert!(res.iter().any(|p| p.ends_with("18-8 10h Hoa Anh Nguyễn")));
        assert!(res.iter().any(|p| p.ends_with("20-8 8h Lee Thị Thu 1cc")));
        assert!(res.iter().any(|p| p.ends_with("22-8 9h Khánh Vy 1cc")));

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_resolve_smart_input_folders_keeps_single_subfolder_as_root() {
        let temp_dir = std::env::temp_dir().join(format!("mvd_smart_test_single_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let cust_folder = temp_dir.join("18-8 10h Hoa Anh Nguyễn");
        let inner_folder = cust_folder.join("18-8 10h Hoa Anh Nguyễn");
        create_dir_all(&inner_folder).unwrap();

        let cust_str = cust_folder.to_string_lossy().to_string();
        let res = resolve_smart_input_folders(vec![cust_str.clone()]).unwrap();

        // Since cust_folder has only 1 subfolder, the starting point is cust_folder itself
        assert_eq!(res.len(), 1);
        assert_eq!(res[0], cust_str);

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_resolve_smart_input_folders_keeps_zero_subfolders_folder() {
        let temp_dir = std::env::temp_dir().join(format!("mvd_smart_test_zero_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let cust_folder = temp_dir.join("20-8 8h Lee Thị Thu 1cc");
        create_dir_all(&cust_folder).unwrap();
        File::create(cust_folder.join("IMG_0001.JPG")).unwrap();

        let cust_str = cust_folder.to_string_lossy().to_string();
        let res = resolve_smart_input_folders(vec![cust_str.clone()]).unwrap();

        assert_eq!(res.len(), 1);
        assert_eq!(res[0], cust_str);

        let _ = fs::remove_dir_all(temp_dir);
    }
}


