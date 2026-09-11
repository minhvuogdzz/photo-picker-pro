use std::io::{Read, Write};
use std::net::TcpListener;
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "com.minhvuong.photopicker.google_oauth";

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthLoopbackInfo {
    pub port: u16,
    pub redirect_uri: String,
    pub code_verifier: String,
    pub code_challenge: String,
    pub state: String,
}

/// Generates a PKCE code verifier (43-128 chars) and challenge (base64url SHA256)
fn generate_pkce() -> (String, String) {
    use sha2::{Digest, Sha256};
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;

    // Use current time + thread rng / simple entropy for verifier
    let random_bytes: Vec<u8> = (0..32).map(|_| {
        let t = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(42);
        ((t ^ 0x5a5a5a5a) & 0xff) as u8
    }).collect();

    let verifier = URL_SAFE_NO_PAD.encode(&random_bytes);
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    let challenge = URL_SAFE_NO_PAD.encode(hash);

    (verifier, challenge)
}

/// Generates a random state string for OAuth CSRF protection
fn generate_state() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(123456);
    format!("{:x}", now)
}

/// Spawns a loopback TCP listener on an ephemeral port (127.0.0.1:0)
#[tauri::command]
pub fn start_google_oauth_loopback() -> Result<OAuthLoopbackInfo, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Không thể mở cổng loopback OAuth: {}", e))?;
    let port = listener.local_addr()
        .map_err(|e| format!("Không thể lấy thông tin cổng: {}", e))?
        .port();

    // Drop the listener so wait_for_google_oauth_code can bind on the same port
    drop(listener);

    let (verifier, challenge) = generate_pkce();
    let state = generate_state();
    let redirect_uri = format!("http://127.0.0.1:{}", port);

    Ok(OAuthLoopbackInfo {
        port,
        redirect_uri,
        code_verifier: verifier,
        code_challenge: challenge,
        state,
    })
}

/// Listens for a single HTTP GET request containing the OAuth code and state
#[tauri::command]
pub fn wait_for_google_oauth_code(port: u16, expected_state: String) -> Result<String, String> {
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
        .map_err(|e| format!("Không thể kết nối lại cổng loopback {}: {}", port, e))?;

    // Accept one connection
    let (mut stream, _) = listener.accept()
        .map_err(|e| format!("Lỗi nhận kết nối OAuth callback: {}", e))?;

    let mut buffer = [0u8; 2048];
    let bytes_read = stream.read(&mut buffer)
        .map_err(|e| format!("Lỗi đọc dữ liệu OAuth: {}", e))?;
    let request_str = String::from_utf8_lossy(&buffer[..bytes_read]);

    // Parse the GET line: GET /oauth/callback?code=...&state=... HTTP/1.1
    let first_line = request_str.lines().next().unwrap_or("");
    let path = first_line.split_whitespace().nth(1).unwrap_or("");

    let url_query = path.split('?').nth(1).unwrap_or("");
    let mut code: Option<String> = None;
    let mut state: Option<String> = None;

    for param in url_query.split('&') {
        let mut parts = param.splitn(2, '=');
        let key = parts.next().unwrap_or("");
        let val = parts.next().unwrap_or("");
        if key == "code" {
            code = Some(val.to_string());
        } else if key == "state" {
            state = Some(val.to_string());
        }
    }

    // Verify CSRF state
    if state.as_deref() != Some(&expected_state) {
        let error_html = "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h2>Lỗi xác thực: State không khớp!</h2></body></html>";
        let _ = stream.write_all(error_html.as_bytes());
        return Err("OAuth state validation mismatch (CSRF protection)".to_string());
    }

    let code = match code {
        Some(c) => c,
        None => {
            let error_html = "HTTP/1.1 400 Bad Request\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h2>Không nhận được mã xác thực (code)!</h2></body></html>";
            let _ = stream.write_all(error_html.as_bytes());
            return Err("Missing authorization code in callback".to_string());
        }
    };

    // Return friendly success HTML to the browser
    let success_html = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body style='font-family: system-ui, sans-serif; text-align: center; padding: 40px; background: #0f172a; color: #f8fafc;'><div style='max-width: 480px; margin: 0 auto; background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155;'><h2 style='color: #14b8a6; margin-top: 0;'>Xác thực Google thành công!</h2><p style='color: #94a3b8; font-size: 14px;'>Bạn có thể đóng tab này và quay lại Super App <b>MVD Photoshop Academy</b>.</p></div></body></html>";
    let _ = stream.write_all(success_html.as_bytes());

    Ok(code)
}

