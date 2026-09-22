use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;

use rayon::prelude::*;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use super::types::{PhotoFile, ProgressEvent, ScanResult};

/// Image file extensions supported by the scanner
const _IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp", "heic", "heif",
    "raw", "cr2", "cr3", "nef", "arw", "orf", "rw2", "dng", "raf", "pef",
    "srw", "x3f", "3fr", "mef", "erf", "nrw", "rwl", "mrw",
    "svg", "ico", "psd", "ai", "eps",
];

/// Extracts the numeric portion from a filename for matching purposes.
/// Example: "IMG01234.JPG" -> "01234", "MVD000123.CR2" -> "000123"
fn extract_number_from_filename(filename: &str) -> String {
    let name_without_ext = Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);

    let numbers: String = name_without_ext
        .chars()
        .rev()
        .take_while(|c| c.is_ascii_digit())
        .collect::<String>()
        .chars()
        .rev()
        .collect();

    if numbers.is_empty() {
        // Try to find the longest numeric sequence in the filename
        let mut longest = String::new();
        let mut current = String::new();
        for ch in name_without_ext.chars() {
            if ch.is_ascii_digit() {
                current.push(ch);
            } else {
                if current.len() > longest.len() {
                    longest = current.clone();
                }
                current.clear();
            }
        }
        if current.len() > longest.len() {
            longest = current;
        }
        longest
    } else {
        numbers
    }
}

