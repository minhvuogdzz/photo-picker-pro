use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::metadata::Orientation;
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use super::exif_engine::{
    build_or_update_tiff_exif, extract_tiff_header_from_file, is_target_format_exif_supported,
    parse_tiff_exif, preserve_jpeg_icc_profile, read_reference_photo_timestamp,
    resolve_target_timestamp, scan_files_metadata_batch, should_fix_file_metadata,
    verify_output_exif_dates, write_exif_to_output_file, ConvertBatchReport,
    ExifCorrectionOptions, ExifScanSummary, FileErrorDetail, FileMetadataAnalysis,
    ResolvedExifTimestamp,
};

static CANCEL_CONVERT_FLAG: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
pub struct ProgressEvent {
    pub total: usize,
    pub current: usize,
    pub percentage: usize,
    #[serde(rename = "currentFile")]
    pub current_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferencePhotoExifResult {
    pub file_path: String,
    pub file_name: String,
    pub exif_datetime: String,
    pub exif_offset: String,
    pub camera_model: Option<String>,
}

/// Inputs only macOS `sips` can decode; the cross-platform converter skips them.
const SIPS_ONLY_EXTENSIONS: &[&str] = &["heic", "heif", "psd", "jp2", "sgi", "icns"];

pub const VALID_CONVERT_EXTENSIONS: &[&str] = &[
    // Phổ biến
    "jpg", "jpeg", "png", "webp", "heic", "heif", "tiff", "tif", "bmp", "gif", "jp2", "psd",
    "tga", "sgi", "icns",
    // RAW formats
    "cr2", "cr3", "arw", "dng", "raw", "nef", "orf", "raf", "sr2", "rw2", "pef", "x3f", "mos",
    "mef", "mrw", "crw", "kdc", "srw", "erf", "nrw", "rwz", "rwl",
];

pub const RAW_CONVERT_EXTENSIONS: &[&str] = &[
    "cr2", "cr3", "arw", "dng", "raw", "nef", "orf", "raf", "sr2", "rw2", "pef", "x3f", "mos",
    "mef", "mrw", "crw", "kdc", "srw", "erf", "nrw", "rwz", "rwl",
];

fn emit_log(app: Option<&AppHandle>, msg: &str) {
    if let Some(a) = app {
        let _ = a.emit("convert-log", msg);
    }
}

fn emit_progress(app: Option<&AppHandle>, event: ProgressEvent) {
    if let Some(a) = app {
        let _ = a.emit("convert-progress", event);
    }
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

fn convert_with_sips(
    input: &Path,
    output: &Path,
    format: &str,
    quality: u8,
    shrink_to_2048: bool,
) -> Result<(), String> {
    let mut cmd = Command::new("sips");
    cmd.arg("-s").arg("format").arg(format);
    if format == "jpeg" || format == "webp" {
        cmd.arg("-s")
            .arg("formatOptions")
            .arg(quality_percent(quality).to_string());
    }
    if shrink_to_2048 {
        cmd.arg("-Z").arg("2048");
    }
    cmd.arg(input).arg("--out").arg(output);

    let out = cmd
        .output()
        .map_err(|e| format!("không chạy được sips: {e}"))?;
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

/// Converter used where `sips` doesn't exist (Windows) or for fast parallel in-process conversion.
/// RAW files are decoded from the JPEG preview the camera embeds in them, which is full-size on most bodies.
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
        let mut img = image::load_from_memory_with_format(&jpeg, ImageFormat::Jpeg)
            .map_err(|e| e.to_string())?;
        if let Some(orientation) = u8::try_from(exif_orientation)
            .ok()
            .and_then(Orientation::from_exif)
        {
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
        "jpeg" => {
            JpegEncoder::new_with_quality(&mut writer, quality_percent(quality))
                .encode_image(&img.to_rgb8())
        }
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

/// Collects all convertible image files from the input paths (files or directories).
pub fn collect_convertible_files(inputs: &[String]) -> Vec<PathBuf> {
    let mut files_to_convert = Vec::new();
    for input in inputs {
        let input_path = Path::new(input);
        if input_path.is_file() {
            if let Some(ext) = input_path.extension().and_then(|e| e.to_str()) {
                if VALID_CONVERT_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                    files_to_convert.push(input_path.to_path_buf());
                }
            }
        } else if input_path.is_dir() {
            for entry in WalkDir::new(input_path).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if VALID_CONVERT_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                            files_to_convert.push(path.to_path_buf());
                        }
                    }
                }
            }
        }
    }
    files_to_convert
}

fn map_target_format(target_format: &str) -> (&'static str, &'static str) {
    match target_format.to_lowercase().as_str() {
        "jpg" | "jpeg" => ("jpeg", "jpg"),
        "png" => ("png", "png"),
        "webp" => ("webp", "webp"),
        "tiff" | "tif" => ("tiff", "tiff"),
        "bmp" => ("bmp", "bmp"),
        _ => ("jpeg", "jpg"),
    }
}

/// Fast single-pass stream writer for JPEG -> JPEG (100% quality, no resize) with EXIF replacement.
/// Reads the source JPEG once, replaces/inserts only the `APP1` EXIF segment in memory without
/// decoding pixels, and writes directly to `output_path` in a single I/O pass!
fn stream_copy_jpeg_with_new_exif(
    input_path: &Path,
    output_path: &Path,
    new_tiff: &[u8],
) -> Result<(), String> {
    let bytes = fs::read(input_path).map_err(|e| format!("Không đọc được file JPEG gốc: {e}"))?;
    if bytes.len() < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 {
        return Err("File đầu vào không phải là JPEG hợp lệ".to_string());
    }
    let app1_len = 2 + 6 + new_tiff.len();
    if app1_len > 0xFFFF {
        return Err("APP1 EXIF vượt quá 65535 bytes".to_string());
    }

    let mut out = Vec::with_capacity(bytes.len() + new_tiff.len() + 16);
    out.extend_from_slice(&[0xFF, 0xD8]);

    let mut pos = 2usize;
    let mut inserted = false;

    while pos + 4 <= bytes.len() && bytes[pos] == 0xFF {
        let marker = bytes[pos + 1];
        if marker == 0xFF {
            pos += 1;
            continue;
        }
        if marker == 0xDA || marker == 0xD9 {
            break;
        }
        if marker == 0xD8 || (0xD0..=0xD7).contains(&marker) || marker == 0x01 {
            out.extend_from_slice(&bytes[pos..pos + 2]);
            pos += 2;
            continue;
        }
        let seg_len = u16::from_be_bytes([bytes[pos + 2], bytes[pos + 3]]) as usize;
        if seg_len < 2 || pos + 2 + seg_len > bytes.len() {
            break;
        }
        let seg_end = pos + 2 + seg_len;
        let is_exif = marker == 0xE1 && seg_len >= 8 && &bytes[pos + 4..pos + 10] == b"Exif\0\0";
        if is_exif {
            if !inserted {
                let len_u16 = app1_len as u16;
                out.extend_from_slice(&[0xFF, 0xE1]);
                out.extend_from_slice(&len_u16.to_be_bytes());
                out.extend_from_slice(b"Exif\0\0");
                out.extend_from_slice(new_tiff);
                inserted = true;
            }
        } else {
            out.extend_from_slice(&bytes[pos..seg_end]);
            if marker == 0xE0 && !inserted {
                let len_u16 = app1_len as u16;
                out.extend_from_slice(&[0xFF, 0xE1]);
                out.extend_from_slice(&len_u16.to_be_bytes());
                out.extend_from_slice(b"Exif\0\0");
                out.extend_from_slice(new_tiff);
                inserted = true;
            }
        }
        pos = seg_end;
    }

    if !inserted {
        let len_u16 = app1_len as u16;
        out.extend_from_slice(&[0xFF, 0xE1]);
        out.extend_from_slice(&len_u16.to_be_bytes());
        out.extend_from_slice(b"Exif\0\0");
        out.extend_from_slice(new_tiff);
    }

    out.extend_from_slice(&bytes[pos..]);
    fs::write(output_path, &out).map_err(|e| format!("Không ghi được file JPEG output: {e}"))
}

