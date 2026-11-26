use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(target_os = "macos")]
extern "C" {
    fn macos_begin_bridge_activity();
    fn macos_end_bridge_activity();
    fn macos_wake_hidden_main_window();
    fn macos_sleep_hidden_main_window();
}

pub fn keep_hidden_window_awake_on_macos() {
    #[cfg(target_os = "macos")]
    unsafe {
        macos_wake_hidden_main_window();
    }
}

pub const PROTOCOL_VERSION: u32 = 1;
const MAX_LINE_BYTES: usize = 4 * 1024 * 1024; // 4 MiB
const REQUEST_TIMEOUT: Duration = Duration::from_secs(180);
const WEBVIEW_READY_WAIT: Duration = Duration::from_secs(12);

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeRequest {
    pub protocol_version: u32,
    pub id: String,
    pub action: String,
    #[serde(default)]
    pub params: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeProgress {
    pub current: u32,
    pub total: u32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeErrorBody {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeResponseEnvelope {
    pub protocol_version: u32,
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<BridgeProgress>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<BridgeErrorBody>,
}

impl BridgeResponseEnvelope {
    pub fn progress(id: &str, progress: BridgeProgress) -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            id: id.to_string(),
            kind: "progress".to_string(),
            progress: Some(progress),
            data: None,
            error: None,
        }
    }

    pub fn result(id: &str, data: Value) -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            id: id.to_string(),
            kind: "result".to_string(),
            progress: None,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(id: &str, code: &str, message: impl Into<String>) -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            id: id.to_string(),
            kind: "error".to_string(),
            progress: None,
            data: None,
            error: Some(BridgeErrorBody {
                code: code.to_string(),
                message: message.into(),
            }),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WebviewBridgeEvent {
    dispatch_id: String,
    action: String,
    params: Value,
}

enum OutboundEvent {
    Progress(BridgeProgress),
    Result(Value),
    Error { code: String, message: String },
}

pub struct BridgeState {
    webview_ready: AtomicBool,
    launched_in_background: AtomicBool,
    main_window_visible: AtomicBool,
    active_requests: AtomicUsize,
    owns_socket: AtomicBool,
    dispatch_seq: AtomicU64,
    pending: Mutex<HashMap<String, mpsc::Sender<OutboundEvent>>>,
    socket_path: PathBuf,
}

impl BridgeState {
    pub fn new(launched_in_background: bool) -> Self {
        Self {
            webview_ready: AtomicBool::new(false),
            launched_in_background: AtomicBool::new(launched_in_background),
            main_window_visible: AtomicBool::new(!launched_in_background),
            active_requests: AtomicUsize::new(0),
            owns_socket: AtomicBool::new(false),
            dispatch_seq: AtomicU64::new(1),
            pending: Mutex::new(HashMap::new()),
            socket_path: default_socket_path(),
        }
    }

    pub fn mark_webview_ready(&self) {
        self.webview_ready.store(true, Ordering::SeqCst);
    }

    pub fn is_webview_ready(&self) -> bool {
        self.webview_ready.load(Ordering::SeqCst)
    }

    pub fn launched_in_background(&self) -> bool {
        self.launched_in_background.load(Ordering::SeqCst)
    }

    pub fn is_main_window_visible(&self) -> bool {
        self.main_window_visible.load(Ordering::SeqCst)
    }

    pub fn set_main_window_visible(&self, visible: bool) {
        self.main_window_visible.store(visible, Ordering::SeqCst);
    }

    pub fn has_active_requests(&self) -> bool {
        self.active_requests.load(Ordering::SeqCst) > 0
    }

    pub fn socket_path(&self) -> &PathBuf {
        &self.socket_path
    }

    fn next_dispatch_id(&self) -> String {
        let seq = self.dispatch_seq.fetch_add(1, Ordering::Relaxed);
        format!("disp_{}_{}", std::process::id(), seq)
    }

    fn register_pending(&self, dispatch_id: String) -> mpsc::Receiver<OutboundEvent> {
        let (tx, rx) = mpsc::channel();
        if let Ok(mut guard) = self.pending.lock() {
            guard.insert(dispatch_id, tx);
        }
        rx
    }

    fn remove_pending(&self, dispatch_id: &str) {
        if let Ok(mut guard) = self.pending.lock() {
            guard.remove(dispatch_id);
        }
    }

    fn emit_progress(&self, dispatch_id: &str, progress: BridgeProgress) {
        if let Ok(guard) = self.pending.lock() {
            if let Some(tx) = guard.get(dispatch_id) {
                let _ = tx.send(OutboundEvent::Progress(progress));
            }
        }
    }

    fn finish_pending(
        &self,
        dispatch_id: &str,
        ok: bool,
        data: Option<Value>,
        error_code: Option<String>,
        error_message: Option<String>,
    ) {
        let tx = self
            .pending
            .lock()
            .ok()
            .and_then(|mut guard| guard.remove(dispatch_id));

        if let Some(tx) = tx {
            if ok {
                let _ = tx.send(OutboundEvent::Result(data.unwrap_or(Value::Null)));
            } else {
                let _ = tx.send(OutboundEvent::Error {
                    code: error_code.unwrap_or_else(|| "INTERNAL_ERROR".to_string()),
                    message: error_message
                        .unwrap_or_else(|| "Lỗi không xác định từ DH Studio Pro.".to_string()),
                });
            }
        }
    }

    pub fn cleanup_socket(&self) {
        if self.owns_socket.swap(false, Ordering::SeqCst) {
            let _ = std::fs::remove_file(&self.socket_path);
        }
    }
}

pub fn default_socket_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            return home
                .join("Library")
                .join("Application Support")
                .join("Devhouse")
                .join("bridges")
                .join("dh-studio-pro.sock");
        }
    }

    let base = dirs::data_local_dir().unwrap_or_else(std::env::temp_dir);
    base.join("Devhouse")
        .join("bridges")
        .join("dh-studio-pro.sock")
}

