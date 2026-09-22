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
            .filter(|p| p.is_dir())
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

                    // Update subsequent paths in the chain (shallower ones already processed)
                    // Since we go from deepest to shallowest, no update needed
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
fn photon_binary_name(p: &Path) -> &'static str {
    if p.join("Contents").join("MacOS").join("MPhoton").exists() {
        "MPhoton"
    } else {
        "Photon Studio"
    }
}

#[cfg(target_os = "macos")]
fn is_valid_photon_bundle(p: &Path) -> bool {
    if !p.exists() {
        return false;
    }
    let asar_file = p.join("Contents").join("Resources").join("app.asar");
    let binary_file = p.join("Contents").join("MacOS").join(photon_binary_name(p));
    asar_file.exists() && binary_file.exists()
}

#[cfg(target_os = "macos")]
fn spawn_photon(p: &Path) -> bool {
    let binary_file = p.join("Contents").join("MacOS").join(photon_binary_name(p));

    // Strip quarantine + restore execute permissions (copies/bundling may strip these)
    let _ = Command::new("xattr").args(["-cr", p.to_str().unwrap_or("")]).status();
    let _ = Command::new("chmod").args(["-R", "+x", p.to_str().unwrap_or("")]).status();

    // Clean up stale Electron Singleton locks to prevent instant quit
    if let Ok(home) = std::env::var("HOME") {
        let p_support = Path::new(&home).join("Library/Application Support/Photon Studio");
        let _ = std::fs::remove_file(p_support.join("SingletonLock"));
        let _ = std::fs::remove_file(p_support.join("SingletonSocket"));
        let _ = std::fs::remove_file(p_support.join("SingletonCookie"));
    }

    // 1. Primary: launch binary directly so env vars pass through (bypasses Electron singleton lock)
    if Command::new(&binary_file)
        .env("PHOTON_E2E_ALLOW_MULTIPLE_INSTANCES", "1")
        .env("PHOTON_DISABLE_QUIT_CONFIRM", "1")
        .spawn()
        .is_ok()
    {
        return true;
    }

    // 2. Fallback: open command
    if let Ok(st) = Command::new("open").args(["-n", p.to_str().unwrap_or("")]).status() {
        if st.success() {
            return true;
        }
    }
    false
}

/// The stable, writable home for MPhoton — outside any signed app bundle so macOS
/// doesn't apply nested-bundle / translocation restrictions, and independent of
/// app updates (a small app update never touches this folder).
#[cfg(target_os = "macos")]
fn photon_app_support_path() -> Option<std::path::PathBuf> {
    std::env::var("HOME").ok().map(|home| {
        Path::new(&home)
            .join("Library")
            .join("Application Support")
            .join("MVD Studio")
            .join("apps")
            .join("MPhoton.app")
    })
}

