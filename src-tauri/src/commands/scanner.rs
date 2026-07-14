use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;

use rayon::prelude::*;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use super::types::{PhotoFile, ProgressEvent, ScanResult};

/// Image file extensions supported by the scanner
const IMAGE_EXTENSIONS: &[&str] = &[
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
}
