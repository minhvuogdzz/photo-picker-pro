# DH Studio Pro

Ứng dụng desktop đa nền tảng (Tauri v2 + Rust + React 19 + TypeScript + Tailwind v4) của **Devhouse Software**, tích hợp các module studio: **Photo Picker Pro**, **Contact the Sheet**, **Chuyển đổi file (`mvd-convert`)**, **Thống kê (`photo-counter`)** và **Kho Tài Nguyên Creative**.

## Lệnh phát triển và kiểm thử

- `npm run dev` — chạy frontend Vite dev server (`http://localhost:1420`)
- `npm run build` — kiểm tra TypeScript (`tsc`) và build frontend (`vite build`)
- `npm test` — chạy toàn bộ unit test TypeScript (`node --experimental-strip-types --test`)
- `cargo test --manifest-path src-tauri/Cargo.toml` — chạy unit test Rust core và bridge
- `npm run tauri dev` — chạy ứng dụng desktop ở chế độ phát triển
- `npm run tauri build` — đóng gói bản phát hành

## Cấu trúc chính

- `src/modules/` — các module ứng dụng (`photo-picker`, `contact-the-sheet`, `mvd-convert`, `photo-counter`, `resources`, `notifications`, `tray-panel`, `system`)
- `src/core/` — đăng nhập, bản quyền (`appEntitlementPolicy.ts`), cập nhật, store Zustand dùng chung
- `src-tauri/src/commands/` — các Tauri command xử lý Rust (`scanner`, `parser`, `matcher`, `copy`, `converter`, `exif_engine`, `sheet_fs`, `sheet_auth`, `photo_counter`, `preview`, `system_monitor`)
- `src-tauri/src/bridge.rs` — cầu nối Unix domain socket cho hệ sinh thái Devhouse (DHbox)
- `DH Studio Pro OAuth - Admin - Web/` — backend NestJS + Admin + Web (`apidhstudio.devhouse.vn`)

## Liên kết hệ sinh thái DH (DHbox <-> DH Studio Pro)

Đặc tả đầy đủ của hợp đồng giao tiếp nằm tại [docs/DH_BRIDGE.md](docs/DH_BRIDGE.md) (bản đồng bộ nằm tại `DHbox/docs/DH_BRIDGE.md`).

### Quy tắc bắt buộc để không phá luồng liên kết

1. **Không đổi tên hoặc xóa action/field trong hợp đồng v1** (`bridge.ping`, `bridge.show_window`, `bridge.shutdown`, `contact_sheet.*`, `photo_picker.*`) và đường dẫn socket `~/Library/Application Support/Devhouse/bridges/dh-studio-pro.sock` nếu không cập nhật đồng thời cả hai repo (`DH Studio Pro` và `DHbox`).
2. **Mọi trường dữ liệu mới thêm vào phản hồi bridge phải là tùy chọn (optional)** để giữ tương thích ngược.
3. **Giữ nguyên chế độ khởi chạy ngầm `--background` và vòng đời cửa sổ macOS:**
   - Cửa sổ `main` trong `src-tauri/tauri.conf.json` phải giữ `"visible": false` để khi DHbox mở ngầm bằng `--background` (hoặc `--autostart`), cửa sổ không bị nháy trên màn hình.
   - `src-tauri/src/lib.rs` chỉ gọi `tray::show_main_window` khi khởi chạy bình thường (không có `--background` / `--autostart`).
   - Trên macOS, `--background` đặt `ActivationPolicy::Accessory`; khi hiện cửa sổ chính (`tray::show_main_window` / `bridge.show_window` / `show_main_window_from_tray`), phải khôi phục `ActivationPolicy::Regular`, đặt lại `alphaValue = 1.0`, `ignoresMouseEvents = NO`, và gọi `[NSApp unhide:]` + `[NSApp activateIgnoringOtherApps:YES]` (`macos_activate_main_window`).
   - **Không xóa `HiddenWakeGuard` trong `src-tauri/src/bridge.rs` / `src-tauri/src/dock_icon.m`:** macOS App Nap & WebKit Occlusion sẽ tạm dừng JS/`fetch()` trong cửa sổ ẩn sau ~5 giây nếu không giữ `NSProcessInfo` activity và đánh thức cửa sổ `main` ở chế độ vô hình xuyên chuột (`alphaValue = 0.001`, `orderFrontRegardless`) trong lúc xử lý yêu cầu `contact_sheet.*` và `photo_picker.*`. Luôn dùng `BridgeState::is_main_window_visible()` thay vì `window.is_visible()` cho `bridge.ping` và `bridge.shutdown`.
   - **Không bao giờ để `CloseRequested` hủy `"main"` trong khi `"tray-panel"` giữ tiến trình sống:** trong `lib.rs`, `"tray-panel"` luôn ẩn + `prevent_close()`; với `"main"`, nếu `close_to_tray == true` thì ẩn + `prevent_close()`, còn `close_to_tray == false` phải `cleanup_socket()` + `app.exit(0)` để không để lại tiến trình ma không mở lại được cửa sổ.
   - `initContactSheetBridge()` trong `src/App.tsx` phải luôn được đăng ký ở tầng gốc (không phụ thuộc việc người dùng đã mở module nào) để điều phối cả `contact_sheet.*` và `photo_picker.*` (`photoPickerBridge.ts`), rồi gọi `bridge_mark_ready` sau khi gắn listener. Riêng `photo_picker.cancel` được xử lý thẳng trong `bridge.rs` để hủy quét/chép tức thì.