#[tauri::command]
pub fn launch_photon_studio(app: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;

        // 0. Enforce VIP Premium permission
        if let Ok(Some(session)) = crate::commands::auth::load_auth_session() {
            let is_premium = session.is_premium.unwrap_or(false) || session.subscription_status == "LIFETIME";
            if !is_premium {
                return Err("MPhoton là tính năng độc quyền yêu cầu tài khoản VIP Premium để khởi chạy.".to_string());
            }
        }

        // 1. Fast path: MPhoton already staged in Application Support — launch directly
        if let Some(staged) = photon_app_support_path() {
            if is_valid_photon_bundle(&staged) && spawn_photon(&staged) {
                return Ok("Đã khởi chạy cửa sổ MPhoton thành công".to_string());
            }
        }

        // 2. Not staged yet — find a source bundle (dev workspace, app resources, or /Applications)
        let mut source_candidates: Vec<std::path::PathBuf> = Vec::new();

        if let Ok(cwd) = std::env::current_dir() {
            source_candidates.push(cwd.join("resources").join("apps").join("MPhoton.app"));
            source_candidates.push(cwd.join("src-tauri").join("resources").join("apps").join("MPhoton.app"));
            source_candidates.push(cwd.join("photo-picker-pro").join("src-tauri").join("resources").join("apps").join("MPhoton.app"));
            source_candidates.push(cwd.join("resources").join("apps").join("Photon Studio.app"));
            source_candidates.push(cwd.join("src-tauri").join("resources").join("apps").join("Photon Studio.app"));
            source_candidates.push(cwd.join("photo-picker-pro").join("src-tauri").join("resources").join("apps").join("Photon Studio.app"));
        }

        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(contents_dir) = exe_path.parent().and_then(|p| p.parent()) {
                let res_dir = contents_dir.join("Resources");
                source_candidates.push(res_dir.join("apps").join("MPhoton.app"));
                source_candidates.push(res_dir.join("apps").join("Photon Studio.app"));
                source_candidates.push(res_dir.join("resources").join("apps").join("MPhoton.app"));
                source_candidates.push(res_dir.join("resources").join("apps").join("Photon Studio.app"));
            }
        }

        if let Ok(res_dir) = app.path().resource_dir() {
            source_candidates.push(res_dir.join("apps").join("MPhoton.app"));
            source_candidates.push(res_dir.join("apps").join("Photon Studio.app"));
            source_candidates.push(res_dir.join("resources").join("apps").join("MPhoton.app"));
            source_candidates.push(res_dir.join("resources").join("apps").join("Photon Studio.app"));
        }

        source_candidates.push(Path::new("/Applications/MPhoton.app").to_path_buf());
        source_candidates.push(Path::new("/Applications/Photon Studio.app").to_path_buf());

        let source = source_candidates.iter().find(|p| is_valid_photon_bundle(p));

        let Some(source) = source else {
            let exe_info = std::env::current_exe().map(|p| p.display().to_string()).unwrap_or_else(|_| "unknown".to_string());
            let res_info = app.path().resource_dir().map(|p| p.display().to_string()).unwrap_or_else(|_| "unknown".to_string());
            return Err(format!(
                "Không tìm thấy MPhoton.app. Đường dẫn đã kiểm tra — exe: {exe_info} | res_dir: {res_info}"
            ));
        };

        // 3. Stage it: copy out of the (possibly nested/signed/read-only-translocated) source
        // into a plain writable folder in Application Support, then launch from there.
        let Some(staged) = photon_app_support_path() else {
            return Err("Không thể xác định thư mục HOME để cài đặt MPhoton.".to_string());
        };
        let staged_parent = staged.parent().unwrap();

        if staged.exists() {
            let _ = std::fs::remove_dir_all(&staged);
        }
        if let Err(e) = std::fs::create_dir_all(staged_parent) {
            return Err(format!("Không thể tạo thư mục cài đặt MPhoton: {e}"));
        }

        let copy_ok = Command::new("cp")
            .args(["-R", source.to_str().unwrap_or(""), staged.to_str().unwrap_or("")])
            .status()
            .map(|st| st.success())
            .unwrap_or(false);

        if !copy_ok || !is_valid_photon_bundle(&staged) {
            return Err(format!("Không thể sao chép MPhoton từ {} sang Application Support.", source.display()));
        }

        if spawn_photon(&staged) {
            return Ok("Đã cài đặt và khởi chạy MPhoton thành công".to_string());
        }

        Err("Đã sao chép MPhoton nhưng không thể khởi chạy.".to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("MPhoton hiện chỉ hỗ trợ trên hệ điều hành macOS.".to_string())
    }
}

#[tauri::command]
pub fn check_photon_studio_status() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let output1 = Command::new("pgrep").args(["-f", "MPhoton"]).output();
        if let Ok(out) = output1 {
            if out.status.success() {
                return Ok(true);
            }
        }

        let output2 = Command::new("pgrep").args(["-f", "Photon Studio"]).output();
        if let Ok(out) = output2 {
            return Ok(out.status.success());
        }

        Ok(false)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub fn terminate_photon_studio() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("pkill").args(["-9", "-f", "MPhoton"]).status();
        let _ = Command::new("pkill").args(["-9", "-f", "Photon Studio"]).status();

        Ok("Đã gửi lệnh đóng MPhoton".to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("MPhoton hiện chỉ hỗ trợ trên macOS.".to_string())
    }
}

#[tauri::command]
pub fn set_window_companion_mode(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window("main") {
        if enabled {
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 360.0, height: 580.0 })));
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 380.0, height: 680.0 }));
            let _ = window.set_always_on_top(true);

            if let Ok(Some(monitor)) = window.current_monitor() {
                let screen_size = monitor.size();
                let scale = monitor.scale_factor();
                let screen_width = screen_size.width as f64 / scale;
                let new_x = (screen_width - 400.0).max(20.0);
                let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition { x: new_x, y: 60.0 }));
            }
        } else {
            let _ = window.set_always_on_top(false);
            let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 1024.0, height: 680.0 })));
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1280.0, height: 800.0 }));
            let _ = window.center();
            let _ = window.set_focus();
        }
        Ok(())
    } else {
        Err("Không tìm thấy cửa sổ chính của Super-App".to_string())
    }
}

#[tauri::command]
pub fn minimize_main_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.minimize();
        Ok(())
    } else {
        Err("Không tìm thấy cửa sổ chính".to_string())
    }
}

#[tauri::command]
pub fn restore_main_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        Ok(())
    } else {
        Err("Không tìm thấy cửa sổ chính".to_string())
    }
}