#[tauri::command]
pub fn bridge_mark_ready(state: State<'_, Arc<BridgeState>>) {
    state.mark_webview_ready();
}

#[tauri::command]
pub fn bridge_emit_progress(
    state: State<'_, Arc<BridgeState>>,
    dispatch_id: String,
    current: u32,
    total: u32,
    message: String,
) {
    state.emit_progress(
        &dispatch_id,
        BridgeProgress {
            current,
            total,
            message,
        },
    );
}

#[tauri::command]
pub fn bridge_reply(
    state: State<'_, Arc<BridgeState>>,
    dispatch_id: String,
    ok: bool,
    data: Option<Value>,
    error_code: Option<String>,
    error_message: Option<String>,
) {
    state.finish_pending(&dispatch_id, ok, data, error_code, error_message);
}

#[cfg(unix)]
pub fn start_bridge_server(app: AppHandle, state: Arc<BridgeState>) {
    std::thread::Builder::new()
        .name("dh-bridge-listener".to_string())
        .spawn(move || {
            if let Err(err) = run_unix_server(app, state) {
                eprintln!("[DH Bridge] Listener stopped: {}", err);
            }
        })
        .ok();
}

#[cfg(not(unix))]
pub fn start_bridge_server(_app: AppHandle, _state: Arc<BridgeState>) {}

#[cfg(unix)]
fn is_existing_bridge_alive(socket_path: &PathBuf) -> bool {
    use std::io::{BufRead, BufReader, Write};
    use std::os::unix::net::UnixStream;

    if !socket_path.exists() {
        return false;
    }

    let Ok(mut stream) = UnixStream::connect(socket_path) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(450)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(450)));

    let ping = json!({
        "protocolVersion": PROTOCOL_VERSION,
        "id": "probe",
        "action": "bridge.ping",
        "params": {}
    });
    if writeln!(stream, "{}", ping).is_err() {
        return false;
    }
    let _ = stream.flush();

    let mut line = String::new();
    let mut reader = BufReader::new(stream);
    match reader.read_line(&mut line) {
        Ok(n) if n > 0 => line.contains("\"dh-studio-pro\""),
        _ => false,
    }
}

