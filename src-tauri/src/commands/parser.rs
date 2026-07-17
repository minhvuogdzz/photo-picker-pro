use regex::Regex;

use super::types::CustomerCode;

/// Parses raw customer code input into normalized numeric codes.
///
/// The parser is designed to handle messy, real-world input from photographers.
/// It strips all non-numeric characters (letters, emojis, special chars, extensions)
/// and extracts only the numeric codes.
///
/// # Examples
/// - "IMG01234.JPG" -> "01234"
/// - "MVD000123.CR2" -> "000123"
/// - "concept 2\nảnh đẹp\n01256" -> "01256"
/// - "01234, 01235; 01236" -> ["01234", "01235", "01236"]
#[tauri::command]
pub fn parse_customer_codes(input: String) -> Result<Vec<CustomerCode>, String> {
    let re = Regex::new(r"\d{3,}").map_err(|e| e.to_string())?;

    let mut codes: Vec<CustomerCode> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // Split input by common delimiters and newlines
    for line in input.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Split by common separators: comma, semicolon, tab, pipe, space
        let parts: Vec<&str> = trimmed
            .split(|c: char| c == ',' || c == ';' || c == '\t' || c == '|')
            .collect();

        for part in parts {
            let part = part.trim();
            if part.is_empty() {
                continue;
            }

            // Remove file extension if present
            let without_ext = remove_extension(part);

            // Use the cleaned raw value (lowercase) as dedup key to preserve
            // different prefixes with same number (e.g. ABC_01234 vs DEF_01234)
            let dedup_key = without_ext.to_lowercase();

            // Extract all numeric sequences of 3+ digits
            for mat in re.find_iter(&without_ext) {
                let normalized = mat.as_str().to_string();
                if !seen.contains(&dedup_key) {
                    seen.insert(dedup_key.clone());
                    codes.push(CustomerCode {
                        raw: part.to_string(),
                        normalized,
                    });
                }
            }
        }
    }

    Ok(codes)
}

/// Removes common image file extensions from a string
fn remove_extension(s: &str) -> String {
    let extensions = [
        ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp",
        ".heic", ".heif", ".raw", ".cr2", ".cr3", ".nef", ".arw", ".orf",
        ".rw2", ".dng", ".raf", ".pef", ".srw", ".x3f", ".psd",
    ];

    let lower = s.to_lowercase();
    for ext in &extensions {
        if lower.ends_with(ext) {
            return s[..s.len() - ext.len()].to_string();
        }
    }
    s.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_codes() {
        let result = parse_customer_codes("01234\n01235\n01236".to_string()).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].normalized, "01234");
        assert_eq!(result[1].normalized, "01235");
        assert_eq!(result[2].normalized, "01236");
    }

    #[test]
    fn test_with_filenames() {
        let result = parse_customer_codes("IMG01234.JPG\nMVD01235.CR2".to_string()).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].normalized, "01234");
        assert_eq!(result[1].normalized, "01235");
    }

    #[test]
    fn test_messy_input() {
        let input = "Concept 1\nIMG01234.JPG\nMVD01235\n01236\nConcept 2\nabc000567";
        let result = parse_customer_codes(input.to_string()).unwrap();
        assert_eq!(result.len(), 4);
        assert_eq!(result[0].normalized, "01234");
        assert_eq!(result[1].normalized, "01235");
        assert_eq!(result[2].normalized, "01236");
        assert_eq!(result[3].normalized, "000567");
    }

    #[test]
    fn test_comma_separated() {
        let result = parse_customer_codes("01234, 01235, 01236".to_string()).unwrap();
        assert_eq!(result.len(), 3);
    }

    #[test]
    fn test_dedup() {
        let result = parse_customer_codes("01234\n01234\n01234".to_string()).unwrap();
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_ignores_short_numbers() {
        let result = parse_customer_codes("12\n01234".to_string()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].normalized, "01234");
    }

    #[test]
    fn test_emoji_and_special_chars() {
        let result = parse_customer_codes("🎉 ảnh đẹp 01234 ✨".to_string()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].normalized, "01234");
    }

    #[test]
    fn test_different_prefixes_same_number_kept() {
        // ABC_01234 and DEF_01234 should both be kept as separate codes
        let result = parse_customer_codes("ABC_01234\nDEF_01234".to_string()).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].raw, "ABC_01234");
        assert_eq!(result[0].normalized, "01234");
        assert_eq!(result[1].raw, "DEF_01234");
        assert_eq!(result[1].normalized, "01234");
    }

    #[test]
    fn test_same_prefix_same_number_deduped() {
        // Exact same input should still be deduped
        let result = parse_customer_codes("ABC_01234\nABC_01234".to_string()).unwrap();
        assert_eq!(result.len(), 1);
    }
}
