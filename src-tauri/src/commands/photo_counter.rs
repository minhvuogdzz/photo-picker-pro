use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

const DEFAULT_FINISHED_EXTS: &[&str] = &["jpg", "jpeg", "png", "tif", "tiff", "webp"];
const ALL_IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "tif", "tiff", "webp",
    "cr2", "cr3", "nef", "arw", "raf", "dng", "orf", "rw2", "pef", "psd"
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanMonthOptions {
    pub extensions_preset: Option<String>, // "finished" (default), "all", "custom"
    pub custom_extensions: Option<Vec<String>>,
    pub count_mode: Option<String>, // "deepest_folder" (default) or "all_recursive"
    pub exclude_patterns: Option<Vec<String>>, // e.g. ["raw", "goc", "backup", "original"]
    pub enable_exclude_patterns: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepestFolderInfo {
    pub folder_path: String,
    pub folder_name: String,
    pub relative_path: String,
    pub job_name: String,
    pub photo_count: usize,
    pub sample_files: Vec<String>,
    pub extensions: HashMap<String, usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayScanResult {
    pub day_name: String,
    pub day_path: String,
    pub total_photos: usize,
    pub job_count: usize,
    pub deepest_folders: Vec<DeepestFolderInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthScanResult {
    pub month_path: String,
    pub month_name: String,
    pub total_photos: usize,
    pub active_days: usize,
    pub total_days: usize,
    pub days: Vec<DayScanResult>,
}

/// Helper: parse natural day/date key for sorting
/// e.g. "1-9" -> 1, "22-9" -> 22, "Ngay 03" -> 3, "2024-09-22" -> 22
fn extract_day_number(name: &str) -> (i64, String) {
    let mut num_str = String::new();
    let mut chars = name.chars().peekable();

    while let Some(&c) = chars.peek() {
        if c.is_ascii_digit() {
            break;
        }
        chars.next();
    }

    while let Some(&c) = chars.peek() {
        if c.is_ascii_digit() {
            num_str.push(c);
            chars.next();
        } else {
            break;
        }
    }

    let num = num_str.parse::<i64>().unwrap_or(9999);
    (num, name.to_lowercase())
}

/// Scans a Month folder, detecting all day subfolders and calculating leaf photo counts.
#[tauri::command]
pub fn scan_month_photos(
    month_path: String,
    options: Option<ScanMonthOptions>,
) -> Result<MonthScanResult, String> {
    let root = Path::new(&month_path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Thư mục không tồn tại hoặc không phải là thư mục: {}", month_path));
    }

    let opts = options.unwrap_or(ScanMonthOptions {
        extensions_preset: Some("finished".to_string()),
        custom_extensions: None,
        count_mode: Some("deepest_folder".to_string()),
        exclude_patterns: None,
        enable_exclude_patterns: Some(true),
    });

    let allowed_exts: HashSet<String> = match opts.extensions_preset.as_deref() {
        Some("all") => ALL_IMAGE_EXTS.iter().map(|&s| s.to_string()).collect(),
        Some("custom") => {
            if let Some(custom) = opts.custom_extensions {
                custom.into_iter().map(|s| s.to_lowercase().trim_start_matches('.').to_string()).collect()
            } else {
                DEFAULT_FINISHED_EXTS.iter().map(|&s| s.to_string()).collect()
            }
        }
        _ => DEFAULT_FINISHED_EXTS.iter().map(|&s| s.to_string()).collect(),
    };

    let enable_exclude = opts.enable_exclude_patterns.unwrap_or(true);
    let exclude_patterns: Vec<String> = if enable_exclude {
        opts.exclude_patterns.unwrap_or_else(|| {
            vec![
                "raw".to_string(),
                "cr2".to_string(),
                "cr3".to_string(),
                "nef".to_string(),
                "arw".to_string(),
                "dng".to_string(),
                "goc".to_string(),
                "file goc".to_string(),
                "anh goc".to_string(),
                "original".to_string(),
                "backup".to_string(),
                ".ds_store".to_string(),
                "thumbs.db".to_string(),
            ]
        }).into_iter().map(|s| s.to_lowercase()).collect()
    } else {
        Vec::new()
    };

    let count_mode = opts.count_mode.unwrap_or_else(|| "deepest_folder".to_string());
    let is_deepest_mode = count_mode == "deepest_folder";

    // 1. Discover Day folders (immediate child directories of root)
    let entries = fs::read_dir(root)
        .map_err(|e| format!("Không thể đọc thư mục tháng: {}", e))?;

    let mut day_dirs: Vec<(PathBuf, String)> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let folder_name = entry.file_name().to_string_lossy().to_string();
            // Skip hidden folders
            if folder_name.starts_with('.') {
                continue;
            }
            day_dirs.push((path, folder_name));
        }
    }

    // If root has no subdirectories, but root itself has images/jobs, treat root as 1 day
    if day_dirs.is_empty() {
        let root_name = root.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "Thư mục".to_string());
        day_dirs.push((root.to_path_buf(), root_name));
    }

    // Sort days naturally (e.g. 1-9, 2-9, ... 22-9 or 01, 02 ... 31)
    day_dirs.sort_by(|a, b| {
        let (num_a, name_a) = extract_day_number(&a.1);
        let (num_b, name_b) = extract_day_number(&b.1);
        num_a.cmp(&num_b).then_with(|| name_a.cmp(&name_b))
    });

    // 2. Scan each Day folder in parallel
    let days_result: Vec<DayScanResult> = day_dirs
        .into_par_iter()
        .map(|(day_path, day_name)| {
            // Collect all directories in day_path with direct image counts
            struct DirEntryData {
                photo_count: usize,
                sample_files: Vec<String>,
                extensions: HashMap<String, usize>,
            }

            let mut dir_map: HashMap<PathBuf, DirEntryData> = HashMap::new();

            for entry in WalkDir::new(&day_path).into_iter().filter_entry(|e| {
                let name = e.file_name().to_string_lossy().to_lowercase();
                if name.starts_with('.') {
                    return false;
                }
                if enable_exclude && e.file_type().is_dir() {
                    for pattern in &exclude_patterns {
                        if name == *pattern || name.starts_with(&format!("{}_", pattern)) || name.ends_with(&format!("_{}", pattern)) {
                            return false;
                        }
                    }
                }
                true
            }).flatten() {
                let p = entry.path();
                if entry.file_type().is_dir() {
                    dir_map.entry(p.to_path_buf()).or_insert_with(|| DirEntryData {
                        photo_count: 0,
                        sample_files: Vec::new(),
                        extensions: HashMap::new(),
                    });
                } else if entry.file_type().is_file() {
                    if let Some(ext) = p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()) {
                        if allowed_exts.contains(&ext) {
                            if let Some(parent) = p.parent() {
                                let parent_buf = parent.to_path_buf();
                                let data = dir_map.entry(parent_buf).or_insert_with(|| DirEntryData {
                                    photo_count: 0,
                                    sample_files: Vec::new(),
                                    extensions: HashMap::new(),
                                });
                                data.photo_count += 1;
                                *data.extensions.entry(ext).or_insert(0) += 1;
                                if data.sample_files.len() < 5 {
                                    data.sample_files.push(entry.file_name().to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }

            // Determine which directories are "deepest image directories"
            let dirs_with_images: Vec<PathBuf> = dir_map
                .iter()
                .filter(|(_, data)| data.photo_count > 0)
                .map(|(path, _)| path.clone())
                .collect();

            let mut leaf_folders: Vec<DeepestFolderInfo> = Vec::new();
            let mut day_total_photos = 0;
            let mut unique_jobs: HashSet<String> = HashSet::new();

            for dir_path in &dirs_with_images {
                let is_leaf = if is_deepest_mode {
                    let has_descendant_with_images = dirs_with_images.iter().any(|other| {
                        other != dir_path && other.starts_with(dir_path)
                    });
                    !has_descendant_with_images
                } else {
                    true
                };

                if is_leaf {
                    if let Some(data) = dir_map.get(dir_path) {
                        day_total_photos += data.photo_count;

                        let relative = dir_path.strip_prefix(&day_path)
                            .map(|p| p.to_string_lossy().to_string())
                            .unwrap_or_default();

                        let job_name = if let Ok(rel) = dir_path.strip_prefix(&day_path) {
                            rel.components()
                                .next()
                                .map(|c| c.as_os_str().to_string_lossy().to_string())
                                .unwrap_or_else(|| day_name.clone())
                        } else {
                            day_name.clone()
                        };

                        unique_jobs.insert(job_name.clone());

                        leaf_folders.push(DeepestFolderInfo {
                            folder_path: dir_path.to_string_lossy().to_string(),
                            folder_name: dir_path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                            relative_path: relative,
                            job_name,
                            photo_count: data.photo_count,
                            sample_files: data.sample_files.clone(),
                            extensions: data.extensions.clone(),
                        });
                    }
                }
            }

            leaf_folders.sort_by(|a, b| a.job_name.cmp(&b.job_name).then_with(|| a.relative_path.cmp(&b.relative_path)));

            DayScanResult {
                day_name,
                day_path: day_path.to_string_lossy().to_string(),
                total_photos: day_total_photos,
                job_count: unique_jobs.len(),
                deepest_folders: leaf_folders,
            }
        })
        .collect();

    let grand_total_photos: usize = days_result.iter().map(|d| d.total_photos).sum();
    let active_days: usize = days_result.iter().filter(|d| d.total_photos > 0).count();

    let month_name = root.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Tháng".to_string());

    let total_days = days_result.len();

    Ok(MonthScanResult {
        month_path,
        month_name,
        total_photos: grand_total_photos,
        active_days,
        total_days,
        days: days_result,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    #[test]
    fn test_extract_day_number() {
        assert_eq!(extract_day_number("22-9").0, 22);
        assert_eq!(extract_day_number("1-9").0, 1);
        assert_eq!(extract_day_number("03").0, 3);
        assert_eq!(extract_day_number("Ngay 15").0, 15);
        assert_eq!(extract_day_number("2024-09-28").0, 2024);
    }

    #[test]
    fn test_scan_month_deepest_folders() {
        let temp_dir = std::env::temp_dir().join(format!("mvd_test_month_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        // Structure:
        // temp_dir/
        // ├── 22-9/
        // │   ├── Customer_A/màu final/SubA/img1.jpg, img2.jpg
        // │   └── Customer_B/JobB/img3.jpg
        // └── 23-9/
        //     └── Customer_C/Final/img4.jpg

        let leaf_a = temp_dir.join("22-9").join("Customer_A").join("màu final").join("SubA");
        let leaf_b = temp_dir.join("22-9").join("Customer_B").join("JobB");
        let leaf_c = temp_dir.join("23-9").join("Customer_C").join("Final");

        fs::create_dir_all(&leaf_a).unwrap();
        fs::create_dir_all(&leaf_b).unwrap();
        fs::create_dir_all(&leaf_c).unwrap();

        File::create(leaf_a.join("img1.jpg")).unwrap().write_all(b"fake").unwrap();
        File::create(leaf_a.join("img2.jpg")).unwrap().write_all(b"fake").unwrap();
        File::create(leaf_b.join("img3.jpg")).unwrap().write_all(b"fake").unwrap();
        File::create(leaf_c.join("img4.jpg")).unwrap().write_all(b"fake").unwrap();

        let result = scan_month_photos(temp_dir.to_string_lossy().to_string(), None).unwrap();

        assert_eq!(result.total_photos, 4);
        assert_eq!(result.active_days, 2);
        assert_eq!(result.days.len(), 2);

        // Day 1 is 22-9
        assert_eq!(result.days[0].day_name, "22-9");
        assert_eq!(result.days[0].total_photos, 3);
        assert_eq!(result.days[0].deepest_folders.len(), 2);

        // Day 2 is 23-9
        assert_eq!(result.days[1].day_name, "23-9");
        assert_eq!(result.days[1].total_photos, 1);
        assert_eq!(result.days[1].deepest_folders.len(), 1);

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