#[cfg(unix)]
fn verify_same_user(stream: &std::os::unix::net::UnixStream) -> bool {
    use std::os::unix::io::AsRawFd;

    let fd = stream.as_raw_fd();
    #[cfg(target_os = "macos")]
    {
        let mut euid: libc::uid_t = 0;
        let mut egid: libc::gid_t = 0;
        let rc = unsafe { libc::getpeereid(fd, &mut euid, &mut egid) };
        let my_uid = unsafe { libc::geteuid() };
        rc == 0 && euid == my_uid
    }
    #[cfg(target_os = "linux")]
    {
        let mut cred = libc::ucred {
            pid: 0,
            uid: 0,
            gid: 0,
        };
        let mut len = std::mem::size_of::<libc::ucred>() as libc::socklen_t;
        let rc = unsafe {
            libc::getsockopt(
                fd,
                libc::SOL_SOCKET,
                libc::SO_PEERCRED,
                &mut cred as *mut _ as *mut libc::c_void,
                &mut len,
            )
        };
        let my_uid = unsafe { libc::geteuid() };
        rc == 0 && cred.uid == my_uid
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        let _ = fd;
        true
    }
}

#[cfg(unix)]
fn run_unix_server(app: AppHandle, state: Arc<BridgeState>) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    use std::os::unix::net::UnixListener;

    let socket_path = state.socket_path().clone();
    if let Some(parent) = socket_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Cannot create bridge directory: {}", e))?;
        let _ = std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700));
    }

    if is_existing_bridge_alive(&socket_path) {
        return Err("Another live DH Studio Pro bridge instance is already bound".to_string());
    }

    let _ = std::fs::remove_file(&socket_path);
    let listener = UnixListener::bind(&socket_path)
        .map_err(|e| format!("Failed to bind bridge socket {:?}: {}", socket_path, e))?;
    let _ = std::fs::set_permissions(&socket_path, std::fs::Permissions::from_mode(0o600));
    state.owns_socket.store(true, Ordering::SeqCst);

    for incoming in listener.incoming() {
        match incoming {
            Ok(stream) => {
                if !verify_same_user(&stream) {
                    continue;
                }
                let app_clone = app.clone();
                let state_clone = Arc::clone(&state);
                std::thread::spawn(move || {
                    handle_client(stream, app_clone, state_clone);
                });
            }
            Err(err) => {
                eprintln!("[DH Bridge] Accept error: {}", err);
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    }

    Ok(())
}

#[cfg(unix)]
fn write_envelope(stream: &mut std::os::unix::net::UnixStream, env: &BridgeResponseEnvelope) -> bool {
    use std::io::Write;
    match serde_json::to_string(env) {
        Ok(line) => {
            if writeln!(stream, "{}", line).is_err() {
                return false;
            }
            stream.flush().is_ok()
        }
        Err(_) => false,
    }
}

#[cfg(unix)]
fn read_single_line(stream: &std::os::unix::net::UnixStream) -> Result<String, String> {
    use std::io::Read;

    let mut buf = Vec::with_capacity(1024);
    let mut chunk = [0u8; 4096];
    let mut reader = stream;

    loop {
        match reader.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                if let Some(pos) = chunk[..n].iter().position(|&b| b == b'\n') {
                    buf.extend_from_slice(&chunk[..pos]);
                    break;
                }
                buf.extend_from_slice(&chunk[..n]);
                if buf.len() > MAX_LINE_BYTES {
                    return Err("Request exceeds 4 MiB limit".to_string());
                }
            }
            Err(err) => return Err(format!("Read error: {}", err)),
        }
    }

    String::from_utf8(buf).map_err(|e| format!("Invalid UTF-8: {}", e))
}

