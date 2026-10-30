# 📋 Lịch Sử Cập Nhật & Phát Hành (Changelog)

Tất cả các bản phát hành của **DH Studio Pro** (phát triển & thuộc sở hữu bản quyền của **DevHouse Software**) đều được ghi lại chi tiết tại đây. Mỗi bản cập nhật đều mang sứ mệnh nâng cao hiệu năng, ổn định hệ thống và mang lại trải nghiệm tối ưu nhất cho Studio & Photographer.

## [v2.9.4] - 2026-10-30

### Trong bản cập nhật này, chúng tôi đã:

#### 🎨 Tái thiết lập giao diện Studio Dashboard & Phong cách macOS hiện đại
- **Bảng màu Light Mode & Dark Mode cao cấp:** Tinh chỉnh hệ màu chuẩn theo phong cách macOS, nền canvas mềm mại, thẻ bo tròn mềm mại và bóng mờ tinh tế.
- **Bố cục Hero Card đôi song song:** Hai thẻ tiêu điểm quan trọng nhất (Chỉ số RAM/Bộ nhớ hệ thống & Kho Tài Nguyên Creative) được mở rộng kích thước đặt song song ở hàng trên cùng.
- **Khối ứng dụng Studio dạng mini-card:** 4 ứng dụng cốt lõi (Photo Picker Pro, Contact The Sheet, MVD Convert, Thống kê) được chuyển đổi thành các khối nhỏ xinh, cân đối và hiển thị trọn vẹn thông tin nghiệp vụ.
- **Căn giữa giao diện thông minh:** Tự động căn giữa nội dung theo chiều dọc và chiều ngang, thu gọn khoảng cách (gap) giữa các thẻ, mang lại bố cục hoàn hảo trên màn hình rộng không còn khoảng trống chết.

#### 🧭 Hệ thống Thanh bên sinh thái (Ecosystem Sidebar) & Hub người dùng
- **Nhận diện thương hiệu nguyên bản:** Đảm bảo chính xác thương hiệu **DH Studio Pro** cùng đơn vị phát triển **DevHouse Software** và biểu tượng logo chính thức.
- **Hub tài khoản & Bản quyền trực quan ở chân thanh bên:** Di chuyển toàn bộ thông tin tài khoản người dùng, gói thời hạn bản quyền, phím nạp Key và nút Donate Cafe xuống đáy thanh bên.
- **Tinh gọn danh mục điều hướng:** Bỏ mục Thùng rác và Lịch sử thao tác dư thừa trên thanh bên để tối ưu hóa không gian cho các phân hệ chính.

#### ⚡ Tối ưu thanh TopBar & Không gian làm việc
- **Bộ chuyển đổi theme capsule trực quan:** Bổ sung switch 3 chế độ [ 🌓 Tự động | ☀️ Sáng | 🌙 Tối ] nhanh chóng và hiện đại.
- **Loại bỏ tab thừa:** Bỏ các tab riêng của Photo Picker trên thanh đầu trang, tăng diện tích cho thanh tìm kiếm thông minh Smart Search.
- **Cân đối khoảng cách:** Căn lề đối xứng 16px giữa thanh bên, nội dung và mép phải cửa sổ.
- **Toàn vẹn chức năng:** Bảo toàn 100% tất cả các tính năng, IPC và luồng logic nghiệp vụ của tất cả các app trong hệ sinh thái.

---

## [v2.9.3] - 2026-10-28

### Trong bản cập nhật này, chúng tôi đã:

