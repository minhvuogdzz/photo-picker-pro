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

/// What kind of storage a path lives on, used to pick how many files to copy at once.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StorageKind {
    /// Internal or external SSD: parallel copies overlap well.
    SolidState,
    /// Spinning hard disk: parallel reads/writes make the head seek back and forth, so copy one at a time.
    Rotational,
    /// Network share or cloud sync folder (SMB, NFS, Google Drive...): latency-bound, parallel copies help.
    Network,
    /// Could not tell (e.g. non-macOS): keep the previous default.
    Unknown,
}

/// Number of files copied at the same time. One spinning disk on either side forces sequential copying,
/// because interleaving several large RAW files on a HDD is slower than copying them back to back.
fn copy_parallelism(kinds: &[StorageKind]) -> usize {
    if kinds.contains(&StorageKind::Rotational) {
        1
    } else {
        4
    }
}

/// Reads the `SolidState` key from `diskutil info -plist` output. `None` when the key is missing.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn parse_solid_state_from_plist(plist: &str) -> Option<bool> {
    let idx = plist.find("<key>SolidState</key>")?;
    let rest = plist[idx + "<key>SolidState</key>".len()..].trim_start();
    if rest.starts_with("<true/>") {
        Some(true)
    } else if rest.starts_with("<false/>") {
        Some(false)
    } else {
        None
    }
}

/// Filesystems that live on a local block device; anything else (smbfs, nfs, afpfs, webdav, macFUSE
/// cloud drives...) is treated as network storage.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn is_local_fs_type(fs_type: &str) -> bool {
    matches!(
        fs_type,
        "apfs" | "hfs" | "exfat" | "msdos" | "ntfs" | "ufsd_ntfs" | "tuxera_ntfs" | "ufsd_exfat"
    )
}

/// Returns (filesystem type, mount point) for the volume holding `path`.
#[cfg(target_os = "macos")]
fn volume_of(path: &Path) -> Option<(String, String)> {
    use std::ffi::{CStr, CString};
    use std::os::unix::ffi::OsStrExt;

    let c_path = CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut stat: libc::statfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statfs(c_path.as_ptr(), &mut stat) } != 0 {
        return None;
    }
    let fs_type = unsafe { CStr::from_ptr(stat.f_fstypename.as_ptr()) }
        .to_string_lossy()
        .to_string();
    let mount = unsafe { CStr::from_ptr(stat.f_mntonname.as_ptr()) }
        .to_string_lossy()
        .to_string();
    Some((fs_type, mount))
}

/// Storage kind per mount point, kept for the whole app session so `diskutil` (~0.25s) runs once per volume.
#[cfg(target_os = "macos")]
static STORAGE_KIND_CACHE: std::sync::OnceLock<Mutex<std::collections::HashMap<String, StorageKind>>> =
    std::sync::OnceLock::new();

/// Detects the storage kind of every distinct volume among `dirs`, asking `diskutil` once per volume.
#[cfg(target_os = "macos")]
fn detect_storage_kinds<'a>(dirs: impl Iterator<Item = &'a Path>) -> Vec<StorageKind> {
    use std::collections::HashMap;

    let cache = STORAGE_KIND_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let mut by_mount: HashMap<String, StorageKind> = HashMap::new();
    for dir in dirs {
        let Some((fs_type, mount)) = volume_of(dir) else {
            continue;
        };
        if by_mount.contains_key(&mount) {
            continue;
        }
        if let Some(kind) = cache.lock().ok().and_then(|c| c.get(&mount).copied()) {
            by_mount.insert(mount, kind);
            continue;
        }
        let cloud_folder = dir.to_string_lossy().contains("/Library/CloudStorage/");
        let kind = if cloud_folder || !is_local_fs_type(&fs_type) {
            StorageKind::Network
        } else {
            std::process::Command::new("/usr/sbin/diskutil")
                .args(["info", "-plist", &mount])
                .output()
                .ok()
                .filter(|out| out.status.success())
                .and_then(|out| parse_solid_state_from_plist(&String::from_utf8_lossy(&out.stdout)))
                .map(|ssd| if ssd { StorageKind::SolidState } else { StorageKind::Rotational })
                .unwrap_or(StorageKind::Unknown)
        };
        if let Ok(mut c) = cache.lock() {
            c.insert(mount.clone(), kind);
        }
        by_mount.insert(mount, kind);
    }
    by_mount.into_values().collect()
}

#[cfg(not(target_os = "macos"))]
fn detect_storage_kinds<'a>(_dirs: impl Iterator<Item = &'a Path>) -> Vec<StorageKind> {
    vec![StorageKind::Unknown]
}

/// True when the OS refused a path because of the characters in its name: `EILSEQ`
/// ("Illegal byte sequence", os error 92 on macOS) on Unix, `ERROR_INVALID_NAME` on Windows.
fn is_illegal_name_error(err: &std::io::Error) -> bool {
    #[cfg(unix)]
    {
        err.raw_os_error() == Some(libc::EILSEQ)
    }
    #[cfg(windows)]
    {
        err.raw_os_error() == Some(123)
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = err;
        false
    }
}