#[cfg(unix)]
fn handle_client(
    mut stream: std::os::unix::net::UnixStream,
    app: AppHandle,
    state: Arc<BridgeState>,
) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));

    let raw = match read_single_line(&stream) {
        Ok(line) if !line.trim().is_empty() => line,
        Ok(_) => {
            let _ = write_envelope(
                &mut stream,
                &BridgeResponseEnvelope::error("", "INVALID_REQUEST", "Yêu cầu rỗng."),
            );
            return;
        }
        Err(err) => {
            let _ = write_envelope(
                &mut stream,
                &BridgeResponseEnvelope::error("", "INVALID_REQUEST", err),
            );
            return;
        }
    };

    let req: BridgeRequest = match serde_json::from_str(&raw) {
        Ok(r) => r,
        Err(err) => {
            let _ = write_envelope(
                &mut stream,
                &BridgeResponseEnvelope::error(
                    "",
                    "INVALID_REQUEST",
                    format!("JSON không hợp lệ: {}", err),
                ),
            );
            return;
        }
    };

    if req.protocol_version != PROTOCOL_VERSION {
        let _ = write_envelope(
            &mut stream,
            &BridgeResponseEnvelope::error(
                &req.id,
                "INVALID_REQUEST",
                format!(
                    "Phiên bản giao thức không khớp (nhận {}, hỗ trợ {}).",
                    req.protocol_version, PROTOCOL_VERSION
                ),
            ),
        );
        return;
    }

    match req.action.as_str() {
        "bridge.ping" => {
            let has_main = app.get_webview_window("main").is_some();
            let main_visible = has_main && state.is_main_window_visible();
            let webview_ready = has_main && state.is_webview_ready();
            let data = json!({
                "app": "dh-studio-pro",
                "appVersion": app.package_info().version.to_string(),
                "protocolVersion": PROTOCOL_VERSION,
                "pid": std::process::id(),
                "webviewReady": webview_ready,
                "launchedInBackground": state.launched_in_background(),
                "mainWindowVisible": main_visible,
            });
            let _ = write_envelope(&mut stream, &BridgeResponseEnvelope::result(&req.id, data));
        }

        "bridge.show_window" => {
            crate::tray::show_main_window(&app);
            if let Some(module) = req.params.get("module").and_then(|v| v.as_str()) {
                let _ = app.emit_to("main", "navigate-to-module", json!({ "module": module }));
            }
            if let Some(tab) = req.params.get("tab").and_then(|v| v.as_str()) {
                let module = req
                    .params
                    .get("module")
                    .and_then(|v| v.as_str())
                    .unwrap_or("contact-the-sheet");
                let _ = app.emit_to(
                    "main",
                    "dh-bridge:open-tab",
                    json!({ "module": module, "tab": tab }),
                );
            }
            let _ = write_envelope(
                &mut stream,
                &BridgeResponseEnvelope::result(&req.id, json!({ "shown": true })),
            );
        }

        "bridge.shutdown" => {
            let only_if_hidden = req
                .params
                .get("onlyIfHidden")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let main_visible =
                app.get_webview_window("main").is_some() && state.is_main_window_visible();

            if only_if_hidden && main_visible {
                let _ = write_envelope(
                    &mut stream,
                    &BridgeResponseEnvelope::result(
                        &req.id,
                        json!({ "shuttingDown": false, "reason": "WINDOW_VISIBLE" }),
                    ),
                );
                return;
            }

            let _ = write_envelope(
                &mut stream,
                &BridgeResponseEnvelope::result(
                    &req.id,
                    json!({ "shuttingDown": true, "reason": Value::Null }),
                ),
            );
            state.cleanup_socket();
            let app_to_exit = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(120));
                app_to_exit.exit(0);
            });
        }

        "photo_picker.cancel" => {
            if let Some(cancel_flag) = app.try_state::<Arc<AtomicBool>>() {
                cancel_flag.store(true, Ordering::SeqCst);
            }
            let _ = write_envelope(
                &mut stream,
                &BridgeResponseEnvelope::result(&req.id, json!({ "cancelled": true })),
            );
        }

        action if action.starts_with("contact_sheet.") || action.starts_with("photo_picker.") => {
            forward_to_webview(&mut stream, &app, &state, &req);
        }

        _ => {
            let _ = write_envelope(
                &mut stream,
                &BridgeResponseEnvelope::error(
                    &req.id,
                    "UNKNOWN_ACTION",
                    format!("Action không được hỗ trợ: {}", req.action),
                ),
            );
        }
    }
}

/// RAII guard preventing macOS App Nap & WebKit occlusion throttling while a
/// hidden background bridge request is in flight.
#[cfg(unix)]
struct HiddenWakeGuard<'a> {
    state: &'a BridgeState,
}

