use std::collections::HashMap;

use regex::Regex;

use tauri::{AppHandle, Emitter};

use super::types::{
    CustomerCode, MatchMode, MatchResult, MatchStatus, MatchedPhoto, PhotoFile, ProgressEvent,
};

/// Matches customer codes against scanned photo files.
///
/// Supports three matching modes:
/// - **ExactNumber**: The numeric portion of the filename must exactly match the code
/// - **Contains**: The filename must contain the code somewhere within it
/// - **Regex**: User-provided regex pattern is used for matching
#[tauri::command]
pub fn match_photos(
    app: AppHandle,
    codes: Vec<CustomerCode>,
    files: Vec<PhotoFile>,
    mode: String,
    regex_pattern: Option<String>,
    folder_count: Option<usize>,
) -> Result<MatchResult, String> {
    match_photos_impl(codes, files, mode, regex_pattern, folder_count, move |event| {
        let _ = app.emit("match-progress", event);
    })
}

pub fn match_photos_impl<F>(
    codes: Vec<CustomerCode>,
    files: Vec<PhotoFile>,
    mode: String,
    regex_pattern: Option<String>,
    folder_count: Option<usize>,
    mut progress_callback: F,
) -> Result<MatchResult, String>
where
    F: FnMut(ProgressEvent),
{
    let match_mode = match mode.as_str() {
        "ExactNumber" => MatchMode::ExactNumber,
        "Contains" => MatchMode::Contains,
        "Regex" => MatchMode::Regex,
        _ => MatchMode::ExactNumber,
    };

    let multi_folder = folder_count.unwrap_or(1) >= 2;

    // Build number-based file index for ExactNumber mode
    let number_index: HashMap<String, Vec<&PhotoFile>> = match match_mode {
        MatchMode::ExactNumber => {
            let mut index: HashMap<String, Vec<&PhotoFile>> = HashMap::new();
            for file in &files {
                if !file.normalized_number.is_empty() {
                    index
                        .entry(file.normalized_number.clone())
                        .or_default()
                        .push(file);
                }
            }
            index
        }
        _ => HashMap::new(),
    };

    // Build a stem-based index for multi-folder exact matching
    // Maps lowercase filename stem -> list of files
    let stem_index: HashMap<String, Vec<&PhotoFile>> = if multi_folder && matches!(match_mode, MatchMode::ExactNumber) {
        let mut index: HashMap<String, Vec<&PhotoFile>> = HashMap::new();
        for file in &files {
            let stem = std::path::Path::new(&file.filename)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();
            if !stem.is_empty() {
                index.entry(stem).or_default().push(file);
            }
        }
        index
    } else {
        HashMap::new()
    };

    // Compile regex if needed
    let compiled_regex = if let MatchMode::Regex = match_mode {
        let pattern = regex_pattern.as_deref().unwrap_or(".*");
        Some(Regex::new(pattern).map_err(|e| format!("Invalid regex: {}", e))?)
    } else {
        None
    };

    let mut matches: Vec<MatchedPhoto> = Vec::new();
    let mut found_count: usize = 0;
    let mut missing_count: usize = 0;
    let mut duplicate_count: usize = 0;
    let total_codes = codes.len();

    // Initial progress event
    progress_callback(ProgressEvent {
        current: 0,
        total: total_codes,
        percentage: 0.0,
        message: "Chuẩn bị lọc ảnh...".to_string(),
        eta_seconds: None,
        speed: None,
    });

    for (i, code) in codes.iter().enumerate() {
        // Emit progress every few codes to prevent event spam, but enough to keep UI updated
        if total_codes > 0 && i % std::cmp::max(1, total_codes / 100) == 0 {
            progress_callback(ProgressEvent {
                current: i,
                total: total_codes,
                percentage: (i as f64 / total_codes as f64) * 100.0,
                message: format!("Đang lọc mã {}...", code.normalized),
                eta_seconds: None,
                speed: None,
            });
        }
        let matched_files: Vec<PhotoFile> = match match_mode {
            MatchMode::ExactNumber => {
                if multi_folder {
                    // Multi-folder: try full stem match first
                    // e.g. raw="ABC_01234" matches file "ABC_01234.CR2" but not "DEF_01234.CR2"
                    let raw_stem = {
                        let r = code.raw.trim();
                        let without_ext = std::path::Path::new(r)
                            .file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or(r);
                        without_ext.to_lowercase()
                    };

                    let full_matches: Vec<PhotoFile> = stem_index
                        .get(&raw_stem)
                        .map(|fs| fs.iter().map(|f| (*f).clone()).collect())
                        .unwrap_or_default();

                    if !full_matches.is_empty() {
                        full_matches
                    } else {
                        // Fallback: number-only match (user typed just a number)
                        let mut fallback_matched = Vec::new();
                        for (file_num, files_with_num) in &number_index {
                            if file_num.ends_with(&code.normalized) {
                                fallback_matched.extend(files_with_num.iter().map(|f| (*f).clone()));
                            }
                        }
                        fallback_matched
                    }
                } else {
                    // Single folder: number-only suffix match
                    let mut matched = Vec::new();
                    for (file_num, files_with_num) in &number_index {
                        if file_num.ends_with(&code.normalized) {
                            matched.extend(files_with_num.iter().map(|f| (*f).clone()));
                        }
                    }
                    matched
                }
            }

            MatchMode::Contains => files
                .iter()
                .filter(|f| {
                    let name_lower = f.filename.to_lowercase();
                    name_lower.contains(&code.normalized)
                })
                .cloned()
                .collect(),

            MatchMode::Regex => {
                if let Some(ref re) = compiled_regex {
                    files
                        .iter()
                        .filter(|f| re.is_match(&f.filename))
                        .cloned()
                        .collect()
                } else {
                    Vec::new()
                }
            }
        };

        let status = if matched_files.is_empty() {
            missing_count += 1;
            MatchStatus::Missing
        } else if matched_files.len() > 1 {
            duplicate_count += 1;
            found_count += 1;
            MatchStatus::Duplicate
        } else {
            found_count += 1;
            MatchStatus::Found
        };

        let primary_photo = matched_files.first().cloned();

        matches.push(MatchedPhoto {
            code: code.normalized.clone(),
            photo: primary_photo,
            status,
            all_matches: matched_files,
        });
    }

    // Final progress event
    progress_callback(ProgressEvent {
        current: total_codes,
        total: total_codes,
        percentage: 100.0,
        message: "Hoàn tất lọc ảnh!".to_string(),
        eta_seconds: None,
        speed: None,
    });

    Ok(MatchResult {
        matches,
        found_count,
        missing_count,
        duplicate_count,
        total_codes: codes.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_photo(filename: &str, number: &str) -> PhotoFile {
        PhotoFile {
            full_path: format!("/test/{}", filename),
            filename: filename.to_string(),
            extension: "jpg".to_string(),
            folder: "/test".to_string(),
            size: 1000,
            normalized_number: number.to_string(),
        }
    }

    fn make_code(normalized: &str) -> CustomerCode {
        CustomerCode {
            raw: normalized.to_string(),
            normalized: normalized.to_string(),
        }
    }

    fn make_code_with_raw(raw: &str, normalized: &str) -> CustomerCode {
        CustomerCode {
            raw: raw.to_string(),
            normalized: normalized.to_string(),
        }
    }

    #[test]
    fn test_exact_match_found() {
        let files = vec![make_photo("IMG01234.jpg", "01234")];
        let codes = vec![make_code("01234")];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, None, |_| {}).unwrap();
        assert_eq!(result.found_count, 1);
        assert_eq!(result.missing_count, 0);
    }

    #[test]
    fn test_exact_match_missing() {
        let files = vec![make_photo("IMG01234.jpg", "01234")];
        let codes = vec![make_code("99999")];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, None, |_| {}).unwrap();
        assert_eq!(result.found_count, 0);
        assert_eq!(result.missing_count, 1);
    }

    #[test]
    fn test_exact_match_no_partial() {
        let files = vec![make_photo("IMG012345.jpg", "012345")];
        let codes = vec![make_code("01234")];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, None, |_| {}).unwrap();
        assert_eq!(result.found_count, 0);
        assert_eq!(result.missing_count, 1);
    }

    #[test]
    fn test_contains_match() {
        let files = vec![make_photo("IMG012345.jpg", "012345")];
        let codes = vec![make_code("01234")];
        let result = match_photos_impl(codes, files, "Contains".to_string(), None, None, |_| {}).unwrap();
        assert_eq!(result.found_count, 1);
    }

    #[test]
    fn test_duplicate_detection() {
        let files = vec![
            make_photo("IMG01234.jpg", "01234"),
            make_photo("IMG01234_edit.jpg", "01234"),
        ];
        let codes = vec![make_code("01234")];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, None, |_| {}).unwrap();
        assert_eq!(result.duplicate_count, 1);
        assert_eq!(result.matches[0].all_matches.len(), 2);
    }

    // --- Multi-folder tests ---

    #[test]
    fn test_multi_folder_stem_match_distinguishes_prefixes() {
        // Two files with same number but different prefixes from different folders
        let files = vec![
            make_photo("ABC_01234.CR2", "01234"),
            make_photo("DEF_01234.CR2", "01234"),
        ];
        // User types "ABC_01234" — should only match the ABC file
        let codes = vec![make_code_with_raw("ABC_01234", "01234")];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, Some(2), |_| {}).unwrap();
        assert_eq!(result.found_count, 1);
        assert_eq!(result.duplicate_count, 0);
        assert_eq!(result.matches[0].status, MatchStatus::Found);
        assert_eq!(result.matches[0].photo.as_ref().unwrap().filename, "ABC_01234.CR2");
    }

    #[test]
    fn test_multi_folder_number_fallback() {
        // Multi-folder but user only types a number — should fallback to number matching
        let files = vec![
            make_photo("ABC_01234.CR2", "01234"),
            make_photo("DEF_01234.CR2", "01234"),
        ];
        let codes = vec![make_code("01234")];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, Some(2), |_| {}).unwrap();
        // Both files match by number, should be Duplicate
        assert_eq!(result.duplicate_count, 1);
        assert_eq!(result.matches[0].all_matches.len(), 2);
    }

    #[test]
    fn test_single_folder_ignores_prefix() {
        // Single folder — should match by number only regardless of prefix
        let files = vec![
            make_photo("ABC_01234.CR2", "01234"),
        ];
        let codes = vec![make_code_with_raw("DEF_01234", "01234")];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, Some(1), |_| {}).unwrap();
        assert_eq!(result.found_count, 1);
    }
}