/// Scans multiple folders for image files using multi-threaded traversal.
/// Emits progress events back to the frontend via Tauri's event system.
#[tauri::command]
pub async fn scan_folders(
    app: AppHandle,
    paths: Vec<String>,
    options: super::types::ScanOptions,
    cancelled: tauri::State<'_, Arc<AtomicBool>>,
) -> Result<ScanResult, String> {
    let start = Instant::now();
    cancelled.store(false, Ordering::SeqCst);
    let cancelled_flag = cancelled.inner().clone();

    // First pass: count total files for progress calculation
    let total_files = Arc::new(AtomicUsize::new(0));
    let processed_files = Arc::new(AtomicUsize::new(0));
    let total_folders = Arc::new(AtomicUsize::new(0));

    // Collect all file entries first
    let mut all_entries: Vec<walkdir::DirEntry> = Vec::new();

    for path in &paths {
        if cancelled_flag.load(Ordering::SeqCst) {
            return Ok(ScanResult {
                total_files: 0,
                total_folders: 0,
                files: Vec::new(),
                elapsed_ms: start.elapsed().as_millis() as u64,
            });
        }

        let mut walker = WalkDir::new(path).into_iter();
        
        while let Some(entry_result) = walker.next() {
            if let Ok(entry) = entry_result {
                if entry.file_type().is_dir() {
                    // If not recursive and depth > 0, skip this directory
                    if !options.recursive && entry.depth() > 0 {
                        walker.skip_current_dir();
                        continue;
                    }
                    total_folders.fetch_add(1, Ordering::Relaxed);
                } else if entry.file_type().is_file() {
                    let path = entry.path();
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        let ext_lower = ext.to_lowercase();
                        
                        let is_jpg = ext_lower == "jpg" || ext_lower == "jpeg";
                        let is_raw = matches!(
                            ext_lower.as_str(),
                            "cr2" | "cr3" | "arw" | "nef" | "orf" | "raf" | "dng" | "rw2"
                        );

                        // If both options are false, accept all valid images (fallback/default behavior)
                        // If any option is true, only accept matching types
                        let valid = if options.filter_raw || options.filter_jpg {
                            (options.filter_raw && is_raw) || (options.filter_jpg && is_jpg)
                        } else {
                            is_jpg || is_raw || matches!(ext_lower.as_str(), "png" | "heic" | "heif" | "tiff")
                        };

                        if valid {
                            all_entries.push(entry);
                        }
                    }
                }
            }
        }
    }

    let total = all_entries.len();
    total_files.store(total, Ordering::SeqCst);

    let _ = app.emit(
        "scan-progress",
        ProgressEvent {
            current: 0,
            total,
            percentage: 0.0,
            message: format!("Found {} image files, indexing...", total),
            eta_seconds: None,
            speed: None,
        },
    );

    // Process files in parallel using rayon
    let app_clone = app.clone();
    let processed_clone = processed_files.clone();
    let cancelled_clone = cancelled_flag.clone();
    let start_clone = start;

    let photos: Vec<PhotoFile> = all_entries
        .par_iter()
        .filter_map(|entry| {
            if cancelled_clone.load(Ordering::SeqCst) {
                return None;
            }

            let path = entry.path();
            let full_path = path.to_string_lossy().to_string();
            let filename = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let extension = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let folder = path
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let normalized_number = extract_number_from_filename(&filename);

            let current = processed_clone.fetch_add(1, Ordering::SeqCst) + 1;

            // Emit progress every 500 files to avoid flooding
            if current % 500 == 0 || current == total {
                let elapsed = start_clone.elapsed().as_secs_f64();
                let speed = current as f64 / elapsed;
                let remaining = total.saturating_sub(current) as f64 / speed;

                let _ = app_clone.emit(
                    "scan-progress",
                    ProgressEvent {
                        current,
                        total,
                        percentage: (current as f64 / total as f64) * 100.0,
                        message: format!("Indexing: {}/{}", current, total),
                        eta_seconds: Some(remaining),
                        speed: Some(format!("{:.0} files/s", speed)),
                    },
                );
            }

            Some(PhotoFile {
                full_path,
                filename,
                extension,
                folder,
                size,
                normalized_number,
            })
        })
        .collect();

    let elapsed = start.elapsed().as_millis() as u64;
    let folder_count = total_folders.load(Ordering::SeqCst);

    let _ = app.emit(
        "scan-progress",
        ProgressEvent {
            current: total,
            total,
            percentage: 100.0,
            message: format!(
                "Scan complete: {} files in {}ms",
                photos.len(),
                elapsed
            ),
            eta_seconds: Some(0.0),
            speed: None,
        },
    );

    Ok(ScanResult {
        total_files: photos.len(),
        total_folders: folder_count,
        files: photos,
        elapsed_ms: elapsed,
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CustomerFolderItem {
    pub folder_path: String,
    pub folder_name: String,
    pub day_name: Option<String>,
    pub month_name: Option<String>,
    pub image_count: usize,
}

fn is_asset_subfolder_name(name: &str) -> bool {
    let lower = name.trim().to_lowercase();
    let norm: String = lower
        .replace('đ', "d")
        .replace('á', "a")
        .replace('à', "a")
        .replace('ả', "a")
        .replace('ã', "a")
        .replace('ạ', "a")
        .replace('ă', "a")
        .replace('ắ', "a")
        .replace('ằ', "a")
        .replace('ẳ', "a")
        .replace('ẵ', "a")
        .replace('ặ', "a")
        .replace('â', "a")
        .replace('ấ', "a")
        .replace('ầ', "a")
        .replace('ẩ', "a")
        .replace('ẫ', "a")
        .replace('ậ', "a")
        .replace('é', "e")
        .replace('è', "e")
        .replace('ẻ', "e")
        .replace('ẽ', "e")
        .replace('ẹ', "e")
        .replace('ê', "e")
        .replace('ế', "e")
        .replace('ề', "e")
        .replace('ể', "e")
        .replace('ễ', "e")
        .replace('ệ', "e")
        .replace('í', "i")
        .replace('ì', "i")
        .replace('ỉ', "i")
        .replace('ĩ', "i")
        .replace('ị', "i")
        .replace('ó', "o")
        .replace('ò', "o")
        .replace('ỏ', "o")
        .replace('õ', "o")
        .replace('ọ', "o")
        .replace('ô', "o")
        .replace('ố', "o")
        .replace('ồ', "o")
        .replace('ổ', "o")
        .replace('ỗ', "o")
        .replace('ộ', "o")
        .replace('ơ', "o")
        .replace('ớ', "o")
        .replace('ờ', "o")
        .replace('ở', "o")
        .replace('ỡ', "o")
        .replace('ợ', "o")
        .replace('ú', "u")
        .replace('ù', "u")
        .replace('ủ', "u")
        .replace('ũ', "u")
        .replace('ụ', "u")
        .replace('ư', "u")
        .replace('ứ', "u")
        .replace('ừ', "u")
        .replace('ử', "u")
        .replace('ữ', "u")
        .replace('ự', "u")
        .replace('ý', "y")
        .replace('ỳ', "y")
        .replace('ỷ', "y")
        .replace('ỹ', "y")
        .replace('ỵ', "y");

    matches!(
        norm.as_str(),
        "raw" | "jpg" | "jpeg" | "png" | "cr2" | "cr3" | "nef" | "arw" | "dng"
            | "export" | "exports" | "xuat" | "xuat jpg" | "selected" | "select" | "chon"
            | "goc" | "file goc" | "anh goc" | "coc" | "chup" | "chua loc"
            | "final" | "edited" | "done" | "da sua" | "da loc" | "loc"
            | "psd" | "tif" | "tiff" | "backup" | "edit" | "retouch" | "blend" | "in" | "album" | "preview"
    )
}

fn get_immediate_subdirs(dir: &Path) -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.starts_with('.') {
                    dirs.push(p);
                }
            }
        }
    }
    dirs.sort_by(|a, b| a.file_name().cmp(&b.file_name()));
    dirs
}

