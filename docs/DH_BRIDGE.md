# DH Ecosystem Bridge Protocol (v1)

Tài liệu đặc tả hợp đồng giao tiếp cục bộ giữa **DHbox** (macOS native Swift) và **DH Studio Pro** (Tauri v2 / Rust / React).
Bản đặc tả này được giữ đồng bộ ở cả hai kho mã:
- `DHbox/docs/DH_BRIDGE.md`
- `DH Studio Pro/docs/DH_BRIDGE.md`

> Quy tắc bắt buộc cho mọi phiên phát triển (kể cả khi giao tiếp cho agent khác chỉ mở một kho mã):
> 1. **Không tự ý đổi tên, xóa hoặc đổi kiểu dữ liệu** của `socketPath`, `protocolVersion`, tên `action`, mã lỗi, hoặc bất kỳ khóa JSON nào đã công bố trong tài liệu này nếu không cập nhật đồng thời cả hai kho mã và tăng `protocolVersion` khi phá vỡ tương thích ngược.
> 2. **Trường mới phải là tùy chọn (optional)** để hai phiên bản lệch nhẹ vẫn nói chuyện được.
> 3. **Không sao chép logic nghiệp vụ** của Contact the Sheet hay Photo Picker Pro sang DHbox. DHbox chỉ là bề mặt Finder và giao diện hiển thị gọn; toàn bộ cấu hình Sheet, Google OAuth, bản quyền, phân tích mã, quét, đối soát, chép ảnh và ghi Google Sheets chạy trong DH Studio Pro.
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
- **Tùy chọn bật/tắt trong DHbox:** Mặc định tắt (`FeatureFlags.dhStudioBridgeEnabled = false`), người dùng tự bật trong `Cài đặt -> Hệ sinh thái DH` (kèm chú thích cần tải và cài đặt DH Studio Pro mới dùng được). Khi tắt, `FinderSyncExtension` ẩn các mục `DH Studio Pro: Contact the Sheet` và `DH Studio Pro: Lọc ảnh` (`DH Studio Pro: Photo picker`) khỏi menu DHbox (qua `AgentRequest.finderBridgeEnabled` + thông báo `com.dh.DHbox.finderMenuChanged`), và `FinderServices` chặn không bật ngầm DH Studio Pro nếu gọi từ menu Dịch vụ. Riêng `DH Studio Pro: Lọc ảnh` chỉ hiển thị khi chọn đúng 1 thư mục khách (chế độ lọc 1 khách).
- **Khởi chạy ngầm từ DHbox:**
  1. DHbox gọi `bridge.ping` trước (timeout ngắn). Nếu đang chạy, nối thẳng.
  2. Nếu chưa chạy, DHbox tìm ứng dụng theo bundle ID và chạy với tham số `--background` (`activates = false`, `addsToRecentItems = false`). **Không đặt `config.hides = true`** vì `[NSApp hide:]` làm macOS kích hoạt App Nap và tạm dừng tiến trình WebKit của cửa sổ nền ngay lập tức.
  3. Khi nhận `--background`, DH Studio Pro:
     - Giữ cửa sổ `main` ở trạng thái ẩn (`visible: false` trong `tauri.conf.json`, không gọi `show()`, `BridgeState::main_window_visible = false`).
     - Trên macOS chuyển `ActivationPolicy::Accessory` để không nhảy icon trên Dock.
     - Vẫn nạp WebView ngầm để khôi phục phiên đăng nhập, bản quyền, cấu hình Contact the Sheet và phiên Google OAuth, rồi báo `webviewReady = true`.
     - Mở socket cầu nối ngay trong `setup`.
  4. **Chống treo WebKit khi chạy ngầm trên macOS (`HiddenWakeGuard`):** Khi nhận yêu cầu `contact_sheet.*` hoặc `photo_picker.*` trong lúc cửa sổ `main` đang ẩn, `src-tauri/src/bridge.rs` (kết hợp `src-tauri/src/dock_icon.m`) bật `NSProcessInfo` activity (`NSActivityUserInitiatedAllowingIdleSystemSleep | NSActivityLatencyCritical`) và tạm đưa cửa sổ `main` sang trạng thái không bị che khuất nhưng vô hình, xuyên chuột, không chiếm focus (`alphaValue = 0.001`, `ignoresMouseEvents = YES`, `hasShadow = NO`, `excludedFromWindowsMenu = YES`, `Transient | IgnoresCycle`, `orderFrontRegardless`) trong đúng thời gian yêu cầu đang chạy, sau đó `orderOut` ngay khi `Drop`. Do đó `bridge.ping` và `bridge.shutdown` bắt buộc đọc cờ `BridgeState::main_window_visible` thay vì `window.is_visible()`. Hạn chờ 180 giây của `forward_to_webview` tự đặt lại mỗi khi nhận sự kiện `progress`, giúp sao chép lô ảnh RAW lớn không bị ngắt oan trong khi vẫn bắt được yêu cầu bị treo.
  5. **Vòng đời đóng/mở lại cửa sổ trên macOS (`lib.rs`, `tray.rs`):**
     - Không bao giờ để `"main"` bị hủy trong khi `"tray-panel"` giữ tiến trình sống thành trạng thái ma (icon Menu Bar còn nhưng không mở lại được cửa sổ chính). Khi đóng `"main"` (`X` / `Cmd+W`): nếu `close_to_tray == true` thì ẩn `"main"` và `prevent_close()`; nếu `close_to_tray == false` thì dọn socket và gọi `app.exit(0)`. Cửa sổ `"tray-panel"` luôn chỉ ẩn (`prevent_close()`).
     - Khi người dùng mở trực tiếp DH Studio Pro (Dock `RunEvent::Reopen`, Menu Bar, Control Hub) hoặc DHbox gọi `bridge.show_window`, `tray::show_main_window` luôn chỉ thao tác cửa sổ `"main"`, khôi phục `ActivationPolicy::Regular`, trả lại alpha/mouseEvents/shadow và gọi `[NSApp unhide:]` + `[NSApp activateIgnoringOtherApps:YES]`.
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

