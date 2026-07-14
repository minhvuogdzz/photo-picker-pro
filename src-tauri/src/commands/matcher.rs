use std::collections::HashMap;

use regex::Regex;

use super::types::{
    CustomerCode, MatchMode, MatchResult, MatchStatus, MatchedPhoto, PhotoFile,
};

/// Matches customer codes against scanned photo files.
///
/// Supports three matching modes:
/// - **ExactNumber**: The numeric portion of the filename must exactly match the code
/// - **Contains**: The filename must contain the code somewhere within it
/// - **Regex**: User-provided regex pattern is used for matching
#[tauri::command]
pub fn match_photos(
    codes: Vec<CustomerCode>,
    files: Vec<PhotoFile>,
    mode: String,
    regex_pattern: Option<String>,
) -> Result<MatchResult, String> {
    let match_mode = match mode.as_str() {
        "ExactNumber" => MatchMode::ExactNumber,
        "Contains" => MatchMode::Contains,
        "Regex" => MatchMode::Regex,
        _ => MatchMode::ExactNumber,
    };

    // Build file index based on match mode
    let file_index: HashMap<String, Vec<&PhotoFile>> = match match_mode {
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

    for code in &codes {
        let matched_files: Vec<PhotoFile> = match match_mode {
            MatchMode::ExactNumber => file_index
                .get(&code.normalized)
                .map(|fs| fs.iter().map(|f| (*f).clone()).collect())
                .unwrap_or_default(),

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

    #[test]
    fn test_exact_match_found() {
        let files = vec![make_photo("IMG01234.jpg", "01234")];
        let codes = vec![make_code("01234")];
        let result = match_photos(codes, files, "ExactNumber".to_string(), None).unwrap();
        assert_eq!(result.found_count, 1);
        assert_eq!(result.missing_count, 0);
    }

    #[test]
    fn test_exact_match_missing() {
        let files = vec![make_photo("IMG01234.jpg", "01234")];
        let codes = vec![make_code("99999")];
        let result = match_photos(codes, files, "ExactNumber".to_string(), None).unwrap();
        assert_eq!(result.found_count, 0);
        assert_eq!(result.missing_count, 1);
    }

    #[test]
    fn test_exact_match_no_partial() {
        let files = vec![make_photo("IMG012345.jpg", "012345")];
        let codes = vec![make_code("01234")];
        let result = match_photos(codes, files, "ExactNumber".to_string(), None).unwrap();
        assert_eq!(result.found_count, 0);
        assert_eq!(result.missing_count, 1);
    }

    #[test]
    fn test_contains_match() {
        let files = vec![make_photo("IMG012345.jpg", "012345")];
        let codes = vec![make_code("01234")];
        let result = match_photos(codes, files, "Contains".to_string(), None).unwrap();
        assert_eq!(result.found_count, 1);
    }

    #[test]
    fn test_duplicate_detection() {
        let files = vec![
            make_photo("IMG01234.jpg", "01234"),
            make_photo("IMG01234_edit.jpg", "01234"),
        ];
        let codes = vec![make_code("01234")];
        let result = match_photos(codes, files, "ExactNumber".to_string(), None).unwrap();
        assert_eq!(result.duplicate_count, 1);
        assert_eq!(result.matches[0].all_matches.len(), 2);
    }
}