/// Recursively and intelligently expands input paths (Month folder, Day folder, or Customer folders)
/// into a flat list of individual Customer Folder items with 2-level parallel traversal.
/// Ultra-fast: avoids deep file counting to prevent hanging on Google Drive / network drives.
#[tauri::command]
pub fn expand_batch_customer_folders(paths: Vec<String>) -> Result<Vec<CustomerFolderItem>, String> {
    use std::collections::HashSet;
    let mut results: Vec<CustomerFolderItem> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();

    for path_str in paths {
        let root = Path::new(&path_str);
        if !root.exists() || !root.is_dir() {
            continue;
        }

        let child_dirs = get_immediate_subdirs(root);

        // Check if child_dirs is empty or ALL child_dirs are asset subfolders (like raw/jpg)
        let has_only_asset_subdirs = !child_dirs.is_empty()
            && child_dirs.iter().all(|d| {
                let name = d.file_name().map(|n| n.to_string_lossy()).unwrap_or_default();
                is_asset_subfolder_name(&name)
            });

        if child_dirs.is_empty() || has_only_asset_subdirs {
            // This directory itself is a Customer Folder!
            let p_str = root.to_string_lossy().to_string();
            if !seen_paths.contains(&p_str) {
                seen_paths.insert(p_str.clone());
                let folder_name = root
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| p_str.clone());
                results.push(CustomerFolderItem {
                    folder_path: p_str,
                    folder_name,
                    day_name: None,
                    month_name: None,
                    image_count: 0,
                });
            }
            continue;
        }

        // Check if this is a Month folder:
        // A Month folder has children (Days) whose own children contain customer folders (non-asset subdirs)
        let is_month_folder = child_dirs.iter().take(5).any(|d| {
            let sub_sub = get_immediate_subdirs(d);
            sub_sub.iter().any(|sub_p| {
                let name = sub_p.file_name().map(|n| n.to_string_lossy()).unwrap_or_default();
                !is_asset_subfolder_name(&name)
            })
        });

        if is_month_folder {
            let month_name = root.file_name().map(|n| n.to_string_lossy().to_string());

            // Scan each Day folder in parallel
            let day_results: Vec<Vec<CustomerFolderItem>> = child_dirs
                .par_iter()
                .map(|day_dir| {
                    let day_name = day_dir.file_name().map(|n| n.to_string_lossy().to_string());
                    let mut items: Vec<CustomerFolderItem> = Vec::new();
                    let cust_dirs = get_immediate_subdirs(day_dir);

                    for p in cust_dirs {
                        let name = p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                        if !is_asset_subfolder_name(&name) {
                            items.push(CustomerFolderItem {
                                folder_path: p.to_string_lossy().to_string(),
                                folder_name: name,
                                day_name: day_name.clone(),
                                month_name: month_name.clone(),
                                image_count: 0,
                            });
                        }
                    }
                    items
                })
                .collect();

            for items in day_results {
                for item in items {
                    if !seen_paths.contains(&item.folder_path) {
                        seen_paths.insert(item.folder_path.clone());
                        results.push(item);
                    }
                }
            }
        } else {
            // It's a Day folder (contains customer folders directly: 1-9 8h Hà Tiny, etc.)
            let day_name = root.file_name().map(|n| n.to_string_lossy().to_string());
            let month_name = root
                .parent()
                .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()));

            for cust_dir in child_dirs {
                let name = cust_dir.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                if !is_asset_subfolder_name(&name) {
                    let p_str = cust_dir.to_string_lossy().to_string();
                    if !seen_paths.contains(&p_str) {
                        seen_paths.insert(p_str.clone());
                        results.push(CustomerFolderItem {
                            folder_path: p_str,
                            folder_name: name,
                            day_name: day_name.clone(),
                            month_name: month_name.clone(),
                            image_count: 0,
                        });
                    }
                }
            }
        }
    }

    Ok(results)
}

