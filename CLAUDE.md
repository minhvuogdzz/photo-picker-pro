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

1. **Không đổi tên hoặc xóa action/field trong hợp đồng v1** (`bridge.ping`, `bridge.show_window`, `bridge.shutdown`, `contact_sheet.*`) và đường dẫn socket `~/Library/Application Support/Devhouse/bridges/dh-studio-pro.sock` nếu không cập nhật đồng thời cả hai repo (`DH Studio Pro` và `DHbox`).
2. **Mọi trường dữ liệu mới thêm vào phản hồi bridge phải là tùy chọn (optional)** để giữ tương thích ngược.
3. **Giữ nguyên chế độ khởi chạy ngầm `--background` và vòng đời cửa sổ macOS:**
   - Cửa sổ `main` trong `src-tauri/tauri.conf.json` phải giữ `"visible": false` để khi DHbox mở ngầm bằng `--background` (hoặc `--autostart`), cửa sổ không bị nháy trên màn hình.
   - `src-tauri/src/lib.rs` chỉ gọi `tray::show_main_window` khi khởi chạy bình thường (không có `--background` / `--autostart`).
   - Trên macOS, `--background` đặt `ActivationPolicy::Accessory`; khi hiện cửa sổ chính (`tray::show_main_window` / `bridge.show_window` / `show_main_window_from_tray`), phải khôi phục `ActivationPolicy::Regular`, đặt lại `alphaValue = 1.0`, `ignoresMouseEvents = NO`, và gọi `[NSApp unhide:]` + `[NSApp activateIgnoringOtherApps:YES]` (`macos_activate_main_window`).
   - **Không xóa `HiddenWakeGuard` trong `src-tauri/src/bridge.rs` / `src-tauri/src/dock_icon.m`:** macOS App Nap & WebKit Occlusion sẽ tạm dừng JS/`fetch()` trong cửa sổ ẩn sau ~5 giây nếu không giữ `NSProcessInfo` activity và đánh thức cửa sổ `main` ở chế độ vô hình xuyên chuột (`alphaValue = 0.001`, `orderFrontRegardless`) trong lúc xử lý yêu cầu `contact_sheet.*`. Luôn dùng `BridgeState::is_main_window_visible()` thay vì `window.is_visible()` cho `bridge.ping` và `bridge.shutdown`.
   - **Không bao giờ để `CloseRequested` hủy `"main"` trong khi `"tray-panel"` giữ tiến trình sống:** trong `lib.rs`, `"tray-panel"` luôn ẩn + `prevent_close()`; với `"main"`, nếu `close_to_tray == true` thì ẩn + `prevent_close()`, còn `close_to_tray == false` phải `cleanup_socket()` + `app.exit(0)` để không để lại tiến trình ma không mở lại được cửa sổ.
   - `initContactSheetBridge()` trong `src/App.tsx` phải luôn được đăng ký ở tầng gốc (không phụ thuộc việc người dùng đã mở tab Contact the Sheet hay chưa) và gọi `bridge_mark_ready` sau khi gắn listener.
4. **Bảo mật cầu nối:** `bridge.rs` chỉ tạo socket quyền `0600` trong thư mục `0700` và luôn kiểm tra `uid` của tiến trình kết nối (`getpeereid` / `SO_PEERCRED`).
5. **Kiểm tra sau khi sửa:** Luôn chạy `npm test`, `npm run build`, và `cargo test --manifest-path src-tauri/Cargo.toml`, đồng thời cập nhật `CHANGELOG.md` và `docs/DH_BRIDGE.md` nếu thay đổi hành vi cầu nối.
