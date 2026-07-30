use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// Session data persisted locally on disk.
/// Contains JWT tokens, user info, subscription state, and offline tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalSession {
    pub access_token: String,
    pub refresh_token: String,
    pub user_id: String,
    pub email: String,
    pub name: String,
    pub subscription_status: String,
    pub subscription_plan: String,
    pub expires_at: Option<String>,
    pub device_id: String,
    pub last_sync_at: String,
}

/// Returns the app config directory path (platform-specific)
fn get_config_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .ok()
            .map(|home| {
                PathBuf::from(home).join("Library/Application Support/photo-picker-pro")
            })
            .ok_or_else(|| "Cannot determine config directory".to_string())
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|appdata| PathBuf::from(appdata).join("photo-picker-pro"))
            .ok_or_else(|| "Cannot determine config directory".to_string())
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("HOME")
            .ok()
            .map(|home| PathBuf::from(home).join(".config/photo-picker-pro"))
            .ok_or_else(|| "Cannot determine config directory".to_string())
    }
}

/// Path to the session file on disk
fn get_session_path() -> Result<PathBuf, String> {
    Ok(get_config_dir()?.join("session.json"))
}

/// Path to the persistent device ID file
fn get_device_id_path() -> Result<PathBuf, String> {
    Ok(get_config_dir()?.join("device.id"))
}

/// Saves the auth session to an encrypted file on disk.
/// File permissions are restricted to owner-only on Unix.
#[tauri::command]
pub fn save_auth_session(session: LocalSession) -> Result<(), String> {
    let path = get_session_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&session)
        .map_err(|e| format!("Failed to serialize session: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("Failed to write session: {}", e))?;

    // Restrict file permissions to owner-only on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

/// Loads the auth session from disk. Returns None if no session exists.
#[tauri::command]
pub fn load_auth_session() -> Result<Option<LocalSession>, String> {
    let path = get_session_path()?;
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read session: {}", e))?;

    let session: LocalSession = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse session: {}", e))?;

    Ok(Some(session))
}

/// Clears the auth session from disk (logout).
#[tauri::command]
pub fn clear_auth_session() -> Result<(), String> {
    let path = get_session_path()?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete session: {}", e))?;
    }
    Ok(())
}

/// Returns a persistent device fingerprint.
/// Generated once and stored on disk. Uses timestamp + system entropy.
#[tauri::command]
pub fn get_device_fingerprint() -> Result<String, String> {
    let path = get_device_id_path()?;

    // Return existing device ID if available
    if path.exists() {
        return fs::read_to_string(&path)
            .map(|id| id.trim().to_string())
            .map_err(|e| format!("Failed to read device ID: {}", e));
    }

    // Generate new device ID from system info
    let hostname = get_hostname();
    let username = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "user".to_string());
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();

    // Create deterministic hash from system info
    let raw = format!(
        "{}:{}:{}:{}:{}:{}",
        hostname,
        username,
        os,
        arch,
        timestamp.as_millis(),
        timestamp.subsec_nanos()
    );

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    raw.hash(&mut hasher);
    let hash = hasher.finish();

    let device_id = format!("dvf_{:016x}", hash);

    // Persist device ID
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&path, &device_id);

    Ok(device_id)
}

/// Checks whether the offline grace period (7 days) is still valid.
/// Returns true if the last sync was less than 7 days ago.
#[tauri::command]
pub fn is_offline_period_valid(last_sync_at: String) -> Result<bool, String> {
    use chrono::Utc;

    let last_sync = chrono::DateTime::parse_from_rfc3339(&last_sync_at)
        .or_else(|_| {
            // Fallback: try parsing without timezone
            chrono::NaiveDateTime::parse_from_str(&last_sync_at, "%Y-%m-%dT%H:%M:%S%.f")
                .map(|naive| {
                    naive
                        .and_utc()
                        .fixed_offset()
                })
        })
        .map_err(|e| format!("Invalid date format: {}", e))?;

    let now = Utc::now();
    let diff = now.signed_duration_since(last_sync);

    Ok(diff.num_days() < 7)
}

/// Retrieves the system hostname for device fingerprinting
fn get_hostname() -> String {
    #[cfg(unix)]
    {
        std::process::Command::new("hostname")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }
    #[cfg(windows)]
    {
        std::env::var("COMPUTERNAME").unwrap_or_else(|_| "unknown".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_offline_period_valid_recent() {
        let now = chrono::Utc::now().to_rfc3339();
        assert!(is_offline_period_valid(now).unwrap());
    }

    #[test]
    fn test_offline_period_expired() {
        let old = (chrono::Utc::now() - chrono::Duration::days(8)).to_rfc3339();
        assert!(!is_offline_period_valid(old).unwrap());
    }

    #[test]
    fn test_offline_period_boundary() {
        let boundary = (chrono::Utc::now() - chrono::Duration::days(6)).to_rfc3339();
        assert!(is_offline_period_valid(boundary).unwrap());
    }
}