#[tauri::command]
pub fn cancel_convert_batch() -> Result<(), String> {
    CANCEL_CONVERT_FLAG.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn scan_exif_batch(
    inputs: Vec<String>,
    target_format: String,
    export_jpg_2048: bool,
    exif_options: Option<ExifCorrectionOptions>,
) -> Result<ExifScanSummary, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let files = collect_convertible_files(&inputs);
        let (target_kind, _) = map_target_format(&target_format);
        let opts = exif_options.unwrap_or_default();
        let (_, summary) = scan_files_metadata_batch(
            &files,
            target_kind,
            export_jpg_2048,
            RAW_CONVERT_EXTENSIONS,
            &opts,
        );
        Ok(summary)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_reference_photo_exif(
    file_path: String,
) -> Result<ReferencePhotoExifResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&file_path);
        if !path.exists() {
            return Err("File ảnh tham chiếu không tồn tại".to_string());
        }
        let ts = read_reference_photo_timestamp(path)?;
        let tiff = extract_tiff_header_from_file(path);
        let info = tiff.as_deref().map(parse_tiff_exif).unwrap_or_default();
        let camera_model = match (info.camera_make, info.camera_model) {
            (Some(make), Some(model)) => {
                if model.starts_with(&make) {
                    Some(model)
                } else {
                    Some(format!("{make} {model}"))
                }
            }
            (None, Some(model)) => Some(model),
            (Some(make), None) => Some(make),
            (None, None) => None,
        };
        Ok(ReferencePhotoExifResult {
            file_path: file_path.clone(),
            file_name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            exif_datetime: ts.exif_datetime,
            exif_offset: ts.exif_offset,
            camera_model,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn run_convert_batch(
    app: AppHandle,
    inputs: Vec<String>,
    output_folder: String,
    target_format: String,
    quality: u8,
    export_jpg_2048: bool,
    exif_options: Option<ExifCorrectionOptions>,
) -> Result<ConvertBatchReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        execute_convert_batch_core(
            Some(&app),
            inputs,
            output_folder,
            target_format,
            quality,
            export_jpg_2048,
            exif_options.unwrap_or_default(),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

struct PlannedWorkItem {
    input_file: PathBuf,
    file_name_str: String,
    ext_lower: String,
    is_raw: bool,
    actual_kind: &'static str,
    shrink_to_2048: bool,
    out_path: PathBuf,
    analysis: Option<FileMetadataAnalysis>,
    should_fix_exif: bool,
}

pub fn execute_convert_batch_core(
    app: Option<&AppHandle>,
    inputs: Vec<String>,
    output_folder: String,
    target_format: String,
    quality: u8,
    export_jpg_2048: bool,
    exif_options: ExifCorrectionOptions,
) -> Result<ConvertBatchReport, String> {
    CANCEL_CONVERT_FLAG.store(false, Ordering::SeqCst);
    let batch_start = Instant::now();

    emit_log(app, "Bắt đầu quét thư mục đầu vào...");

    let files_to_convert = collect_convertible_files(&inputs);
    let total = files_to_convert.len();
    if total == 0 {
        emit_log(app, "Không tìm thấy file ảnh nào hợp lệ để chuyển đổi.");
        return Ok(ConvertBatchReport::default());
    }

    emit_log(app, &format!("Đã tìm thấy {} file ảnh.", total));

    // Validate EXIF replacement parameters upfront if EXIF date correction is enabled
    let mut cached_reference_ts: Option<ResolvedExifTimestamp> = None;
    if exif_options.enabled {
        match exif_options.date_source {
            super::exif_engine::ExifDateSource::Custom => {
                if super::exif_engine::parse_flexible_user_datetime(exif_options.custom_date_time.trim()).is_none() {
                    let msg = format!(
                        "Định dạng ngày giờ tùy chỉnh không hợp lệ: '{}'. Vui lòng nhập theo dạng YYYY-MM-DD HH:MM:SS (ví dụ: 2026-11-11 14:30:00).",
                        exif_options.custom_date_time
                    );
                    emit_log(app, &msg);
                    return Err(msg);
                }
            }
            super::exif_engine::ExifDateSource::ReferencePhoto => {
                let ref_path_str = exif_options
                    .reference_photo_path
                    .as_deref()
                    .unwrap_or("")
                    .trim();
                if ref_path_str.is_empty() {
                    let msg = "Vui lòng chọn ảnh tham chiếu để lấy ngày chụp EXIF.".to_string();
                    emit_log(app, &msg);
                    return Err(msg);
                }
                let ts = read_reference_photo_timestamp(Path::new(ref_path_str))?;
                cached_reference_ts = Some(ts);
            }
            _ => {}
        }
    }

    // Create output directory (exact existing behavior preserved)
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
        emit_log(app, &msg);
        return Err(msg);
    }

    emit_log(app, &format!("Thư mục lưu ảnh: {}", output_dir.display()));

    let (target_kind, extension) = map_target_format(&target_format);

    // Step 1: Metadata Scan & Classification (if enabled, runs in parallel across all files;
    // when OFF, zero scan overhead!)
    let mut scan_duration_ms = 0u64;
    let (analyses_opt, scan_summary) = if exif_options.enabled {
        emit_log(app, "Đang quét & phân loại metadata ngày chụp EXIF hàng loạt...");
        let (analyses, summary) = scan_files_metadata_batch(
            &files_to_convert,
            target_kind,
            export_jpg_2048,
            RAW_CONVERT_EXTENSIONS,
            &exif_options,
        );
        scan_duration_ms = summary.scan_duration_ms;
        emit_log(
            app,
            &format!(
                "Phân loại EXIF ({}ms): Hợp lệ: {} | Bất thường: {} | Thiếu EXIF: {} | Không xác định: {} -> Cần sửa: {} | Không hỗ trợ: {}",
                summary.scan_duration_ms,
                summary.valid_count,
                summary.abnormal_count,
                summary.missing_count,
                summary.unknown_count,
                summary.fixable_count,
                summary.unsupported_count
            ),
        );
        (Some(analyses), summary)
    } else {
        (None, ExifScanSummary::default())
    };

    // Step 2: Pre-compute deterministic output paths sequentially (preserving exact collision resolution)
    let mut used_names = std::collections::HashSet::with_capacity(total);
    let mut work_items: Vec<PlannedWorkItem> = Vec::with_capacity(total);

    for (idx, input_file) in files_to_convert.into_iter().enumerate() {
        let file_name_str = input_file
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let ext_lower = input_file
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let is_raw = RAW_CONVERT_EXTENSIONS.contains(&ext_lower.as_str());

        let shrink_to_2048 = export_jpg_2048 && is_raw;
        let (actual_kind, actual_extension) = if shrink_to_2048 {
            ("jpeg", "jpg")
        } else {
            (target_kind, extension)
        };

        let file_stem = input_file.file_stem().unwrap_or_default().to_string_lossy();
        let mut candidate_name = format!("{}.{}", file_stem, actual_extension);
        let mut out_path = output_dir.join(&candidate_name);
        let mut counter = 1usize;
        while used_names.contains(&candidate_name) || out_path.exists() {
            candidate_name = format!("{}-{}.{}", file_stem, counter, actual_extension);
            out_path = output_dir.join(&candidate_name);
            counter += 1;
        }
        used_names.insert(candidate_name);

        let analysis = analyses_opt
            .as_ref()
            .and_then(|list| list.get(idx).cloned());
        let should_fix_exif = analysis
            .as_ref()
            .map(|a| should_fix_file_metadata(a, &exif_options))
            .unwrap_or(false);

        work_items.push(PlannedWorkItem {
            input_file,
            file_name_str,
            ext_lower,
            is_raw,
            actual_kind,
            shrink_to_2048,
            out_path,
            analysis,
            should_fix_exif,
        });
    }

    // Step 3: Bounded parallel execution using Rayon thread pool
    let worker_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .clamp(2, 8);
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(worker_threads)
        .build()
        .unwrap_or_else(|_| rayon::ThreadPoolBuilder::new().build().unwrap());

    let use_sips_on_macos = cfg!(target_os = "macos");
    let completed_count = AtomicUsize::new(0);
    let converted_success = AtomicUsize::new(0);
    let metadata_fixed = AtomicUsize::new(0);
    let metadata_kept = AtomicUsize::new(0);
    let metadata_unsupported = AtomicUsize::new(0);
    let failed_count = AtomicUsize::new(0);
    let convert_time_ns = AtomicUsize::new(0);
    let exif_time_ns = AtomicUsize::new(0);
    let errors_mutex: Mutex<Vec<FileErrorDetail>> = Mutex::new(Vec::new());

    // Progress throttling for large batches so WebView IPC is never flooded
    let progress_step = (total / 100).max(1);
    let verbose_per_file_logs = total <= 100;

    pool.install(|| {
        work_items.par_iter().for_each(|item| {
            if CANCEL_CONVERT_FLAG.load(Ordering::Relaxed) {
                return;
            }

            let done = completed_count.fetch_add(1, Ordering::Relaxed) + 1;
            if done == 1 || done == total || done % progress_step == 0 {
                let percentage = (done as f64 / total as f64 * 100.0) as usize;
                emit_progress(
                    app,
                    ProgressEvent {
                        total,
                        current: done,
                        percentage,
                        current_file: item.file_name_str.clone(),
                    },
                );
            }

            if !use_sips_on_macos && SIPS_ONLY_EXTENSIONS.contains(&item.ext_lower.as_str()) {
                failed_count.fetch_add(1, Ordering::Relaxed);
                let msg = format!(
                    "Định dạng {} chỉ chuyển đổi được trên macOS",
                    item.ext_lower.to_uppercase()
                );
                emit_log(app, &format!("Bỏ qua {}: {}", item.file_name_str, msg));
                if let Ok(mut errs) = errors_mutex.lock() {
                    errs.push(FileErrorDetail {
                        file_name: item.file_name_str.clone(),
                        stage: "convert".to_string(),
                        message: msg,
                    });
                }
                return;
            }

            let out_file_name = item
                .out_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy();
            if verbose_per_file_logs {
                emit_log(
                    app,
                    &format!("Đang xử lý: {} -> {}", item.file_name_str, out_file_name),
                );
            } else if done % 500 == 0 {
                emit_log(
                    app,
                    &format!("Đã xử lý {}/{} file ảnh...", done, total),
                );
            }

            // Check if we can do a lossless same-format stream copy / metadata-only write
            // without decoding and re-encoding pixels!
            let is_input_jpeg = item.ext_lower == "jpg" || item.ext_lower == "jpeg";
            let is_lossless_same_jpeg =
                is_input_jpeg && item.actual_kind == "jpeg" && quality >= 4 && !item.shrink_to_2048;

            // Extract original TIFF header once if needed for preserving camera EXIF or fixing dates
            let source_tiff = if !is_lossless_same_jpeg
                && is_target_format_exif_supported(item.actual_kind)
            {
                extract_tiff_header_from_file(&item.input_file)
            } else if is_lossless_same_jpeg && item.should_fix_exif {
                extract_tiff_header_from_file(&item.input_file)
            } else {
                None
            };

            // Fast Path: JPEG -> JPEG (100% quality, no resize) + EXIF Date Correction in a single pass!
            if is_lossless_same_jpeg && exif_options.enabled && item.should_fix_exif {
                let analysis_ref = item.analysis.as_ref().unwrap();
                match resolve_target_timestamp(
                    &item.input_file,
                    analysis_ref,
                    &exif_options,
                    cached_reference_ts.as_ref(),
                ) {
                    Ok(target_ts) => {
                        let t_exif = Instant::now();
                        let new_tiff = build_or_update_tiff_exif(
                            source_tiff.as_deref(),
                            &target_ts,
                            None,
                        );
                        match stream_copy_jpeg_with_new_exif(
                            &item.input_file,
                            &item.out_path,
                            &new_tiff,
                        ) {
                            Ok(()) => {
                                // Fast header verification
                                match verify_output_exif_dates(&item.out_path, &target_ts) {
                                    Ok(_) => {
                                        exif_time_ns.fetch_add(
                                            t_exif.elapsed().as_nanos() as usize,
                                            Ordering::Relaxed,
                                        );
                                        converted_success.fetch_add(1, Ordering::Relaxed);
                                        metadata_fixed.fetch_add(1, Ordering::Relaxed);
                                        return;
                                    }
                                    Err(ver_err) => {
                                        // Rollback to exact original JPEG copy so conversion still succeeds safely
                                        let _ = fs::copy(&item.input_file, &item.out_path);
                                        converted_success.fetch_add(1, Ordering::Relaxed);
                                        metadata_kept.fetch_add(1, Ordering::Relaxed);
                                        if let Ok(mut errs) = errors_mutex.lock() {
                                            errs.push(FileErrorDetail {
                                                file_name: item.file_name_str.clone(),
                                                stage: "exif_verify".to_string(),
                                                message: ver_err,
                                            });
                                        }
                                        return;
                                    }
                                }
                            }
                            Err(_) => {
                                // Fall through to standard convert + post-process path
                            }
                        }
                    }
                    Err(ts_err) => {
                        if let Ok(mut errs) = errors_mutex.lock() {
                            errs.push(FileErrorDetail {
                                file_name: item.file_name_str.clone(),
                                stage: "exif_resolve".to_string(),
                                message: ts_err,
                            });
                        }
                    }
                }
            }

            // Perform format conversion (or lossless copy for JPEG -> JPEG at 100% quality)
            let t_conv = Instant::now();
            let mut pixels_rotated_by_image_crate = false;

            let conv_result = if is_lossless_same_jpeg {
                // Verify input is a valid readable JPEG header before copying
                let valid_jpeg = fs::File::open(&item.input_file)
                    .and_then(|mut f| {
                        use std::io::Read;
                        let mut b = [0u8; 2];
                        f.read_exact(&mut b)?;
                        Ok(b == [0xFF, 0xD8])
                    })
                    .unwrap_or(false);
                if valid_jpeg {
                    fs::copy(&item.input_file, &item.out_path)
                        .map(|_| ())
                        .map_err(|e| e.to_string())
                } else {
                    Err("File JPEG đầu vào bị hỏng hoặc không hợp lệ".to_string())
                }
            } else if use_sips_on_macos
                && (SIPS_ONLY_EXTENSIONS.contains(&item.ext_lower.as_str())
                    || (item.is_raw
                        && super::preview::extract_embedded_jpeg(&item.input_file, u32::MAX)
                            .is_none()))
                && item.actual_kind != "webp"
            {
                convert_with_sips(
                    &item.input_file,
                    &item.out_path,
                    item.actual_kind,
                    quality,
                    item.shrink_to_2048,
                )
            } else {
                pixels_rotated_by_image_crate = true;
                let res = convert_with_image_crate(
                    &item.input_file,
                    &item.out_path,
                    item.actual_kind,
                    quality,
                    item.shrink_to_2048,
                    item.is_raw,
                );
                if res.is_err() && use_sips_on_macos && item.actual_kind != "webp" {
                    pixels_rotated_by_image_crate = false;
                    convert_with_sips(
                        &item.input_file,
                        &item.out_path,
                        item.actual_kind,
                        quality,
                        item.shrink_to_2048,
                    )
                } else {
                    res
                }
            };

            convert_time_ns.fetch_add(t_conv.elapsed().as_nanos() as usize, Ordering::Relaxed);

            if let Err(e) = conv_result {
                let _ = fs::remove_file(&item.out_path);
                failed_count.fetch_add(1, Ordering::Relaxed);
                emit_log(
                    app,
                    &format!("Lỗi chuyển đổi {}: {}", item.file_name_str, e),
                );
                if let Ok(mut errs) = errors_mutex.lock() {
                    errs.push(FileErrorDetail {
                        file_name: item.file_name_str.clone(),
                        stage: "convert".to_string(),
                        message: e,
                    });
                }
                return;
            }

            converted_success.fetch_add(1, Ordering::Relaxed);

            // Preserve ICC Color Profile when re-encoding JPEG -> JPEG via image crate
            if is_input_jpeg && item.actual_kind == "jpeg" && !is_lossless_same_jpeg {
                preserve_jpeg_icc_profile(&item.input_file, &item.out_path);
            }

            let override_orientation = if pixels_rotated_by_image_crate {
                Some(1u16)
            } else {
                None
            };

            // Step 4: Post-Conversion Metadata Processing
            if !exif_options.enabled {
                // Even when EXIF Date Correction is OFF, if image_crate encoded the output,
                // preserve source camera EXIF metadata (Make, Model, Lens, ISO, GPS, Dates)
                if pixels_rotated_by_image_crate
                    && is_target_format_exif_supported(item.actual_kind)
                    && source_tiff.is_some()
                {
                    let _ = write_exif_to_output_file(
                        &item.out_path,
                        item.actual_kind,
                        source_tiff.as_deref(),
                        None,
                        override_orientation,
                    );
                }
                metadata_kept.fetch_add(1, Ordering::Relaxed);
                return;
            }

            // When EXIF Date Correction is ON:
            if !is_target_format_exif_supported(item.actual_kind) {
                metadata_unsupported.fetch_add(1, Ordering::Relaxed);
                return;
            }

            if !item.should_fix_exif {
                // Keep valid metadata intact (and carry over source EXIF if re-encoded by image_crate)
                if pixels_rotated_by_image_crate && source_tiff.is_some() {
                    let _ = write_exif_to_output_file(
                        &item.out_path,
                        item.actual_kind,
                        source_tiff.as_deref(),
                        None,
                        override_orientation,
                    );
                }
                metadata_kept.fetch_add(1, Ordering::Relaxed);
                return;
            }

            // File requires EXIF Date Correction
            let t_exif = Instant::now();
            let analysis_ref = match item.analysis.as_ref() {
                Some(a) => a,
                None => {
                    metadata_kept.fetch_add(1, Ordering::Relaxed);
                    return;
                }
            };

            let target_ts = match resolve_target_timestamp(
                &item.input_file,
                analysis_ref,
                &exif_options,
                cached_reference_ts.as_ref(),
            ) {
                Ok(ts) => ts,
                Err(e) => {
                    metadata_kept.fetch_add(1, Ordering::Relaxed);
                    if let Ok(mut errs) = errors_mutex.lock() {
                        errs.push(FileErrorDetail {
                            file_name: item.file_name_str.clone(),
                            stage: "exif_resolve".to_string(),
                            message: e,
                        });
                    }
                    return;
                }
            };

            // Keep a backup of the converted output bytes in memory in case verification fails (rollback safety)
            let backup_bytes = fs::read(&item.out_path).ok();

            match write_exif_to_output_file(
                &item.out_path,
                item.actual_kind,
                source_tiff.as_deref(),
                Some(&target_ts),
                override_orientation,
            )
            .and_then(|()| verify_output_exif_dates(&item.out_path, &target_ts).map(|_| ()))
            {
                Ok(()) => {
                    exif_time_ns.fetch_add(t_exif.elapsed().as_nanos() as usize, Ordering::Relaxed);
                    metadata_fixed.fetch_add(1, Ordering::Relaxed);
                }
                Err(err_msg) => {
                    // Rollback output file to pre-EXIF converted state so output image is never lost or corrupted
                    if let Some(orig_out) = backup_bytes {
                        let _ = fs::write(&item.out_path, orig_out);
                    }
                    metadata_kept.fetch_add(1, Ordering::Relaxed);
                    emit_log(
                        app,
                        &format!(
                            "Cảnh báo EXIF {} (đã giữ ảnh convert an toàn): {}",
                            item.file_name_str, err_msg
                        ),
                    );
                    if let Ok(mut errs) = errors_mutex.lock() {
                        errs.push(FileErrorDetail {
                            file_name: item.file_name_str.clone(),
                            stage: "exif_write".to_string(),
                            message: err_msg,
                        });
                    }
                }
            }
        });
    });

    let total_duration_ms = batch_start.elapsed().as_millis() as u64;
    let convert_duration_ms = (convert_time_ns.load(Ordering::Relaxed) as u64) / 1_000_000 / (worker_threads as u64).max(1);
    let exif_fix_duration_ms = (exif_time_ns.load(Ordering::Relaxed) as u64) / 1_000_000 / (worker_threads as u64).max(1);

    let processed = completed_count.load(Ordering::Relaxed);
    let conv_ok = converted_success.load(Ordering::Relaxed);
    let fixed_ok = metadata_fixed.load(Ordering::Relaxed);
    let kept_ok = metadata_kept.load(Ordering::Relaxed);
    let unsup_ok = metadata_unsupported.load(Ordering::Relaxed);
    let failed = failed_count.load(Ordering::Relaxed);
    let errors = errors_mutex.into_inner().unwrap_or_default();

    let throughput = if total_duration_ms > 0 {
        (processed as f64) / (total_duration_ms as f64 / 1000.0)
    } else {
        processed as f64
    };

    emit_progress(
        app,
        ProgressEvent {
            total,
            current: processed,
            percentage: 100,
            current_file: "Hoàn tất".to_string(),
        },
    );

    if exif_options.enabled {
        emit_log(
            app,
            &format!(
                "Hoàn tất trong {}ms ({:.1} files/s) — Convert thành công: {}/{} | Đã sửa EXIF: {} | Giữ nguyên EXIF: {} | Không hỗ trợ EXIF: {} | Lỗi: {}",
                total_duration_ms, throughput, conv_ok, total, fixed_ok, kept_ok, unsup_ok, failed
            ),
        );
    } else {
        emit_log(
            app,
            &format!(
                "Đã hoàn tất quá trình chuyển đổi ảnh ({}/{} thành công trong {}ms).",
                conv_ok, total, total_duration_ms
            ),
        );
    }

    Ok(ConvertBatchReport {
        total_processed: processed,
        converted_success: conv_ok,
        metadata_fixed: fixed_ok,
        metadata_kept: kept_ok,
        metadata_unsupported: unsup_ok,
        failed_count: failed,
        errors,
        scan_duration_ms,
        convert_duration_ms,
        exif_fix_duration_ms,
        total_duration_ms,
        throughput_files_per_sec: (throughput * 10.0).round() / 10.0,
        output_dir: output_dir.to_string_lossy().to_string(),
        scan_summary,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::exif_engine::{
        ExifCorrectionScope, ExifDateSource, FileTimestampKind,
    };
    use image::{Rgb, RgbImage};

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "mvd_convert_{tag}_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// High-frequency pattern so the JPEG stays above the 8KB embedded-preview threshold
    fn patterned_jpeg(width: u32, height: u32) -> Vec<u8> {
        let img = RgbImage::from_fn(width, height, |x, y| {
            Rgb([
                (x * 7 + y * 13) as u8,
                (x ^ y) as u8,
                (x.wrapping_mul(y)) as u8,
            ])
        });
        let mut bytes = Vec::new();
        JpegEncoder::new_with_quality(&mut bytes, 90)
            .encode_image(&img)
            .unwrap();
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
        RgbImage::from_pixel(64, 48, Rgb([200, 100, 50]))
            .save(&src)
            .unwrap();

        for (kind, ext) in [
            ("jpeg", "jpg"),
            ("png", "png"),
            ("webp", "webp"),
            ("tiff", "tiff"),
            ("bmp", "bmp"),
        ] {
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

    /// Helper: builds a rich TIFF EXIF payload with Camera Make, Model, LensModel, ISO, GPS, and configurable dates
    fn build_rich_test_exif(
        dto: Option<&str>,
        cd: Option<&str>,
        md: Option<&str>,
        offset: Option<&str>,
    ) -> Vec<u8> {
        use crate::commands::exif_engine::*;
        let endian = Endian::Little;
        let mut buf = Vec::new();
        buf.extend_from_slice(b"II");
        buf.extend_from_slice(&endian.write_u16(42));
        buf.extend_from_slice(&endian.write_u32(8)); // IFD0 at 8

        // Build via our TIFF builder first, then customize
        let dummy_ts = ResolvedExifTimestamp {
            exif_datetime: "2022:08:15 10:20:30".to_string(),
            exif_offset: "+07:00".to_string(),
            naive_dt: parse_exif_datetime_str("2022:08:15 10:20:30").unwrap(),
        };
        let mut base = build_or_update_tiff_exif(None, &dummy_ts, Some(1));

        // Now construct a custom TIFF with Make, Model, ISO, LensModel, GPS, and requested dates
        let mut ifd0: Vec<(u16, u16, u32, Vec<u8>)> = vec![
            (TAG_MAKE, TYPE_ASCII, 6, b"Canon\0".to_vec()),
            (TAG_MODEL, TYPE_ASCII, 13, b"Canon EOS R5\0".to_vec()),
            (TAG_ORIENTATION, TYPE_SHORT, 1, 1u16.to_le_bytes().to_vec()),
            (TAG_RATING, TYPE_SHORT, 1, 5u16.to_le_bytes().to_vec()),
        ];
        if let Some(m) = md {
            let mut b = m.as_bytes().to_vec();
            b.push(0);
            ifd0.push((TAG_DATETIME, TYPE_ASCII, b.len() as u32, b));
        }

        let mut exif_ifd: Vec<(u16, u16, u32, Vec<u8>)> = vec![
            (TAG_EXPOSURE_TIME, TYPE_RATIONAL, 1, [1u32.to_le_bytes(), 200u32.to_le_bytes()].concat()),
            (TAG_FNUMBER, TYPE_RATIONAL, 1, [28u32.to_le_bytes(), 10u32.to_le_bytes()].concat()),
            (TAG_ISO, TYPE_SHORT, 1, 400u16.to_le_bytes().to_vec()),
            (TAG_EXIF_VERSION, TYPE_UNDEFINED, 4, b"0232".to_vec()),
            (TAG_FOCAL_LENGTH, TYPE_RATIONAL, 1, [50u32.to_le_bytes(), 1u32.to_le_bytes()].concat()),
            (TAG_LENS_MODEL, TYPE_ASCII, 24, b"RF 24-70mm F2.8L IS USM\0".to_vec()),
        ];
        if let Some(d) = dto {
            let mut b = d.as_bytes().to_vec();
            b.push(0);
            exif_ifd.push((TAG_DATETIME_ORIGINAL, TYPE_ASCII, b.len() as u32, b));
        }
        if let Some(c) = cd {
            let mut b = c.as_bytes().to_vec();
            b.push(0);
            exif_ifd.push((TAG_CREATE_DATE, TYPE_ASCII, b.len() as u32, b));
        }
        if let Some(o) = offset {
            let mut b = o.as_bytes().to_vec();
            b.push(0);
            exif_ifd.push((TAG_OFFSET_TIME, TYPE_ASCII, b.len() as u32, b.clone()));
            exif_ifd.push((TAG_OFFSET_TIME_ORIGINAL, TYPE_ASCII, b.len() as u32, b.clone()));
            exif_ifd.push((TAG_OFFSET_TIME_DIGITIZED, TYPE_ASCII, b.len() as u32, b));
        }

        let gps_ifd: Vec<(u16, u16, u32, Vec<u8>)> = vec![
            (0x0001, TYPE_ASCII, 2, b"N\0".to_vec()),
            (0x0003, TYPE_ASCII, 2, b"E\0".to_vec()),
        ];

        ifd0.push((TAG_EXIF_IFD_POINTER, TYPE_LONG, 1, vec![0; 4]));
        ifd0.push((TAG_GPS_IFD_POINTER, TYPE_LONG, 1, vec![0; 4]));
        ifd0.sort_by_key(|x| x.0);
        exif_ifd.sort_by_key(|x| x.0);

        let ifd0_start = 8usize;
        let ifd0_table_len = 2 + ifd0.len() * 12 + 4;
        let ifd0_data_start = ifd0_start + ifd0_table_len;
        let mut t0 = Vec::new();
        let mut h0 = Vec::new();
        let mut ep_pos = 0usize;
        let mut gp_pos = 0usize;
        t0.extend_from_slice(&(ifd0.len() as u16).to_le_bytes());
        for (tag, ft, cnt, data) in &ifd0 {
            t0.extend_from_slice(&tag.to_le_bytes());
            t0.extend_from_slice(&ft.to_le_bytes());
            t0.extend_from_slice(&cnt.to_le_bytes());
            if *tag == TAG_EXIF_IFD_POINTER {
                ep_pos = ifd0_start + t0.len();
            } else if *tag == TAG_GPS_IFD_POINTER {
                gp_pos = ifd0_start + t0.len();
            }
            if data.len() <= 4 {
                let mut inl = [0u8; 4];
                inl[..data.len()].copy_from_slice(data);
                t0.extend_from_slice(&inl);
            } else {
                let off = (ifd0_data_start + h0.len()) as u32;
                t0.extend_from_slice(&off.to_le_bytes());
                h0.extend_from_slice(data);
                if h0.len() % 2 != 0 {
                    h0.push(0);
                }
            }
        }
        t0.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(&t0);
        buf.extend_from_slice(&h0);

        let exif_start = buf.len() as u32;
        buf[ep_pos..ep_pos + 4].copy_from_slice(&exif_start.to_le_bytes());
        let es = buf.len();
        let et_len = 2 + exif_ifd.len() * 12 + 4;
        let ed_start = es + et_len;
        let mut te = Vec::new();
        let mut he = Vec::new();
        te.extend_from_slice(&(exif_ifd.len() as u16).to_le_bytes());
        for (tag, ft, cnt, data) in &exif_ifd {
            te.extend_from_slice(&tag.to_le_bytes());
            te.extend_from_slice(&ft.to_le_bytes());
            te.extend_from_slice(&cnt.to_le_bytes());
            if data.len() <= 4 {
                let mut inl = [0u8; 4];
                inl[..data.len()].copy_from_slice(data);
                te.extend_from_slice(&inl);
            } else {
                let off = (ed_start + he.len()) as u32;
                te.extend_from_slice(&off.to_le_bytes());
                he.extend_from_slice(data);
                if he.len() % 2 != 0 {
                    he.push(0);
                }
            }
        }
        te.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(&te);
        buf.extend_from_slice(&he);

        let gps_start = buf.len() as u32;
        buf[gp_pos..gp_pos + 4].copy_from_slice(&gps_start.to_le_bytes());
        buf.extend_from_slice(&(gps_ifd.len() as u16).to_le_bytes());
        for (tag, ft, cnt, data) in &gps_ifd {
            buf.extend_from_slice(&tag.to_le_bytes());
            buf.extend_from_slice(&ft.to_le_bytes());
            buf.extend_from_slice(&cnt.to_le_bytes());
            let mut inl = [0u8; 4];
            inl[..data.len()].copy_from_slice(data);
            buf.extend_from_slice(&inl);
        }
        buf.extend_from_slice(&0u32.to_le_bytes());

        base.clear();
        buf
    }

    fn write_test_jpeg_with_exif(
        path: &Path,
        width: u32,
        height: u32,
        tiff_exif: Option<&[u8]>,
    ) {
        let raw_jpeg = patterned_jpeg(width, height);
        fs::write(path, &raw_jpeg).unwrap();
        if let Some(tiff) = tiff_exif {
            let mut out = Vec::with_capacity(raw_jpeg.len() + tiff.len() + 16);
            out.extend_from_slice(&[0xFF, 0xD8]);
            let seg_len = (2 + 6 + tiff.len()) as u16;
            out.extend_from_slice(&[0xFF, 0xE1]);
            out.extend_from_slice(&seg_len.to_be_bytes());
            out.extend_from_slice(b"Exif\0\0");
            out.extend_from_slice(tiff);
            out.extend_from_slice(&raw_jpeg[2..]);
            fs::write(path, out).unwrap();
        }
    }

    #[test]
    fn comprehensive_15_scenarios_exif_date_correction() {
        use sha2::{Digest, Sha256};

        let dir = temp_dir("comprehensive_15");
        let in_dir = dir.join("inputs");
        let out_root = dir.join("outputs");
        fs::create_dir_all(&in_dir).unwrap();
        fs::create_dir_all(&out_root).unwrap();

        // 1. JPEG with valid capture date (from 2018 -> must NOT be modified!)
        let f1_valid = in_dir.join("01_valid_2018.jpg");
        write_test_jpeg_with_exif(
            &f1_valid,
            80,
            60,
            Some(&build_rich_test_exif(
                Some("2018:06:20 15:45:10"),
                Some("2018:06:20 15:45:10"),
                Some("2018:06:20 15:45:10"),
                Some("+07:00"),
            )),
        );

        // 2. JPEG with 01/01/2000 device reset date
        let f2_2000 = in_dir.join("02_reset_2000.jpg");
        write_test_jpeg_with_exif(
            &f2_2000,
            80,
            60,
            Some(&build_rich_test_exif(
                Some("2000:01:01 00:00:00"),
                Some("2000:01:01 00:00:00"),
                Some("2000:01:01 00:00:00"),
                Some("+07:00"),
            )),
        );

        // 3. JPEG with 01/01/1970 Unix epoch date
        let f3_1970 = in_dir.join("03_epoch_1970.jpg");
        write_test_jpeg_with_exif(
            &f3_1970,
            80,
            60,
            Some(&build_rich_test_exif(
                Some("1970:01:01 00:00:12"),
                Some("1970:01:01 00:00:12"),
                Some("1970:01:01 00:00:12"),
                None,
            )),
        );

        // 4. JPEG with future timestamp (year 2038)
        let f4_future = in_dir.join("04_future_2038.jpg");
        write_test_jpeg_with_exif(
            &f4_future,
            80,
            60,
            Some(&build_rich_test_exif(
                Some("2038:05:01 12:00:00"),
                Some("2038:05:01 12:00:00"),
                Some("2038:05:01 12:00:00"),
                Some("+07:00"),
            )),
        );

        // 5. JPEG without any EXIF metadata
        let f5_missing = in_dir.join("05_no_exif.jpg");
        write_test_jpeg_with_exif(&f5_missing, 80, 60, None);

        // 6. JPEG with inconsistent DateTimeOriginal vs CreateDate
        let f6_inconsistent = in_dir.join("06_inconsistent.jpg");
        write_test_jpeg_with_exif(
            &f6_inconsistent,
            80,
            60,
            Some(&build_rich_test_exif(
                Some("2024:10:15 09:30:00"),
                Some("2019:02:10 09:30:00"),
                Some("2024:10:15 09:30:00"),
                Some("+07:00"),
            )),
        );

        // 7. PNG with abnormal EXIF metadata (1980-01-01)
        let f7_png = in_dir.join("07_image.png");
        RgbImage::from_pixel(64, 48, Rgb([100, 150, 200]))
            .save(&f7_png)
            .unwrap();
        let bad_ts = ResolvedExifTimestamp {
            exif_datetime: "1980:01:01 00:00:00".to_string(),
            exif_offset: "+07:00".to_string(),
            naive_dt: super::super::exif_engine::parse_exif_datetime_str("1980:01:01 00:00:00")
                .unwrap(),
        };
        write_exif_to_output_file(&f7_png, "png", None, Some(&bad_ts), None).unwrap();

        // 8. TIFF with abnormal EXIF metadata
        let f8_tiff = in_dir.join("08_image.tiff");
        RgbImage::from_pixel(64, 48, Rgb([50, 180, 90]))
            .save(&f8_tiff)
            .unwrap();
        write_exif_to_output_file(&f8_tiff, "tiff", None, Some(&bad_ts), None).unwrap();

        // 9. HEIC (created via macOS sips)
        let f9_heic = in_dir.join("09_apple.heic");
        if cfg!(target_os = "macos") {
            let _ = Command::new("sips")
                .args(["-s", "format", "heic"])
                .arg(&f2_2000)
                .arg("--out")
                .arg(&f9_heic)
                .output();
        }

        // 10. RAW file (.CR2) with embedded JPEG (>8KB) & abnormal date
        let f10_raw = in_dir.join("10_canon_raw.CR2");
        {
            let raw_preview_jpg = dir.join("temp_raw_preview.jpg");
            write_test_jpeg_with_exif(
                &raw_preview_jpg,
                600,
                400,
                Some(&build_rich_test_exif(
                    Some("2000:01:01 00:00:00"),
                    Some("2000:01:01 00:00:00"),
                    Some("2000:01:01 00:00:00"),
                    Some("+07:00"),
                )),
            );
            let mut raw_bytes = b"FAKE_CR2_CONTAINER".to_vec();
            raw_bytes.extend(fs::read(&raw_preview_jpg).unwrap());
            let _ = fs::remove_file(&raw_preview_jpg);
            fs::write(&f10_raw, raw_bytes).unwrap();
        }

        // 11. Vietnamese filename with diacritics
        let f11_vn = in_dir.join("11_Ảnh cưới Đà Lạt Nguyễn Văn Ánh.jpg");
        write_test_jpeg_with_exif(
            &f11_vn,
            80,
            60,
            Some(&build_rich_test_exif(
                Some("2000:01:01 08:15:00"),
                Some("2000:01:01 08:15:00"),
                Some("2000:01:01 08:15:00"),
                Some("+07:00"),
            )),
        );

        // 12. Filename with spaces & special characters
        let f12_special = in_dir.join("12_Studio (VIP) #01 - [Khách & Bạn] 'Test'.jpg");
        write_test_jpeg_with_exif(
            &f12_special,
            80,
            60,
            Some(&build_rich_test_exif(
                Some("1970:01:01 00:00:00"),
                Some("1970:01:01 00:00:00"),
                Some("1970:01:01 00:00:00"),
                Some("+07:00"),
            )),
        );

        // 13. Large high-resolution JPEG (3000x2000)
        let f13_large = in_dir.join("13_large_3000x2000.jpg");
        write_test_jpeg_with_exif(
            &f13_large,
            3000,
            2000,
            Some(&build_rich_test_exif(
                Some("2000:01:01 10:00:00"),
                Some("2000:01:01 10:00:00"),
                Some("2000:01:01 10:00:00"),
                Some("+07:00"),
            )),
        );

        // 15a. JPEG with corrupted/malformed EXIF date string ("2024:99:99 99:99:99")
        let f15a_corrupt_exif = in_dir.join("15a_corrupt_date_str.jpg");
        write_test_jpeg_with_exif(
            &f15a_corrupt_exif,
            80,
            60,
            Some(&build_rich_test_exif(
                Some("2024:99:99 99:99:99"),
                Some("2024:99:99 99:99:99"),
                Some("2024:99:99 99:99:99"),
                Some("+99:99"),
            )),
        );

        // 15b. Completely corrupted image file (ensures batch does not stop on 1 bad file)
        let f15b_corrupt_file = in_dir.join("15b_broken_file.jpg");
        fs::write(&f15b_corrupt_file, b"NOT_A_VALID_JPEG_STREAM").unwrap();

        // Record SHA-256 of input files to verify 100% input immutability
        let hash_before_f1 = Sha256::digest(&fs::read(&f1_valid).unwrap());
        let hash_before_f2 = Sha256::digest(&fs::read(&f2_2000).unwrap());
        let hash_before_raw = Sha256::digest(&fs::read(&f10_raw).unwrap());

        // Run Batch with Custom Date ("2026-11-11 14:30:00"), AbnormalOnly, include_missing = true
        let opts = ExifCorrectionOptions {
            enabled: true,
            date_source: ExifDateSource::Custom,
            file_timestamp_kind: FileTimestampKind::Created,
            custom_date_time: "2026-11-11 14:30:00".to_string(),
            keep_original_time_of_day: false,
            reference_photo_path: None,
            scope: ExifCorrectionScope::AbnormalOnly,
            include_missing: true,
            min_reasonable_year: 1995,
        };

        let report = execute_convert_batch_core(
            None,
            vec![in_dir.to_string_lossy().to_string()],
            out_root.to_string_lossy().to_string(),
            "JPG".to_string(),
            4,
            true,
            opts,
        )
        .unwrap();

        // Verify inputs were never touched
        assert_eq!(hash_before_f1, Sha256::digest(&fs::read(&f1_valid).unwrap()));
        assert_eq!(hash_before_f2, Sha256::digest(&fs::read(&f2_2000).unwrap()));
        assert_eq!(hash_before_raw, Sha256::digest(&fs::read(&f10_raw).unwrap()));

        let out_dir = PathBuf::from(&report.output_dir);

        // 1. Valid 2018 JPEG must keep its original 2018 date and camera metadata!
        let out_f1 = parse_tiff_exif(
            &extract_tiff_header_from_file(&out_dir.join("01_valid_2018.jpg")).unwrap(),
        );
        assert_eq!(
            out_f1.date_time_original.as_deref(),
            Some("2018:06:20 15:45:10")
        );
        assert_eq!(out_f1.camera_model.as_deref(), Some("Canon EOS R5"));

        // 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 15a must all have synchronized "2026:11:11 14:30:00"
        for name in [
            "02_reset_2000.jpg",
            "03_epoch_1970.jpg",
            "04_future_2038.jpg",
            "05_no_exif.jpg",
            "06_inconsistent.jpg",
            "07_image.jpg",
            "08_image.jpg",
            "10_canon_raw.jpg",
            "11_Ảnh cưới Đà Lạt Nguyễn Văn Ánh.jpg",
            "12_Studio (VIP) #01 - [Khách & Bạn] 'Test'.jpg",
            "13_large_3000x2000.jpg",
            "15a_corrupt_date_str.jpg",
        ] {
            let p = out_dir.join(name);
            assert!(p.exists(), "Output file missing: {name}");
            let tiff = extract_tiff_header_from_file(&p)
                .unwrap_or_else(|| panic!("Missing EXIF in {name}"));
            let info = parse_tiff_exif(&tiff);
            assert_eq!(
                info.date_time_original.as_deref(),
                Some("2026:11:11 14:30:00"),
                "DateTimeOriginal mismatch on {name}"
            );
            assert_eq!(
                info.create_date.as_deref(),
                Some("2026:11:11 14:30:00"),
                "CreateDate mismatch on {name}"
            );
            assert_eq!(
                info.modify_date.as_deref(),
                Some("2026:11:11 14:30:00"),
                "ModifyDate mismatch on {name}"
            );
            assert!(info.offset_time_original.is_some(), "OffsetTimeOriginal missing on {name}");
        }

        // If macOS created 09_apple.heic, verify 09_apple.jpg output has corrected EXIF too
        if f9_heic.exists() {
            let p9 = out_dir.join("09_apple.jpg");
            assert!(p9.exists(), "09_apple.jpg output from HEIC missing");
            let info9 = parse_tiff_exif(&extract_tiff_header_from_file(&p9).unwrap());
            assert_eq!(info9.date_time_original.as_deref(), Some("2026:11:11 14:30:00"));
        }

        // Verify ReferencePhoto date source & keep_original_time_of_day
        let ref_out = out_root.join("ref_test");
        fs::create_dir_all(&ref_out).unwrap();
        let rep_ref = execute_convert_batch_core(
            None,
            vec![f11_vn.to_string_lossy().to_string()],
            ref_out.to_string_lossy().to_string(),
            "JPG".to_string(),
            4,
            false,
            ExifCorrectionOptions {
                enabled: true,
                date_source: ExifDateSource::ReferencePhoto,
                reference_photo_path: Some(f1_valid.to_string_lossy().to_string()),
                keep_original_time_of_day: true, // Keep 08:15:00 from f11_vn, take date 2018:06:20 from f1_valid
                ..Default::default()
            },
        )
        .unwrap();
        let out_f11_ref = parse_tiff_exif(
            &extract_tiff_header_from_file(
                &PathBuf::from(&rep_ref.output_dir).join("11_Ảnh cưới Đà Lạt Nguyễn Văn Ánh.jpg"),
            )
            .unwrap(),
        );
        assert_eq!(
            out_f11_ref.date_time_original.as_deref(),
            Some("2018:06:20 08:15:00")
        );

        // Verify FileCreated date source
        let fc_out = out_root.join("fc_test");
        fs::create_dir_all(&fc_out).unwrap();
        let rep_fc = execute_convert_batch_core(
            None,
            vec![f2_2000.to_string_lossy().to_string()],
            fc_out.to_string_lossy().to_string(),
            "JPG".to_string(),
            4,
            false,
            ExifCorrectionOptions {
                enabled: true,
                date_source: ExifDateSource::FileCreated,
                file_timestamp_kind: FileTimestampKind::Created,
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(rep_fc.metadata_fixed, 1);

        // Verify OFF mode (enabled = false) preserves original behavior without modifying abnormal dates
        let off_out = out_root.join("off_test");
        fs::create_dir_all(&off_out).unwrap();
        let rep_off = execute_convert_batch_core(
            None,
            vec![f2_2000.to_string_lossy().to_string()],
            off_out.to_string_lossy().to_string(),
            "JPG".to_string(),
            4,
            false,
            ExifCorrectionOptions {
                enabled: false,
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(rep_off.metadata_fixed, 0);
        let out_f2_off = parse_tiff_exif(
            &extract_tiff_header_from_file(
                &PathBuf::from(&rep_off.output_dir).join("02_reset_2000.jpg"),
            )
            .unwrap(),
        );
        assert_eq!(
            out_f2_off.date_time_original.as_deref(),
            Some("2000:01:01 00:00:00")
        );
        // Verify camera metadata (Make, Model, LensModel, ISO, GPS) preserved on corrected JPEGs!
        let out_f2 = parse_tiff_exif(
            &extract_tiff_header_from_file(&out_dir.join("02_reset_2000.jpg")).unwrap(),
        );
        assert_eq!(out_f2.camera_make.as_deref(), Some("Canon"));
        assert_eq!(out_f2.camera_model.as_deref(), Some("Canon EOS R5"));
        assert_eq!(
            out_f2.lens_model.as_deref(),
            Some("RF 24-70mm F2.8L IS USM")
        );
        assert_eq!(out_f2.iso, Some(400));
        assert!(out_f2.has_gps);

        // Verify PNG, WEBP, TIFF, and BMP target output formats with EXIF Date Correction
        for (target_fmt, expected_ext, supports_exif) in [
            ("PNG", "png", true),
            ("WEBP", "webp", true),
            ("TIFF", "tiff", true),
            ("BMP", "bmp", false),
        ] {
            let sub_out = out_root.join(target_fmt);
            fs::create_dir_all(&sub_out).unwrap();
            let rep = execute_convert_batch_core(
                None,
                vec![f2_2000.to_string_lossy().to_string()],
                sub_out.to_string_lossy().to_string(),
                target_fmt.to_string(),
                4,
                false,
                ExifCorrectionOptions {
                    enabled: true,
                    date_source: ExifDateSource::Custom,
                    custom_date_time: "2026-11-11 16:00:00".to_string(),
                    ..Default::default()
                },
            )
            .unwrap();
            let target_file = PathBuf::from(&rep.output_dir).join(format!("02_reset_2000.{expected_ext}"));
            assert!(target_file.exists());
            if supports_exif {
                assert_eq!(rep.metadata_fixed, 1);
                let info = parse_tiff_exif(&extract_tiff_header_from_file(&target_file).unwrap());
                assert_eq!(info.date_time_original.as_deref(), Some("2026:11:11 16:00:00"));
                assert_eq!(info.camera_model.as_deref(), Some("Canon EOS R5"));
            } else {
                assert_eq!(rep.converted_success, 1);
                assert_eq!(rep.metadata_unsupported, 1);
            }
        }

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn benchmark_high_performance_batch_1000_5000_10000_jpegs() {
        use sysinfo::{Pid, ProcessesToUpdate, System};

        let dir = temp_dir("bench_10k");
        let template_valid = dir.join("template_valid.jpg");
        let template_bad = dir.join("template_bad.jpg");

        write_test_jpeg_with_exif(
            &template_valid,
            320,
            240,
            Some(&build_rich_test_exif(
                Some("2023:09:15 10:20:30"),
                Some("2023:09:15 10:20:30"),
                Some("2023:09:15 10:20:30"),
                Some("+07:00"),
            )),
        );
        write_test_jpeg_with_exif(
            &template_bad,
            320,
            240,
            Some(&build_rich_test_exif(
                Some("2000:01:01 00:00:00"),
                Some("2000:01:01 00:00:00"),
                Some("2000:01:01 00:00:00"),
                Some("+07:00"),
            )),
        );

        let valid_bytes = fs::read(&template_valid).unwrap();
        let bad_bytes = fs::read(&template_bad).unwrap();

        let mut sys = System::new();
        let pid = Pid::from_u32(std::process::id());

        for count in [1_000usize, 5_000usize, 10_000usize] {
            let batch_in = dir.join(format!("in_{count}"));
            let batch_out = dir.join(format!("out_{count}"));
            fs::create_dir_all(&batch_in).unwrap();
            fs::create_dir_all(&batch_out).unwrap();

            // Half abnormal (need EXIF fix), half valid (must be skipped by EXIF fixer)
            (0..count).into_par_iter().for_each(|i| {
                let p = batch_in.join(format!("IMG_{i:05}.jpg"));
                if i % 2 == 0 {
                    fs::write(p, &bad_bytes).unwrap();
                } else {
                    fs::write(p, &valid_bytes).unwrap();
                }
            });

            let opts = ExifCorrectionOptions {
                enabled: true,
                date_source: ExifDateSource::Current,
                file_timestamp_kind: FileTimestampKind::Created,
                custom_date_time: String::new(),
                keep_original_time_of_day: false,
                reference_photo_path: None,
                scope: ExifCorrectionScope::AbnormalOnly,
                include_missing: false,
                min_reasonable_year: 1995,
            };

            let rep = execute_convert_batch_core(
                None,
                vec![batch_in.to_string_lossy().to_string()],
                batch_out.to_string_lossy().to_string(),
                "JPG".to_string(),
                4,
                false,
                opts,
            )
            .unwrap();

            sys.refresh_processes(ProcessesToUpdate::Some(&[pid]), true);
            let mem_mb = sys
                .process(pid)
                .map(|p| p.memory() as f64 / (1024.0 * 1024.0))
                .unwrap_or(0.0);

            println!(
                "[BENCHMARK {count} JPEGs] Scan: {}ms | EXIF Fix: {}ms | Total: {}ms | Throughput: {:.1} files/sec | Fixed: {} | Kept: {} | RSS RAM: {:.1} MB",
                rep.scan_duration_ms,
                rep.exif_fix_duration_ms,
                rep.total_duration_ms,
                rep.throughput_files_per_sec,
                rep.metadata_fixed,
                rep.metadata_kept,
                mem_mb
            );

            assert_eq!(rep.converted_success, count);
            assert_eq!(rep.metadata_fixed, count / 2);
            assert_eq!(rep.metadata_kept, count / 2);

            if count == 1_000 {
                // Compare against full decode + re-encode (quality = 3 -> 80% JPEG re-encode)
                let reencode_out = dir.join("out_1000_reencode");
                fs::create_dir_all(&reencode_out).unwrap();
                let rep_reencode = execute_convert_batch_core(
                    None,
                    vec![batch_in.to_string_lossy().to_string()],
                    reencode_out.to_string_lossy().to_string(),
                    "JPG".to_string(),
                    3, // triggers full JPEG decode + re-encode + post EXIF injection
                    false,
                    ExifCorrectionOptions {
                        enabled: true,
                        date_source: ExifDateSource::Current,
                        scope: ExifCorrectionScope::AbnormalOnly,
                        ..Default::default()
                    },
                )
                .unwrap();
                println!(
                    "[BENCHMARK 1000 JPEGs DECODE/RE-ENCODE (Q=80%)] Total: {}ms | Throughput: {:.1} files/sec (Speedup of metadata-only path: {:.1}x)",
                    rep_reencode.total_duration_ms,
                    rep_reencode.throughput_files_per_sec,
                    (rep_reencode.total_duration_ms as f64) / (rep.total_duration_ms.max(1) as f64)
                );
                let _ = fs::remove_dir_all(&reencode_out);
            }

            let _ = fs::remove_dir_all(&batch_in);
            let _ = fs::remove_dir_all(&batch_out);
        }

        let _ = fs::remove_dir_all(dir);
    }
}
