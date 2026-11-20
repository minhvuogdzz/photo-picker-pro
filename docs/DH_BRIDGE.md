# DH Ecosystem Bridge Protocol (v1)

Tài liệu đặc tả hợp đồng giao tiếp cục bộ giữa **DHbox** (macOS native Swift) và **DH Studio Pro** (Tauri v2 / Rust / React).
Bản đặc tả này được giữ đồng bộ ở cả hai kho mã:
- `DHbox/docs/DH_BRIDGE.md`
- `DH Studio Pro/docs/DH_BRIDGE.md`

> Quy tắc bắt buộc cho mọi phiên phát triển (kể cả khi giao tiếp cho agent khác chỉ mở một kho mã):
> 1. **Không tự ý đổi tên, xóa hoặc đổi kiểu dữ liệu** của `socketPath`, `protocolVersion`, tên `action`, mã lỗi, hoặc bất kỳ khóa JSON nào đã công bố trong tài liệu này nếu không cập nhật đồng thời cả hai kho mã và tăng `protocolVersion` khi phá vỡ tương thích ngược.
> 2. **Trường mới phải là tùy chọn (optional)** để hai phiên bản lệch nhẹ vẫn nói chuyện được.
> 3. **Không sao chép logic nghiệp vụ** của Contact the Sheet sang DHbox. DHbox chỉ là bề mặt Finder và giao diện hiển thị gọn; toàn bộ cấu hình Sheet, Google OAuth, bản quyền, quét, đối soát và ghi Google Sheets chạy trong DH Studio Pro.
> 4. Mỗi khi sửa hợp đồng, phải chạy test hợp đồng ở cả hai bên:
>    - DHbox: `make test` và `make lint`
>    - DH Studio Pro: `npm test` và `cargo test --manifest-path src-tauri/Cargo.toml`

---

## 1. Vận chuyển và bảo mật

- **Đường dẫn Unix domain socket:**
  `~/Library/Application Support/Devhouse/bridges/dh-studio-pro.sock`
- **Quyền tệp:** thư mục cha `0700`, tệp socket `0600`.
- **Xác thực tiến trình gọi:** máy chủ (DH Studio Pro) bắt buộc kiểm tra `uid` của tiến trình kết nối (`getpeereid` trên macOS / `SO_PEERCRED` trên Linux) phải trùng `geteuid()` hiện tại; từ chối ngay nếu khác user.
- **Đóng khung (Framing):** JSON theo từng dòng kết thúc bằng `\n` (NDJSON, UTF-8), giới hạn tối đa 4 MiB mỗi dòng.
- **Vòng đời kết nối:** mỗi lời gọi RPC mở một kết nối mới:
  1. Client gửi đúng 1 dòng JSON yêu cầu.
  2. Server gửi `0..N` dòng `type: "progress"`.
  3. Server gửi đúng 1 dòng `type: "result"` hoặc `type: "error"`, flush rồi đóng kết nối.

---

## 2. Cơ chế khởi chạy ngầm và đóng sạch

- **Bundle ID của DH Studio Pro:** `com.minhvuong.devtool`
- **Tùy chọn bật/tắt trong DHbox:** Mặc định tắt (`FeatureFlags.dhStudioBridgeEnabled = false`), người dùng tự bật trong `Cài đặt -> Hệ sinh thái DH` (kèm chú thích cần tải và cài đặt DH Studio Pro mới dùng được). Khi tắt, `FinderSyncExtension` ẩn mục `DH Studio Pro: Contact the Sheet` khỏi menu DHbox (qua `AgentRequest.finderBridgeEnabled` + thông báo `com.dh.DHbox.finderMenuChanged`), và `FinderServices` chặn không bật ngầm DH Studio Pro nếu gọi từ menu Dịch vụ.
- **Khởi chạy ngầm từ DHbox:**
  1. DHbox gọi `bridge.ping` trước (timeout ngắn). Nếu đang chạy, nối thẳng.
  2. Nếu chưa chạy, DHbox tìm ứng dụng theo bundle ID và chạy với tham số `--background` (`activates = false`, `hides = true`, `addsToRecentItems = false`).
  3. Khi nhận `--background`, DH Studio Pro:
     - Giữ cửa sổ `main` ở trạng thái ẩn (`visible: false` trong `tauri.conf.json`, không gọi `show()`).
     - Trên macOS chuyển `ActivationPolicy::Accessory` để không nhảy icon trên Dock.
     - Vẫn nạp WebView ngầm để khôi phục phiên đăng nhập, bản quyền, cấu hình Contact the Sheet và phiên Google OAuth, rồi báo `webviewReady = true`.
     - Mở socket cầu nối ngay trong `setup`.
  4. Nếu người dùng mở trực tiếp DH Studio Pro hoặc DHbox gọi `bridge.show_window`, DH Studio Pro khôi phục `ActivationPolicy::Regular` và hiện cửa sổ chính bình thường.
