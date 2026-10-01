# Hướng Dẫn Đóng Gói Và Xuất Bản Ứng Dụng (Tauri + Github Actions)

Tài liệu này hướng dẫn bạn cách tạo ra một phiên bản mới của ứng dụng **Photo Picker Pro**, đóng gói nó cho Windows/MacOS và xuất bản lên Github để tính năng **Tự động cập nhật (Auto Updater)** có thể nhận diện và tải về cho người dùng.

> [!IMPORTANT]
> Toàn bộ quá trình build và đóng gói sẽ được chạy tự động trên máy chủ của Github thông qua tính năng Github Actions. Bạn không cần phải treo máy để tự build!

---

## 🔑 Bước 1: Chuẩn bị Khóa bảo mật (Chỉ làm 1 lần duy nhất)

Ứng dụng Tauri yêu cầu các file cập nhật phải được "ký" (sign) bằng một khóa bảo mật để đảm bảo không ai có thể can thiệp và chèn mã độc vào file cập nhật của bạn.

Nếu bạn chưa thiết lập khóa trên Github, hãy làm như sau:
1. Truy cập vào trang quản lý Repository của bạn trên Github: `minhvuogdzz/photo-picker-pro`
2. Chọn **Settings** (cài đặt) ở thanh ngang trên cùng.
3. Ở menu bên trái, cuộn xuống chọn **Secrets and variables** > **Actions**.
4. Nhấn nút màu xanh **New repository secret** và thêm 2 khóa sau:
   - Tên (Name): `TAURI_PRIVATE_KEY` 
     - Giá trị (Secret): Mở file `.key` (khóa bí mật) mà bạn từng tạo bằng lệnh `tauri signer generate` trên máy bạn, copy toàn bộ nội dung và dán vào đây.
   - Tên (Name): `TAURI_KEY_PASSWORD`
     - Giá trị (Secret): Mật khẩu mà bạn đã đặt khi tạo khóa (nếu lúc đó bạn để trống mật khẩu thì không cần tạo secret này hoặc để giá trị rỗng).

> [!TIP]
> Khóa công khai (Public Key) tương ứng đã được mình thiết lập sẵn trong file `src-tauri/tauri.conf.json` (`"pubkey": "dW50..."`). Bạn không cần quan tâm đến nó nữa.

---

## 🚀 Bước 2: Nâng Phiên Bản & Viết Release Notes Chi Tiết

Mỗi khi sửa lỗi hoặc thêm tính năng xong và muốn phát hành, bắt buộc phải nâng số phiên bản và **ghi rõ nội dung cập nhật chi tiết** để người dùng biết được những cải tiến trong phiên bản mới.

1. **Cập nhật số phiên bản ở 2 file:**
   - `photo-picker-pro/package.json`
   - `photo-picker-pro/src-tauri/tauri.conf.json`
   *(Lưu ý: Số phiên bản ở cả 2 file phải hoàn toàn khớp nhau, ví dụ: `"2.6.7"`).*

2. **Cập nhật file `photo-picker-pro/CHANGELOG.md`:**
   Thêm mục phiên bản mới nhất lên đầu file theo đúng cấu trúc tiêu chuẩn:
   ```markdown
   ## [v2.6.7] - YYYY-MM-DD

   ### Trong bản cập nhật này, chúng tôi đã:

   #### 🚀 Tính năng mới
   - Thêm tính năng A giúp studio xử lý B nhanh hơn...

   #### ⚡ Cải thiện & Tối ưu
   - Tối ưu hóa hiệu suất lọc ảnh và giảm 30% bộ nhớ...

   #### 🛠️ Sửa lỗi hệ thống
   - Khắc phục sự cố không thể đồng bộ dữ liệu khi...
   ```

*(Hệ thống Auto Updater sẽ tự động đọc nội dung này từ `CHANGELOG.md` để hiển thị trực tiếp trong hộp thoại cập nhật của người dùng và cập nhật lên trang GitHub Releases!)*

---

## 📦 Bước 3: Đẩy Code và Kích hoạt Build Tự Động

Mở Terminal và chạy lần lượt các lệnh sau:

**1. Lưu tất cả thay đổi (Commit):**
```bash
git add .
git commit -m "chore(release): bump v2.6.7 - cập nhật tính năng và tài liệu phát hành"
```

**2. Gắn nhãn phiên bản (Tạo Tag có chú thích):**
> [!IMPORTANT]
> Tên Tag **bắt buộc** phải bắt đầu bằng chữ `v` và khớp với phiên bản bạn vừa sửa (ví dụ: `v2.6.7`).
> Bạn có thể gắn tag nhanh kèm ghi chú vắn tắt (hệ thống sẽ tự động lấy chi tiết từ `CHANGELOG.md`):

```bash
git tag -a v2.6.7 -m "Release v2.6.7"
```

**3. Đẩy code và Tag lên Github để kích hoạt đóng gói tự động:**
```bash
git push origin main
git push origin v2.6.7
```

---

## ⏳ Bước 4: Chờ Đợi và Kiểm Tra Kết Quả

Ngay sau khi bạn chạy lệnh `git push origin v1.0.11`, Github sẽ lập tức khởi tạo một máy chủ ảo để build ứng dụng của bạn.

1. Bạn có thể mở trang repo trên Github, chuyển sang tab **Actions** để xem tiến trình.
2. Quá trình này thường mất khoảng **10 đến 15 phút** vì Github sẽ build song song cho cả MacOS (chip Intel + Apple Silicon) và Windows.
3. Khi vòng tròn chuyển sang dấu **Tick màu xanh lá (✅)**, quá trình build đã hoàn tất!

Lúc này, Github đã tự động tạo một mục trong trang **Releases**. Mục này sẽ chứa:
- File cài đặt cho MacOS (`.dmg`, `.app.tar.gz`)
- File cài đặt cho Windows (`.exe`, `.msi.zip`)
- File chữ ký (`.sig`)
- File quan trọng nhất: `latest.json` (File này chứa thông tin cho app của người dùng biết là có bản cập nhật mới).

---

## 🎯 Hoàn tất! Người Dùng Sẽ Thấy Gì?

Khi bước 4 hoàn tất, bất kỳ ai đang sử dụng **Photo Picker Pro** bản cũ (ví dụ `1.0.10`), chỉ cần họ mở app lên (hoặc đang mở sẵn), tính năng Auto Updater sẽ quét và hiện lên **Bảng thông báo cập nhật**.

Nếu người dùng đã check vào ô "Tự động tải xuống" trong cài đặt, app sẽ tự động tải file `.tar.gz` về và hỏi người dùng khởi động lại để áp dụng. Nếu không, người dùng sẽ tự bấm "Cập nhật ngay".

Chúc bạn thành công xuất bản ứng dụng!