/// Characters kept when a folder name has to be cleaned: letters and digits of any script
/// (Vietnamese, CJK...), combining accents, printable ASCII except path separators, assigned BMP
/// symbols, and long-established emoji blocks. Control characters, Unicode noncharacters, private-use
/// characters and very new / unassigned astral code points are dropped, since those are what
/// macOS rejects with "Illegal byte sequence".
fn is_safe_name_char(c: char) -> bool {
    let cp = c as u32;
    if c.is_control() || c == '/' || c == '\\' || c == ':' {
        return false;
    }
    if c.is_ascii() || c.is_alphanumeric() || c.is_whitespace() {
        return true;
    }
    let noncharacter = (0xFDD0..=0xFDEF).contains(&cp) || (cp & 0xFFFE) == 0xFFFE;
    let private_use = (0xE000..=0xF8FF).contains(&cp) || cp >= 0xF0000;
    if noncharacter || private_use {
        return false;
    }
    if cp <= 0xFFFF {
        return true;
    }
    matches!(
        cp,
        0x1F1E6..=0x1F1FF // regional indicators (flags)
            | 0x1F300..=0x1F5FF // symbols & pictographs
            | 0x1F600..=0x1F64F // emoticons
            | 0x1F680..=0x1F6FF // transport & map
            | 0x1F900..=0x1F9FF // supplemental symbols & pictographs
    )
}

/// Cleans one folder name: unsafe characters become a space, runs of spaces collapse,
/// and leading/trailing spaces and dots are trimmed. Never returns an empty name.
fn sanitize_folder_name(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    let mut last_was_space = false;
    for c in name.chars() {
        let c = if is_safe_name_char(c) { c } else { ' ' };
        if c.is_whitespace() {
            if !last_was_space {
                out.push(' ');
            }
            last_was_space = true;
        } else {
            out.push(c);
            last_was_space = false;
        }
    }
    let trimmed = out.trim_matches(|c: char| c.is_whitespace() || c == '.');
    if trimmed.is_empty() {
        "Folder".to_string()
    } else {
        trimmed.to_string()
    }
}

/// Rebuilds `path` with every not-yet-existing component cleaned by [`sanitize_folder_name`].
/// Components that already exist on disk are kept as they are.
fn sanitize_missing_components(path: &Path) -> PathBuf {
    let mut base = path.to_path_buf();
    let mut missing: Vec<String> = Vec::new();
    while !base.exists() {
        match (base.file_name(), base.parent()) {
            (Some(name), Some(parent)) => {
                missing.push(name.to_string_lossy().to_string());
                base = parent.to_path_buf();
            }
            _ => break,
        }
    }
    for name in missing.iter().rev() {
        base.push(sanitize_folder_name(name));
    }
    base
}