#### ⚡ Tự động hóa Trạng thái lọc (Contact The Sheet Status Automation)
- **Cập nhật trạng thái "Đã lọc" tự động khi thực thi Batch:** Hệ thống tự động đánh dấu trạng thái hoàn tất (theo giá trị cấu hình `PHOTO_PICK_STATUS_COMPLETED`, mặc định "Đã lọc") vào cột Trạng Thái Lọc (cột M) trên Google Sheets khi thực thi Batch ghi cùng lúc Tên Edit và Link Edit.
- **Tự động cấp quyền ghi cho cột trạng thái:** Cập nhật mẫu Workspace chuẩn và bộ lưu cấu hình để tự động cấp quyền `READ_WRITE` và chính sách `ALWAYS_REPLACE` cho cột Trạng Thái Lọc nếu người dùng thiết lập trạng thái hoàn tất.
- **Bảo vệ nguyên vẹn ô tính an toàn:** Bảo tồn tuyệt đối các ô chứa công thức bảo vệ và bỏ qua các ô đã có sẵn trạng thái hoàn tất để tránh ghi dư thừa.

#### 🛠️ Khắc phục lỗi phân quyền ghi và đồng bộ Drive trong Batch Runner
- **Loại bỏ lỗi hiển thị sai "Bị chặn bởi quyền hạn":** Khắc phục lỗi khi chuyển tiếp tự động từ màn hình Đồng bộ tên thư mục sang Thực thi Batch làm phát sinh lỗi `FIELD_READ_ONLY` sai ngữ nghĩa khi thiếu liên kết Drive.
- **Nâng cấp thuật toán Strategy A của Drive Resolver:** Tìm kiếm và định vị chính xác thư mục thành phẩm con (`leaf delivery folder`) trên Google Drive ngay cả khi tên thư mục con vừa được đổi đồng bộ khớp với tên thư mục khách hàng.
- **Phân giải phân quyền ghi đa tab (`effectiveProfile`):** Đánh giá quyền ghi và phạm vi dòng (`rowScope`) chuẩn xác theo từng Tab riêng biệt, triệt tiêu lỗi xung đột phân quyền chéo khi thực thi Batch trên nhiều tháng/nhiều tab.
- **Xử lý trạng thái thiếu Drive link thân thiện (`NEEDS_REVIEW`):** Chuyển sang trạng thái Cần duyệt kèm hướng dẫn kiểm tra Google Drive Desktop thay vì đánh dấu lỗi đỏ `ERROR`.

#### 🚀 Tối ưu hiệu năng & độ trễ chuyển tiếp
- **Gia tăng độ trễ chuyển tiếp an toàn lên 1.5s:** Cho phép Google Drive Desktop và hệ thống tệp cục bộ có đủ thời gian ghi nhận và đồng bộ các thao tác đổi tên thư mục con.
- **Cơ chế xóa bộ nhớ đệm ô gộp (`clearMergesCache`):** Bổ sung hàm dọn cache cho `SheetDiscoveryService`, đảm bảo dữ liệu ô gộp trên trang tính luôn được cập nhật chính xác nhất.

---

## [v2.9.2] - 2026-10-26

### Trong bản cập nhật này, chúng tôi đã:

#### ⚡ Auto Find — Lọc liên tục nhiều khách hàng thông minh
- **Công tắc Auto Find chuyên dụng:** Bổ sung công tắc bật/tắt Auto Find ngay cạnh các chế độ so khớp (`# Chính xác`, `Q Chứa`, `.* Regex`), cho phép chủ động kích hoạt quy trình tự động hóa cho hàng đợi nhiều khách.
- **Tự động truy xuất và nạp mã khách tiếp theo:** Ngay sau khi chép xong khách hiện tại, hệ thống tự động dò tìm và nạp mã chọn từ Google Sheet cho khách tiếp theo trong hàng đợi mà không cần người dùng phải bấm "Truy xuất trang tính" thủ công.
- **Điểm dừng an toàn (Safe Inspection Stop):** Tự động dừng lại ở bước nạp mã vào ô lọc để người dùng kiểm tra nhanh danh sách mã trước khi bấm "Quét file".
- **Nhận diện tháng thông minh:** Tự động phát hiện thông tin tháng từ tên thư mục khách (ví dụ `20-10...` $\rightarrow$ Tháng 10) để ưu tiên quét đúng tab tháng tương ứng.
- **Bộ nhớ đệm thông minh (Cache TTL 5 phút):** Ngăn chặn việc gọi API dồn dập gây lỗi HTTP 429 (Rate Limit) của Google Sheets, mang lại tốc độ chuyển tiếp tức thì (<1ms).
- **Cập nhật trạng thái chạy ngầm không gián đoạn:** Tác vụ đổi trạng thái Sheet của khách cũ được thực hiện bất đồng bộ ngầm, không gây khựng hay tắc nghẽn luồng xử lý của khách tiếp theo.
- **Nút "Bỏ qua sang khách tiếp":** Bổ sung nút xử lý nhanh trên thông báo khi khách chưa có mã chọn trên Google Sheet.

