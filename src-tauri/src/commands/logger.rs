use std::fs;
use std::io::Write;
use std::path::Path;

use super::types::{ExportFormat, MatchResult, MatchStatus};

/// Exports the match results to a file in the specified format.
#[tauri::command]
pub fn export_log(
    result: MatchResult,
    format: String,
    output_path: String,
) -> Result<String, String> {
    let export_format = match format.as_str() {
        "csv" => ExportFormat::Csv,
        "json" => ExportFormat::Json,
        _ => ExportFormat::Txt,
    };

    let content = match export_format {
        ExportFormat::Txt => generate_txt(&result),
        ExportFormat::Csv => generate_csv(&result),
        ExportFormat::Json => generate_json(&result)?,
    };

    // Ensure parent directory exists
    if let Some(parent) = Path::new(&output_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let mut file = fs::File::create(&output_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;

    file.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(output_path)
}

/// Exports only the missing codes to a file.
#[tauri::command]
pub fn export_missing(result: MatchResult, output_path: String) -> Result<String, String> {
    let missing: Vec<&str> = result
        .matches
        .iter()
        .filter(|m| m.status == MatchStatus::Missing)
        .map(|m| m.code.as_str())
        .collect();

    let content = missing.join("\n");

    if let Some(parent) = Path::new(&output_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    fs::write(&output_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(output_path)
}

fn generate_txt(result: &MatchResult) -> String {
    let mut lines = Vec::new();

    lines.push(format!(
        "Photo Picker Pro - Match Report\n{}\n",
        "=".repeat(40)
    ));
    lines.push(format!("Total Codes: {}", result.total_codes));
    lines.push(format!("Found: {}", result.found_count));
    lines.push(format!("Missing: {}", result.missing_count));
    lines.push(format!("Duplicates: {}", result.duplicate_count));
    lines.push(format!("\n{}\n", "-".repeat(40)));

    lines.push("FOUND:".to_string());
    for m in &result.matches {
        if m.status == MatchStatus::Found || m.status == MatchStatus::Duplicate {
            let path = m
                .photo
                .as_ref()
                .map(|p| p.full_path.as_str())
                .unwrap_or("N/A");
            let status = if m.status == MatchStatus::Duplicate {
                format!("DUPLICATE ({})", m.all_matches.len())
            } else {
                "FOUND".to_string()
            };
            lines.push(format!("  {} -> {} [{}]", m.code, path, status));
        }
    }

    lines.push(format!("\n{}", "-".repeat(40)));
    lines.push("MISSING:".to_string());
    for m in &result.matches {
        if m.status == MatchStatus::Missing {
            lines.push(format!("  {}", m.code));
        }
    }

    lines.join("\n")
}

fn generate_csv(result: &MatchResult) -> String {
    let mut lines = Vec::new();
    lines.push("Code,Status,FilePath,FileName,Folder".to_string());

    for m in &result.matches {
        let status = match m.status {
            MatchStatus::Found => "FOUND",
            MatchStatus::Missing => "MISSING",
            MatchStatus::Duplicate => "DUPLICATE",
        };

        if let Some(ref photo) = m.photo {
            lines.push(format!(
                "{},{},{},{},{}",
                m.code, status, photo.full_path, photo.filename, photo.folder
            ));
        } else {
            lines.push(format!("{},{},,,", m.code, status));
        }
    }

    lines.join("\n")
}

fn generate_json(result: &MatchResult) -> Result<String, String> {
    serde_json::to_string_pretty(result).map_err(|e| format!("JSON serialization failed: {}", e))
}