#[cfg(unix)]
impl<'a> HiddenWakeGuard<'a> {
    fn acquire(state: &'a BridgeState) -> Self {
        let prev = state.active_requests.fetch_add(1, Ordering::SeqCst);
        #[cfg(target_os = "macos")]
        {
            unsafe {
                macos_begin_bridge_activity();
            }
            if !state.is_main_window_visible() {
                unsafe {
                    macos_wake_hidden_main_window();
                }
                if prev == 0 {
                    // Let AppKit order the invisible window onto the screen and
                    // notify WKWebView before dispatching JS work.
                    std::thread::sleep(Duration::from_millis(80));
                }
            }
        }
        #[cfg(not(target_os = "macos"))]
        let _ = prev;
        Self { state }
    }
}

#[cfg(unix)]
impl Drop for HiddenWakeGuard<'_> {
    fn drop(&mut self) {
        let prev = self.state.active_requests.fetch_sub(1, Ordering::SeqCst);
        #[cfg(target_os = "macos")]
        {
            if prev == 1 && !self.state.is_main_window_visible() {
                unsafe {
                    macos_sleep_hidden_main_window();
                }
            }
            unsafe {
                macos_end_bridge_activity();
            }
        }
        #[cfg(not(target_os = "macos"))]
        let _ = prev;
    }
}