### 4.3 Photo Picker Pro — Lọc 1 khách (chuyển tiếp sang `src/modules/photo-picker/services/photoPickerBridge.ts`, riêng `photo_picker.cancel` xử lý trực tiếp trong `bridge.rs`)

Mọi thao tác ở nhóm này luôn ép `pickerMode = "single"` (không dùng hàng đợi nhiều khách, Check TT, Auto Find chuyển khách tự động hay Mini Trash Bin). Khi mở từ chuột phải Finder trên 1 thư mục khách, DHbox gọi `photo_picker.get_context` -> `photo_picker.set_folder` -> tự động gọi `photo_picker.scan_and_match` (với danh sách mã rỗng) để quét sẵn toàn bộ ảnh trong thư mục vào RAM; ngay khi người dùng dán mã hoặc truy xuất mã từ Google Sheet, `photo_picker.set_codes` đối chiếu tức thì trong RAM.

#### `photo_picker.get_context`
- `params`: `{}`
- `data`: `PhotoPickerBridgeContext` (trạng thái đăng nhập, bản quyền `photo-picker`, kết nối Google, hồ sơ Sheet rút gọn, `folderPath`, `folderName`, `rawCodeInput`, `parsedCodeCount`, `scannedFilesCount`, `phase`, `matchMode`, `regexPattern`, `scanOptions`, `inheritExtensionEnabled`, `inheritedExtensions`, `outputMode`, `outputFolder`, `sheetFilterContext`, `sheetUpdateStatus`, `matchResult`, `lineAnalysis`, `copyResult`).

#### `photo_picker.set_folder`
- `params`: `{ "folderPath": "/path/to/customer" }`
- `data`: `PhotoPickerBridgeContext` (đặt `pickerMode = "single"`, nạp thư mục khách mới và dọn trạng thái phiên khách cũ nếu đổi thư mục).

