use regex::Regex;

use super::types::CustomerCode;

const VALID_EXTENSIONS_LIST: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp",
    "heic", "heif", "raw", "cr2", "cr3", "nef", "arw", "orf",
    "rw2", "dng", "raf", "pef", "srw", "x3f", "psd",
];

/// Largest range expanded from one `A-B` expression; wider spans are almost always typos.
const MAX_RANGE_SPAN: u64 = 500;

const RANGE_DASHES: [char; 3] = ['-', '–', '—'];

fn has_code_digits(token: &str) -> bool {
    token.split(|c: char| !c.is_ascii_digit()).any(|run| run.len() >= 3)
}

fn leading_token(s: &str) -> &str {
    let end = s
        .find(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
        .unwrap_or(s.len());
    &s[..end]
}

fn trailing_token(s: &str) -> &str {
    let start = s
        .char_indices()
        .rev()
        .find(|(_, c)| !(c.is_ascii_alphanumeric() || *c == '_'))
        .map(|(i, c)| i + c.len_utf8())
        .unwrap_or(0);
    &s[start..]
}

fn strip_leading_separator(s: &str) -> Option<&str> {
    if let Some(rest) = s.strip_prefix("..") {
        return Some(rest.trim_start_matches('.'));
    }
    if let Some(rest) = s.strip_prefix('~') {
        return Some(rest);
    }
    let rest = s.trim_start_matches(RANGE_DASHES);
    (rest.len() != s.len()).then_some(rest)
}

fn strip_trailing_separator(s: &str) -> Option<&str> {
    if let Some(rest) = s.strip_suffix("..") {
        return Some(rest.trim_end_matches('.'));
    }
    if let Some(rest) = s.strip_suffix('~') {
        return Some(rest);
    }
    let rest = s.trim_end_matches(RANGE_DASHES);
    (rest.len() != s.len()).then_some(rest)
}

/// True when another code follows through a dash/tilde/`..` (spaces allowed) or an attached dot.
/// A dot followed by a space is a sentence break, not a chain.
fn continues_with_code(after: &str) -> bool {
    if let Some(rest) = after.strip_prefix('.').filter(|r| !r.starts_with('.')) {
        return has_code_digits(leading_token(rest));
    }
    strip_leading_separator(after.trim_start_matches([' ', '\t']))
        .is_some_and(|rest| has_code_digits(leading_token(rest.trim_start_matches([' ', '\t']))))
}

fn preceded_by_code(before: &str) -> bool {
    if let Some(rest) = before.strip_suffix('.').filter(|r| !r.ends_with('.')) {
        return has_code_digits(trailing_token(rest));
    }
    strip_trailing_separator(before.trim_end_matches([' ', '\t']))
        .is_some_and(|rest| has_code_digits(trailing_token(rest.trim_end_matches([' ', '\t']))))
}

/// Expands `0450-0465`, `0450..0465`, `0450~0465` and prefixed forms (`IMG_0450-0465`) into one
/// code per line. Only a standalone pair is a range: dash chains such as `0555-0573-0576` are how
/// customers list separate photos, so they are left for the normal splitting below.
fn expand_code_ranges(input: &str) -> Result<String, String> {
    let re_range = Regex::new(
        r"(?P<lp>[A-Za-z_]*[A-Za-z][A-Za-z_]*)?(?P<a>\d{3,})[ \t]*(?:\.{2,3}|~|[-–—]+)[ \t]*(?P<rp>[A-Za-z_]*[A-Za-z][A-Za-z_]*)?(?P<b>\d{3,})",
    )
    .map_err(|e| e.to_string())?;

    let expanded = re_range.replace_all(input, |caps: &regex::Captures| {
        let whole = caps.get(0).unwrap();
        let original = whole.as_str().to_string();
        let before = &input[..whole.start()];
        let after = &input[whole.end()..];

        let glued = |c: char| c.is_alphanumeric() || c == '_';
        if before.chars().next_back().is_some_and(glued) || after.chars().next().is_some_and(glued) {
            return original;
        }
        if preceded_by_code(before) || continues_with_code(after) {
            return original;
        }

        let lp = caps.name("lp").map(|m| m.as_str());
        let rp = caps.name("rp").map(|m| m.as_str());
        let same_prefix = |l: &str, r: &str| l.trim_matches('_').eq_ignore_ascii_case(r.trim_matches('_'));
        match (lp, rp) {
            (_, None) => {}
            (Some(l), Some(r)) if same_prefix(l, r) => {}
            _ => return original,
        }

        let (a, b) = (&caps["a"], &caps["b"]);
        let (Ok(start), Ok(end)) = (a.parse::<u64>(), b.parse::<u64>()) else {
            return original;
        };
        if a.len() != b.len() || end <= start || end - start + 1 > MAX_RANGE_SPAN {
            return original;
        }

        let prefix = lp.unwrap_or("");
        let width = a.len();
        let codes: Vec<String> = (start..=end).map(|n| format!("{prefix}{n:0width$}")).collect();
        format!("\n{}\n", codes.join("\n"))
    });

    Ok(expanded.into_owned())
}

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

/// Helper to detect if a string token or line is a command to clear/strip prefixes
pub fn is_clear_token(s: &str) -> bool {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return false;
    }
    let lower = trimmed.to_lowercase();
    let cleaned = lower.trim_matches(|c: char| {
        c == ':' || c == '-' || c == '/' || c == '#' || c == '@' || c == ' ' || c == ',' || c == ';' || c == '.' || c == '='
    });
    if cleaned == "clear" || cleaned == "none" || cleaned == "reset" || cleaned == "all" {
        return true;
    }
    if lower.starts_with("@clear")
        || lower.starts_with("@none")
        || lower.starts_with("#clear")
        || lower.starts_with("#none")
        || lower.starts_with("@reset")
        || lower.starts_with("#reset")
    {
        let rest = lower.trim_start_matches(|c: char| c == '@' || c == '#');
        let cmd = rest
            .split(|c: char| c == ' ' || c == ':' || c == '-' || c == ',' || c == ';' || c == '=')
            .next()
            .unwrap_or("");
        if cmd == "clear" || cmd == "none" || cmd == "reset" || cmd == "all" {
            return true;
        }
    }
    false
}