#### 🗑️ Hiệu ứng Thùng rác tương tác (macOS Trash Toss)
- **Widget Thùng rác thu nhỏ (Mini Trash Bin):** Đặt ngay phía trên các nút tác vụ ở cột bên phải với nắp thùng rác mở ra và đóng vào có hiệu ứng nảy chân thực.
- **Hiệu ứng vo tròn và ném rác 3D:** Khách vừa hoàn tất được vo tròn thành cục giấy 3D ném theo quỹ đạo parabol qua màn hình vào thùng rác.
- **Căn chỉnh vị trí bắt đầu chuẩn xác:** Cục giấy được vo tròn ngay tại vị trí ô khách ở cột hàng đợi bên trái trước khi bay sang cột bên phải.
- **Âm thanh đáp rác macOS chân thực:** Tích hợp âm thanh thả rác nguyên bản của macOS (`trash.wav`) kèm bộ tổng hợp Web Audio API dự phòng.
- **Cửa sổ Khách đã đá ra (Ejected Customers Modal):** Hỗ trợ xem lại danh sách khách đã hoàn tất, khôi phục khách về hàng đợi hoặc dọn sạch thùng rác (hoàn toàn an toàn, chỉ quản lý trong app, không xóa file trên ổ đĩa).

#### 🛠️ Sửa lỗi & Tối ưu luồng truy xuất trang tính
- **Đồng bộ siêu dữ liệu Tab Google Sheet:** Khắc phục triệt để lỗi không tìm thấy dòng do lệch danh sách tab giữa Auto Find và modal Truy xuất trang tính thủ công.
- **Xử lý tự động kết quả khớp tương đồng (`NEEDS_REVIEW`):** Tự động chọn hàng có điểm khớp cao nhất chưa bị đánh dấu "Đã lọc".
- **Timeout bảo vệ 8s:** Ngăn chặn tuyệt đối tình trạng đứng ứng dụng khi kết nối mạng Google Sheets bị gián đoạn.

---

## [v2.9.1] - 2026-10-26

### Trong bản cập nhật này, chúng tôi đã:

#### 🎨 Làm mới giao diện Đăng nhập (Auth UI)
- **Bố cục Split-screen hiện đại:** Khung trình chiếu ảnh dự án mượt mà bên trái, form đăng nhập trực quan và thoáng đãng bên phải.
- **Tích hợp bộ chọn giao diện tức thì:** Hỗ trợ Sáng (Light), Tối (Dark) và Tự động theo hệ thống (System) ngay trên màn hình đăng nhập.
- **Bo góc mềm mại chuẩn mực:** Áp dụng bo góc `rounded-xl` đồng bộ cho toàn bộ ô nhập liệu và các nút bấm.
- **Căn chỉnh hàng tùy chọn cân đối:** Sắp xếp gọn gàng "Tự động đăng nhập", "Lưu mật khẩu" và "Quên mật khẩu" chống tràn dòng trên màn hình hẹp.