/// Cancels an ongoing scan operation
#[tauri::command]
pub async fn cancel_scan(
    cancelled: tauri::State<'_, Arc<AtomicBool>>,
) -> Result<(), String> {
    cancelled.store(true, Ordering::SeqCst);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_number_trailing() {
        assert_eq!(extract_number_from_filename("IMG01234.JPG"), "01234");
    }

    #[test]
    fn test_extract_number_with_prefix() {
        assert_eq!(extract_number_from_filename("MVD000123.CR2"), "000123");
    }

    #[test]
    fn test_extract_number_only_digits() {
        assert_eq!(extract_number_from_filename("01234.jpg"), "01234");
    }

    #[test]
    fn test_extract_number_complex() {
        assert_eq!(extract_number_from_filename("DSC_1234_edit.tif"), "1234");
    }

    #[test]
    fn test_extract_number_no_digits() {
        assert_eq!(extract_number_from_filename("photo.jpg"), "");
    }

    #[test]
    fn test_expand_batch_customer_folders() {
        use std::fs::{create_dir_all, File};

        let temp_dir = std::env::temp_dir().join(format!("mvd_test_batch_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        let cust1 = temp_dir.join("Tháng 9").join("01-09").join("1-9 8h Hà Tiny 2cc");
        let cust2 = temp_dir.join("Tháng 9").join("01-09").join("1-9 9h Như Quỳnh 1cc");
        let cust3 = temp_dir.join("Tháng 9").join("02-09").join("2-9 10h Linh Thùy 1cc");

        create_dir_all(&cust1).unwrap();
        create_dir_all(&cust2).unwrap();
        create_dir_all(&cust3).unwrap();

        File::create(cust1.join("IMG_0001.JPG")).unwrap();
        File::create(cust2.join("IMG_0002.CR3")).unwrap();
        File::create(cust3.join("IMG_0003.ARW")).unwrap();

        let month_path = temp_dir.join("Tháng 9").to_string_lossy().to_string();
        let items = expand_batch_customer_folders(vec![month_path]).unwrap();

        assert_eq!(items.len(), 3);
        let names: Vec<String> = items.into_iter().map(|it| it.folder_name).collect();
        assert!(names.contains(&"1-9 8h Hà Tiny 2cc".to_string()));
        assert!(names.contains(&"1-9 9h Như Quỳnh 1cc".to_string()));
        assert!(names.contains(&"2-9 10h Linh Thùy 1cc".to_string()));

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