/// Creates every destination folder once. If the OS rejects a folder name, the missing part of the
/// path is cleaned, created, and all tasks pointing into it are redirected there.
/// Returns the final set of destination folders.
fn create_destination_dirs(tasks: &mut [(String, PathBuf)]) -> Result<HashSet<PathBuf>, String> {
    let mut unique_parents: HashSet<PathBuf> = HashSet::new();
    for (_, dest) in tasks.iter() {
        if let Some(parent) = dest.parent() {
            unique_parents.insert(parent.to_path_buf());
        }
    }

    let mut remap: std::collections::HashMap<PathBuf, PathBuf> = std::collections::HashMap::new();
    for parent in &unique_parents {
        match fs::create_dir_all(parent) {
            Ok(()) => {}
            Err(e) if is_illegal_name_error(&e) => {
                let fixed = sanitize_missing_components(parent);
                if fixed == *parent {
                    return Err(format!("Failed to create destination folder {}: {}", parent.display(), e));
                }
                fs::create_dir_all(&fixed).map_err(|e2| {
                    format!("Failed to create destination folder {}: {}", fixed.display(), e2)
                })?;
                remap.insert(parent.clone(), fixed);
            }
            Err(e) => {
                return Err(format!("Failed to create destination folder {}: {}", parent.display(), e));
            }
        }
    }

    if remap.is_empty() {
        return Ok(unique_parents);
    }

    for (_, dest) in tasks.iter_mut() {
        let new_dest = match (dest.parent(), dest.file_name()) {
            (Some(parent), Some(file_name)) => remap.get(parent).map(|np| np.join(file_name)),
            _ => None,
        };
        if let Some(nd) = new_dest {
            *dest = nd;
        }
    }
    Ok(unique_parents
        .into_iter()
        .map(|p| remap.get(&p).cloned().unwrap_or(p))
        .collect())
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
        // CloudStorage / filesystem syscalls on every file iteration. Folder names the OS refuses
        // (e.g. a customer folder whose name holds a character macOS does not know) are cleaned up.
        let unique_parents = create_destination_dirs(&mut tasks)?;

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

        // Pick the copy concurrency from the source and destination volumes: 4 parallel copies overlap
        // SSD / CloudStorage / network latency, but a spinning HDD on either side is copied one file at a
        // time in folder order so the disk head is not thrashed between several large RAW files.
        let source_dirs: HashSet<PathBuf> = tasks
            .iter()
            .filter_map(|(src, _)| Path::new(src).parent().map(|p| p.to_path_buf()))
            .collect();
        let storage_kinds = detect_storage_kinds(
            source_dirs
                .iter()
                .map(|p| p.as_path())
                .chain(unique_parents.iter().map(|p| p.as_path())),
        );
        let parallelism = copy_parallelism(&storage_kinds);

        if parallelism <= 1 {
            tasks.sort_by(|a, b| a.0.cmp(&b.0));
            tasks.iter().for_each(process_task);
        } else if let Ok(pool) = rayon::ThreadPoolBuilder::new().num_threads(parallelism).build() {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_copy_parallelism_by_storage_kind() {
        assert_eq!(copy_parallelism(&[StorageKind::SolidState]), 4);
        assert_eq!(copy_parallelism(&[StorageKind::Network, StorageKind::SolidState]), 4);
        assert_eq!(copy_parallelism(&[StorageKind::Unknown]), 4);
        assert_eq!(copy_parallelism(&[StorageKind::Rotational, StorageKind::SolidState]), 1);
        assert_eq!(copy_parallelism(&[StorageKind::Network, StorageKind::Rotational]), 1);
    }

    #[test]
    fn test_parse_solid_state_from_plist() {
        let ssd = "<dict>\n\t<key>SolidState</key>\n\t<true/>\n</dict>";
        let hdd = "<dict>\n\t<key>SolidState</key>\n\t<false/>\n</dict>";
        assert_eq!(parse_solid_state_from_plist(ssd), Some(true));
        assert_eq!(parse_solid_state_from_plist(hdd), Some(false));
        assert_eq!(parse_solid_state_from_plist("<dict></dict>"), None);
    }

    #[test]
    fn test_is_local_fs_type() {
        assert!(is_local_fs_type("apfs"));
        assert!(is_local_fs_type("exfat"));
        assert!(!is_local_fs_type("smbfs"));
        assert!(!is_local_fs_type("macfuse"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_detect_storage_kinds_on_this_mac() {
        let tmp = std::env::temp_dir();
        let kinds = detect_storage_kinds(std::iter::once(tmp.as_path()));
        assert_eq!(kinds.len(), 1);
        println!("temp dir storage kind: {:?}", kinds[0]);
    }
    #[test]
    fn test_sanitize_folder_name_keeps_vietnamese_and_common_emoji() {
        assert_eq!(
            sanitize_folder_name("22-11 16h Nguyễn Thị Mỹ Linh 2cc"),
            "22-11 16h Nguyễn Thị Mỹ Linh 2cc"
        );
        assert_eq!(sanitize_folder_name("24-11 16h Quả bom 💣 2cc"), "24-11 16h Quả bom 💣 2cc");
        assert_eq!(sanitize_folder_name("22-11 8h phgihnl - 芳玲. 2cc"), "22-11 8h phgihnl - 芳玲. 2cc");
    }

    #[test]
    fn test_sanitize_folder_name_drops_rejected_characters() {
        assert_eq!(sanitize_folder_name("ngon quả\u{FFFF}1cc"), "ngon quả 1cc");
        assert_eq!(sanitize_folder_name("ngon quả\u{1FAFF}\u{1FAFF}1cc"), "ngon quả 1cc");
        assert_eq!(sanitize_folder_name("a/b:c"), "a b c");
        assert_eq!(sanitize_folder_name("\u{FFFF}"), "Folder");
    }

    #[cfg(unix)]
    #[test]
    fn test_create_destination_dirs_recovers_from_illegal_folder_name() {
        let root = std::env::temp_dir().join(format!(
            "dh_copy_eilseq_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let bad_dir = root.join("22-11 16h chiyokeys - ngon quả\u{FFFF}1cc");
        let mut tasks = vec![
            ("/src/IMG_0001.JPG".to_string(), bad_dir.join("IMG_0001.JPG")),
            ("/src/IMG_0002.JPG".to_string(), bad_dir.join("IMG_0002.JPG")),
            ("/src/IMG_0003.JPG".to_string(), root.join("ok").join("IMG_0003.JPG")),
        ];

        let parents = create_destination_dirs(&mut tasks).unwrap();

        let fixed_dir = root.join("22-11 16h chiyokeys - ngon quả 1cc");
        // On filesystems that accept the name nothing is remapped; on macOS it is cleaned.
        let expected_dir = if bad_dir.exists() { bad_dir.clone() } else { fixed_dir.clone() };
        assert!(expected_dir.is_dir());
        assert_eq!(tasks[0].1, expected_dir.join("IMG_0001.JPG"));
        assert_eq!(tasks[1].1, expected_dir.join("IMG_0002.JPG"));
        assert_eq!(tasks[2].1, root.join("ok").join("IMG_0003.JPG"));
        assert!(parents.contains(&expected_dir));
        #[cfg(target_os = "macos")]
        assert_eq!(expected_dir, fixed_dir);

        let _ = fs::remove_dir_all(&root);
    }
}
