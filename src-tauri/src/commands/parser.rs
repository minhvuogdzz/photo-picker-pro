use regex::Regex;

use super::types::CustomerCode;

const VALID_EXTENSIONS_LIST: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp",
    "heic", "heif", "raw", "cr2", "cr3", "nef", "arw", "orf",
    "rw2", "dng", "raf", "pef", "srw", "x3f", "psd",
];

/// Cleans a raw code token by:
/// 1. Stripping all leading non-alphanumeric characters.
///    Preserves leading '_' only if immediately followed by an ASCII alphabetic char (e.g. `_MG_1234.CR2`).
/// 2. Stripping trailing non-alphanumeric characters, preserving valid image extensions (e.g. `.jpg`, `.cr3`).
/// 3. If no valid image extension is present, also stripping trailing dots, underscores, and dashes.
pub fn clean_token(token: &str) -> String {
    let mut s = token.trim();
    if s.is_empty() {
        return String::new();
    }

    // 1. Strip leading non-alphanumeric characters
    while !s.is_empty() {
        let first_char = s.chars().next().unwrap();
        if first_char.is_ascii_alphanumeric() {
            break;
        }
        if first_char == '_' {
            let mut chars = s.chars();
            chars.next(); // skip '_'
            if let Some(next_c) = chars.next() {
                if next_c.is_ascii_alphabetic() {
                    break; // keep leading _
                }
            }
        }
        s = &s[first_char.len_utf8()..];
    }

    // 2. Strip trailing non-alphanumeric chars
    while !s.is_empty() {
        let last_char = s.chars().last().unwrap();
        if last_char.is_ascii_alphanumeric() {
            break;
        }
        let end_idx = s.len() - last_char.len_utf8();
        s = &s[..end_idx];
    }

    let lower = s.to_lowercase();
    let has_ext = VALID_EXTENSIONS_LIST.iter().any(|ext| {
        lower.ends_with(&format!(".{}", ext))
    });

    if !has_ext {
        while s.ends_with('.') || s.ends_with('_') || s.ends_with('-') {
            s = &s[..s.len() - 1];
        }
    }

    s.trim().to_string()
}

/// Removes common image file extensions from a string
pub fn remove_extension(s: &str) -> String {
    let lower = s.to_lowercase();
    for ext in VALID_EXTENSIONS_LIST {
        let ext_with_dot = format!(".{}", ext);
        if lower.ends_with(&ext_with_dot) {
            return s[..s.len() - ext_with_dot.len()].to_string();
        }
    }
    s.to_string()
}

