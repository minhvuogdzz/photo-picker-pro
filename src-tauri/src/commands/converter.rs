use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::fs;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

#[derive(Clone, Serialize)]
struct ProgressEvent {
    total: usize,
    current: usize,
    percentage: usize,
    #[serde(rename = "currentFile")]
    current_file: String,
}

fn emit_log(app: &AppHandle, msg: &str) {
    let _ = app.emit("convert-log", msg);
}

fn emit_progress(app: &AppHandle, event: ProgressEvent) {
    let _ = app.emit("convert-progress", event);
}

#[tauri::command]
pub async fn run_convert_batch(
    app: AppHandle,
    inputs: Vec<String>,
    output_folder: String,
    target_format: String,
    quality: u8,
    export_jpg_2048: bool,
) -> Result<(), String> {
    emit_log(&app, &format!("Bắt đầu quét thư mục đầu vào..."));

    // Find all valid image files
    let mut files_to_convert = Vec::new();
    let valid_extensions = vec![
        // Phổ biến
        "jpg", "jpeg", "png", "webp", "heic", "heif", "tiff", "tif", "bmp", "gif", "jp2", "psd", "tga", "sgi", "icns",
        // RAW formats
        "cr2", "cr3", "arw", "dng", "raw", "nef", "orf", "raf", "sr2", "rw2", "pef", "x3f", "mos", "mef", "mrw", "crw", "kdc", "srw", "erf", "nrw", "rwz", "rwl"
    ];
    let raw_extensions = vec![
        "cr2", "cr3", "arw", "dng", "raw", "nef", "orf", "raf", "sr2", "rw2", "pef", "x3f", "mos", "mef", "mrw", "crw", "kdc", "srw", "erf", "nrw", "rwz", "rwl"
    ];

    for input in inputs {
        let input_path = Path::new(&input);
        if input_path.is_file() {
            if let Some(ext) = input_path.extension().and_then(|e| e.to_str()) {
                if valid_extensions.contains(&ext.to_lowercase().as_str()) {
                    files_to_convert.push(input_path.to_path_buf());
                }
            }
        } else if input_path.is_dir() {
            for entry in WalkDir::new(input_path).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if valid_extensions.contains(&ext.to_lowercase().as_str()) {
                            files_to_convert.push(path.to_path_buf());
                        }
                    }
                }
            }
        }
    }

    let total = files_to_convert.len();
    if total == 0 {
        emit_log(&app, "Không tìm thấy file ảnh nào hợp lệ để chuyển đổi.");
        return Ok(());
    }

    emit_log(&app, &format!("Đã tìm thấy {} file ảnh.", total));

    // Create output directory
    let mut output_dir = Path::new(&output_folder).join("mvdconvert");
    if output_dir.exists() {
        let mut counter = 1;
        loop {
            let next_dir = Path::new(&output_folder).join(format!("mvdconvert ({})", counter));
            if !next_dir.exists() {
                output_dir = next_dir;
                break;
            }
            counter += 1;
        }
    }
    
    if let Err(e) = fs::create_dir_all(&output_dir) {
        let msg = format!("Không thể tạo thư mục đầu ra: {}", e);
        emit_log(&app, &msg);
        return Err(msg);
    }
    
    emit_log(&app, &format!("Thư mục lưu ảnh: {}", output_dir.display()));

    // Map format
    let target_format_lower = target_format.to_lowercase();
    let sips_format = match target_format_lower.as_str() {
        "jpg" => "jpeg",
        "png" => "png",
        "webp" => "webp",
        "tiff" => "tiff",
        "bmp" => "bmp",
        _ => "jpeg", // default fallback
    };
    
    let extension = match target_format_lower.as_str() {
        "jpg" => "jpg",
        "jpeg" => "jpg",
        _ => target_format_lower.as_str(),
    };

    let mut current = 0;
    
    for input_file in files_to_convert {
        let file_name_str = input_file.file_name().unwrap_or_default().to_string_lossy();
        let ext_lower = input_file.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        let is_raw = raw_extensions.contains(&ext_lower.as_str());
        
        current += 1;
        let percentage = (current as f64 / total as f64 * 100.0) as usize;
        
        emit_progress(&app, ProgressEvent {
            total,
            current,
            percentage,
            current_file: file_name_str.to_string(),
        });
        
        let mut actual_sips_format = sips_format;
        let mut actual_extension = extension;
        
        // Nếu bật JPG 2048 và file này là RAW thì ép sang JPG
        if export_jpg_2048 && is_raw {
            actual_sips_format = "jpeg";
            actual_extension = "jpg";
        }

        // Output file path
        let file_stem = input_file.file_stem().unwrap_or_default().to_string_lossy();
        let mut out_path = output_dir.join(format!("{}.{}", file_stem, actual_extension));
        
        // Handle name collision
        let mut counter = 1;
        while out_path.exists() {
            out_path = output_dir.join(format!("{}-{}.{}", file_stem, counter, actual_extension));
            counter += 1;
        }
        
        emit_log(&app, &format!("Đang xử lý: {} -> {}", file_name_str, out_path.file_name().unwrap().to_string_lossy()));
        
        let mut cmd = Command::new("sips");
        cmd.arg("-s").arg("format").arg(actual_sips_format);
        
        // Quality
        let quality_str = match quality {
            1 => "40",
            2 => "60",
            3 => "80",
            4 | _ => "100",
        };
        // Áp dụng quality cho formatOptions (thường có tác dụng với jpeg/heic/webp)
        if actual_sips_format == "jpeg" || actual_sips_format == "heic" || actual_sips_format == "webp" {
             cmd.arg("-s").arg("formatOptions").arg(quality_str);
        }

        // Thu nhỏ nếu export_jpg_2048 và là file raw
        if export_jpg_2048 && is_raw {
            cmd.arg("-Z").arg("2048");
        }
        
        cmd.arg(&input_file).arg("--out").arg(&out_path);
        
        match cmd.output() {
            Ok(out) => {
                if !out.status.success() {
                    let err_str = String::from_utf8_lossy(&out.stderr);
                    emit_log(&app, &format!("Lỗi chuyển đổi {}: {}", file_name_str, err_str));
                }
            }
            Err(e) => {
                emit_log(&app, &format!("Lỗi thực thi lệnh với {}: {}", file_name_str, e));
            }
        }
    }
    
    emit_progress(&app, ProgressEvent {
        total,
        current: total,
        percentage: 100,
        current_file: "Hoàn tất".to_string(),
    });
    
    emit_log(&app, "Đã hoàn tất quá trình chuyển đổi ảnh.");
    
    Ok(())
}
