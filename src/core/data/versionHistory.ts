export interface VersionReleaseSection {
  title: string;
  type: 'design' | 'feature' | 'improvement' | 'fix' | 'security';
  items: string[];
}

export interface VersionReleaseNote {
  version: string;
  date: string;
  title: string;
  isCurrent?: boolean;
  sections: VersionReleaseSection[];
  rawNotes?: string;
}

export const RECENT_7_VERSIONS: VersionReleaseNote[] = [
  {
    version: "v2.9.4",
    date: "2026-10-30",
    title: "Tái thiết lập giao diện Studio Dashboard toàn diện & Tối ưu không gian làm việc macOS",
    isCurrent: true,
    sections: [
      {
        title: "🎨 Tái thiết lập giao diện Studio Dashboard & Phong cách macOS hiện đại",
        type: "design",
        items: [
          "Tái thiết kế toàn diện bảng màu Light Mode & Dark Mode theo ngôn ngữ thiết kế macOS hiện đại, độ tương phản mượt mà, chiều sâu viền và bóng đổ mềm mại.",
          "Tối ưu bố cục Launcher với 2 Hero Card lớn đặt song song: Thẻ giám sát bộ nhớ & RAM với đồng hồ đo tỷ lệ tròn (Circular Gauge) cùng Thẻ tiêu điểm Kho Tài Nguyên Creative.",
          "Tinh chỉnh 4 ứng dụng Studio (Photo Picker Pro, Contact The Sheet, MVD Convert, Thống kê) thành các khối module nhỏ gọn, cân đối, hiển thị đầy đủ thông tin trạng thái.",
          "Căn giữa bảng điều khiển tự nhiên theo chiều dọc và ngang, thu gọn khoảng cách (gap) giữa các thành phần, loại bỏ khoảng trống thừa trên màn hình độ phân giải cao.",
        ],
      },
      {
        title: "🧭 Tối ưu hóa Thanh bên sinh thái (Ecosystem Sidebar) & Hub người dùng",
        type: "design",
        items: [
          "Tích hợp đầy đủ nhận diện thương hiệu DH Studio Pro & DevHouse Software cùng logo chính thức.",
          "Chuyển toàn bộ thông tin người dùng, trạng thái gói bản quyền (Full App), mã kích hoạt Key và nút ủng hộ Cafe xuống chân thanh bên (footer) gọn gàng, trực quan.",
          "Lược bỏ các mục điều hướng không cần thiết như Thùng rác và Lịch sử thao tác trên thanh bên chính.",
        ],
      },
      {
        title: "⚡ Tinh chỉnh thanh điều hướng TopBar & Trải nghiệm tổng thể",
        type: "improvement",
        items: [
          "Bổ sung bộ chuyển đổi giao diện hình con nhộng trực quan [ 🌓 Tự động | ☀️ Sáng | 🌙 Tối ] ngay trên thanh TopBar.",
          "Lược bỏ các tab con chuyển chế độ riêng lẻ của Photo Picker trên thanh đầu trang, tăng cường diện tích thanh tìm kiếm thông minh.",
          "Căn chỉnh đối xứng lề trái và phải (16px) cho khu vực làm việc chính của ứng dụng.",
          "Đảm bảo 100% tất cả các tính năng, kết nối IPC và luồng xử lý dữ liệu của các ứng dụng hoạt động ổn định và chính xác.",
        ],
      },
    ],
  },
  {
    version: "v2.9.3",
    date: "2026-10-28",
    title: "Tự động đổi trạng thái lọc & Khắc phục phân quyền Batch Contact The Sheet",
    sections: [
      {
        title: "⚡ Tự động hóa Trạng thái lọc (Status Automation)",
        type: "feature",
        items: [
          "Tự động điền trạng thái lọc hoàn tất (ví dụ 'Đã lọc') vào cột Trạng Thái Lọc (cột M) trên Google Sheets khi thực thi Batch hoàn thành cùng Tên Editor và Link Edit.",
          "Bổ sung cấu hình quyền READ_WRITE và chính sách ALWAYS_REPLACE cho cột Trạng Thái Lọc trong Studio Workspace Wizard.",
          "Bảo tồn tuyệt đối các cột có công thức bảo vệ hoặc khi ô tính đã có sẵn trạng thái hoàn tất để tránh ghi đè dư thừa.",
        ],
      },
      {
        title: "🛠️ Khắc phục phân quyền ghi và đồng bộ Drive trong Batch Runner",
        type: "fix",
        items: [
          "Loại bỏ hoàn toàn lỗi hiển thị sai 'Bị chặn bởi quyền hạn' khi chuyển tiếp tự động từ màn hình Đồng bộ tên thư mục sang Thực thi Batch.",
          "Nâng cấp thuật toán Strategy A của Drive Resolver: Tự động phát hiện và định vị thư mục thành phẩm con (leaf delivery folder) trên Google Drive ngay cả khi tên thư mục con vừa được đổi đồng bộ khớp với tên thư mục khách hàng.",
          "Phân giải phân quyền ghi đa tab (effectiveProfile): Đánh giá quyền ghi và phạm vi dòng (rowScope) chuẩn xác theo từng Tab riêng biệt, ngăn ngừa xung đột phân quyền chéo giữa các tháng.",
          "Khi thiếu liên kết Drive, chuyển trạng thái thông minh sang NEEDS_REVIEW kèm hướng dẫn kiểm tra Google Drive Desktop thay vì báo lỗi đỏ giả lập.",
        ],
      },
      {
        title: "🚀 Tối ưu hóa hiệu năng & độ trễ chuyển tiếp",
        type: "improvement",
        items: [
          "Tăng độ trễ chuyển tiếp an toàn lên 1.5s để Google Drive Desktop kịp đồng bộ siêu dữ liệu file system cục bộ.",
          "Tối ưu bộ nhớ đệm spreadsheetMergesCache với phương thức dọn dẹp tức thì, bảo đảm dữ liệu ô gộp luôn tươi mới.",
        ],
      },
    ],
  },
  {
    version: "v2.9.2",
    date: "2026-10-26",
    title: "Chế độ Auto Find thông minh đa khách hàng & Hiệu ứng Thùng rác tương tác",
    sections: [
      {
        title: "⚡ Auto Find — Lọc liên tục nhiều khách hàng",
        type: "feature",
        items: [
          "Bổ sung công tắc Auto Find cạnh chế độ so khớp, tự động truy xuất và nạp mã khách tiếp theo từ Google Sheet ngay khi hoàn tất khách trước.",
          "Cơ chế an toàn: Dừng lại ở bước nạp mã để người dùng kiểm tra danh sách mã trước khi bấm Quét file.",
          "Tự động nhận diện tháng trong tên thư mục (ví dụ '20-10' -> Tháng 10) để ưu tiên quét đúng tab tháng tương ứng.",
          "Bộ nhớ đệm thông minh (Cache TTL 5 phút) ngăn chặn vượt hạn mức Google Sheets API (HTTP 429) và cho tốc độ chuyển tiếp tức thì (<1ms).",
          "Tự động đồng bộ trạng thái 'Đã lọc' của khách cũ ở chế độ chạy ngầm (asynchronous background), không làm nghẽn hoặc đơ luồng xử lý khách mới.",
          "Bổ sung nút 'Bỏ qua sang khách tiếp' trên thanh thông báo khi khách chưa có mã chọn trên Google Sheet.",
        ],
      },
      {
        title: "🗑️ Hiệu ứng Thùng rác tương tác (macOS Trash Toss)",
        type: "design",
        items: [
          "Thùng rác thu nhỏ (Mini Trash Bin) tại cột Dashboard với nắp mở đóng tương tác bật nảy.",
          "Hiệu ứng vo tròn thẻ khách thành cục giấy 3D ném theo quỹ đạo parabol qua màn hình vào thùng rác.",
          "Vị trí bắt đầu vo giấy được căn chỉnh chính xác ngay tại vị trí ô khách ở cột hàng đợi bên trái.",
          "Tích hợp âm thanh đáp rác chân thực trích xuất từ hệ thống CoreAudio của macOS (trash.wav).",
          "Cửa sổ Quản lý khách đã đá ra (Ejected Customers Modal) hỗ trợ xem lại, khôi phục về hàng đợi hoặc dọn sạch thùng rác (chỉ quản lý trong app, hoàn toàn không xoá file trên ổ đĩa).",
        ],
      },
      {
        title: "🛠️ Sửa lỗi & Tối ưu luồng truy xuất trang tính",
        type: "fix",
        items: [
          "Khắc phục sự cố lệch tên Tab Google Sheet giữa Auto Find và modal Truy xuất trang tính thủ công.",
          "Xử lý tự động trường hợp nhiều hàng trùng khớp hoặc điểm tương đồng (NEEDS_REVIEW) bằng cách chọn hàng có điểm cao nhất chưa bị đánh dấu 'Đã lọc'.",
          "Bổ sung cơ chế Timeout 8s cho các lệnh gọi API Google Sheets, loại bỏ triệt để hiện tượng đứng app hoặc tắc nghẽn hàng đợi.",
        ],
      },
    ],
  },
  {
    version: "v2.9.1",
    date: "2026-10-26",
    title: "Làm mới giao diện Đăng nhập & Bổ sung Lịch sử phiên bản (Release Notes)",
    sections: [
      {
        title: "🎨 Làm mới giao diện Đăng nhập (Auth UI)",
        type: "design",
        items: [
          "Bố cục Split-screen hiện đại: Trình chiếu ảnh dự án mượt mà bên trái, biểu mẫu đăng nhập liền mạch bên phải.",
          "Tích hợp bộ chọn giao diện tức thì (Sáng / Tối / Theo hệ thống) ngay trên màn hình đăng nhập.",
          "Bo góc mềm mại chuẩn mực (rounded-xl) cho tất cả các trường dữ liệu và nút bấm.",
          "Căn chỉnh hàng tùy chọn Tự động đăng nhập, Lưu mật khẩu và Quên mật khẩu chống tràn dòng trên màn hình hẹp.",
        ],
      },
      {
        title: "📋 Lịch sử phiên bản & Ghi chú phát hành (Release Notes)",
        type: "feature",
        items: [
          "Bổ sung cửa sổ xem lịch sử 7 phiên bản gần nhất kèm ghi chú phát hành chi tiết từng bản cập nhật.",
          "Tích hợp linh hoạt vào Cài đặt chung, Thông tin phiên bản và Hộp thoại cập nhật ứng dụng.",
          "Tự động nhận diện và hiển thị giao diện thông báo phiên bản mới nhất thân thiện.",
        ],
      },
      {
        title: "🛠️ Sửa lỗi hiển thị đồ họa",
        type: "fix",
        items: [
          "Khắc phục triệt để lỗi vỡ nền / ô vuông màu trên WebKit macOS khi chuyển đổi màn hình đăng nhập bằng dải màu Radial Gradients GPU.",
        ],
      },
    ],
  },
  {
    version: "v2.9.0",
    date: "2026-10-25",
    title: "Làm mới giao diện toàn bộ ứng dụng & Tối ưu toàn diện",
    sections: [
      {
        title: "Làm mới giao diện toàn bộ ứng dụng",
        type: "design",
        items: [
          "Bảng màu mới đạt chuẩn tương phản cao, dễ đọc ở cả giao diện Sáng và Tối.",
          "Chữ lớn và rõ hơn (cỡ chữ tối thiểu tăng lên 11px), tăng độ tương phản.",
          "Giao diện gọn gàng, bớt icon gây nhiễu, chuẩn hóa các thẻ ứng dụng Launcher.",
          "Hỗ trợ bàn phím, con trỏ và chế độ giảm chuyển động của hệ điều hành tốt hơn.",
          "Đồng bộ thương hiệu DH Studio Pro trên toàn bộ hệ thống.",
        ],
      },
      {
        title: "Contact The Sheet — Quét và điền link Drive chính xác hơn",
        type: "feature",
        items: [
          "Tải dữ liệu nhiều tab Google Sheet song song và tra cứu Drive đa luồng có kiểm soát hạn mức.",
          "Kiểm tra chủ sở hữu thư mục, tránh chọn nhầm thư mục của tài khoản khác.",
          "Đọc chuẩn xác các ô gộp (merged cells) cho ngày hẹn trả ảnh.",
        ],
      },
      {
        title: "Photo Picker — Truy xuất mã & kiểm tra trạng thái lọc",
        type: "feature",
        items: [
          "Truy xuất mã từ nhiều tab Sheet cùng lúc, ưu tiên các dòng còn mã và chưa lọc.",
          "Nhận diện trạng thái 'Chưa lọc' chính xác hơn (hỗ trợ Unicode tổ hợp, khoảng trắng đặc biệt).",
          "Hỗ trợ đọc ngày hẹn dạng dd/mm chuẩn theo múi giờ Việt Nam.",
        ],
      },
      {
        title: "Cải thiện & Tối ưu hiệu năng",
        type: "improvement",
        items: [
          "Giảm mức sử dụng CPU khi máy ở trạng thái rảnh (tự tạm dừng hiệu ứng nền).",
          "Tối ưu tốc độ mở app ban đầu, nạp ứng dụng theo cơ chế lazy-loading.",
        ],
      },
    ],
  },
  {
    version: "v2.8.1",
    date: "2026-10-23",
    title: "Ổn định kết nối Google Drive & Kiểm tra trạng thái lọc đa tab",
    sections: [
      {
        title: "Giữ kết nối tài khoản Google ổn định (Sheet & Drive)",
        type: "fix",
        items: [
          "Khắc phục triệt để lỗi bị đăng xuất tài khoản Google sau khi tắt máy hoặc thoát ứng dụng.",
          "Không tự động xoá kết nối Google khi gói hết hạn, tự kích hoạt lại khi gia hạn.",
          "Lưu dự phòng an toàn trên máy, tự động khôi phục kết nối kể cả khi xoá cache tạm.",
        ],
      },
      {
        title: "Contact The Sheet & Photo Picker",
        type: "improvement",
        items: [
          "Chỉ chọn thư mục giao ảnh cuối cùng có chứa file, tránh điền nhầm thư mục rỗng.",
          "Hỗ trợ kiểm tra nhiều tab Google Sheet đồng thời và ghi nhớ cấu hình quét.",
          "Tuỳ chọn quét các khách hàng có ngày hẹn trả ảnh từ hôm nay trở về trước.",
        ],
      },
    ],
  },
  {
    version: "v2.8.0",
    date: "2026-10-20",
    title: "Bảo mật Keychain hệ điều hành & Duy trì phiên đăng nhập thông minh",
    sections: [
      {
        title: "Giữ đăng nhập ổn định & Bảo mật",
        type: "security",
        items: [
          "Không còn phải đăng nhập lại mỗi lần mở app khi đã bật 'Tự động đăng nhập'.",
          "Bỏ cơ chế tự đăng xuất lúc 0h00, phiên làm việc tự gia hạn liên tục.",
          "Mật khẩu lưu được bảo vệ trong Keychain macOS và Windows Credential Manager.",
          "Khả năng chịu lỗi cao, không bị ngắt phiên khi mạng chập chờn hoặc máy chủ bận.",
        ],
      },
      {
        title: "Tính năng Contact The Sheet",
        type: "feature",
        items: [
          "Tự động kết nối lại Google Sheet/Drive khi máy có mạng sau khi khởi động.",
          "Bổ sung nút 'Sao chép nhanh link Drive' trực tiếp trong cửa sổ xem trước thay đổi.",
        ],
      },
    ],
  },
  {
    version: "v2.7.1",
    date: "2026-10-05",
    title: "Chuẩn hóa Dock Icon Apple HIG & Tối ưu đồ họa Native macOS",
    sections: [
      {
        title: "Giao diện & Dock Icon Native",
        type: "design",
        items: [
          "Chuẩn hóa kích thước icon ứng dụng theo tỉ lệ Apple HIG chuẩn 824x824 trên canvas 1024x1024.",
          "Tích hợp hiệu ứng đổ bóng đa tầng (ambient + key shadow) cho thanh Dock macOS.",
          "Đồng bộ icon thời gian thực từ mã nguồn Native Cocoa tự động theo Dark/Light Mode.",
          "Cập nhật định danh tiến trình hiển thị trên macOS chính thức thành DH Studio Pro.",
        ],
      },
    ],
  },
  {
    version: "v2.7.0",
    date: "2026-10-05",
    title: "Nâng cấp thương hiệu DH Studio Pro & Bộ nhận diện Squircle mới",
    sections: [
      {
        title: "Chuyển đổi thương hiệu & Nhận diện (Rebranding)",
        type: "feature",
        items: [
          "Chính thức chuyển giao và đổi tên thành DH Studio Pro trực thuộc DevHouse Software.",
          "Bộ biểu tượng Logo Squircle mới sang trọng mô phỏng chu trình làm việc Studio khép kín.",
          "Đồng bộ nhận diện thương hiệu trên TopBar, Launcher, Sidebar, Đăng nhập và Bản quyền.",
        ],
      },
      {
        title: "Cải thiện hệ thống phát hành",
        type: "improvement",
        items: [
          "Tối ưu đồ họa trong suốt chuẩn nét trên cả giao diện Sáng và Tối.",
          "Bộ cài đặt DMG và NSIS mới hỗ trợ Auto-updater mượt mà không xung đột mã cũ.",
        ],
      },
    ],
  },
];