#### 📋 Lịch sử phiên bản & Ghi chú phát hành (Release Notes)
- **Cửa sổ xem lịch sử 7 phiên bản gần nhất:** Hiển thị trực quan danh sách 7 bản cập nhật gần nhất với ghi chú phát hành (Release Notes) được phân loại rõ ràng (Giao diện, Tính năng, Tối ưu, Sửa lỗi, Bảo mật).
- **Tích hợp sâu vào hệ thống:** Xem trực tiếp từ Cài đặt chung, Cập nhật ứng dụng, Thông tin phiên bản và Hộp thoại tự động cập nhật.
- **Thông báo phiên bản mới nhất thân thiện:** Thay thế hộp thoại cảnh báo mặc định của trình duyệt bằng giao diện thông báo trực quan, chuyên nghiệp.

#### 🛠️ Sửa lỗi hiển thị đồ họa
- **Khắc phục triệt để lỗi vỡ nền / ô vuông màu:** Chuyển đổi hiệu ứng nền sang dải màu chuyển tiếp Radial Gradients tính toán trực tiếp trên GPU, loại bỏ hoàn toàn lỗi vỡ ô vuông màu của bộ render WebKit macOS khi chuyển đổi màn hình đăng nhập.

---

## [v2.9.0] - 2026-10-25

### Trong bản cập nhật này, chúng tôi đã:

#### 🎨 Làm mới giao diện toàn bộ ứng dụng
- **Bảng màu mới đạt chuẩn dễ đọc:** Màu chính xanh dương được điều chỉnh để chữ trên nút và liên kết luôn đủ tương phản ở cả giao diện Sáng và Tối.
- **Chữ lớn và rõ hơn:** Cỡ chữ nhỏ nhất tăng từ khoảng 9,75px lên 11px; các chữ mờ được tăng độ đậm để dễ đọc.
- **Bớt icon gây nhiễu:** Mỗi nút, thẻ và nhãn chỉ còn một icon phù hợp nhất; gỡ toàn bộ emoji và các icon trang trí dư thừa (ví dụ các tab "Truy xuất mã chọn" và "Cấu hình Sheet & Cột").
- **Launcher gọn hơn:** Các ứng dụng xếp lưới 2×2 cân đối, thẻ mở được bằng bàn phím, gói dài hạn hiển thị "Vĩnh viễn".
- **Thao tác bằng bàn phím và trình đọc màn hình tốt hơn:** Viền focus rõ ràng, nút chỉ có icon đều có tên mô tả, hộp thoại và biểu mẫu đăng nhập được gắn nhãn đầy đủ; tôn trọng chế độ giảm chuyển động của hệ điều hành.
- **Đồng bộ tên thương hiệu "DH Studio Pro"** ở màn chào, Donate, License và Thông báo.

#### 📊 Contact The Sheet — Quét và điền link Drive nhanh, chính xác hơn
- **Tải dữ liệu nhiều tab Google Sheet song song** và tra cứu Drive nhiều job cùng lúc (có giới hạn để tránh vượt hạn mức API).
- **Kiểm tra chủ sở hữu thư mục:** Bỏ qua thư mục cuối thuộc tài khoản khác, chọn đúng thư mục của tài khoản đang kết nối; mỗi lần quét mới đều xoá dữ liệu Drive tạm để không dùng nhầm kết quả cũ.
- **Đọc đúng ô gộp (merged cells):** Ngày hẹn trả ở ô gộp được áp cho cả khối hàng.

#### ✅ Photo Picker — Truy xuất mã & kiểm tra trạng thái lọc
- **Truy xuất mã từ nhiều tab Sheet,** mỗi tab có hàng bắt đầu và cột trạng thái riêng; nhiều dòng trùng tên file ưu tiên dòng còn mã và chưa "Đã lọc".
- **Nhận diện trạng thái "Chưa lọc" chính xác hơn** (kể cả chữ Unicode tổ hợp hoặc khoảng trắng lạ) và đọc ngày hẹn dạng dd/mm không có năm, tính theo giờ Việt Nam.