#### `photo_picker.format_codes`
- `params`: `{ "text": "IMG_1001-1002, 1005" }`
- `data`: `{ "formatted": "IMG_1001\n1002\n1005" }` (dùng nguyên `formatPastedCodes` của DH Studio Pro).

#### `photo_picker.set_codes`
- `params`: `{ "rawCodeInput": "1001\n1002" }`
- `data`: `{ "rawCodeInput", "parsedCodeCount", "phase", "matchResult", "lineAnalysis" }` (chạy `parse_customer_codes`, nếu thư mục đã quét trong RAM thì khớp tức thì bằng `match_photos` và phân tích từng dòng bằng `analyzeCodeInputLines`).

#### `photo_picker.set_options`
- `params`: các trường tùy chọn `{ "matchMode", "regexPattern", "scanOptions", "inheritExtensionEnabled", "inheritedExtensions", "outputMode", "outputFolder", "autoRescan" }`. Khi đổi `outputFolder`, đồng bộ lưu ngược vào `default_output` của `settings.json` trong DH Studio Pro. Khi đổi `scanOptions` trong lúc đã có kết quả quét và `autoRescan !== false`, tự quét lại và stream `progress`.
- `data`: `PhotoPickerBridgeContext`.

#### `photo_picker.scan_and_match`
- `params`: `{ "forceRescan": false }` (tùy chọn)
- Streams `progress` (`scan-progress` và `match-progress`).
- `data`: `PhotoPickerBridgeContext` kèm `elapsedMs`.

#### `photo_picker.sheet_tabs`
- `params`: `{}`
- `data`: `{ "sheetProfile", "availableTabs", "checkedTabs", "completedStatusValue" }`.

#### `photo_picker.sheet_extract`
- `params`: `{ "folderName"?, "tabTitles"?, "preferredRow"?: { "tabTitle", "row" }, "forceFresh"? }`
- Streams `progress`.
- `data`: kết quả `extractCodesAcrossTabs` (`status`, `matchedRow`, `matchedTabTitle`, `customerName`, `jobFolderName`, `confidence`, `reason`, `candidateColumns`, `defaultSelectedColumns`, `candidateRows`, `sameFileRows`, `searchedTabs`, `failedTabs`, `totalLoadedRows`, `statusColumnLetter`, `statusColumnWritable`, `completedStatusValue`).

#### `photo_picker.sheet_apply_codes`
- `params`: `{ "columnLetters": ["I"], "mode": "replace" | "append", "updateStatusOnCopy": true, "tabTitle"?, "matchedRow"?, "statusColumnLetter"?, "statusValue"?, "candidateColumns"? }`
- `data`: `PhotoPickerBridgeContext` sau khi nạp mã, lưu `sheetFilterContext` và khớp lại tức thì trong RAM.

#### `photo_picker.copy`
- `params`: `{ "operation": "Copy" | "Move", "outputMode"?, "outputFolder"?, "updateSheetStatus": true }`
- Streams `progress` từ `copy-progress` (gồm số tệp, tốc độ, ETA) và cập nhật trạng thái `"Đã lọc"` trên Google Sheet nếu bật.
- `data`: `{ "copyResult", "sheetUpdateStatus", "destinationFolder", "context" }`.

#### `photo_picker.retry_sheet_status`
- `params`: `{}`
- `data`: `{ "sheetUpdateStatus" }`.

#### `photo_picker.cancel`
- Xử lý trực tiếp trong Rust (`bridge.rs`), bật cờ hủy chung `Arc<AtomicBool>` tức thì (< 1ms) cho cả `scan_folders` và `copy_files`.
- `params`: `{}`
- `data`: `{ "cancelled": true }`.

#### `photo_picker.export_report`
- `params`: `{ "format": "txt" | "csv" | "json", "outputPath": "/path/to/report.csv" }`
- `data`: `{ "outputPath" }`.