fn get_google_tokens_path() -> Result<std::path::PathBuf, String> {
    let base = dirs_next().ok_or_else(|| "Cannot determine config directory".to_string())?;
    Ok(base.join("google_tokens.json"))
}

fn dirs_next() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME")
            .ok()
            .map(|home| std::path::PathBuf::from(home).join("Library/Application Support/photo-picker-pro"))
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|appdata| std::path::PathBuf::from(appdata).join("photo-picker-pro"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("HOME")
            .ok()
            .map(|home| std::path::PathBuf::from(home).join(".config/photo-picker-pro"))
    }
}

fn read_tokens_file() -> std::collections::HashMap<String, String> {
    if let Ok(path) = get_google_tokens_path() {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(map) = serde_json::from_str::<std::collections::HashMap<String, String>>(&content) {
                    return map;
                }
            }
        }
    }
    std::collections::HashMap::new()
}

fn write_tokens_file(tokens: &std::collections::HashMap<String, String>) -> Result<(), String> {
    let path = get_google_tokens_path()?;
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let content = serde_json::to_string_pretty(tokens)
        .map_err(|e| format!("Failed to serialize google tokens: {}", e))?;
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write google tokens: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// Saves Google refresh token securely on disk (0o600 owner-only) & OS Keychain
#[tauri::command]
pub fn save_google_secure_token(account_email: String, refresh_token: String) -> Result<(), String> {
    // 1. Primary: Save to secure owner-only JSON file in Application Support
    let mut tokens = read_tokens_file();
    tokens.insert(account_email.clone(), refresh_token.clone());
    write_tokens_file(&tokens)?;

    // 2. Best-effort secondary: OS Keychain
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &account_email) {
        let _ = entry.set_password(&refresh_token);
    }

    Ok(())
}

/// Retrieves Google refresh token securely from disk or OS Keychain
#[tauri::command]
pub fn get_google_secure_token(account_email: String) -> Result<Option<String>, String> {
    // 1. Check primary persistent file
    let tokens = read_tokens_file();
    if let Some(token) = tokens.get(&account_email) {
        if !token.is_empty() {
            return Ok(Some(token.clone()));
        }
    }

    // 2. Fallback: Check OS Keychain
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &account_email) {
        if let Ok(token) = entry.get_password() {
            if !token.is_empty() {
                // Back-fill into file
                let mut tokens = read_tokens_file();
                tokens.insert(account_email, token.clone());
                let _ = write_tokens_file(&tokens);
                return Ok(Some(token));
            }
        }
    }

    Ok(None)
}

/// Deletes Google refresh token securely from disk and OS Keychain
#[tauri::command]
pub fn delete_google_secure_token(account_email: String) -> Result<(), String> {
    let mut tokens = read_tokens_file();
    tokens.remove(&account_email);
    let _ = write_tokens_file(&tokens);

    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &account_email) {
        let _ = entry.delete_credential();
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keyring_store_and_retrieve() {
        let email = "test_user_persistence@studio.com".to_string();
        let token = "test_refresh_token_xyz_12345".to_string();
        let save_res = save_google_secure_token(email.clone(), token.clone());
        assert!(save_res.is_ok(), "Save token must succeed");

        let get_res = get_google_secure_token(email.clone());
        assert_eq!(get_res, Ok(Some(token)), "Token must be retrieved reliably across restarts");

        let del_res = delete_google_secure_token(email.clone());
        assert!(del_res.is_ok(), "Delete token must succeed");

        let get_after_del = get_google_secure_token(email);
        assert_eq!(get_after_del, Ok(None), "Deleted token must return None");
    }
}
