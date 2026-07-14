use std::fs;
use std::path::PathBuf;

use super::types::{AppSettings, HistoryEntry};

/// Returns the path to the app's config directory
fn get_config_dir() -> Result<PathBuf, String> {
    let config_dir = dirs_next()
        .ok_or_else(|| "Cannot determine config directory".to_string())?;
    Ok(config_dir)
}

/// Platform-specific config directory
fn dirs_next() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .ok()
            .map(|home| PathBuf::from(home).join("Library/Application Support/photo-picker-pro"))
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|appdata| PathBuf::from(appdata).join("photo-picker-pro"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("HOME")
            .ok()
            .map(|home| PathBuf::from(home).join(".config/photo-picker-pro"))
    }
}

/// Loads application settings from disk.
#[tauri::command]
pub fn load_settings() -> Result<AppSettings, String> {
    let config_dir = get_config_dir()?;
    let settings_path = config_dir.join("settings.json");

    if !settings_path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings: {}", e))
}

/// Saves application settings to disk.
#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    let config_dir = get_config_dir()?;
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;

    let settings_path = config_dir.join("settings.json");
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(&settings_path, content)
        .map_err(|e| format!("Failed to write settings: {}", e))
}

/// Loads operation history from disk. Returns the last 10 entries.
#[tauri::command]
pub fn load_history() -> Result<Vec<HistoryEntry>, String> {
    let config_dir = get_config_dir()?;
    let history_path = config_dir.join("history.json");

    if !history_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&history_path)
        .map_err(|e| format!("Failed to read history: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse history: {}", e))
}

/// Adds a new history entry. Keeps only the last 10 entries.
#[tauri::command]
pub fn add_history(entry: HistoryEntry) -> Result<(), String> {
    let config_dir = get_config_dir()?;
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;

    let history_path = config_dir.join("history.json");

    let mut history = if history_path.exists() {
        let content = fs::read_to_string(&history_path)
            .map_err(|e| format!("Failed to read history: {}", e))?;
        serde_json::from_str::<Vec<HistoryEntry>>(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    // Add to front and keep max 10
    history.insert(0, entry);
    history.truncate(10);

    let content = serde_json::to_string_pretty(&history)
        .map_err(|e| format!("Failed to serialize history: {}", e))?;

    fs::write(&history_path, content)
        .map_err(|e| format!("Failed to write history: {}", e))
}

/// Clears all history entries.
#[tauri::command]
pub fn clear_history() -> Result<(), String> {
    let config_dir = get_config_dir()?;
    let history_path = config_dir.join("history.json");

    if history_path.exists() {
        fs::remove_file(&history_path)
            .map_err(|e| format!("Failed to delete history: {}", e))?;
    }

    Ok(())
}

fn find_child_dir(parent: &PathBuf, search: &str) -> Option<PathBuf> {
    let search_lower = search.to_lowercase().replace(" ", "");
    if let Ok(entries) = std::fs::read_dir(parent) {
        for entry in entries.filter_map(|e| e.ok()) {
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_lowercase().replace(" ", "");
                if name.contains(&search_lower) {
                    return Some(entry.path());
                }
            }
        }
    }
    None
}

/// Auto detects the studio output folder path
#[tauri::command]
pub fn auto_detect_studio_output() -> Result<Option<String>, String> {
    let users_dir = if cfg!(target_os = "windows") {
        PathBuf::from("C:\\Users")
    } else if cfg!(target_os = "macos") {
        PathBuf::from("/Users")
    } else {
        PathBuf::from("/home")
    };
    
    if let Ok(entries) = std::fs::read_dir(users_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                let user_dir = entry.path();
                
                // Paths to check for Google Drive root
                let gdrive_paths = vec![
                    // Windows or older macOS path
                    user_dir.join("GoogleDrive-pinkaskyart03@gmail.com"),
                    // Modern macOS Google Drive path
                    user_dir.join("Library").join("CloudStorage").join("GoogleDrive-pinkaskyart03@gmail.com"),
                ];

                for gdrive_root in gdrive_paths {
                    let mut current = gdrive_root
                        .join(".shortcut-targets-by-id")
                        .join("1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI");
                        
                    if !current.exists() {
                        continue;
                    }
                    
                    // Fuzzy match Photoshop
                    if let Some(p) = find_child_dir(&current, "photoshop") {
                        current = p;
                    } else { continue; }
                    
                    // Fuzzy match Ảnh chọn
                    if let Some(p) = find_child_dir(&current, "nhcho") {
                        current = p;
                    } else { continue; }
                    
                    // Fuzzy match ảnh tổng
                    if let Some(p) = find_child_dir(&current, "nhto") {
                        current = p;
                    } else { continue; }
                    
                    return Ok(Some(current.to_string_lossy().to_string()));
                }
            }
        }
    }

    Ok(None)
}
