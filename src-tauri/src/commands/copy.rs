use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use rayon::prelude::*;
use tauri::{AppHandle, Emitter};

use super::types::{
    CopyOptions, CopyResult, DuplicatePolicy, FileOperation, FolderStructure,
    MatchStatus, MatchedPhoto, ProgressEvent,
};

/// Fast file copy that attempts macOS APFS copy-on-write (`clonefile`) first
/// for instant 0-byte-copy same-volume operations, falling back to `std::fs::copy`.
fn fast_copy_file(src: &str, dest: &Path) -> std::io::Result<()> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;
        if let (Ok(c_src), Ok(c_dest)) = (
            CString::new(src.as_bytes()),
            CString::new(dest.as_os_str().as_bytes()),
        ) {
            let ret = unsafe { libc::clonefile(c_src.as_ptr(), c_dest.as_ptr(), 0) };
            if ret == 0 {
                return Ok(());
            }
        }
    }
    fs::copy(src, dest).map(|_| ())
}

/// Copies or moves matched photos to the output folder.
///
/// Supports multiple operations (Copy, Move, HardLink, SymbolicLink),
/// duplicate policies, and folder structure modes (Flat, Preserve).
/// Runs off the main async runtime thread and uses bounded parallel I/O
/// to avoid stalling on CloudStorage (Google Drive) or large RAW batches.
#[tauri::command]
pub async fn copy_files(
    app: AppHandle,
    matches: Vec<MatchedPhoto>,
    options: CopyOptions,
    cancelled: tauri::State<'_, Arc<AtomicBool>>,
) -> Result<CopyResult, String> {
    cancelled.store(false, Ordering::SeqCst);
    let cancelled_flag = cancelled.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        let start = Instant::now();

        if !options.output_folder.is_empty() {
            fs::create_dir_all(&options.output_folder)
                .map_err(|e| format!("Failed to create output folder: {}", e))?;
        }

        // Collect files to process based on duplicate policy
        let mut tasks: Vec<(String, PathBuf)> = Vec::new();
        let mut seen_dests: HashSet<PathBuf> = HashSet::new();

        for matched in &matches {
            if matched.status == MatchStatus::Missing || matched.status == MatchStatus::InputDuplicate {
                continue;
            }

            let files_to_copy = match options.duplicate_policy {
                DuplicatePolicy::CopyFirst => {
                    matched.photo.as_ref().map(|p| vec![p.clone()]).unwrap_or_default()
                }
                DuplicatePolicy::CopyAll => matched.all_matches.clone(),
                DuplicatePolicy::RenameAutomatically => matched.all_matches.clone(),
                DuplicatePolicy::Skip => {
                    if matched.status == MatchStatus::Duplicate {
                        continue;
                    }
                    matched.photo.as_ref().map(|p| vec![p.clone()]).unwrap_or_default()
                }
            };

            for (idx, file) in files_to_copy.iter().enumerate() {
                let dest = compute_destination(
                    &file.full_path,
                    &file.filename,
                    &options,
                    idx,
                    files_to_copy.len() > 1,
                )?;
                if seen_dests.insert(dest.clone()) {
                    tasks.push((file.full_path.clone(), dest));
                }
            }
        }

        let total = tasks.len();
        if total == 0 {
            let _ = app.emit(
                "copy-progress",
                ProgressEvent {
                    current: 0,
                    total: 0,
                    percentage: 100.0,
                    message: "Hoàn tất: 0 file cần chép".to_string(),
                    eta_seconds: Some(0.0),
                    speed: None,
                },
            );
            return Ok(CopyResult {
                success_count: 0,
                error_count: 0,
                skipped_count: 0,
                errors: Vec::new(),
            });
        }

        // Emit immediate initial progress so UI popup never appears stuck at uninitialized 0%
        let _ = app.emit(
            "copy-progress",
            ProgressEvent {
                current: 0,
                total,
                percentage: 0.0,
                message: format!("Đang chuẩn bị lọc {} file...", total),
                eta_seconds: None,
                speed: None,
            },
        );

        // Pre-create all unique destination parent directories once to avoid redundant
        // CloudStorage / filesystem syscalls on every file iteration.
        let mut unique_parents: HashSet<PathBuf> = HashSet::new();
        for (_, dest) in &tasks {
            if let Some(parent) = dest.parent() {
                unique_parents.insert(parent.to_path_buf());
            }
        }
        for parent in &unique_parents {
            if let Err(e) = fs::create_dir_all(parent) {
                return Err(format!("Failed to create destination folder {}: {}", parent.display(), e));
            }
        }

        let completed_count = AtomicUsize::new(0);
        let success_count = AtomicUsize::new(0);
        let error_count = AtomicUsize::new(0);
        let skipped_count = AtomicUsize::new(0);
        let errors: Mutex<Vec<String>> = Mutex::new(Vec::new());

        let process_task = |(src, dest): &(String, PathBuf)| {
            if cancelled_flag.load(Ordering::Relaxed) {
                return;
            }

            if dest.exists() {
                skipped_count.fetch_add(1, Ordering::Relaxed);
            } else {
                let result = match options.operation {
                    FileOperation::Copy => fast_copy_file(src, dest),
                    FileOperation::Move => fs::rename(src, dest).or_else(|_| {
                        fast_copy_file(src, dest).and_then(|_| fs::remove_file(src))
                    }),
                    FileOperation::HardLink => fs::hard_link(src, dest),
                    FileOperation::SymbolicLink => {
                        #[cfg(unix)]
                        {
                            std::os::unix::fs::symlink(src, dest)
                        }
                        #[cfg(windows)]
                        {
                            std::os::windows::fs::symlink_file(src, dest)
                        }
                    }
                };

                match result {
                    Ok(()) => {
                        success_count.fetch_add(1, Ordering::Relaxed);
                    }
                    Err(e) => {
                        error_count.fetch_add(1, Ordering::Relaxed);
                        if let Ok(mut errs) = errors.lock() {
                            errs.push(format!("{} -> {}: {}", src, dest.display(), e));
                        }
                    }
                }
            }

            let done = completed_count.fetch_add(1, Ordering::SeqCst) + 1;
            let emit_interval = std::cmp::max(1, total / 100);
            if done % emit_interval == 0 || done == total {
                let elapsed = start.elapsed().as_secs_f64().max(0.001);
                let speed = done as f64 / elapsed;
                let remaining = total.saturating_sub(done) as f64 / speed;

                let _ = app.emit(
                    "copy-progress",
                    ProgressEvent {
                        current: done,
                        total,
                        percentage: (done as f64 / total as f64) * 100.0,
                        message: format!("Đang lọc {}/{} file", done, total),
                        eta_seconds: Some(remaining),
                        speed: Some(format!("{:.0} files/s", speed)),
                    },
                );
            }
        };

        // Use a bounded 4-thread pool for parallel file copying: overlaps CloudStorage / disk latency
        // (3-4x faster than sequential loop) without overwhelming virtual filesystem daemons.
        if let Ok(pool) = rayon::ThreadPoolBuilder::new().num_threads(4).build() {
            pool.install(|| {
                tasks.par_iter().for_each(process_task);
            });
        } else {
            tasks.iter().for_each(process_task);
        }

        let final_success = success_count.load(Ordering::SeqCst);
        let final_error = error_count.load(Ordering::SeqCst);
        let final_skipped = skipped_count.load(Ordering::SeqCst);
        let mut final_errors = errors.into_inner().unwrap_or_default();

        if cancelled_flag.load(Ordering::SeqCst) {
            final_errors.push("Operation cancelled by user".to_string());
            return Ok(CopyResult {
                success_count: final_success,
                error_count: final_error,
                skipped_count: final_skipped,
                errors: final_errors,
            });
        }

        let _ = app.emit(
            "copy-progress",
            ProgressEvent {
                current: total,
                total,
                percentage: 100.0,
                message: format!(
                    "Hoàn tất: {} thành công, {} lỗi, {} bỏ qua",
                    final_success, final_error, final_skipped
                ),
                eta_seconds: Some(0.0),
                speed: None,
            },
        );

        Ok(CopyResult {
            success_count: final_success,
            error_count: final_error,
            skipped_count: final_skipped,
            errors: final_errors,
        })
    })
    .await
    .map_err(|e| format!("Copy task failed: {}", e))?
}