#### ⚡ Cải thiện & Tối ưu
- **Giảm CPU khi để máy rảnh:** Các hiệu ứng lặp tự tạm dừng khi không có thao tác hoặc cửa sổ bị ẩn; vòng xoay tiến trình vẫn chạy khi đang xử lý.
- **Mở app nhanh hơn:** Từng ứng dụng chỉ được nạp lần đầu khi bạn mở nó.

---

## [v2.8.1] - 2026-10-23

### Trong bản cập nhật này, chúng tôi đã:

#### 🔗 Giữ kết nối tài khoản Google ổn định (Sheet & Drive)
- **Khắc phục triệt để lỗi bị đăng xuất tài khoản Google sau khi tắt máy hoặc thoát app:** Trước đây, tài khoản chỉ sở hữu một trong hai gói (Contact The Sheet hoặc Photo Picker) bị ngắt kết nối Google mỗi lần mở lại ứng dụng. Nay kết nối Google được giữ nguyên cho cả hai gói.
- **Không còn tự động xoá kết nối Google:** Khi gói hết hạn, tính năng Google chỉ tạm khoá và tự hoạt động lại ngay sau khi gia hạn, không cần đăng nhập Google lại. Kết nối chỉ bị xoá khi bạn chủ động bấm "Ngắt kết nối".
- **Lưu dự phòng an toàn trên máy:** Thông tin kết nối Google được lưu thêm một bản trong thư mục ứng dụng, giúp tự khôi phục kết nối kể cả khi dữ liệu tạm của ứng dụng bị xoá.

#### 📁 Contact The Sheet — Điền link Drive chính xác hơn
- **Chỉ chọn thư mục giao ảnh cuối cùng có chứa file:** Khi quét để điền link Drive, hệ thống bỏ qua thư mục còn thư mục con hoặc thư mục rỗng, tự lùi về thư mục giao ảnh gần nhất hợp lệ, tránh điền nhầm link thư mục cha hay thư mục trống.

#### ✅ Photo Picker — Kiểm tra trạng thái lọc
- **Kiểm tra nhiều tab cùng lúc:** Chọn được nhiều tab Google Sheet trong một lần kiểm tra; lựa chọn được ghi nhớ cho lần sau.
- **Quét file tới hạn:** Tuỳ chọn chỉ hiển thị các khách có ngày "Hẹn trả ảnh" từ hôm nay (giờ Việt Nam) trở về trước, cấu hình được cột ngày hẹn.

---

## [v2.8.0] - 2026-10-20

### Trong bản cập nhật này, chúng tôi đã:

#### 🔐 Giữ đăng nhập ổn định
- **Không còn phải đăng nhập lại mỗi lần mở app:** Khắc phục lỗi phiên đăng nhập bị xoá khi tắt và mở lại ứng dụng dù đã chọn "Tự động đăng nhập".
- **Bỏ đăng xuất tự động lúc 0h00:** Tài khoản giữ đăng nhập cho tới khi bạn chủ động đăng xuất, hoặc khi tài khoản được đăng nhập trên thiết bị khác. Mỗi lần mở app, phiên được tự động gia hạn.
- **Tài khoản miễn phí:** Vẫn giữ giới hạn phiên làm việc 10 phút; thời gian còn lại được giữ nguyên khi mở lại app.
- **Không bị đăng xuất khi máy chủ gặp sự cố tạm thời** hoặc khi mạng chập chờn.

#### 🛡️ Bảo mật
- **Mật khẩu "Lưu mật khẩu" được cất trong Keychain của hệ điều hành** (macOS Keychain / Windows Credential Manager) thay vì lưu dạng văn bản thường. Mật khẩu đã lưu từ phiên bản cũ được chuyển sang tự động.
- Gỡ bỏ bản sao phiên đăng nhập không cần thiết lưu trên máy.