- **Đóng sau khi hoàn tất:**
  - Khi DH Studio Pro được DHbox mở ngầm (hoặc cửa sổ chính vẫn đang ẩn), sau khi người dùng thực thi xong hoặc khi đóng cửa sổ Contact the Sheet bên DHbox, DHbox hiện hộp thoại xác nhận đóng DH Studio Pro.
  - Khi người dùng xác nhận đóng, DHbox gửi `bridge.shutdown` để DH Studio Pro dọn socket và thoát sạch (`app.exit(0)`), không ẩn xuống khay hệ thống.

---

## 3. Cấu trúc bản tin

### Yêu cầu (Client -> Server)

```json
{
  "protocolVersion": 1,
  "id": "uuid-v4",
  "action": "contact_sheet.scan",
  "params": {}
}
```

### Tiến trình (Server -> Client, tùy chọn, có thể nhiều dòng)

```json
{
  "protocolVersion": 1,
  "id": "uuid-v4",
  "type": "progress",
  "progress": {
    "current": 30,
    "total": 100,
    "message": "Đang tải dữ liệu Google Sheet (2 tab)..."
  }
}
```

### Kết quả thành công (Server -> Client)

```json
{
  "protocolVersion": 1,
  "id": "uuid-v4",
  "type": "result",
  "data": {}
}
```

### Lỗi (Server -> Client)

```json
{
  "protocolVersion": 1,
  "id": "uuid-v4",
  "type": "error",
  "error": {
    "code": "NOT_AUTHENTICATED",
    "message": "Bạn chưa đăng nhập DH Studio Pro."
  }
}
```

### Mã lỗi chuẩn

| Mã lỗi | Ý nghĩa |
|---|---|
| `INVALID_REQUEST` | JSON sai định dạng hoặc thiếu tham số bắt buộc |
| `UNKNOWN_ACTION` | Action không được hỗ trợ ở phiên bản này |
| `BRIDGE_NOT_READY` | WebView của DH Studio Pro chưa khởi tạo xong |
| `NOT_AUTHENTICATED` | Chưa đăng nhập tài khoản DH Studio Pro |
| `ENTITLEMENT_DENIED` | Tài khoản không có quyền dùng Contact the Sheet |
| `NO_ACTIVE_PROFILE` | Chưa có cấu hình Sheet đang hoạt động |
| `GOOGLE_NOT_CONNECTED` | Chưa kết nối tài khoản Google (khi không ở chế độ thử nghiệm) |
| `NO_TABS_SELECTED` | Chưa chọn tab nào để quét |
| `BUSY` | Đang có phiên quét hoặc thực thi khác chạy |
| `TIMEOUT` | Quá thời gian chờ phản hồi từ WebView |
| `INTERNAL_ERROR` | Lỗi phát sinh khi xử lý nghiệp vụ |

---

## 4. Danh sách Action (v1)

### 4.1 Vòng đời cầu nối (xử lý trực tiếp trong Rust `src-tauri/src/bridge.rs`)

#### `bridge.ping`
- `params`: `{}`
- `data`:
  ```json
  {
    "app": "dh-studio-pro",
    "appVersion": "3.4.2",
    "protocolVersion": 1,
    "pid": 12345,
    "webviewReady": true,
    "launchedInBackground": true,
    "mainWindowVisible": false
  }
  ```

#### `bridge.show_window`
- `params`: `{ "module": "contact-the-sheet", "tab": "workspace" | "batch" | "drive" | "audit" }` (cả hai trường tùy chọn)
- `data`: `{ "shown": true }`

#### `bridge.shutdown`
- `params`: `{ "onlyIfHidden": false }` (tùy chọn, mặc định `false`)
- `data`: `{ "shuttingDown": true, "reason": null }` hoặc `{ "shuttingDown": false, "reason": "WINDOW_VISIBLE" }`