/// Parses raw customer code input into normalized numeric codes.
#[tauri::command]
pub fn parse_customer_codes(input: String) -> Result<Vec<CustomerCode>, String> {
    let re = Regex::new(r"\d{3,}").map_err(|e| e.to_string())?;

    // 1. Normalize weird unicode zeros to standard ASCII '0'
    let normalized_input = input
        .replace('０', "0") // U+FF10 Fullwidth
        .replace('𝟶', "0") // U+1D7F6 Monospace
        .replace('𝟎', "0") // U+1D7CE Bold
        .replace('𝟘', "0") // U+1D7D8 Double-struck
        .replace('𝟢', "0") // U+1D7E2 Sans-serif
        .replace('𝟬', "0") // U+1D7EC Sans-serif Bold
        .replace('〇', "0"); // U+3007 Ideographic

    // 2. Pre-split dash/plus joined extensions (e.g. HYTU3068.CR3-HYTU3124.CR3 or zha0401.jpg.zha0407)
    let re_ext_join = Regex::new(r"(\.[a-zA-Z0-9]{2,4})[-+.]+([a-zA-Z0-9])").map_err(|e| e.to_string())?;
    let ext_separated = re_ext_join.replace_all(&normalized_input, "$1\n$2");

    // 3. Separate dot-joined codes when NOT a valid file extension (e.g. zha0401.zha0407 or 01234.01235)
    let re_dot_code = Regex::new(r"\.([a-zA-Z0-9_]+)").map_err(|e| e.to_string())?;
    let dot_separated = re_dot_code.replace_all(&ext_separated, |caps: &regex::Captures| {
        let after_dot = caps.get(1).map(|m| m.as_str().to_lowercase()).unwrap_or_default();
        if VALID_EXTENSIONS_LIST.contains(&after_dot.as_str()) {
            format!(".{}", &caps[1])
        } else {
            format!("\n{}", &caps[1])
        }
    });

    // 4. Separate dash-joined codes/numbers (e.g. HPP01099-01006-01078 or ZHA_0555-0573-0576)
    let re_dash_code = Regex::new(r"(\d+)-+([a-zA-Z0-9])").map_err(|e| e.to_string())?;
    let mut dash_separated = dot_separated.into_owned();
    while re_dash_code.is_match(&dash_separated) {
        dash_separated = re_dash_code.replace_all(&dash_separated, "$1\n$2").into_owned();
    }

    let mut codes: Vec<CustomerCode> = Vec::new();

    // Split input by common delimiters: newlines, commas, semicolons, tabs, pipes, slashes, pluses, spaces
    for line in dash_separated.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let parts: Vec<&str> = trimmed
            .split(|c: char| c == ',' || c == ';' || c == '\t' || c == '|' || c == '/' || c == '\\' || c == '+' || c == ':' || c == ' ')
            .collect();

        for part in parts {
            let cleaned = clean_token(part);
            if cleaned.is_empty() {
                continue;
            }

            // Remove file extension if present
            let without_ext = remove_extension(&cleaned);

            for mat in re.find_iter(&without_ext) {
                let normalized = mat.as_str().to_string();
                codes.push(CustomerCode {
                    raw: cleaned.clone(),
                    normalized,
                });
            }
        }
    }

    Ok(codes)
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
    fn test_dot_separated_codes_without_spaces() {
        // Screenshot 1 case: zha0401.zha0407
        let result = parse_customer_codes("zha0401.zha0407".to_string()).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].raw, "zha0401");
        assert_eq!(result[0].normalized, "0401");
        assert_eq!(result[1].raw, "zha0407");
        assert_eq!(result[1].normalized, "0407");
    }

    #[test]
    fn test_dash_joined_prefixed_and_numeric_codes() {
        // Screenshot 2 case: HPP01099-01006-01078-00987-01012-01019-01032-01044-01070-01045
        let input = "HPP01099-01006-01078-00987-01012-01019-01032-01044-01070-01045\nZHA_0555-0573-0576-0597-0608-0637-0647-0500-0586-0518";
        let result = parse_customer_codes(input.to_string()).unwrap();
        assert_eq!(result.len(), 20);
        assert_eq!(result[0].raw, "HPP01099");
        assert_eq!(result[0].normalized, "01099");
        assert_eq!(result[1].raw, "01006");
        assert_eq!(result[1].normalized, "01006");
        assert_eq!(result[10].raw, "ZHA_0555");
        assert_eq!(result[10].normalized, "0555");
        assert_eq!(result[11].raw, "0573");
        assert_eq!(result[11].normalized, "0573");
    }

    #[test]
    fn test_plus_prefix_and_suffix_stripped() {
        let result = parse_customer_codes("+ABC01234\n+1234\n+ABC12345.jpg+\n[01236]".to_string()).unwrap();
        assert_eq!(result.len(), 4);
        assert_eq!(result[0].raw, "ABC01234");
        assert_eq!(result[0].normalized, "01234");
        assert_eq!(result[1].raw, "1234");
        assert_eq!(result[1].normalized, "1234");
        assert_eq!(result[2].raw, "ABC12345.jpg");
        assert_eq!(result[2].normalized, "12345");
        assert_eq!(result[3].raw, "01236");
        assert_eq!(result[3].normalized, "01236");
    }

    #[test]
    fn test_messy_input() {
        let input = "Concept 1\n+IMG01234.JPG\nMVD01235\n01236\nConcept 2\nabc000567";
        let result = parse_customer_codes(input.to_string()).unwrap();
        assert_eq!(result.len(), 4);
        assert_eq!(result[0].normalized, "01234");
        assert_eq!(result[0].raw, "IMG01234.JPG");
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
    fn test_ignores_short_numbers() {
        let result = parse_customer_codes("12\n01234".to_string()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].normalized, "01234");
    }

    #[test]
    fn test_emoji_and_special_chars() {
        let result = parse_customer_codes("🎉 ảnh đẹp +01234 ✨".to_string()).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].raw, "01234");
        assert_eq!(result[0].normalized, "01234");
    }

    #[test]
    fn test_different_prefixes_same_number_kept() {
        let result = parse_customer_codes("ABC_01234\nDEF_01234".to_string()).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].raw, "ABC_01234");
        assert_eq!(result[0].normalized, "01234");
        assert_eq!(result[1].raw, "DEF_01234");
        assert_eq!(result[1].normalized, "01234");
    }

    #[test]
    fn test_same_prefix_same_number_not_deduped() {
        let result = parse_customer_codes("ABC_01234\nABC_01234".to_string()).unwrap();
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_space_and_dot_separated() {
        let result = parse_customer_codes("ABC123 ABC234".to_string()).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].normalized, "123");
        assert_eq!(result[1].normalized, "234");
        
        let result2 = parse_customer_codes("ABC123. ABC234".to_string()).unwrap();
        assert_eq!(result2.len(), 2);
        assert_eq!(result2[0].normalized, "123");
        assert_eq!(result2[1].normalized, "234");
    }

    #[test]
    fn test_dash_joined_extensions() {
        let result = parse_customer_codes("HYTU3068.CR3-HYTU3124.CR3".to_string()).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].raw, "HYTU3068.CR3");
        assert_eq!(result[0].normalized, "3068");
        assert_eq!(result[1].raw, "HYTU3124.CR3");
        assert_eq!(result[1].normalized, "3124");
    }
}