#[cfg(unix)]
fn forward_to_webview(
    stream: &mut std::os::unix::net::UnixStream,
    app: &AppHandle,
    state: &Arc<BridgeState>,
    req: &BridgeRequest,
) {
    if app.get_webview_window("main").is_none() {
        let _ = write_envelope(
            stream,
            &BridgeResponseEnvelope::error(
                &req.id,
                "BRIDGE_NOT_READY",
                "Cửa sổ nền của DH Studio Pro chưa sẵn sàng hoặc đã bị đóng. Vui lòng mở lại DH Studio Pro.",
            ),
        );
        return;
    }

    let _wake_guard = HiddenWakeGuard::acquire(state);

    let wait_start = Instant::now();
    while !state.is_webview_ready() {
        if wait_start.elapsed() >= WEBVIEW_READY_WAIT {
            let _ = write_envelope(
                stream,
                &BridgeResponseEnvelope::error(
                    &req.id,
                    "BRIDGE_NOT_READY",
                    "DH Studio Pro đang khởi tạo giao diện nền. Vui lòng thử lại sau giây lát.",
                ),
            );
            return;
        }
        std::thread::sleep(Duration::from_millis(50));
    }

    let dispatch_id = state.next_dispatch_id();
    let rx = state.register_pending(dispatch_id.clone());

    let event = WebviewBridgeEvent {
        dispatch_id: dispatch_id.clone(),
        action: req.action.clone(),
        params: req.params.clone(),
    };

    if let Err(err) = app.emit_to("main", "dh-bridge:request", event) {
        state.remove_pending(&dispatch_id);
        let _ = write_envelope(
            stream,
            &BridgeResponseEnvelope::error(
                &req.id,
                "BRIDGE_NOT_READY",
                format!("Không thể gửi yêu cầu tới WebView của DH Studio Pro: {}", err),
            ),
        );
        return;
    }

    // Reset inactivity deadline whenever progress streams in (so large RAW copies
    // with continuous progress updates never falsely hit timeout while stalled calls still do).
    let mut deadline = Instant::now() + REQUEST_TIMEOUT;
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            state.remove_pending(&dispatch_id);
            let _ = write_envelope(
                stream,
                &BridgeResponseEnvelope::error(
                    &req.id,
                    "TIMEOUT",
                    "Hết thời gian chờ phản hồi từ DH Studio Pro.",
                ),
            );
            return;
        }

        match rx.recv_timeout(remaining) {
            Ok(OutboundEvent::Progress(progress)) => {
                deadline = Instant::now() + REQUEST_TIMEOUT;
                if !write_envelope(stream, &BridgeResponseEnvelope::progress(&req.id, progress)) {
                    state.remove_pending(&dispatch_id);
                    return;
                }
            }
            Ok(OutboundEvent::Result(data)) => {
                let _ = write_envelope(stream, &BridgeResponseEnvelope::result(&req.id, data));
                return;
            }
            Ok(OutboundEvent::Error { code, message }) => {
                let _ = write_envelope(
                    stream,
                    &BridgeResponseEnvelope::error(&req.id, &code, message),
                );
                return;
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                state.remove_pending(&dispatch_id);
                let _ = write_envelope(
                    stream,
                    &BridgeResponseEnvelope::error(
                        &req.id,
                        "TIMEOUT",
                        "Hết thời gian chờ phản hồi từ DH Studio Pro.",
                    ),
                );
                return;
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                state.remove_pending(&dispatch_id);
                let _ = write_envelope(
                    stream,
                    &BridgeResponseEnvelope::error(
                        &req.id,
                        "INTERNAL_ERROR",
                        "Kết nối nội bộ trong DH Studio Pro đã đóng bất ngờ.",
                    ),
                );
                return;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_deserializes_camel_case_contract() {
        let raw = r#"{"protocolVersion":1,"id":"req-1","action":"contact_sheet.scan","params":{"paths":["/tmp/a"],"tabTitles":["Edit 11/2026"],"replaceExisting":true}}"#;
        let req: BridgeRequest = serde_json::from_str(raw).expect("valid request");
        assert_eq!(req.protocol_version, 1);
        assert_eq!(req.id, "req-1");
        assert_eq!(req.action, "contact_sheet.scan");
        assert_eq!(req.params["replaceExisting"], true);

        let raw_pp = r#"{"protocolVersion":1,"id":"req-pp-1","action":"photo_picker.set_folder","params":{"folderPath":"/tmp/customer"}}"#;
        let req_pp: BridgeRequest = serde_json::from_str(raw_pp).expect("valid photo_picker request");
        assert_eq!(req_pp.action, "photo_picker.set_folder");
        assert_eq!(req_pp.params["folderPath"], "/tmp/customer");
    }

    #[test]
    fn envelopes_match_protocol_schema() {
        let progress = BridgeResponseEnvelope::progress(
            "req-2",
            BridgeProgress {
                current: 50,
                total: 100,
                message: "Scanning".to_string(),
            },
        );
        let p_json = serde_json::to_value(&progress).expect("serialize progress");
        assert_eq!(p_json["protocolVersion"], 1);
        assert_eq!(p_json["id"], "req-2");
        assert_eq!(p_json["type"], "progress");
        assert_eq!(p_json["progress"]["current"], 50);
        assert!(p_json.get("data").is_none());
        assert!(p_json.get("error").is_none());

        let result = BridgeResponseEnvelope::result("req-3", json!({ "shown": true }));
        let r_json = serde_json::to_value(&result).expect("serialize result");
        assert_eq!(r_json["type"], "result");
        assert_eq!(r_json["data"]["shown"], true);

        let err = BridgeResponseEnvelope::error("req-4", "NOT_AUTHENTICATED", "Chưa đăng nhập");
        let e_json = serde_json::to_value(&err).expect("serialize error");
        assert_eq!(e_json["type"], "error");
        assert_eq!(e_json["error"]["code"], "NOT_AUTHENTICATED");
        assert_eq!(e_json["error"]["message"], "Chưa đăng nhập");
    }

    #[test]
    fn default_socket_path_points_to_devhouse_bridges() {
        let path = default_socket_path();
        assert_eq!(
            path.file_name().and_then(|s| s.to_str()),
            Some("dh-studio-pro.sock")
        );
        assert!(path.to_string_lossy().contains("Devhouse"));
    }

    #[test]
    fn bridge_state_tracks_visibility_and_background_flag() {
        let bg = BridgeState::new(true);
        assert!(bg.launched_in_background());
        assert!(!bg.is_main_window_visible());
        assert!(!bg.has_active_requests());
        bg.set_main_window_visible(true);
        assert!(bg.is_main_window_visible());

        let fg = BridgeState::new(false);
        assert!(!fg.launched_in_background());
        assert!(fg.is_main_window_visible());
        fg.set_main_window_visible(false);
        assert!(!fg.is_main_window_visible());
    }
}
