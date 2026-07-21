use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use tauri::{AppHandle, Emitter};

use super::types::{
    CopyOptions, CopyResult, DuplicatePolicy, FileOperation, FolderStructure,
    MatchStatus, MatchedPhoto, ProgressEvent,
};

/// Copies or moves matched photos to the output folder.
///
/// Supports multiple operations (Copy, Move, HardLink, SymbolicLink),
/// duplicate policies, and folder structure modes (Flat, Preserve).
#[tauri::command]
pub async fn copy_files(
    app: AppHandle,
    matches: Vec<MatchedPhoto>,
    options: CopyOptions,
    cancelled: tauri::State<'_, Arc<AtomicBool>>,
) -> Result<CopyResult, String> {
    cancelled.store(false, Ordering::SeqCst);
    let cancelled_flag = cancelled.inner().clone();
    let start = Instant::now();

    // Create output directory
    fs::create_dir_all(&options.output_folder)
        .map_err(|e| format!("Failed to create output folder: {}", e))?;

    // Collect files to process based on duplicate policy
    let mut tasks: Vec<(String, PathBuf)> = Vec::new();

    for matched in &matches {
        if matched.status == MatchStatus::Missing {
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
            tasks.push((file.full_path.clone(), dest));
        }
    }

    let total = tasks.len();
    let mut success_count: usize = 0;
    let mut error_count: usize = 0;
    let mut skipped_count: usize = 0;
    let mut errors: Vec<String> = Vec::new();

    for (idx, (src, dest)) in tasks.iter().enumerate() {
        if cancelled_flag.load(Ordering::SeqCst) {
            return Ok(CopyResult {
                success_count,
                error_count,
                skipped_count,
                errors: vec!["Operation cancelled by user".to_string()],
            });
        }

        // Create parent directories
        if let Some(parent) = dest.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                errors.push(format!("Failed to create dir for {}: {}", dest.display(), e));
                error_count += 1;
                continue;
            }
        }

        // Check if destination already exists
        if dest.exists() {
            skipped_count += 1;
            continue;
        }

        // Perform the file operation
        let result = match options.operation {
            FileOperation::Copy => fs::copy(src, dest).map(|_| ()),
            FileOperation::Move => fs::rename(src, dest).or_else(|_| {
                // Cross-device move: copy then delete
                fs::copy(src, dest).and_then(|_| fs::remove_file(src))
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
            Ok(()) => success_count += 1,
            Err(e) => {
                errors.push(format!("{} -> {}: {}", src, dest.display(), e));
                error_count += 1;
            }
        }

        // Emit progress
        if (idx + 1) % 10 == 0 || idx + 1 == total {
            let elapsed = start.elapsed().as_secs_f64();
            let speed = (idx + 1) as f64 / elapsed;
            let remaining = (total - idx - 1) as f64 / speed;

            let _ = app.emit(
                "copy-progress",
                ProgressEvent {
                    current: idx + 1,
                    total,
                    percentage: ((idx + 1) as f64 / total as f64) * 100.0,
                    message: format!("Processing {}/{}", idx + 1, total),
                    eta_seconds: Some(remaining),
                    speed: Some(format!("{:.0} files/s", speed)),
                },
            );
        }
    }

    let _ = app.emit(
        "copy-progress",
        ProgressEvent {
            current: total,
            total,
            percentage: 100.0,
            message: format!(
                "Complete: {} success, {} errors, {} skipped",
                success_count, error_count, skipped_count
            ),
            eta_seconds: Some(0.0),
            speed: None,
        },
    );

    Ok(CopyResult {
        success_count,
        error_count,
        skipped_count,
        errors,
    })
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
