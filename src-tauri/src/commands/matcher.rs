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

    let _multi_folder = folder_count.unwrap_or(1) >= 2;

    // Helper to normalize strings for separator-agnostic matching
    fn canonicalize(s: &str) -> String {
        s.chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect::<String>()
            .to_lowercase()
    }

    // Build number-based file index for ExactNumber mode fallback
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

    // Build a stem-based index for exact matching
    // Maps lowercase filename stem -> list of files
    let stem_index: HashMap<String, Vec<&PhotoFile>> = if matches!(match_mode, MatchMode::ExactNumber) {
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

    // Build canonical stem index for separator-agnostic matching
    // Maps canonical alphanumeric stem (e.g. "abc1234") -> list of files
    let canonical_stem_index: HashMap<String, Vec<&PhotoFile>> = if matches!(match_mode, MatchMode::ExactNumber) {
        let mut index: HashMap<String, Vec<&PhotoFile>> = HashMap::new();
        for file in &files {
            let stem = std::path::Path::new(&file.filename)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            let canonical = canonicalize(stem);
            if !canonical.is_empty() {
                index.entry(canonical).or_default().push(file);
            }
        }
        index
    } else {
        HashMap::new()
    };

    // Compile regex if needed (skip pre-compile when pattern has {code} placeholder)
    let compiled_regex = if let MatchMode::Regex = match_mode {
        let pattern = regex_pattern.as_deref().unwrap_or(".*");
        if pattern.contains("{code}") {
            None // Will be compiled per-code in the matching loop
        } else {
            Some(Regex::new(pattern).map_err(|e| format!("Invalid regex: {}", e))?)
        }
    } else {
        None
    };

    let mut matches: Vec<MatchedPhoto> = Vec::new();
    let mut found_count: usize = 0;
    let mut missing_count: usize = 0;
    let mut duplicate_count: usize = 0;
    let total_codes = codes.len();
    let mut seen_input_codes = std::collections::HashSet::new();

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

        // Deduplication key respects prefix so identical numbers under different cameras are preserved
        let dedup_key = match &code.prefix {
            Some(prefix) if !prefix.is_empty() => {
                format!("{}:{}", canonicalize(prefix), code.normalized)
            }
            _ => code.raw.trim().to_lowercase(),
        };

        if !seen_input_codes.insert(dedup_key) {
            duplicate_count += 1;
            matches.push(MatchedPhoto {
                code: code.raw.trim().to_string(),
                photo: None,
                status: MatchStatus::InputDuplicate,
                all_matches: Vec::new(),
            });
            continue;
        }

        let matched_files: Vec<PhotoFile> = match match_mode {
            MatchMode::ExactNumber => {
                let cleaned_raw = super::parser::clean_token(&code.raw);
                let raw_stem = {
                    let without_ext = std::path::Path::new(&cleaned_raw)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or(&cleaned_raw);
                    without_ext.to_lowercase()
                };

                // 1. Try exact stem match first
                // e.g. raw="ABC_01234" matches file "ABC_01234.CR2"
                let mut full_matches: Vec<PhotoFile> = stem_index
                    .get(&raw_stem)
                    .map(|fs| fs.iter().map(|f| (*f).clone()).collect())
                    .unwrap_or_default();

                // 2. Try separator-agnostic canonical match
                // Handles: user typed "ABC1234" but file is "ABC_1234.CR2" or "ABC-1234.JPG"
                if full_matches.is_empty() {
                    let canonical_raw = canonicalize(&raw_stem);
                    if let Some(fs) = canonical_stem_index.get(&canonical_raw) {
                        full_matches = fs.iter().map(|f| (*f).clone()).collect();
                    }
                }

                // 3. Inherited prefix match (Cascading Prefix)
                // e.g. prefix="ABC", user typed "1235" -> check canonical "abc1235"
                if full_matches.is_empty() {
                    if let Some(ref prefix) = code.prefix {
                        let combined_canonical = format!("{}{}", canonicalize(prefix), code.normalized);
                        if let Some(fs) = canonical_stem_index.get(&combined_canonical) {
                            full_matches = fs.iter().map(|f| (*f).clone()).collect();
                        }
                    }
                }

                if !full_matches.is_empty() {
                    full_matches
                } else {
                    let has_letters = cleaned_raw.to_lowercase() != code.normalized;
                    let has_prefix = code.prefix.as_ref().map(|p| !p.is_empty()).unwrap_or(false);
                    if has_letters || has_prefix {
                        // Strict prefix match failed. Do not fallback to arbitrary other cameras!
                        Vec::new()
                    } else {
                        // Fallback: number-only match (user typed just a number, no prefix anywhere)
                        let mut fallback_matched = Vec::new();
                        for (file_num, files_with_num) in &number_index {
                            if file_num.ends_with(&code.normalized) {
                                fallback_matched.extend(files_with_num.iter().map(|f| (*f).clone()));
                            }
                        }
                        fallback_matched
                    }
                }
            }

            MatchMode::Contains => {
                // Determine effective prefix if available (either explicit in code.prefix, or in code.raw)
                let effective_prefix: Option<String> = code.prefix.clone().or_else(|| {
                    let cleaned = super::parser::clean_token(&code.raw);
                    let without_ext = super::parser::remove_extension(&cleaned);
                    let re_alpha = Regex::new(r"[a-zA-Z]+").ok()?;
                    re_alpha.find(&without_ext).map(|mat| mat.as_str().to_string())
                });

                files
                    .iter()
                    .filter(|f| {
                        let name_lower = f.filename.to_lowercase();
                        let name_canon = canonicalize(&f.filename);

                        if let Some(ref prefix) = effective_prefix {
                            let prefix_canon = canonicalize(prefix);
                            let target_combined = format!("{}{}", prefix_canon, code.normalized);

                            // Priority 1: Canonical filename contains both prefix and number together
                            // e.g. "ABC_1234.jpg" (canonical "abc1234jpg") contains "abc1234"
                            if name_canon.contains(&target_combined) {
                                return true;
                            }

                            // Priority 2: Filename contains prefix AND contains normalized number anywhere
                            // e.g. "ABC_wedding_1234.jpg" contains "abc" and "1234"
                            if name_canon.contains(&prefix_canon) && name_lower.contains(&code.normalized) {
                                return true;
                            }

                            false
                        } else {
                            // No prefix: standard substring match on normalized number
                            name_lower.contains(&code.normalized)
                        }
                    })
                    .cloned()
                    .collect()
            }

            MatchMode::Regex => {
                let pattern_str = regex_pattern.as_deref().unwrap_or(".*");
                if pattern_str.contains("{code}") {
                    // Replace {code} placeholder with the current code's normalized value
                    let actual_pattern = pattern_str.replace("{code}", &code.normalized);
                    match Regex::new(&actual_pattern) {
                        Ok(re) => files
                            .iter()
                            .filter(|f| re.is_match(&f.filename))
                            .cloned()
                            .collect(),
                        Err(_) => Vec::new(),
                    }
                } else if let Some(ref re) = compiled_regex {
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

        let display_code = match &code.prefix {
            Some(prefix) if !prefix.is_empty() && code.raw.trim().chars().all(|c| !c.is_ascii_alphabetic()) => {
                format!("{}{}", prefix, code.raw.trim())
            }
            _ => code.raw.trim().to_string(),
        };

        matches.push(MatchedPhoto {
            code: display_code,
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
            prefix: None,
        }
    }

    fn make_code_with_raw(raw: &str, normalized: &str) -> CustomerCode {
        CustomerCode {
            raw: raw.to_string(),
            normalized: normalized.to_string(),
            prefix: None,
        }
    }

    fn make_code_with_prefix(raw: &str, normalized: &str, prefix: Option<&str>) -> CustomerCode {
        CustomerCode {
            raw: raw.to_string(),
            normalized: normalized.to_string(),
            prefix: prefix.map(|s| s.to_string()),
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
    fn test_strict_prefix_matching() {
        // If user inputs a prefix, it must exactly match the file stem, regardless of folder count
        let files = vec![
            make_photo("ABC_01234.CR2", "01234"),
        ];
        let codes = vec![make_code_with_raw("DEF_01234", "01234")];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, Some(1), |_| {}).unwrap();
        // Since user specified DEF_01234, it should NOT fallback to match ABC_01234
        assert_eq!(result.found_count, 0);
        assert_eq!(result.missing_count, 1);
    }

    // --- Regex {code} placeholder tests ---

    #[test]
    fn test_regex_code_placeholder_matches_prefix() {
        // Pattern ^abc{code} with code 01234 should only match abc01234, not bcd01234
        let files = vec![
            make_photo("abc01234.jpg", "01234"),
            make_photo("bcd01234.jpg", "01234"),
        ];
        let codes = vec![make_code("01234")];
        let result = match_photos_impl(
            codes, files, "Regex".to_string(),
            Some("^abc{code}".to_string()), None, |_| {},
        ).unwrap();
        assert_eq!(result.found_count, 1);
        assert_eq!(result.matches[0].photo.as_ref().unwrap().filename, "abc01234.jpg");
    }

    #[test]
    fn test_regex_code_placeholder_no_match() {
        // Pattern ^xyz{code} should not match abc01234
        let files = vec![make_photo("abc01234.jpg", "01234")];
        let codes = vec![make_code("01234")];
        let result = match_photos_impl(
            codes, files, "Regex".to_string(),
            Some("^xyz{code}".to_string()), None, |_| {},
        ).unwrap();
        assert_eq!(result.found_count, 0);
        assert_eq!(result.missing_count, 1);
    }

    #[test]
    fn test_regex_without_placeholder_matches_all() {
        // Pattern without {code} should work as before — match all files matching the pattern
        let files = vec![
            make_photo("abc01234.jpg", "01234"),
            make_photo("bcd01234.jpg", "01234"),
        ];
        let codes = vec![make_code("01234")];
        let result = match_photos_impl(
            codes, files, "Regex".to_string(),
            Some("01234".to_string()), None, |_| {},
        ).unwrap();
        // Both files match the pattern, so it should be Duplicate
        assert_eq!(result.found_count, 1);
        assert_eq!(result.duplicate_count, 1);
        assert_eq!(result.matches[0].all_matches.len(), 2);
    }

    #[test]
    fn test_plus_prefixed_exact_matches() {
        let files = vec![
            make_photo("ABC01234.CR2", "01234"),
            make_photo("DEF05678.JPG", "05678"),
        ];
        let codes = vec![
            make_code_with_raw("+ABC01234", "01234"),
            make_code_with_raw("+5678", "5678"),
        ];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, None, |_| {}).unwrap();
        assert_eq!(result.found_count, 2);
        assert_eq!(result.missing_count, 0);
        assert_eq!(result.matches[0].photo.as_ref().unwrap().filename, "ABC01234.CR2");
        assert_eq!(result.matches[1].photo.as_ref().unwrap().filename, "DEF05678.JPG");
    }

    #[test]
    fn test_separator_agnostic_exact_match() {
        // File has underscore: ABC_1234.jpg, customer typed ABC1234 (no underscore)
        let files = vec![make_photo("ABC_1234.jpg", "1234")];
        let codes = vec![make_code_with_raw("ABC1234", "1234")];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, None, |_| {}).unwrap();
        assert_eq!(result.found_count, 1);
        assert_eq!(result.missing_count, 0);
        assert_eq!(result.matches[0].photo.as_ref().unwrap().filename, "ABC_1234.jpg");
    }

    #[test]
    fn test_cascading_prefix_matches_correct_cameras() {
        // Scenario from user: Multiple camera bodies with same numbers in same folder
        let files = vec![
            make_photo("ABC_1234.jpg", "1234"),
            make_photo("ABC_1235.jpg", "1235"),
            make_photo("DEF1234.jpg", "1234"),
            make_photo("DEF1235.jpg", "1235"),
        ];

        // Customer inputs: ABC1234, then 1235 (inherits ABC), then DEF1234, then 1235 (inherits DEF)
        let codes = vec![
            make_code_with_prefix("ABC1234", "1234", Some("ABC")),
            make_code_with_prefix("1235", "1235", Some("ABC")),
            make_code_with_prefix("DEF1234", "1234", Some("DEF")),
            make_code_with_prefix("1235", "1235", Some("DEF")),
        ];

        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, None, |_| {}).unwrap();
        assert_eq!(result.found_count, 4);
        assert_eq!(result.missing_count, 0);
        assert_eq!(result.duplicate_count, 0);

        assert_eq!(result.matches[0].photo.as_ref().unwrap().filename, "ABC_1234.jpg");
        assert_eq!(result.matches[1].photo.as_ref().unwrap().filename, "ABC_1235.jpg");
        assert_eq!(result.matches[2].photo.as_ref().unwrap().filename, "DEF1234.jpg");
        assert_eq!(result.matches[3].photo.as_ref().unwrap().filename, "DEF1235.jpg");

        // Verify displayed codes have prefix attached
        assert_eq!(result.matches[0].code, "ABC1234");
        assert_eq!(result.matches[1].code, "ABC1235");
        assert_eq!(result.matches[2].code, "DEF1234");
        assert_eq!(result.matches[3].code, "DEF1235");
    }

    #[test]
    fn test_smart_contains_distinguishes_prefixes() {
        // Files in folder: ABC_1234.jpg and DEF1234.jpg
        let files = vec![
            make_photo("ABC_1234.jpg", "1234"),
            make_photo("DEF1234.jpg", "1234"),
        ];

        // Customer typed ABC1234 in Contains mode
        let codes = vec![make_code_with_prefix("ABC1234", "1234", Some("ABC"))];
        let result = match_photos_impl(codes, files, "Contains".to_string(), None, None, |_| {}).unwrap();

        // Should ONLY match ABC_1234.jpg, NOT DEF1234.jpg!
        assert_eq!(result.found_count, 1);
        assert_eq!(result.duplicate_count, 0);
        assert_eq!(result.matches[0].status, MatchStatus::Found);
        assert_eq!(result.matches[0].photo.as_ref().unwrap().filename, "ABC_1234.jpg");
    }

    #[test]
    fn test_inherited_prefix_missing_does_not_match_wrong_camera() {
        // Folder only has DEF1235.jpg (no ABC photo)
        let files = vec![make_photo("DEF1235.jpg", "1235")];

        // User typed 1235 which inherited prefix ABC
        let codes = vec![make_code_with_prefix("1235", "1235", Some("ABC"))];
        let result = match_photos_impl(codes, files, "ExactNumber".to_string(), None, None, |_| {}).unwrap();

        // Must report Missing rather than mistakenly picking DEF1235
        assert_eq!(result.found_count, 0);
        assert_eq!(result.missing_count, 1);
        assert_eq!(result.matches[0].status, MatchStatus::Missing);
    }
}