#### 📊 Contact The Sheet
- **Giữ kết nối tài khoản Google sau khi khởi động lại máy:** Khắc phục lỗi một số máy bị mất kết nối Google (Sheet & Drive) khi tắt hẳn rồi bật lại. Khi vừa bật máy chưa có mạng, ứng dụng tự kết nối lại khi mạng sẵn sàng thay vì bắt đăng nhập Google lại.
- **Sao chép nhanh link Drive:** Trong cửa sổ "Xem thay đổi" khi quét và thực thi batch, có thêm nút **Sao chép** cạnh giá trị mới để copy ngay link Drive cần điền.

#### 🛠️ Sửa lỗi hệ thống
- Giữ nguyên quyền gói trả phí sau khi làm mới phiên, kể cả khi mở app lúc đang offline.

---

## [v2.7.1] - 2026-10-05

### Trong bản cập nhật này, chúng tôi đã:

#### ⚡ Cải thiện & Tối ưu hóa giao diện (UI & Dock Icon)
- **Chuẩn hóa kích thước Icon App trên macOS Dock theo chuẩn Apple HIG:**
  - Căn chỉnh tỷ lệ khối Squircle về kích thước chuẩn `824x824 px` trên canvas `1024x1024 px` (tương đương với các ứng dụng hệ thống macOS như Safari, Finder, Photos).
  - Tích hợp hiệu ứng đổ bóng tự nhiên nhiều tầng (ambient shadow + direct key shadow) giúp icon đặt trên thanh Dock có độ nổi khối và chiều sâu sang trọng.
  - Tối ưu khoảng thở (padding) cho biểu tượng logo studio bên trong, đảm bảo icon vừa vặn, không bị bè to.
- **Nâng cấp cơ chế hiển thị Dock Icon Native:**
  - Đồng bộ việc nạp icon thời gian thực từ mã nguồn Native Cocoa (`dock_icon.m` và `system_utils.rs`) trên macOS, tự động chuyển đổi giao diện Dock sắc nét theo Dark Mode / Light Mode của hệ thống.
  - Cập nhật định danh tiến trình hiển thị trên macOS thành chính thức **DH Studio Pro**.

---

## [v2.7.0] - 2026-10-05

### Trong bản cập nhật này, chúng tôi đã:

#### 🚀 Chuyển đổi thương hiệu & Nâng cấp nhận diện (Rebranding)
- **Chính thức đổi tên thành DH Studio Pro:** Ứng dụng chính thức chuyển giao về công ty chủ quản **DevHouse Software**, mang tên gọi mới **DH Studio Pro** (DevHouse Studio Pro) - khẳng định vị thế bộ giải pháp phần mềm chuyên nghiệp, toàn diện cho Studio & Photographer.
- **Biểu tượng Logo & Bộ Icon ứng dụng hoàn toàn mới:**
  - Thiết kế logo mới mô phỏng trọn vẹn chu trình làm việc Studio khép kín: Khách hàng 🔁 Lọc ảnh AI 🔁 Quản lý kho ảnh 🔁 Tối ưu quy trình & Cài đặt.
  - Bộ icon ứng dụng phong cách Squircle sang trọng, hiển thị sắc nét trên thanh Dock macOS và Windows Taskbar.
- **Đồng bộ toàn diện giao diện & Pháp lý:** Cập nhật thương hiệu **DH Studio Pro** và bản quyền chính thức thuộc **DevHouse Software** trên toàn bộ hệ thống: TopBar, Workspace Sidebar, Launcher, Trang đăng nhập, Bảng điều khiển tài khoản và Điều khoản dịch vụ.

#### ⚡ Cải thiện & Tối ưu
- **Tối ưu hóa tài nguyên đồ họa:** Tách nền trong suốt chuẩn nét, hiển thị tương thích hoàn hảo trên cả chế độ Sáng (Light Mode) và Tối (Dark Mode).
- **Hệ thống phát hành & Auto-updater:** Đảm bảo gói cài đặt installer (macOS DMG & Windows NSIS) mang tên thương hiệu mới và tự động cập nhật mượt mà.

---

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
