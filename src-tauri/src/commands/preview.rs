use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use rayon::prelude::*;
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use super::types::PhotoFile;

const VALID_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif",
    "cr2", "cr3", "arw", "nef", "orf", "rw2", "dng", "raf",
    "pef", "srw", "x3f", "heic", "heif", "psd",
];

/// Get local disk thumbnail cache directory
fn get_cache_dir() -> PathBuf {
    let base = dirs::cache_dir().unwrap_or_else(std::env::temp_dir);
    let dir = base.join("mvd_photo_picker_thumbs");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// Computes cache key hash based on file path, size, mtime, and requested max size
fn get_cache_key(file_path: &str, max_size: u32) -> String {
    let mut hasher = Sha256::new();
    hasher.update(file_path.as_bytes());
    if let Ok(meta) = fs::metadata(file_path) {
        hasher.update(&meta.len().to_le_bytes());
        if let Ok(mtime) = meta.modified() {
            if let Ok(dur) = mtime.duration_since(std::time::UNIX_EPOCH) {
                hasher.update(&dur.as_secs().to_le_bytes());
            }
        }
    }
    hasher.update(&max_size.to_le_bytes());
    hasher.update(b"v4_rotated_upright");
    format!("{:x}", hasher.finalize())
}

/// Helper function to extract number from filename
fn extract_number(filename: &str) -> String {
    let name_stem = Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);

    let numbers: String = name_stem
        .chars()
        .rev()
        .take_while(|c| c.is_ascii_digit())
        .collect::<String>()
        .chars()
        .rev()
        .collect();

    if numbers.is_empty() {
        let mut longest = String::new();
        let mut current = String::new();
        for ch in name_stem.chars() {
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

/// List all photos in a folder with fast metadata read
#[tauri::command]
pub async fn list_folder_photos(folder_path: String, recursive: Option<bool>) -> Result<Vec<PhotoFile>, String> {
    let folder = Path::new(&folder_path);
    if !folder.exists() {
        return Err(format!("Thư mục không tồn tại: {}", folder_path));
    }

    let is_recursive = recursive.unwrap_or(false);
    let mut files = Vec::new();

    let mut walker = WalkDir::new(folder).into_iter();
    while let Some(entry_result) = walker.next() {
        let entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        if entry.file_type().is_dir() {
            if !is_recursive && entry.depth() > 0 {
                walker.skip_current_dir();
                continue;
            }
            continue;
        }

        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if VALID_EXTENSIONS.contains(&ext.as_str()) {
            let filename = path
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or("")
                .to_string();

            let parent_folder = path
                .parent()
                .and_then(|p| p.to_str())
                .unwrap_or("")
                .to_string();

            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let normalized_number = extract_number(&filename);

            files.push(PhotoFile {
                full_path: path.to_string_lossy().to_string(),
                filename,
                extension: ext,
                folder: parent_folder,
                size,
                normalized_number,
            });
        }
    }

    // Sort naturally by filename
    files.sort_by(|a, b| a.filename.cmp(&b.filename));

    Ok(files)
}

/// Reads the EXIF/TIFF orientation from RAW container headers (Little-Endian 'II' and Big-Endian 'MM')
fn extract_raw_orientation(buf: &[u8]) -> u16 {
    // Little-endian TIFF tag for Orientation: 0x0112, type 3 (SHORT), count 1
    // Byte sequence: [0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00]
    let pattern_le = [0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00];
    if let Some(pos) = buf.windows(pattern_le.len()).position(|w| w == pattern_le) {
        if pos + 10 <= buf.len() {
            let val = u16::from_le_bytes([buf[pos + 8], buf[pos + 9]]);
            if val >= 1 && val <= 8 {
                return val;
            }
        }
    }

    // Big-endian TIFF tag for Orientation: 0x0112, type 3 (SHORT), count 1
    // Byte sequence: [0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01]
    let pattern_be = [0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01];
    if let Some(pos) = buf.windows(pattern_be.len()).position(|w| w == pattern_be) {
        if pos + 10 <= buf.len() {
            let val = u16::from_be_bytes([buf[pos + 8], buf[pos + 9]]);
            if val >= 1 && val <= 8 {
                return val;
            }
        }
    }

    1
}

/// Extracts embedded JPEG preview from camera RAW files (Canon CR2/CR3, Sony ARW, Nikon NEF, DNG, RAF...)
/// This is 100x faster than full software decoding because cameras embed full-resolution JPEGs directly inside RAW metadata.
fn extract_embedded_jpeg(path: &Path, max_size: u32) -> Option<(Vec<u8>, u16)> {
    use std::io::Read;
    let mut file = fs::File::open(path).ok()?;
    // Read up to 16MB from start of file (previews are always stored in the beginning container metadata)
    let mut buf = vec![0u8; 16 * 1024 * 1024];
    let n = file.read(&mut buf).ok()?;
    if n < 4 {
        return None;
    }
    buf.truncate(n);

    let orientation = extract_raw_orientation(&buf);

    let mut jpegs: Vec<(usize, usize)> = Vec::new(); // (start, length)
    let len = buf.len();
    let mut pos = 0;

    while pos + 3 < len {
        if buf[pos] == 0xFF && buf[pos + 1] == 0xD8 && buf[pos + 2] == 0xFF {
            let start = pos;
            // Search for end marker 0xFF, 0xD9
            let mut search_pos = start + 3;
            let mut end_pos = None;
            while search_pos + 1 < len {
                if buf[search_pos] == 0xFF && buf[search_pos + 1] == 0xD9 {
                    end_pos = Some(search_pos + 2);
                    break;
                }
                search_pos += 1;
            }

            if let Some(end) = end_pos {
                let size = end - start;
                // Only consider valid JPEGs > 8KB
                if size > 8 * 1024 {
                    jpegs.push((start, size));
                }
                pos = end;
                continue;
            }
        }
        pos += 1;
    }

    if jpegs.is_empty() {
        return None;
    }

    // Select candidate based on max_size
    let chosen = if max_size <= 400 {
        // For thumbnail: prefer a medium preview (50KB to 600KB) if exists, else largest
        jpegs
            .iter()
            .find(|(_, sz)| *sz >= 50 * 1024 && *sz <= 600 * 1024)
            .or_else(|| jpegs.iter().max_by_key(|(_, sz)| *sz))
    } else {
        // For high-res hover/lightbox: pick largest preview
        jpegs.iter().max_by_key(|(_, sz)| *sz)
    };

    chosen.map(|(start, size)| (buf[*start..*start + *size].to_vec(), orientation))
}

/// Generates or reads a cached thumbnail for a single photo file (JPG, PNG, or RAW)
pub fn generate_or_get_thumbnail(file_path: &str, max_size: u32) -> Result<String, String> {
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File không tồn tại: {}", file_path));
    }

    let cache_dir = get_cache_dir();
    let cache_key = get_cache_key(file_path, max_size);
    let cache_file = cache_dir.join(format!("{}.jpg", cache_key));

    // 1. If already cached, read from disk (instant 0ms)
    if cache_file.exists() {
        if let Ok(bytes) = fs::read(&cache_file) {
            if !bytes.is_empty() {
                return Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(&bytes)));
            }
        }
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // 2. If it's a standard web image (JPG/PNG/WEBP) and small enough, read directly
    if ext == "jpg" || ext == "jpeg" || ext == "png" || ext == "webp" {
        if let Ok(meta) = fs::metadata(path) {
            if meta.len() <= 1500 * 1024 {
                if let Ok(bytes) = fs::read(path) {
                    let mime = if ext == "png" {
                        "image/png"
                    } else if ext == "webp" {
                        "image/webp"
                    } else {
                        "image/jpeg"
                    };
                    return Ok(format!("data:{};base64,{}", mime, STANDARD.encode(&bytes)));
                }
            }
        }
    }

    // 3. For RAW camera files (CR2, CR3, ARW, NEF, RAF, DNG, ORF, RW2...):
    // Super fast embedded JPEG extraction (< 5ms) directly from the camera-generated stream
    let is_raw = matches!(
        ext.as_str(),
        "cr2" | "cr3" | "arw" | "nef" | "orf" | "rw2" | "dng" | "raf" | "pef" | "srw" | "x3f"
    );

    if is_raw {
        if let Some((jpeg_bytes, orientation)) = extract_embedded_jpeg(path, max_size) {
            let _ = fs::write(&cache_file, &jpeg_bytes);

            // If photo was taken vertically (Orientation 6, 8, 3), rotate upright!
            let rotation_degrees = match orientation {
                6 => 90,
                8 => 270,
                3 => 180,
                _ => 0,
            };

            if rotation_degrees > 0 {
                #[cfg(target_os = "macos")]
                {
                    let _ = Command::new("sips")
                        .arg("-r")
                        .arg(rotation_degrees.to_string())
                        .arg(&cache_file)
                        .output();
                }
            }

            if let Ok(final_bytes) = fs::read(&cache_file) {
                return Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(&final_bytes)));
            }
            return Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(&jpeg_bytes)));
        }
    }

    // 4. Fallback to sips / qlmanage on macOS for other formats or RAW without embedded preview
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("sips")
            .arg("-s")
            .arg("format")
            .arg("jpeg")
            .arg("-Z")
            .arg(max_size.to_string())
            .arg(file_path)
            .arg("--out")
            .arg(&cache_file)
            .output();

        match status {
            Ok(output) => {
                if output.status.success() && cache_file.exists() {
                    if let Ok(bytes) = fs::read(&cache_file) {
                        return Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(&bytes)));
                    }
                }
                let err_msg = String::from_utf8_lossy(&output.stderr);
                // Fallback to quicklook qlmanage if sips had an issue
                let ql_status = Command::new("qlmanage")
                    .arg("-t")
                    .arg("-s")
                    .arg(max_size.to_string())
                    .arg("-o")
                    .arg(&cache_dir)
                    .arg(file_path)
                    .output();

                if let Ok(ql_out) = ql_status {
                    if ql_out.status.success() {
                        // qlmanage names it filename.png
                        let ql_file = cache_dir.join(format!("{}.png", path.file_name().unwrap().to_string_lossy()));
                        if ql_file.exists() {
                            if let Ok(bytes) = fs::read(&ql_file) {
                                let _ = fs::remove_file(&ql_file);
                                let _ = fs::write(&cache_file, &bytes);
                                return Ok(format!("data:image/png;base64,{}", STANDARD.encode(&bytes)));
                            }
                        }
                    }
                }

                Err(format!("Không thể tạo preview: {}", err_msg))
            }
            Err(e) => Err(format!("Lỗi gọi sips: {}", e)),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Fallback for non-macOS platforms using the image crate
        let img = image::open(path).map_err(|e| format!("Lỗi mở ảnh: {}", e))?;
        let thumb = img.thumbnail(max_size, max_size);
        let mut buffer = std::io::Cursor::new(Vec::new());
        thumb
            .write_to(&mut buffer, image::ImageFormat::Jpeg)
            .map_err(|e| format!("Lỗi encode ảnh: {}", e))?;
        let bytes = buffer.into_inner();
        let _ = fs::write(&cache_file, &bytes);
        Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(&bytes)))
    }
}

