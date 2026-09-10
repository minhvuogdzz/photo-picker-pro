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

/// Saves Google refresh token securely in macOS Keychain / Windows Credential Manager
#[tauri::command]
pub fn save_google_secure_token(account_email: String, refresh_token: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account_email)
        .map_err(|e| format!("Không thể khởi tạo Keyring entry: {}", e))?;
    entry.set_password(&refresh_token)
        .map_err(|e| format!("Lỗi lưu token vào OS Keychain/Credential Manager: {}", e))?;
    Ok(())
}

/// Retrieves Google refresh token securely from macOS Keychain / Windows Credential Manager
#[tauri::command]
pub fn get_google_secure_token(account_email: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account_email)
        .map_err(|e| format!("Không thể khởi tạo Keyring entry: {}", e))?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Lỗi đọc token từ OS Keychain/Credential Manager: {}", e)),
    }
}

/// Deletes Google refresh token securely from OS Keychain
#[tauri::command]
pub fn delete_google_secure_token(account_email: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account_email)
        .map_err(|e| format!("Không thể khởi tạo Keyring entry: {}", e))?;
    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Lỗi xóa token khỏi OS Keychain/Credential Manager: {}", e)),
    }
}
