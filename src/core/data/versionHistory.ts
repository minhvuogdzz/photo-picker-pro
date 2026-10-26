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
    version: "v2.9.1",
    date: "2026-10-26",
    title: "Làm mới giao diện Đăng nhập & Bổ sung Lịch sử phiên bản (Release Notes)",
    isCurrent: true,
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
  {
    version: "v2.6.7",
    date: "2026-10-01",
    title: "Tự động phân tách thư mục buổi chụp & Kéo thả Native bền bỉ",
    sections: [
      {
        title: "Tính năng nhận diện thư mục thông minh",
        type: "feature",
        items: [
          "Tự động quét và phân tách thư mục buổi chụp của từng khách hàng khi kéo thả thư mục lớn.",
          "Bổ sung hiệu ứng Expanding Loading UX thông báo tiến trình thời gian thực.",
        ],
      },
      {
        title: "Tối ưu hóa thao tác Kéo - Thả Native",
        type: "improvement",
        items: [
          "Cơ chế Drag & Drop Native bền bỉ trên macOS/Windows, không bị mất sự kiện khi kéo nhanh.",
          "Tự động trích xuất release notes chi tiết cho trình cập nhật tự động.",
        ],
      },
      {
        title: "Sửa lỗi đường dẫn",
        type: "fix",
        items: [
          "Khắc phục sự cố nhận diện thư mục lồng nhau chứa ký tự đặc biệt hoặc tiếng Việt có dấu.",
        ],
      },
    ],
  },
];
