use std::path::Path;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

const FINISHED_EXTS: &[&str] = &["jpg", "jpeg", "png", "tif", "tiff", "webp"];
const RAW_EXTS: &[&str] = &["cr2", "cr3", "nef", "arw", "raf", "dng", "orf", "rw2", "pef"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderMetadataSummary {
    pub folder_path: String,
    pub folder_name: String,
    pub depth: usize,
    pub finished_image_count: usize,
    pub raw_image_count: usize,
    pub subfolder_names: Vec<String>,
    pub representative_extensions: Vec<String>,
}

/// Performs a lightweight directory scan collecting only folder topology and file counts.
/// Does NOT read file contents or decode images.
#[tauri::command]
pub async fn scan_folder_topology(root_path: String, max_depth: Option<usize>) -> Result<Vec<FolderMetadataSummary>, String> {
    tauri::async_runtime::spawn_blocking(move || scan_folder_topology_sync(&root_path, max_depth))
        .await
        .map_err(|e| format!("Lỗi luồng quét thư mục: {}", e))?
}

fn scan_folder_topology_sync(root_path: &str, max_depth: Option<usize>) -> Result<Vec<FolderMetadataSummary>, String> {
    let root = Path::new(root_path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Thư mục không tồn tại: {}", root_path));
    }

    let mut walker = WalkDir::new(root).into_iter();
    let max_depth = max_depth.unwrap_or(10);

    let mut folders_map = std::collections::HashMap::<String, FolderMetadataSummary>::new();

    while let Some(entry_result) = walker.next() {
        let entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let depth = entry.depth();
        if depth > max_depth {
            walker.skip_current_dir();
            continue;
        }

        let path = entry.path();
        if entry.file_type().is_dir() {
            let folder_name = entry.file_name().to_string_lossy().to_string();
            // Skip hidden subdirectories (e.g. .git, .Trash, .Spotlight-V100) while
            // never skipping depth 0 root (which may live under .shortcut-targets-by-id).
            if depth > 0 && folder_name.starts_with('.') {
                walker.skip_current_dir();
                continue;
            }
            let path_str = path.to_string_lossy().to_string();

            folders_map.entry(path_str.clone()).or_insert_with(|| FolderMetadataSummary {
                folder_path: path_str,
                folder_name,
                depth,
                finished_image_count: 0,
                raw_image_count: 0,
                subfolder_names: Vec::new(),
                representative_extensions: Vec::new(),
            });

            // Add as child to parent folder
            if let Some(parent) = path.parent() {
                let parent_str = parent.to_string_lossy().to_string();
                if let Some(parent_summary) = folders_map.get_mut(&parent_str) {
                    let child_name = entry.file_name().to_string_lossy().to_string();
                    if !parent_summary.subfolder_names.contains(&child_name) {
                        parent_summary.subfolder_names.push(child_name);
                    }
                }
            }
        } else if entry.file_type().is_file() {
            if let Some(parent) = path.parent() {
                let parent_str = parent.to_string_lossy().to_string();
                if let Some(summary) = folders_map.get_mut(&parent_str) {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()) {
                        if FINISHED_EXTS.contains(&ext.as_str()) {
                            summary.finished_image_count += 1;
                        } else if RAW_EXTS.contains(&ext.as_str()) {
                            summary.raw_image_count += 1;
                        }

                        if !summary.representative_extensions.contains(&ext) && summary.representative_extensions.len() < 8 {
                            summary.representative_extensions.push(ext);
                        }
                    }
                }
            }
        }
    }

    let mut result: Vec<FolderMetadataSummary> = folders_map.into_values().collect();
    // Sort by depth ascending, then by folder path
    result.sort_by(|a, b| a.depth.cmp(&b.depth).then_with(|| a.folder_path.cmp(&b.folder_path)));

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, File};

    #[test]
    fn skips_hidden_subdirectories_but_allows_hidden_ancestor_root() {
        let base = std::env::temp_dir().join(format!(
            "dh_sheet_fs_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let root = base.join(".shortcut-targets-by-id").join("CustomerA");
        let visible_child = root.join("Edit");
        let hidden_child = root.join(".hidden_cache");
        create_dir_all(&visible_child).unwrap();
        create_dir_all(&hidden_child).unwrap();
        File::create(visible_child.join("001.jpg")).unwrap();
        File::create(hidden_child.join("002.jpg")).unwrap();

        let summaries = scan_folder_topology_sync(&root.to_string_lossy(), Some(5)).unwrap();
        let names: Vec<&str> = summaries.iter().map(|s| s.folder_name.as_str()).collect();
        assert!(names.contains(&"CustomerA"));
        assert!(names.contains(&"Edit"));
        assert!(!names.contains(&".hidden_cache"));

        let edit = summaries.iter().find(|s| s.folder_name == "Edit").unwrap();
        assert_eq!(edit.finished_image_count, 1);

        let _ = std::fs::remove_dir_all(base);
    }
}