/// Tauri command to get a single thumbnail (e.g. for hover high-res zoom)
#[tauri::command]
pub async fn get_photo_thumbnail(file_path: String, max_size: Option<u32>) -> Result<String, String> {
    let size = max_size.unwrap_or(360);
    // Offload CPU heavy work to a worker thread
    tauri::async_runtime::spawn_blocking(move || {
        generate_or_get_thumbnail(&file_path, size)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Tauri command to batch-generate thumbnails for visible photos in parallel using Rayon
#[tauri::command]
pub async fn get_photo_thumbnails_batch(
    file_paths: Vec<String>,
    max_size: Option<u32>,
) -> Result<HashMap<String, String>, String> {
    let size = max_size.unwrap_or(320);

    tauri::async_runtime::spawn_blocking(move || {
        let results: HashMap<String, String> = file_paths
            .par_iter()
            .filter_map(|path| {
                match generate_or_get_thumbnail(path, size) {
                    Ok(data_url) => Some((path.clone(), data_url)),
                    Err(_) => None,
                }
            })
            .collect();

        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Clear thumbnail cache on demand
#[tauri::command]
pub async fn clear_thumbnail_cache() -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let cache_dir = get_cache_dir();
        let mut freed_bytes = 0u64;
        if let Ok(entries) = fs::read_dir(cache_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    freed_bytes += meta.len();
                }
                let _ = fs::remove_file(entry.path());
            }
        }
        Ok(freed_bytes)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
pub struct CopyProgressResult {
    pub success_count: usize,
    pub failed_count: usize,
    pub errors: Vec<String>,
}

/// Copies selected rated photos to a destination folder
#[tauri::command]
pub async fn copy_photo_files(
    file_paths: Vec<String>,
    destination_folder: String,
) -> Result<CopyProgressResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dest_dir = Path::new(&destination_folder);
        if !dest_dir.exists() {
            fs::create_dir_all(dest_dir).map_err(|e| format!("Không thể tạo thư mục đích: {}", e))?;
        }

        let mut success_count = 0;
        let mut failed_count = 0;
        let mut errors = Vec::new();

        for file_path in file_paths {
            let src = Path::new(&file_path);
            if !src.exists() {
                failed_count += 1;
                errors.push(format!("File không tồn tại: {}", file_path));
                continue;
            }

            let file_name = match src.file_name() {
                Some(name) => name,
                None => {
                    failed_count += 1;
                    continue;
                }
            };

            let mut target = dest_dir.join(file_name);
            if target.exists() {
                let stem = src.file_stem().unwrap_or_default().to_string_lossy();
                let ext = src
                    .extension()
                    .map(|e| format!(".{}", e.to_string_lossy()))
                    .unwrap_or_default();
                let mut counter = 1;
                loop {
                    let candidate = dest_dir.join(format!("{}_{}{}", stem, counter, ext));
                    if !candidate.exists() {
                        target = candidate;
                        break;
                    }
                    counter += 1;
                }
            }

            match fs::copy(src, &target) {
                Ok(_) => {
                    success_count += 1;
                }
                Err(e) => {
                    failed_count += 1;
                    errors.push(format!("Lỗi sao chép {}: {}", src.display(), e));
                }
            }
        }

        Ok(CopyProgressResult {
            success_count,
            failed_count,
            errors,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
