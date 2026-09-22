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
fn repair_framework_symlinks(bundle_path: &Path) -> Result<(), String> {
    use std::os::unix::fs::symlink;

    let frameworks_dir = bundle_path.join("Contents").join("Frameworks");
    if !frameworks_dir.exists() || !frameworks_dir.is_dir() {
        return Ok(());
    }

    let entries = fs::read_dir(&frameworks_dir)
        .map_err(|e| format!("Không thể đọc thư mục Frameworks: {e}"))?;

    for entry in entries.flatten() {
        let fw_path = entry.path();
        if !fw_path.is_dir() {
            continue;
        }
        let fw_name = match fw_path.file_name().and_then(|n| n.to_str()) {
            Some(name) if name.ends_with(".framework") => name,
            _ => continue,
        };

        let versions_dir = fw_path.join("Versions");
        let version_a_dir = versions_dir.join("A");
        if !version_a_dir.exists() || !version_a_dir.is_dir() {
            continue;
        }

        // 1. Ensure Versions/Current points to A
        let current_link = versions_dir.join("Current");
        let needs_current_symlink = match fs::symlink_metadata(&current_link) {
            Ok(meta) => {
                if meta.file_type().is_symlink() {
                    fs::read_link(&current_link)
                        .map(|target| target != Path::new("A"))
                        .unwrap_or(true)
                } else {
                    if meta.is_dir() {
                        let _ = fs::remove_dir_all(&current_link);
                    } else {
                        let _ = fs::remove_file(&current_link);
                    }
                    true
                }
            }
            Err(_) => true,
        };

        if needs_current_symlink {
            let _ = fs::remove_file(&current_link);
            let _ = fs::remove_dir_all(&current_link);
            symlink("A", &current_link)
                .map_err(|e| format!("Không thể tạo symlink Current -> A trong {fw_name}: {e}"))?;
        }

        // 2. For every item in Versions/A, ensure root of framework has symlink to Versions/Current/<item>
        if let Ok(a_entries) = fs::read_dir(&version_a_dir) {
            for a_entry in a_entries.flatten() {
                let item_name = a_entry.file_name();
                let item_name_str = match item_name.to_str() {
                    Some(s) => s,
                    None => continue,
                };

                let root_item = fw_path.join(&item_name);
                let target_rel_path = format!("Versions/Current/{}", item_name_str);

                let needs_symlink = match fs::symlink_metadata(&root_item) {
                    Ok(meta) => {
                        if meta.file_type().is_symlink() {
                            fs::read_link(&root_item)
                                .map(|target| target != Path::new(&target_rel_path))
                                .unwrap_or(true)
                        } else {
                            if meta.is_dir() {
                                let _ = fs::remove_dir_all(&root_item);
                            } else {
                                let _ = fs::remove_file(&root_item);
                            }
                            true
                        }
                    }
                    Err(_) => true,
                };

                if needs_symlink {
                    let _ = fs::remove_file(&root_item);
                    let _ = fs::remove_dir_all(&root_item);
                    symlink(&target_rel_path, &root_item).map_err(|e| {
                        format!("Không thể tạo symlink {item_name_str} trong {fw_name}: {e}")
                    })?;
                }
            }
        }
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn prepare_and_sign_bundle(p: &Path) -> Result<(), String> {
    let p_str = p.to_str().ok_or("Đường dẫn không hợp lệ")?;

    // 1. Repair framework symlinks if dereferenced or damaged by bundler
    repair_framework_symlinks(p)?;

    // 2. Strip quarantine attributes
    let _ = Command::new("xattr").args(["-cr", p_str]).status();

    // 3. Ensure executable permissions
    let _ = Command::new("chmod").args(["-R", "+x", p_str]).status();

    // 4. Check if signature is already valid; if not, re-sign ad-hoc
    let verify_status = Command::new("codesign")
        .args(["--verify", "--deep", "--strict", p_str])
        .status();

    let needs_signing = match verify_status {
        Ok(st) => !st.success(),
        Err(_) => true,
    };

    if needs_signing {
        let sign_status = Command::new("codesign")
            .args(["--force", "--deep", "-s", "-", p_str])
            .status()
            .map_err(|e| format!("Lỗi khi chạy codesign: {e}"))?;

        if !sign_status.success() {
            return Err("Không thể ký mã (codesign) cho MPhoton.app".to_string());
        }
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn spawn_photon(p: &Path) -> bool {
    let binary_file = p.join("Contents").join("MacOS").join(photon_binary_name(p));
    let p_str = p.to_str().unwrap_or("");

    // If already running, bring window to front
    if check_photon_studio_status().unwrap_or(false) {
        let _ = Command::new("open").args([p_str]).status();
        return true;
    }

    // Ensure the bundle is repaired and validly signed
    if let Err(e) = prepare_and_sign_bundle(p) {
        eprintln!("[MPhoton] prepare_and_sign_bundle warning: {e}");
    }

    // Clean up stale Electron Singleton locks to prevent instant quit
    if let Ok(home) = std::env::var("HOME") {
        let p_support = Path::new(&home).join("Library/Application Support/Photon Studio");
        let _ = std::fs::remove_file(p_support.join("SingletonLock"));
        let _ = std::fs::remove_file(p_support.join("SingletonSocket"));
        let _ = std::fs::remove_file(p_support.join("SingletonCookie"));
    }

    // 1. Primary: launch via open -n with env vars (LaunchServices handles macOS window lifecycle)
    let open_ok = Command::new("open")
        .args([
            "-n",
            "--env", "PHOTON_E2E_ALLOW_MULTIPLE_INSTANCES=1",
            "--env", "PHOTON_DISABLE_QUIT_CONFIRM=1",
            p_str,
        ])
        .status()
        .map(|st| st.success())
        .unwrap_or(false);

    if open_ok {
        // Wait and verify the process is alive (prevents false positive if it immediately exits)
        for _ in 0..10 {
            std::thread::sleep(std::time::Duration::from_millis(150));
            if check_photon_studio_status().unwrap_or(false) {
                return true;
            }
        }
    }

    // 2. Fallback: direct binary execution
    if Command::new(&binary_file)
        .env("PHOTON_E2E_ALLOW_MULTIPLE_INSTANCES", "1")
        .env("PHOTON_DISABLE_QUIT_CONFIRM", "1")
        .spawn()
        .is_ok()
    {
        for _ in 0..10 {
            std::thread::sleep(std::time::Duration::from_millis(150));
            if check_photon_studio_status().unwrap_or(false) {
                return true;
            }
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

        // 2. Not staged yet or failed — find a source bundle (dev workspace, app resources, or /Applications)
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

        // 3. Stage it: copy out of the source into Application Support, then repair & launch
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
            .args(["-Rp", source.to_str().unwrap_or(""), staged.to_str().unwrap_or("")])
            .status()
            .map(|st| st.success())
            .unwrap_or(false);

        if !copy_ok || !is_valid_photon_bundle(&staged) {
            return Err(format!("Không thể sao chép MPhoton từ {} sang Application Support.", source.display()));
        }

        if spawn_photon(&staged) {
            return Ok("Đã cài đặt và khởi chạy MPhoton thành công".to_string());
        }

        Err("Đã sao chép MPhoton nhưng không thể khởi chạy. Vui lòng kiểm tra quyền hệ thống.".to_string())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "macos")]
    fn test_repair_and_sign_corrupted_production_frameworks() {
        let prod_source = Path::new("/Applications/MVD PHOTOSHOP ACADEMY.app/Contents/Resources/resources/apps/MPhoton.app");
        if !prod_source.exists() {
            return;
        }

        let temp_dir = std::env::temp_dir().join("test_mphoton_repair");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);
        let test_bundle = temp_dir.join("MPhoton.app");

        // Copy the raw corrupted production bundle
        let copy_status = Command::new("cp")
            .args(["-Rp", prod_source.to_str().unwrap(), test_bundle.to_str().unwrap()])
            .status()
            .expect("Failed to copy test bundle");
        assert!(copy_status.success());

        // Prior to repair, codesign verify should fail due to broken symlinks / modified Info.plist
        let pre_verify = Command::new("codesign")
            .args(["--verify", "--deep", "--strict", test_bundle.to_str().unwrap()])
            .status()
            .expect("Failed to run codesign");
        assert!(!pre_verify.success(), "Corrupted bundle should fail verify initially");

        // Run repair and sign
        assert!(prepare_and_sign_bundle(&test_bundle).is_ok());

        // After repair, codesign verify must succeed
        let post_verify = Command::new("codesign")
            .args(["--verify", "--deep", "--strict", test_bundle.to_str().unwrap()])
            .status()
            .expect("Failed to run codesign");
        assert!(post_verify.success(), "Repaired bundle must pass codesign verify");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}



