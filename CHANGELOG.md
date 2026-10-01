# 📋 Lịch Sử Cập Nhật & Phát Hành (Changelog)

Tất cả các bản phát hành của **MVD Studio Suite / Photo Picker Pro** đều được ghi lại chi tiết tại đây. Mỗi bản cập nhật đều mang sứ mệnh nâng cao hiệu năng, ổn định hệ thống và mang lại trải nghiệm tối ưu nhất cho Studio & Photographer.

## [v2.6.7] - 2026-10-01

### Trong bản cập nhật này, chúng tôi đã:

#### 🚀 Tính năng mới
- **Tự động mở rộng & nhận diện thư mục khách hàng thông minh (Contact The Sheet):** Khi kéo thả thư mục lớn chứa nhiều thư mục buổi chụp của các khách hàng, hệ thống Rust đa luồng tự động quét và phân tách chính xác từng thư mục khách hàng con, không cần chọn thủ công từng thư mục riêng lẻ.
- **Trạng thái xử lý trực quan (Expanding Loading UX):** Bổ sung biểu tượng loading và thông báo hướng dẫn thời gian thực khi hệ thống đang phân tích cấu trúc thư mục lớn.

#### ⚡ Cải thiện & Tối ưu
- **Cơ chế Kéo - Thả (Drag & Drop) Native bền bỉ:** Tối ưu hóa bộ bắt sự kiện kéo thả tệp tin trên macOS và Windows (`onDragDropEvent` với fallback sự kiện native), loại bỏ tình trạng mất sự kiện khi kéo nhanh.
- **Hệ thống phát hành tự động chuyên nghiệp (Automated Release Notes):** Nâng cấp pipeline phát hành và Auto-updater để tự động trích xuất và hiển thị nội dung cập nhật chi tiết trên GitHub Releases và hộp thoại cập nhật trong ứng dụng.

#### 🛠️ Sửa lỗi hệ thống
- Khắc phục sự cố nhận diện đường dẫn thư mục lồng nhau khi chứa ký tự đặc biệt hoặc tiếng Việt có dấu.
- Bổ sung bộ kiểm thử tự động (Unit Test Suite) xác thực thuật toán phân tích cây thư mục khách hàng.

---

## [v2.6.6] - 2026-10-01

### Trong bản cập nhật này, chúng tôi đã:

#### ⚡ Cải thiện & Tối ưu
- **Đồng bộ phiên làm việc theo mốc 0h00 đêm (Giờ VN):** Tự động đồng bộ và gia hạn phiên đăng nhập định kỳ lúc 0h00 hàng ngày trên tất cả các loại tài khoản, đảm bảo tính nhất quán và bảo mật phiên làm việc xuyên suốt hệ sinh thái.
- **Tối ưu kết nối Socket thời gian thực:** Giảm thiểu tối đa việc kiểm tra trạng thái lặp thừa qua HTTP, ưu tiên luồng sự kiện tức thời.

---

## [v2.6.5] - 2026-09-30

### Trong bản cập nhật này, chúng tôi đã:

#### ⚡ Cải thiện & Tối ưu
- **Trải nghiệm hết hạn gói dịch vụ thân thiện:** Khi gói tài khoản hết hạn, hệ thống không tự động đăng xuất người dùng ra màn hình login mà hiển thị lớp phủ thông báo hết hạn kèm nút gia hạn / nhập key nhanh ngay trong app.
- **Bảo toàn giao diện cài đặt:** Cho phép người dùng vẫn truy cập được vào Cài đặt để quản lý tài khoản và bản quyền kể cả khi gói dịch vụ đã kết thúc.

---

## [v2.6.4] - 2026-09-29

### Trong bản cập nhật này, chúng tôi đã:

#### 🛠️ Sửa lỗi hệ thống
- Khắc phục sự cố tương thích khi build updater json đa nền tảng (macOS Apple Silicon, Intel & Windows NSIS).
- Cải thiện tốc độ tải gói cập nhật tự động.

---

## [v2.6.3] - 2026-09-28

### Trong bản cập nhật này, chúng tôi đã:

#### 🚀 Tính năng mới
- **Hiệu ứng chúc mừng kích hoạt bản quyền:** Bổ sung âm thanh và hiệu ứng pháo hoa chúc mừng khi người dùng nhập License Key hoặc nâng cấp gói thành công.

#### ⚡ Cải thiện
- Tinh chỉnh giao diện Light Mode (sáng) trên toàn bộ các modal quản lý bản quyền, lịch sử giao dịch và tài khoản.

---

## [v2.6.0] - 2026-09-22

### Trong bản cập nhật này, chúng tôi đã:

#### 🚀 Tính năng mới
- **Tái định vị thương hiệu MVD Tech & Design Studio:** Nâng cấp nhận diện thương hiệu thành bộ ứng dụng studio chuyên nghiệp.
- **Dock Icon động trên macOS:** Biểu tượng app trên thanh Dock tự động thay đổi theo trạng thái ứng dụng.
- **Hệ thống phân quyền theo từng Sub-App:** Hỗ trợ linh hoạt các gói lẻ (Photo Picker) và gói trọn bộ (Full Suite).

---

> [!TIP]
> **Quy chuẩn phát hành:** Từ phiên bản này trở đi, mọi bản release mới đều bắt buộc phải ghi rõ nội dung theo cấu trúc:
> - `### Trong bản cập nhật này, chúng tôi đã:`
> - `#### 🚀 Tính năng mới`
> - `#### ⚡ Cải thiện & Tối ưu`
> - `#### 🛠️ Sửa lỗi hệ thống`