### 4.2 Contact the Sheet (chuyển tiếp sang `src/modules/contact-the-sheet/services/contactSheetBridge.ts`)

#### `contact_sheet.get_context`
- `params`: `{}`
- `data`: `ContactSheetContext`:
  ```json
  {
    "authenticated": true,
    "userEmail": "user@studio.vn",
    "hasAccess": true,
    "accessReason": "ENTITLEMENT_ACTIVE",
    "google": {
      "status": "CONNECTED",
      "accountEmail": "studio@gmail.com",
      "hasDriveAccess": true,
      "hasSheetsAccess": true
    },
    "profiles": [
      {
        "id": "profile_id",
        "displayName": "Studio Chính",
        "spreadsheetId": "...",
        "spreadsheetTitle": "Lịch Edit",
        "selectedTabTitle": "Edit 11/2026",
        "headerRow": 3,
        "isMockSandbox": false
      }
    ],
    "activeProfile": {
      "id": "profile_id",
      "displayName": "Studio Chính",
      "spreadsheetId": "...",
      "spreadsheetTitle": "Lịch Edit",
      "selectedTabTitle": "Edit 11/2026",
      "headerRow": 3,
      "isMockSandbox": false,
      "availableTabTitles": ["Edit 11/2026"],
      "selectedTabTitles": ["Edit 11/2026"],
      "writableColumns": [
        { "columnLetter": "N", "columnHeader": "Tên Edit", "semanticField": "FINAL_FOLDER_NAME" }
      ],
      "driveLocalRootPath": "/Users/mac/..."
    },
    "jobs": [],
    "plans": {}
  }
  ```

#### `contact_sheet.select_profile`
- `params`: `{ "profileId": "profile_id" }`
- `data`: `ContactSheetContext` sau khi chuyển profile.

#### `contact_sheet.remove_tab`
- `params`: `{ "tabTitle": "Edit 10/2026" }`
- `data`: `ContactSheetContext` sau khi gỡ tab khỏi danh sách cấu hình batch.

#### `contact_sheet.undo_apply_all_tabs`
- `params`: `{}`
- `data`: `ContactSheetContext` sau khi hoàn tác áp dụng cho tất cả tab.

#### `contact_sheet.scan`
- `params`:
  ```json
  {
    "paths": ["/path/to/folder1", "/path/to/folder2"],
    "tabTitles": ["Edit 11/2026"],
    "replaceExisting": true
  }
  ```
- Streams `progress` (`current`, `total`, `message`).
- `data`:
  ```json
  {
    "resolvedPaths": ["/path/to/folder1"],
    "jobs": [],
    "plans": {}
  }
  ```
  Trong đó `jobs` theo đúng schema `DiscoveredJob` và `plans` là `Record<string, UpdatePlan>` của DH Studio Pro.

#### `contact_sheet.resolve_conflict`
- `params`:
  - Đơn lẻ: `{ "jobId": "job_1", "policy": "OVERWRITE" | "APPEND" | "SKIP" }`
  - Hàng loạt: `{ "bulk": true, "policy": "OVERWRITE" | "APPEND" | "SKIP" }`
- `data`: `{ "jobs": [], "plans": {} }`

#### `contact_sheet.assign_row`
- `params`:
  ```json
  {
    "jobId": "job_1",
    "rowNumber": 14,
    "tabTitle": "Edit 11/2026",
    "rowSnapshot": { "C": "Tên khách" }
  }
  ```
- `data`: `{ "jobs": [], "plans": {} }`

#### `contact_sheet.update_job_action`
- `params`: `{ "operation": "skip" | "restore" | "remove" | "clear_all", "jobId": "job_1" }` (`jobId` bắt buộc trừ `clear_all`)
- `data`: `{ "jobs": [], "plans": {} }`

#### `contact_sheet.execute`
- `params`: `{ "jobIds": ["job_1"] }` (`jobIds` tùy chọn; bỏ trống thì thực thi toàn bộ job `READY` hiện có)
- Streams `progress` (`current`, `total`, `message`).
- `data`:
  ```json
  {
    "summary": {
      "batchId": "batch_...",
      "startedAt": "2026-11-20T05:00:00.000Z",
      "finishedAt": "2026-11-20T05:00:03.000Z",
      "totalPlanned": 2,
      "successCount": 2,
      "conflictCount": 0,
      "skippedCount": 0,
      "failedCount": 0,
      "errors": []
    },
    "jobs": [],
    "plans": {}
  }
  ```
