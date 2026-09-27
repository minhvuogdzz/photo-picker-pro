use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::metadata::Orientation;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader};
use serde::Serialize;
use std::fs;
use std::io::{BufWriter, Write};
use std::path::Path;
use std::process::Command;
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

/// Inputs only macOS `sips` can decode; the cross-platform converter skips them.
const SIPS_ONLY_EXTENSIONS: &[&str] = &["heic", "heif", "psd", "jp2", "sgi", "icns"];

fn emit_log(app: &AppHandle, msg: &str) {
    let _ = app.emit("convert-log", msg);
}

fn emit_progress(app: &AppHandle, event: ProgressEvent) {
    let _ = app.emit("convert-progress", event);
}

/// Maps the UI quality level (1-4) to a percentage
fn quality_percent(level: u8) -> u8 {
    match level {
        1 => 40,
        2 => 60,
        3 => 80,
        _ => 100,
    }
}

fn convert_with_sips(input: &Path, output: &Path, format: &str, quality: u8, shrink_to_2048: bool) -> Result<(), String> {
    let mut cmd = Command::new("sips");
    cmd.arg("-s").arg("format").arg(format);
    if format == "jpeg" || format == "webp" {
        cmd.arg("-s").arg("formatOptions").arg(quality_percent(quality).to_string());
    }
    if shrink_to_2048 {
        cmd.arg("-Z").arg("2048");
    }
    cmd.arg(input).arg("--out").arg(output);

    let out = cmd.output().map_err(|e| format!("không chạy được sips: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

fn to_8bit(img: &DynamicImage) -> DynamicImage {
    if img.color().has_alpha() {
        DynamicImage::ImageRgba8(img.to_rgba8())
    } else {
        DynamicImage::ImageRgb8(img.to_rgb8())
    }
}

/// Converter used where `sips` doesn't exist (Windows). RAW files are decoded from the
/// JPEG preview the camera embeds in them, which is full-size on most bodies.
fn convert_with_image_crate(
    input: &Path,
    output: &Path,
    format: &str,
    quality: u8,
    shrink_to_2048: bool,
    is_raw: bool,
) -> Result<(), String> {
    let mut img = if is_raw {
        let (jpeg, exif_orientation) = super::preview::extract_embedded_jpeg(input, u32::MAX)
            .ok_or("file RAW không có ảnh JPEG nhúng để chuyển đổi")?;
        let mut img = image::load_from_memory_with_format(&jpeg, ImageFormat::Jpeg).map_err(|e| e.to_string())?;
        if let Some(orientation) = u8::try_from(exif_orientation).ok().and_then(Orientation::from_exif) {
            img.apply_orientation(orientation);
        }
        img
    } else {
        let mut decoder = ImageReader::open(input)
            .and_then(|reader| reader.with_guessed_format())
            .map_err(|e| e.to_string())?
            .into_decoder()
            .map_err(|e| e.to_string())?;
        let orientation = decoder.orientation().unwrap_or(Orientation::NoTransforms);
        let mut img = DynamicImage::from_decoder(decoder).map_err(|e| e.to_string())?;
        img.apply_orientation(orientation);
        img
    };

    if shrink_to_2048 && img.width().max(img.height()) > 2048 {
        img = img.resize(2048, 2048, FilterType::Lanczos3);
    }

    let file = fs::File::create(output).map_err(|e| e.to_string())?;
    let mut writer = BufWriter::new(file);
    let written = match format {
        "jpeg" => JpegEncoder::new_with_quality(&mut writer, quality_percent(quality)).encode_image(&img.to_rgb8()),
        "png" => img.write_to(&mut writer, ImageFormat::Png),
        "tiff" => img.write_to(&mut writer, ImageFormat::Tiff),
        // The pure-Rust WebP encoder is lossless-only, so the quality level doesn't apply
        "webp" => to_8bit(&img).write_to(&mut writer, ImageFormat::WebP),
        "bmp" => to_8bit(&img).write_to(&mut writer, ImageFormat::Bmp),
        other => {
            drop(writer);
            let _ = fs::remove_file(output);
            return Err(format!("định dạng đích không hỗ trợ: {other}"));
        }
    }
    .map_err(|e| e.to_string())
    .and_then(|()| writer.flush().map_err(|e| e.to_string()));

    if written.is_err() {
        drop(writer);
        let _ = fs::remove_file(output);
    }
    written
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
    let target_kind = match target_format_lower.as_str() {
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

    let use_sips = cfg!(target_os = "macos");
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

        if !use_sips && SIPS_ONLY_EXTENSIONS.contains(&ext_lower.as_str()) {
            emit_log(&app, &format!("Bỏ qua {}: định dạng {} chỉ chuyển đổi được trên macOS", file_name_str, ext_lower.to_uppercase()));
            continue;
        }

        let mut actual_kind = target_kind;
        let mut actual_extension = extension;

        // Nếu bật JPG 2048 và file này là RAW thì ép sang JPG
        let shrink_to_2048 = export_jpg_2048 && is_raw;
        if shrink_to_2048 {
            actual_kind = "jpeg";
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

        let result = if use_sips {
            convert_with_sips(&input_file, &out_path, actual_kind, quality, shrink_to_2048)
        } else {
            convert_with_image_crate(&input_file, &out_path, actual_kind, quality, shrink_to_2048, is_raw)
        };
        if let Err(e) = result {
            emit_log(&app, &format!("Lỗi chuyển đổi {}: {}", file_name_str, e));
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

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgb, RgbImage};

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("mvd_convert_{tag}_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// High-frequency pattern so the JPEG stays above the 8KB embedded-preview threshold
    fn patterned_jpeg(width: u32, height: u32) -> Vec<u8> {
        let img = RgbImage::from_fn(width, height, |x, y| {
            Rgb([(x * 7 + y * 13) as u8, (x ^ y) as u8, (x.wrapping_mul(y)) as u8])
        });
        let mut bytes = Vec::new();
        JpegEncoder::new_with_quality(&mut bytes, 90).encode_image(&img).unwrap();
        bytes
    }

    #[test]
    fn raw_uses_embedded_jpeg_and_shrinks_to_2048() {
        let dir = temp_dir("raw");
        let raw_path = dir.join("IMG_0001.CR2");
        let mut raw = b"FAKE-RAW-HEADER".to_vec();
        raw.extend(patterned_jpeg(2400, 1200));
        fs::write(&raw_path, raw).unwrap();

        let out = dir.join("IMG_0001.jpg");
        convert_with_image_crate(&raw_path, &out, "jpeg", 3, true, true).unwrap();

        let converted = image::open(&out).unwrap();
        assert_eq!((converted.width(), converted.height()), (2048, 1024));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn raw_portrait_orientation_is_applied() {
        let dir = temp_dir("portrait");
        let raw_path = dir.join("IMG_0002.NEF");
        // Little-endian TIFF Orientation tag (0x0112) with value 6 = rotate 90° clockwise
        let mut raw = vec![0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00];
        raw.extend(patterned_jpeg(600, 400));
        fs::write(&raw_path, raw).unwrap();

        let out = dir.join("IMG_0002.png");
        convert_with_image_crate(&raw_path, &out, "png", 4, false, true).unwrap();

        let converted = image::open(&out).unwrap();
        assert_eq!((converted.width(), converted.height()), (400, 600));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn every_target_format_is_written() {
        let dir = temp_dir("formats");
        let src = dir.join("source.png");
        RgbImage::from_pixel(64, 48, Rgb([200, 100, 50])).save(&src).unwrap();

        for (kind, ext) in [("jpeg", "jpg"), ("png", "png"), ("webp", "webp"), ("tiff", "tiff"), ("bmp", "bmp")] {
            let out = dir.join(format!("out.{ext}"));
            convert_with_image_crate(&src, &out, kind, 2, false, false).unwrap();
            let converted = image::open(&out).unwrap();
            assert_eq!((converted.width(), converted.height()), (64, 48), "{kind}");
        }
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn failed_conversion_leaves_no_partial_file() {
        let dir = temp_dir("fail");
        let raw_path = dir.join("broken.ARW");
        fs::write(&raw_path, b"no embedded preview here").unwrap();

        let out = dir.join("broken.jpg");
        assert!(convert_with_image_crate(&raw_path, &out, "jpeg", 3, false, true).is_err());
        assert!(!out.exists());
        let _ = fs::remove_dir_all(dir);
    }
}