4. **Bảo mật cầu nối:** `bridge.rs` chỉ tạo socket quyền `0600` trong thư mục `0700` và luôn kiểm tra `uid` của tiến trình kết nối (`getpeereid` / `SO_PEERCRED`).
5. **Kiểm tra sau khi sửa:** Luôn chạy `npm test`, `npm run build`, và `cargo test --manifest-path src-tauri/Cargo.toml`, đồng thời cập nhật `CHANGELOG.md` và `docs/DH_BRIDGE.md` nếu thay đổi hành vi cầu nối.

## Nguyên tắc đồng bộ ngôn ngữ song song (VI <-> EN)

Mọi thay đổi UI, thông báo, lỗi người dùng, cấu hình, menu khay hệ thống (Tray) hoặc ghi chú phát hành trong DH Studio Pro **bắt buộc phải hỗ trợ song ngữ Việt - Anh (`vi` <-> `en`) ngay tại thời điểm sửa code**:

1. **Trong React component (`.tsx`):** Luôn dùng `useTranslation()` (`t()`, `tr(vi, en)`, `lang`), `getLocaleCode(lang)` để định dạng ngày/số, và `localizeBackendMessage(..., lang)` cho thông điệp trả về từ Rust/backend. Tuyệt đối không hardcode chuỗi tiếng Việt thuần trong JSX, `title`, `placeholder`, `aria-label`, `alert`/`confirm`, hay toast/banner. Nhớ đưa `lang` vào dependency array của `useMemo`/`useCallback` nếu giá trị trả về có text dịch.
2. **Trong TypeScript service, hook và Zustand store (`.ts`):** Dùng `trText(vi, en)`, `translate(key)`, `getCurrentLanguage()`, `getLocaleCode()` import qua **đường dẫn tương đối có đuôi `.ts`** (ví dụ `../../../core/lib/i18n.ts`) để tương thích với `node --experimental-strip-types --test`. Giữ nguyên mặc định `defaultSettings.language === "vi"` trong `src/core/stores/useSettingsStore.ts` khi không có `localStorage`.
3. **Từ điển trung tâm, Release Notes & Registry:**
   - Thêm key vào cả `translations.vi` và `translations.en` trong `src/core/lib/i18n.ts` (được kiểm tra khớp key lúc compile).
   - Khi thêm phiên bản mới vào `src/core/data/versionHistory.ts`, bắt buộc điền đầy đủ `title` + `titleEn` và `items` + `itemsEn`.
   - Giữ thông tin song ngữ trong `src/registry.ts` và `getAvailableGeminiModels(lang)` (`src/core/services/aiSettingsService.ts`).
4. **Native Tray & đồng bộ đa cửa sổ:** Nếu thêm/sửa mục menu Tray hoặc thông báo từ Rust, cập nhật đồng thời `build_tray_menu` / `update_tray_language` (`src-tauri/src/tray.rs`) và `localizeBackendMessage()` (`src/core/lib/i18n.ts`), đồng thời giữ nguyên cơ chế đồng bộ `app-language-changed` + `tray-panel-shown` trong `src/modules/tray-panel/TrayControlPanel.tsx`.
5. **Không dịch các token dữ liệu nghiệp vụ (Domain Data Tokens):** Giữ nguyên tiếng Việt cho chuỗi so khớp Google Sheet (`"Chưa lọc"`, `"Đã lọc"`, `"Đang lọc"`, `"Chờ lọc"`, `"Chưa chụp"`, `"Đang xử lý"`, `"Chưa sửa"`, `"DS Khách"`, `KNOWN_SEMANTIC_ALIASES` trong `sheetDiscoveryService.ts`, `codeHeaderKeywords` trong `sheetExtractorService.ts`, `STANDARD_19_STUDIO_MAPPINGS` trong `useContactSheetStore.ts`), heuristic phân tích tên thư mục (`"màu final"`, `"ảnh gốc"`, `"file gốc"`, `"cọ"`, `"giáo trình"`, `"tài liệu"`), tiền tố mã lỗi (`INVALID_SHEET_URL: `, `GOOGLE_TOKEN_EXPIRED: `, v.v.), và hợp đồng bridge v1 (`contactSheetBridge.ts`).
6. **Kiểm tra bắt buộc trước khi kết thúc tác vụ UI/tính năng:**
   - `node --experimental-strip-types --test tests/i18n/i18n-sync.test.ts` (phải đạt 100%, 0 chuỗi tiếng Việt bị bỏ quên trong `src/**/*.tsx`; nếu là token nghiệp vụ mới thực sự dùng để match Sheet/thư mục thì mới cân nhắc thêm vào `DOMAIN_DATA_TOKENS` trong file test này).
   - `npm run build` (`tsc && vite build`) và `cargo test --manifest-path src-tauri/Cargo.toml`.