/// Computes the destination path for a file based on copy options.
fn compute_destination(
    source_path: &str,
    filename: &str,
    options: &CopyOptions,
    duplicate_idx: usize,
    is_duplicate: bool,
) -> Result<PathBuf, String> {
    let mut output = Path::new(&options.output_folder).to_path_buf();

    if options.output_mode == super::types::OutputMode::Folder {
        // Output to a subfolder named after the input folder
        let source = Path::new(source_path);
        for input_folder in &options.input_folders {
            let input = Path::new(input_folder);
            if source.starts_with(input) {
                if let Some(folder_name) = input.file_name() {
                    output = output.join(folder_name);
                }
                break;
            }
        }
    }

    // Apply prefix and suffix
    let stem = Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let mut new_name = String::new();

    if let Some(ref prefix) = options.prefix {
        if !prefix.is_empty() {
            new_name.push_str(prefix);
            new_name.push('_');
        }
    }

    new_name.push_str(stem);

    if let Some(ref suffix) = options.suffix {
        if !suffix.is_empty() {
            new_name.push('_');
            new_name.push_str(suffix);
        }
    }

    // Handle duplicate rename
    if is_duplicate
        && duplicate_idx > 0
        && matches!(options.duplicate_policy, DuplicatePolicy::RenameAutomatically)
    {
        new_name.push_str(&format!("_{}", duplicate_idx + 1));
    }

    if !ext.is_empty() {
        new_name.push('.');
        new_name.push_str(ext);
    }

    if options.output_mode == super::types::OutputMode::SameAsOriginal {
        // Output to a "Selects" subfolder in the same directory as the original file
        let source_dir = Path::new(source_path).parent().unwrap_or(Path::new(""));
        let selects_dir = source_dir.join("Selects");
        return Ok(selects_dir.join(&new_name));
    }


    match options.folder_structure {
        FolderStructure::Flat => Ok(output.join(&new_name)),
        FolderStructure::Preserve => {
            // Find relative path from one of the input folders
            let source = Path::new(source_path);
            for input_folder in &options.input_folders {
                let input = Path::new(input_folder);
                if let Ok(relative) = source.strip_prefix(input) {
                    let relative_dir = relative.parent().unwrap_or(Path::new(""));
                    return Ok(output.join(relative_dir).join(&new_name));
                }
            }
            // Fallback to flat if no matching input folder
            Ok(output.join(&new_name))
        }
    }
}

/// Cancels an ongoing copy operation
#[tauri::command]
pub async fn cancel_copy(
    cancelled: tauri::State<'_, Arc<AtomicBool>>,
) -> Result<(), String> {
    cancelled.store(true, Ordering::SeqCst);
    Ok(())
}