/// Helper to detect if a line or token sets an explicit prefix, e.g. @prefix ABC or #prefix: DEF
pub fn extract_prefix_command(s: &str) -> Option<String> {
    let trimmed = s.trim();
    let lower = trimmed.to_lowercase();
    for kw in &["@prefix", "#prefix", "@set", "#set"] {
        if lower.starts_with(kw) {
            let rest = trimmed[kw.len()..]
                .trim()
                .trim_matches(|c: char| c == ':' || c == '=' || c == ' ');
            let cleaned = rest.trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '_');
            if !cleaned.is_empty() {
                return Some(cleaned.to_string());
            }
        }
    }
    None
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

    // 1b. Expand ranges (0450-0465) before dashes/dots are treated as plain separators
    let range_expanded = expand_code_ranges(&normalized_input)?;

    // 2. Pre-split dash/plus joined extensions (e.g. HYTU3068.CR3-HYTU3124.CR3 or zha0401.jpg.zha0407)
    let re_ext_join = Regex::new(r"(\.[a-zA-Z0-9]{2,4})[-+.]+([a-zA-Z0-9])").map_err(|e| e.to_string())?;
    let ext_separated = re_ext_join.replace_all(&range_expanded, "$1\n$2");

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

    let non_empty_lines: Vec<&str> = dash_separated
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .collect();

    let has_clear_at_start = non_empty_lines
        .first()
        .map(|l| is_clear_token(l))
        .unwrap_or(false);

    let has_clear_at_end = non_empty_lines
        .last()
        .map(|l| is_clear_token(l))
        .unwrap_or(false);

    let has_any_prefix_cmd = non_empty_lines
        .iter()
        .any(|l| extract_prefix_command(l).is_some());

    let mut strip_prefix_mode = has_clear_at_start || (has_clear_at_end && !has_any_prefix_cmd);
    let mut codes: Vec<CustomerCode> = Vec::new();
    let mut current_prefix: Option<String> = None;

    // Split input by common delimiters: newlines, commas, semicolons, tabs, pipes, slashes, pluses, spaces
    for line in dash_separated.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Allow explicit reset of active prefix if user types @clear, @none, #none, or #all
        if is_clear_token(trimmed) {
            current_prefix = None;
            strip_prefix_mode = true;
            continue;
        }

        if let Some(p) = extract_prefix_command(trimmed) {
            current_prefix = Some(p);
            strip_prefix_mode = false;
            continue;
        }

        let parts: Vec<&str> = trimmed
            .split(|c: char| c == ',' || c == ';' || c == '\t' || c == '|' || c == '/' || c == '\\' || c == '+' || c == ':' || c == ' ')
            .collect();

        for part in parts {
            let part_trimmed = part.trim();
            if part_trimmed.is_empty() {
                continue;
            }

            if is_clear_token(part_trimmed) {
                current_prefix = None;
                strip_prefix_mode = true;
                continue;
            }

            if let Some(p) = extract_prefix_command(part_trimmed) {
                current_prefix = Some(p);
                strip_prefix_mode = false;
                continue;
            }

            let cleaned = clean_token(part_trimmed);
            if cleaned.is_empty() {
                continue;
            }

            // Remove file extension if present
            let without_ext = remove_extension(&cleaned);

            for mat in re.find_iter(&without_ext) {
                let normalized = mat.as_str().to_string();
                let start_idx = mat.start();
                let before_digits = &without_ext[..start_idx];

                // Check if this token has its own explicit alphabetic prefix
                let has_alpha_prefix = before_digits.chars().any(|c| c.is_ascii_alphabetic());

                let (prefix, raw) = if strip_prefix_mode {
                    // Under @clear / @none mode:
                    // Strip the letter prefix completely and only search by number.
                    (None, normalized.clone())
                } else if has_alpha_prefix {
                    let p = before_digits
                        .trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '_')
                        .trim_end_matches('_')
                        .to_string();
                    if !p.is_empty() {
                        current_prefix = Some(p.clone());
                        (Some(p), cleaned.clone())
                    } else {
                        (current_prefix.clone(), cleaned.clone())
                    }
                } else {
                    (current_prefix.clone(), cleaned.clone())
                };

                codes.push(CustomerCode {
                    raw,
                    normalized,
                    prefix,
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

    #[test]
    fn test_cascading_prefix_inheritance() {
        let input = "ABC1234\n1235\n1236\nDEF1234\n1235";
        let result = parse_customer_codes(input.to_string()).unwrap();
        assert_eq!(result.len(), 5);

        assert_eq!(result[0].raw, "ABC1234");
        assert_eq!(result[0].normalized, "1234");
        assert_eq!(result[0].prefix.as_deref(), Some("ABC"));

        assert_eq!(result[1].raw, "1235");
        assert_eq!(result[1].normalized, "1235");
        assert_eq!(result[1].prefix.as_deref(), Some("ABC"));

        assert_eq!(result[2].raw, "1236");
        assert_eq!(result[2].normalized, "1236");
        assert_eq!(result[2].prefix.as_deref(), Some("ABC"));

        assert_eq!(result[3].raw, "DEF1234");
        assert_eq!(result[3].normalized, "1234");
        assert_eq!(result[3].prefix.as_deref(), Some("DEF"));

        assert_eq!(result[4].raw, "1235");
        assert_eq!(result[4].normalized, "1235");
        assert_eq!(result[4].prefix.as_deref(), Some("DEF"));
    }

    #[test]
    fn test_prefix_reset_command() {
        let input = "ABC1234\n1235\n@clear\n1236";
        let result = parse_customer_codes(input.to_string()).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].prefix.as_deref(), Some("ABC"));
        assert_eq!(result[1].prefix.as_deref(), Some("ABC"));
        assert_eq!(result[2].prefix, None);
    }

    #[test]
    fn test_clear_command_strips_alphabetic_prefixes() {
        // User scenario: @clear before codes with prefixes IGM, IMG
        let input = "@clear\n\nIGM0088\nIMG0138\nIMG0175\nIMG0309\nIMG0528\nIMG0561";
        let result = parse_customer_codes(input.to_string()).unwrap();
        assert_eq!(result.len(), 6);

        assert_eq!(result[0].raw, "0088");
        assert_eq!(result[0].normalized, "0088");
        assert_eq!(result[0].prefix, None);

        assert_eq!(result[1].raw, "0138");
        assert_eq!(result[1].normalized, "0138");
        assert_eq!(result[1].prefix, None);

        assert_eq!(result[2].raw, "0175");
        assert_eq!(result[2].normalized, "0175");
        assert_eq!(result[2].prefix, None);

        assert_eq!(result[3].raw, "0309");
        assert_eq!(result[3].normalized, "0309");
        assert_eq!(result[3].prefix, None);

        assert_eq!(result[4].raw, "0528");
        assert_eq!(result[4].normalized, "0528");
        assert_eq!(result[4].prefix, None);

        assert_eq!(result[5].raw, "0561");
        assert_eq!(result[5].normalized, "0561");
        assert_eq!(result[5].prefix, None);
    }

    #[test]
    fn test_none_command_strips_alphabetic_prefixes() {
        let input = "@none\nIGM0088\nIMG0138";
        let result = parse_customer_codes(input.to_string()).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].raw, "0088");
        assert_eq!(result[0].normalized, "0088");
        assert_eq!(result[0].prefix, None);
        assert_eq!(result[1].raw, "0138");
        assert_eq!(result[1].normalized, "0138");
        assert_eq!(result[1].prefix, None);
    }

    #[test]
    fn test_trailing_clear_command_strips_preceding_prefixes() {
        let input = "IGM0088\nIMG0138\n@clear";
        let result = parse_customer_codes(input.to_string()).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].raw, "0088");
        assert_eq!(result[0].prefix, None);
        assert_eq!(result[1].raw, "0138");
        assert_eq!(result[1].prefix, None);
    }

    fn normalized(input: &str) -> Vec<String> {
        parse_customer_codes(input.to_string())
            .unwrap()
            .into_iter()
            .map(|c| c.normalized)
            .collect()
    }

    #[test]
    fn test_dash_range_expands() {
        let codes = normalized("0450-0465");
        assert_eq!(codes.len(), 16);
        assert_eq!(codes.first().unwrap(), "0450");
        assert_eq!(codes.last().unwrap(), "0465");
    }

    #[test]
    fn test_dot_tilde_and_spaced_ranges_expand() {
        assert_eq!(normalized("0450..0455").len(), 6);
        assert_eq!(normalized("0450 ~ 0452").len(), 3);
        assert_eq!(normalized("0998 - 1002"), ["0998", "0999", "1000", "1001", "1002"]);
        assert_eq!(normalized("0450–0452").len(), 3);
    }

    #[test]
    fn test_prefixed_range_keeps_prefix() {
        let result = parse_customer_codes("IMG_0450-0452".to_string()).unwrap();
        let raws: Vec<&str> = result.iter().map(|c| c.raw.as_str()).collect();
        assert_eq!(raws, ["IMG_0450", "IMG_0451", "IMG_0452"]);
        assert!(result.iter().all(|c| c.prefix.as_deref() == Some("IMG")));

        assert_eq!(normalized("IMG_0450-IMG_0452").len(), 3);
    }

    #[test]
    fn test_ranges_inside_a_chat_message() {
        assert_eq!(
            normalized("chị lấy 0450-0452, 0460-0461 và 0470 nhé."),
            ["0450", "0451", "0452", "0460", "0461", "0470"]
        );
        assert_eq!(normalized("Lấy 0450-0452. 0470 nữa"), ["0450", "0451", "0452", "0470"]);
    }

    #[test]
    fn test_dash_chains_stay_separate_codes() {
        assert_eq!(normalized("0555-0573-0576"), ["0555", "0573", "0576"]);
        assert_eq!(normalized("0450 - 0465 - 0470"), ["0450", "0465", "0470"]);
        assert_eq!(normalized("0401.0450-0465"), ["0401", "0450", "0465"]);
    }

    #[test]
    fn test_implausible_ranges_stay_two_codes() {
        for input in ["0465-0450", "450-0465", "0001-0999", "ABC0450-DEF0452", "0450-0465k"] {
            assert_eq!(normalized(input).len(), 2, "{input}");
        }
    }

    #[test]
    fn test_prefix_switch_after_clear() {
        let input = "@clear\nIGM0088\n@prefix DEF\n1234\n1235";
        let result = parse_customer_codes(input.to_string()).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].raw, "0088");
        assert_eq!(result[0].prefix, None);
        assert_eq!(result[1].raw, "1234");
        assert_eq!(result[1].prefix.as_deref(), Some("DEF"));
        assert_eq!(result[2].raw, "1235");
        assert_eq!(result[2].prefix.as_deref(), Some("DEF"));
    }
}
