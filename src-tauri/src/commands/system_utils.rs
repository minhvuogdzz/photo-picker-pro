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

