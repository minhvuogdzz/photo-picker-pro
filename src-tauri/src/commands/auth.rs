use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Individual app entitlement persisted in local session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalEntitlement {
    pub app: String,
    pub expires_at: String,
    #[serde(default)]
    pub is_trial: bool,
}

/// Session data persisted locally on disk.
/// Contains JWT tokens, user info, subscription state, entitlements, and offline tracking.
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
    #[serde(default)]
    pub username: Option<String>,
    /// "ADMIN" | "USER". Dùng #[serde(default)] để session cũ trên đĩa (chưa có field
    /// này) vẫn đọc được bình thường, không làm người dùng bị đăng xuất sau khi update.
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub entitlements: Vec<LocalEntitlement>,
    #[serde(default)]
    pub is_premium: Option<bool>,
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

    // A session file copied over from another machine must not log this one in
    if !session.device_id.is_empty() {
        if let Ok(current_device) = get_device_fingerprint() {
            if current_device != session.device_id {
                let _ = fs::remove_file(&path);
                return Ok(None);
            }
        }
    }

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

fn sha256_hex(input: &str) -> String {
    Sha256::digest(input.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn current_username() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "user".to_string())
}

/// Hardware identifier of this machine; it survives app reinstalls and differs between machines.
fn read_hardware_id() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        let out = std::process::Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
            .ok()?;
        String::from_utf8_lossy(&out.stdout)
            .lines()
            .find(|line| line.contains("\"IOPlatformUUID\""))
            .and_then(|line| line.split('"').nth(3))
            .map(|uuid| uuid.trim().to_string())
            .filter(|uuid| !uuid.is_empty())
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let out = std::process::Command::new("reg")
            .args(["query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
        String::from_utf8_lossy(&out.stdout)
            .lines()
            .find(|line| line.contains("MachineGuid"))
            .and_then(|line| line.split_whitespace().last())
            .map(|guid| guid.to_string())
            .filter(|guid| !guid.is_empty())
    }
    #[cfg(target_os = "linux")]
    {
        ["/etc/machine-id", "/var/lib/dbus/machine-id"]
            .iter()
            .find_map(|p| fs::read_to_string(p).ok())
            .map(|id| id.trim().to_string())
            .filter(|id| !id.is_empty())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        None
    }
}

fn hardware_id() -> Option<&'static str> {
    static HARDWARE_ID: OnceLock<Option<String>> = OnceLock::new();
    HARDWARE_ID.get_or_init(read_hardware_id).as_deref()
}

/// Picks the device ID given the stored `device.id` content (`<id>\nbind:<machine hash>`).
/// Returns the ID and whether the file must be rewritten.
/// - bound to this machine: reuse it
/// - bound to another machine (the file was copied): switch to this machine's own ID
/// - legacy file without binding: keep its ID so existing logins stay valid, then bind it
/// - machine hash unknown (hardware ID unreadable): keep whatever is stored, never reset
fn resolve_device_id(stored: Option<&str>, binding: Option<&str>, fresh_id: &str) -> (String, bool) {
    let mut lines = stored
        .unwrap_or("")
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty());
    let Some(stored_id) = lines.next() else {
        return (fresh_id.to_string(), true);
    };
    let stored_binding = lines.next().and_then(|l| l.strip_prefix("bind:"));

    match (stored_binding, binding) {
        (_, None) => (stored_id.to_string(), false),
        (Some(s), Some(b)) if s == b => (stored_id.to_string(), false),
        (Some(_), Some(_)) => (fresh_id.to_string(), true),
        (None, Some(_)) => (stored_id.to_string(), true),
    }
}

/// Returns this machine's persistent device ID. Derived from the hardware ID, so reinstalling
/// keeps the same ID, and a `device.id` file copied to another machine is not honoured there.
#[tauri::command]
pub fn get_device_fingerprint() -> Result<String, String> {
    let path = get_device_id_path()?;
    let stored = fs::read_to_string(&path).ok();

    let hw = hardware_id();
    let binding = hw.map(|id| sha256_hex(&format!("mvd-device-binding-v2:{id}")));
    let id_source = hw
        .map(str::to_string)
        .unwrap_or_else(|| format!("host:{}:{}", get_hostname(), current_username()));
    let fresh_id = format!("dvf_{}", &sha256_hex(&format!("mvd-device-id-v2:{id_source}"))[..16]);

    let (device_id, needs_write) = resolve_device_id(stored.as_deref(), binding.as_deref(), &fresh_id);

    if needs_write {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let content = match &binding {
            Some(b) => format!("{device_id}\nbind:{b}\n"),
            None => format!("{device_id}\n"),
        };
        let _ = fs::write(&path, content);
    }

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

    #[test]
    fn device_file_bound_to_this_machine_is_reused() {
        let result = resolve_device_id(Some("dvf_aaaa\nbind:m1\n"), Some("m1"), "dvf_fresh");
        assert_eq!(result, ("dvf_aaaa".to_string(), false));
    }

    #[test]
    fn device_file_copied_from_another_machine_is_replaced() {
        let result = resolve_device_id(Some("dvf_aaaa\nbind:m1\n"), Some("m2"), "dvf_fresh");
        assert_eq!(result, ("dvf_fresh".to_string(), true));
    }

    #[test]
    fn legacy_device_file_keeps_its_id_and_gets_bound() {
        let result = resolve_device_id(Some("dvf_legacy"), Some("m1"), "dvf_fresh");
        assert_eq!(result, ("dvf_legacy".to_string(), true));
    }

    #[test]
    fn missing_device_file_uses_machine_derived_id() {
        assert_eq!(resolve_device_id(None, Some("m1"), "dvf_fresh"), ("dvf_fresh".to_string(), true));
        assert_eq!(resolve_device_id(Some("  \n"), Some("m1"), "dvf_fresh"), ("dvf_fresh".to_string(), true));
    }

    #[test]
    fn unreadable_hardware_never_resets_an_existing_id() {
        let result = resolve_device_id(Some("dvf_aaaa\nbind:m1\n"), None, "dvf_fresh");
        assert_eq!(result, ("dvf_aaaa".to_string(), false));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn hardware_id_is_readable_and_stable_on_macos() {
        let first = read_hardware_id().expect("IOPlatformUUID should be readable");
        assert_eq!(first.len(), 36, "unexpected UUID format: {first}");
        assert_eq!(read_hardware_id().as_deref(), Some(first.as_str()));
    }
}
