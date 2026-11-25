export interface VersionReleaseSection {
  title: string;
  titleEn?: string;
  type: 'design' | 'feature' | 'improvement' | 'fix' | 'security';
  items: string[];
  itemsEn?: string[];
}

export interface VersionReleaseNote {
  version: string;
  date: string;
  title: string;
  titleEn?: string;
  isCurrent?: boolean;
  sections: VersionReleaseSection[];
  rawNotes?: string;
}

export const RECENT_7_VERSIONS: VersionReleaseNote[] = [
  {
    version: "v4.0.0",
    date: "2026-11-25",
    title: "Lọc ảnh Pro: Giao diện mới gọn & trung tính, quét thư mục nhanh hơn và chép file tự thích ứng theo loại ổ",
    titleEn: "Photo Picker Pro: Cleaner neutral interface, faster folder scans and storage-aware file copying",
    isCurrent: true,
    sections: [
      {
        title: "Giao diện mới gọn gàng & chuyên nghiệp",
        titleEn: "Cleaner, More Professional Interface",
        type: "design",
        items: [
          "Theme tối chuyển sang tông xám than trung tính, bỏ nền xanh navy và các vệt màu; theme sáng cũng chuyển sang nền xám nhạt trung tính. Màu xanh dương chỉ còn dùng làm màu nhấn.",
          "Gom chế độ so khớp, loại file (RAW/JPG), phạm vi quét và kế thừa đuôi file vào nút \"Tùy chọn lọc\" thu/bung, kèm dòng tóm tắt lựa chọn hiện tại. App nhớ trạng thái thu/bung cho lần mở sau.",
          "Bảng điều khiển: thống kê dạng lưới gọn; \"Mã lỗi\" và \"Thư mục đầu ra\" thành các nhóm thu/bung; chọn kiểu đầu ra bằng nút gạt thay cho 2 ô tích.",
          "Cột trái bỏ các ô sao chép lỗi trùng với bảng điều khiển; danh sách mã dùng chấm màu nhỏ thay cho viền và chữ nhiều màu.",
          "Dòng mã lỗi trong khung nhập dùng nền tô nhạt cố định với vạch màu ở mép trái, thay cho hiệu ứng nhấp nháy liên tục.",
          "Đồng bộ cỡ chữ và icon (nét mảnh, cùng kích thước); tiêu đề dùng font hệ thống.",
        ],
        itemsEn: [
          "The dark theme moves to a neutral graphite palette without the navy background and colour washes; the light theme moves to a plain neutral grey canvas. Blue is now used only as the accent colour.",
          "Match mode, file types (RAW/JPG), scan scope and extension inheritance are grouped under a collapsible \"Filter options\" button with a live summary of the current choices. The open/closed state is remembered.",
          "Dashboard: compact stats grid, collapsible \"Code issues\" and \"Output destination\" sections, and a segmented switch instead of two checkboxes for the output mode.",
          "The left column drops the copy boxes that duplicated the dashboard; code lists use small status dots instead of coloured borders and text.",
          "Error lines in the code editor use a calm static tint with a left marker instead of a looping pulse.",
          "Consistent type and icon sizes (thin strokes, one size); headings use the system font.",
        ],
      },
      {
        title: "Quét thư mục nhanh hơn khi bật \"Gồm thư mục con\"",
        titleEn: "Faster Scans With \"Include Subfolders\"",
        type: "improvement",
        items: [
          "Bỏ qua thư mục ẩn (.Trashes, .Spotlight-V100...) và thư mục cache/catalog của Lightroom, Photos, Capture One khi quét đệ quy.",
          "Bỏ qua file rác ._IMG_xxxx do macOS tạo trên ổ exFAT/FAT/ổ mạng (trước đây bị tính là ảnh và gây báo trùng file giả).",
          "Không quét lại thư mục đầu ra khi nó nằm bên trong thư mục khách.",
          "Khi bấm \"Quét file\" lần nữa mà còn mã thiếu, bước làm mới thư mục hiện trạng thái \"Đang quét\" kèm tiến độ.",
        ],
        itemsEn: [
          "Recursive scans skip hidden folders (.Trashes, .Spotlight-V100...) and Lightroom, Photos and Capture One cache/catalog bundles.",
          "macOS ._IMG_xxxx AppleDouble files on exFAT/FAT/network drives are skipped (they used to count as photos and cause false duplicates).",
          "The output folder is no longer rescanned when it sits inside a customer folder.",
          "Re-running \"Scan & Match\" with missing codes now shows a \"Scanning\" state with progress while the folder is refreshed.",
        ],
      },
      {
        title: "Chép file tự thích ứng theo loại ổ",
        titleEn: "Storage-Aware File Copying",
        type: "improvement",
        items: [
          "Tự nhận biết ổ nguồn/đích là SSD, ổ cứng cơ (HDD), ổ mạng hay thư mục Google Drive.",
          "Có ổ HDD ở một trong hai bên thì chép lần lượt từng file theo thứ tự thư mục để đầu đọc không phải nhảy qua lại; SSD, ổ mạng và Google Drive vẫn chép 4 file song song.",
        ],
        itemsEn: [
          "Detects whether the source and destination are an SSD, a spinning hard disk (HDD), a network share or a Google Drive folder.",
          "When a HDD is on either side, files are copied one at a time in folder order to avoid disk-head thrashing; SSD, network and Google Drive keep 4 parallel copies.",
        ],
      },
    ],
  },
  {
    version: "v3.6.1",
    date: "2026-11-24",
    title: "Lọc ảnh Pro: Tuỳ chọn bật/tắt Kế thừa hậu tố đuôi file & bộ lọc nhánh định dạng (.CR2, .CR3, .ARW, .NEF...)",
    titleEn: "Photo Picker Pro: Opt-in file extension inheritance toggle & per-extension branch filter (.CR2, .CR3, .ARW, .NEF...)",
    sections: [
      {
        title: "Khôi phục lọc mặc định linh hoạt & Thêm tuỳ chọn Kế thừa hậu tố đuôi file theo nhánh",
        titleEn: "Restored Flexible Default Matching & Opt-In Extension Branch Filter",
        type: "improvement",
        items: [
          "Đưa cơ chế lọc mặc định về đúng quy trình Studio: khi không tích \"Kế thừa hậu tố đuôi file\", hệ thống tự động bỏ qua đuôi file trong danh sách mã khách gửi (ví dụ khách gửi danh sách .JPG vẫn lọc sang file RAW .CR2/.CR3/.ARW/.NEF bình thường).",
          "Bổ sung checkbox \"Kế thừa hậu tố đuôi file\" ngay cạnh các tuỳ chọn lọc bên dưới ô nhập mã; khi tích chọn sẽ mở ra dải nhánh định dạng (.CR2, .CR3, .ARW, .NEF, .RAF, .DNG, .ORF, .RW2, .JPG).",
          "Lọc cứng chính xác theo các nhánh đuôi file đang được tích chọn (ví dụ chỉ tích .CR3 sẽ loại bỏ toàn bộ .CR2 kể cả khi không gõ đuôi trong ô mã) đồng thời giữ nguyên cơ chế kế thừa hậu tố khi gắn đuôi mới trên mã đầu từng cụm.",
        ],
        itemsEn: [
          "Restored flexible default studio matching: when \"Inherit file extension\" is unchecked (default), input extensions are stripped so customer .JPG lists match RAW files (.CR2/.CR3/.ARW/.NEF) seamlessly.",
          "Added an \"Inherit file extension\" checkbox alongside the bottom scan options that reveals per-extension branch chips (.CR2, .CR3, .ARW, .NEF, .RAF, .DNG, .ORF, .RW2, .JPG) when enabled.",
          "Strictly filters matched photos to checked branch extensions (e.g., checking only .CR3 excludes .CR2 even for bare code lists) while supporting cascading extension inheritance when multiple branches are checked.",
        ],
      },
    ],
  },
  {
    version: "v3.6.0",
    date: "2026-11-23",
    title: "Lọc ảnh Pro: Tô sáng & nháy dòng mã lỗi trực tiếp, kế thừa hậu tố đuôi file (.CR2/.CR3), kéo chỉnh độ rộng 3 cột & giao diện Liquid Glass",
    titleEn: "Photo Picker Pro: Inline error line highlighting & jump navigation, cascading file extension inheritance (.CR2/.CR3), resizable 3-column layout & Liquid Glass toolbar",
    sections: [
      {
        title: "Lọc ảnh Pro — Tô màu, nháy sáng dòng mã lỗi & Nhảy thẳng tới vị trí lỗi",
        titleEn: "Photo Picker Pro — Inline Error Line Highlighting & Click-to-Jump Navigation",
        type: "feature",
        items: [
          "Tô sáng & nháy dòng lỗi trực tiếp ngay trong ô nhập mã kèm cột số thứ tự dòng: dòng bị Sai mã (Missing) nháy đỏ kèm nhãn cảnh báo, dòng bị Trùng mã (Duplicate) nháy đồng thời tất cả các dòng trùng màu cam/vàng và chỉ chéo số dòng bị trùng.",
          "Nhận diện thông minh phần chữ đi kèm mã số ảnh (ví dụ HIN1234 gõ nhầm thành HNI1234 sẽ báo đỏ Sai mã ngay tại dòng đó mà không làm báo sai lây xuống các dòng chỉ ghi số bên dưới); chữ đứng riêng một mình trên 1 dòng không kèm số sẽ không báo sai mã.",
          "Bấm trực tiếp vào bất kỳ mã lỗi nào ở bảng \"Các file lỗi\" bên cột trái (hoặc nút đếm dòng lỗi trên thanh tiêu đề) để tự động cuộn tới đúng dòng đó, nháy sáng thu hút mắt và bôi đen mã để sửa hoặc xoá ngay.",
        ],
        itemsEn: [
          "Added synchronized backdrop line highlighting and line numbers inside the customer code editor: Missing lines pulse red with inline badges, while Duplicate lines highlight all matching duplicate lines in amber and cross-reference their peer line numbers.",
          "Smart prefix-plus-number validation flags mistyped prefixes attached to photo numbers (e.g., HNI1234 instead of HIN1234) without cascading false errors onto subsequent number-only lines, while ignoring standalone text-only lines.",
          "Click any error item in the left \"Errors\" panel (or the header error pills) to automatically scroll to, flash, and select the exact faulty line in the code editor.",
        ],
      },
      {
        title: "Kế thừa hậu tố đuôi file (.CR2 / .CR3 / .JPG / .ARW) & Tự động quét lại khi đổi bộ lọc",
        titleEn: "Cascading File Extension Inheritance (.CR2 / .CR3 / .JPG / .ARW) & Auto Re-Scan on Filter Toggle",
        type: "feature",
        items: [
          "Khi thư mục có 2 file trùng mã nhưng khác đuôi (ví dụ IMG_1234.CR2 và IMG_1234.CR3), chỉ cần gắn đuôi file vào mã đầu tiên (ví dụ IMG_1234.CR3) — toàn bộ các mã bên dưới sẽ tự động ăn theo hậu tố đó cho tới khi gặp vị trí gắn hậu tố mới.",
          "Tự động quét và đối chiếu lại ngay lập tức khi tích/bỏ tích 4 tuỳ chọn lọc (Lọc Raw, Lọc JPG, Chỉ thư mục chọn, Lọc tất cả thư mục con) mà không cần bấm lại nút Quét file.",
        ],
        itemsEn: [
          "When a folder contains files sharing the same code with different extensions (e.g., IMG_1234.CR2 and IMG_1234.CR3), appending an extension to the first code automatically cascades that extension to all subsequent codes until a new extension is specified.",
          "Toggling any of the 4 scan option checkboxes (Filter RAW, Filter JPG, Selected folder only, All subfolders) now automatically re-scans and re-matches immediately.",
        ],
      },
      {
        title: "Kéo chỉnh độ rộng 3 cột linh hoạt & Đồng bộ thanh công cụ Liquid Glass",
        titleEn: "Resizable 3-Column Splitters & Unified Liquid Glass Toolbar",
        type: "design",
        items: [
          "Bổ sung rãnh kéo ngang (con trỏ mũi tên 2 chiều) giữa 3 cột Trái ↔ Giữa ↔ Phải trong Lọc ảnh Pro, tự động lưu kích thước tuỳ chỉnh và hỗ trợ nhấp đúp để đặt lại độ rộng mặc định.",
          "Thiết kế lại thanh công cụ đầu trang ô mã lọc theo chuẩn Liquid Glass đồng bộ với Contact the Sheet, nút Truy xuất trang tính dạng fill xanh liền khối và tinh gọn thanh trạng thái dưới cùng.",
        ],
        itemsEn: [
          "Added interactive horizontal resize splitters (with two-way resize cursor and double-click reset) between the Left, Center, and Right panels in Photo Picker Pro with persistent width storage.",
          "Redesigned the code editor header toolbar with responsive Liquid Glass pills matching Contact the Sheet, a solid filled green Sheet Extract button, and a cleaner bottom status bar.",
        ],
      },
    ],
  },
  {
    version: "v3.5.2",
    date: "2026-11-21",
    title: "Đồng bộ song ngữ Việt ↔ Anh toàn diện trên toàn bộ ứng dụng & thiết lập quy tắc phát triển song ngữ",
    titleEn: "Full Vietnamese ↔ English bilingual synchronization across all modules & automated i18n guard",
    sections: [
      {
        title: "Đồng bộ hoàn toàn song ngữ Việt ↔ Anh (vi ↔ en) trên toàn bộ ứng dụng",
        titleEn: "Full Vietnamese ↔ English (vi ↔ en) Bilingual Synchronization",
        type: "improvement",
        items: [
          "Đồng bộ hóa 100% giao diện, hộp thoại, thông báo, lỗi người dùng và định dạng số/thời gian trên mọi module: Launcher, Đăng nhập/Bản quyền/Cập nhật, Lọc ảnh Pro, Contact the Sheet, Chuyển đổi file (MVD Convert), Thống kê & Tính lương, Kho Tài Nguyên, Trung tâm Thông báo, Hiệu năng hệ thống và Control Hub khay hệ thống (Tray Panel).",
          "Đồng bộ tức thì menu Native Tray (Hiện DH Studio Pro / Show DH Studio Pro, Thoát ứng dụng / Quit App), cửa sổ phụ Tray Popover qua sự kiện app-language-changed, và thông điệp trả về từ Rust backend (localizeBackendMessage).",
          "Hỗ trợ xuất bảng tính Google Sheets/CSV/TSV, báo cáo Zalo và Trợ lý AI Dự đoán Lương phản hồi theo đúng ngôn ngữ đang chọn trong Cài đặt.",
          "Giữ nguyên tuyệt đối các từ khóa nghiệp vụ so khớp Google Sheet (\"Chưa lọc\", \"Đã lọc\", \"DS Khách\", v.v.), heuristic phân tích thư mục và hợp đồng DHbox Bridge v1.",
        ],
        itemsEn: [
          "Synchronized 100% of UI copy, dialogs, notifications, user-facing errors, and locale number/date formatting across all modules: Launcher, Auth/License/Updater, Photo Picker Pro, Contact the Sheet, MVD Convert, Photo Counter & Payroll, Creative Resources, Notification Center, System Performance, and Tray Control Hub.",
          "Instantly synced Native Tray menu items (Show/Quit), the secondary Tray Popover window via app-language-changed, and Rust backend status/error messages via localizeBackendMessage.",
          "Localized Google Sheets/CSV/TSV spreadsheet exports, Zalo summary reports, and AI Salary Coach prompts/suggestions to match the active UI language in Settings.",
          "Preserved all domain-matching Google Sheet tokens (\"Chưa lọc\", \"Đã lọc\", \"DS Khách\", etc.), studio folder heuristics, and DHbox Bridge v1 contracts.",
        ],
      },
      {
        title: "Chuẩn hóa kiểm thử tự động & Quy tắc phát triển song ngữ",
        titleEn: "Automated i18n Guard & Parallel Bilingual Standards",
        type: "improvement",
        items: [
          "Bổ sung bộ kiểm thử AST tự động (tests/i18n/i18n-sync.test.ts) đảm bảo 100% key từ điển vi/en khớp nhau và 0 chuỗi UI tiếng Việt bị bỏ sót trong toàn bộ src/**/*.tsx.",
          "Bổ sung tài liệu nguyên tắc phát triển song ngữ song song trong AGENTS.md và CLAUDE.md để mọi bản cập nhật sau luôn hỗ trợ đồng thời Tiếng Việt và Tiếng Anh.",
        ],
        itemsEn: [
          "Added an automated TypeScript AST test suite (tests/i18n/i18n-sync.test.ts) enforcing 100% vi/en key parity and zero unwrapped Vietnamese UI strings across src/**/*.tsx.",
          "Documented mandatory parallel bilingual guidelines in AGENTS.md and CLAUDE.md so every future feature and UI update ships in both Vietnamese and English.",
        ],
      },
    ],
  },
  {
    version: "v3.5.1",
    date: "2026-11-20",
    title: "Bản vá chạy ngầm Contact the Sheet (hết treo/timeout) & sửa lỗi không mở lại được cửa sổ sau khi ấn X / Cmd+W",
    titleEn: "Contact the Sheet background scan fix (no hang/timeout) & window reopen fix after X / Cmd+W",
    sections: [
      {
        title: "Liên kết DHbox — Hết treo và hết timeout khi quét ngầm",
        titleEn: "DHbox Ecosystem Bridge — Eliminates background scan hangs and timeouts",
        type: "fix",
        items: [
          "Khắc phục triệt để tình trạng macOS App Nap & WebKit Occlusion tạm dừng tiến trình nền sau ~5 giây khiến quét Contact the Sheet từ chuột phải Finder bị treo ở 68% và hết thời gian chờ.",
          "Bổ sung cơ chế giữ tiến trình nền tỉnh táo an toàn (NSProcessInfo activity + đánh thức cửa sổ ẩn xuyên chuột) đúng trong thời gian xử lý yêu cầu từ DHbox, giữ cửa sổ hoàn toàn ẩn và rút ngắn thời gian quét xuống chỉ còn vài giây.",
          "Chuyển quét cây thư mục (scan_folder_topology) sang luồng nền bất đồng bộ và bỏ qua thư mục con ẩn để tránh đơ khi gặp thư mục lớn.",
        ],
        itemsEn: [
          "Resolved macOS App Nap & WebKit Occlusion suspending background WebView execution after ~5s, which caused right-click Finder Contact the Sheet scans to stall at 68% and time out.",
          "Added safe background activity keep-alive (NSProcessInfo activity + click-through hidden window wake) during DHbox request execution, keeping the main window hidden while cutting scan times down to seconds.",
          "Moved folder topology scanning (scan_folder_topology) to an asynchronous background thread and skipped hidden subfolders to prevent stalls on large directories.",
        ],
      },
      {
        title: "Quản lý cửa sổ macOS — Khắc phục lỗi ấn X / Cmd+W không mở lại được",
        titleEn: "macOS Window Management — Fix window failing to reopen after X / Cmd+W",
        type: "fix",
        items: [
          "Sửa lỗi khi tắt tuỳ chọn \"Chạy ngầm trên Menu Bar khi đóng cửa sổ\" và ấn X hoặc Cmd+W khiến cửa sổ chính bị huỷ nhưng icon Menu Bar vẫn còn mà không thể mở lại ứng dụng.",
          "Khi bật \"Chạy ngầm trên Menu Bar\", cửa sổ chính được ẩn an toàn và luôn mở lại ngay khi bấm Dock, icon Menu Bar hoặc nút Mở cửa sổ chính trong Control Hub; khi tắt, ấn X / Cmd+W thoát ứng dụng sạch hoàn toàn.",
        ],
        itemsEn: [
          "Fixed an issue where disabling \"Run in Menu Bar when closed\" and pressing X or Cmd+W destroyed the main window while leaving a zombie Menu Bar icon that could not reopen the app.",
          "When Menu Bar background mode is enabled, closing hides the window safely and reopens immediately from Dock, Menu Bar icon, or Control Hub; when disabled, pressing X / Cmd+W exits the app cleanly.",
        ],
      },
    ],
  },
  {
    version: "v3.5.0",
    date: "2026-11-20",
    title: "Liên kết hệ sinh thái DH — Cổng cầu nối Contact the Sheet cho DHbox & Chế độ chạy ngầm",
    titleEn: "DH Ecosystem Bridge — Contact the Sheet gateway for DHbox & background launch mode",
    sections: [
      {
        title: "Liên kết hệ sinh thái DH (DH Ecosystem Bridge v1)",
        titleEn: "DH Ecosystem Bridge (v1)",
        type: "feature",
        items: [
          "Bổ sung cổng cầu nối Unix domain socket cục bộ (quyền 0600, xác thực cùng tài khoản người dùng) để DHbox gọi trực tiếp Contact the Sheet từ menu chuột phải Finder.",
          "Tái sử dụng trọn vẹn cấu hình Google Sheet, Google OAuth, bản quyền và logic Thực thi Batch sẵn có trong DH Studio Pro mà không phải thiết lập lại.",
          "Hỗ trợ chế độ khởi chạy ngầm (--background) không hiện hay nháy cửa sổ desktop và lệnh thoát sạch sau khi người dùng xác nhận đóng từ DHbox.",
        ],
        itemsEn: [
          "Added a local Unix domain socket bridge (0600 permissions, UID verification) so DHbox can trigger Contact the Sheet directly from Finder's right-click menu.",
          "Fully reuses existing Google Sheet settings, Google OAuth credentials, license state, and Batch Runner logic in DH Studio Pro with zero extra setup.",
          "Added silent background launch (--background) without showing or flashing desktop windows, plus clean shutdown after user confirmation in DHbox.",
        ],
      },
    ],
  },
  {
    version: "v3.4.2",
    date: "2026-11-20",
    title: "Bản vá Lọc ảnh Pro — Mặc định quét thư mục con & Đồng bộ Auto Find tức thì khi chuyển hoặc xoá khách",
    titleEn: "Photo Picker Pro Patch — Default subfolder scan & instant Auto Find sync when switching or removing customers",
    sections: [
      {
        title: "Lọc ảnh Pro — Đồng bộ Auto Find toàn diện & Thiết lập mặc định thông minh",
        titleEn: "Photo Picker Pro — Full Auto Find Sync & Smart Defaults",
        type: "improvement",
        items: [
          "Đặt mặc định tuỳ chọn \"Lọc tất cả thư mục con\" ngay khi khởi động ứng dụng để không bỏ sót ảnh trong các thư mục con của khách.",
          "Đồng bộ hoá toàn diện Auto Find theo khách hàng đang chọn: khi click vào tên khách, tích vào ô checkbox, bấm xoá thủ công một khách khiến hàng đợi nhảy xuống khách kế tiếp, khôi phục từ thùng rác hoặc lọc qua Check TT, hệ thống đều tự động nạp mã chọn mới ngay lập tức.",
          "Tự động làm sạch mã của khách cũ và chống xung đột dữ liệu khi click chuyển nhanh qua nhiều khách liên tiếp.",
        ],
        itemsEn: [
          "Enabled \"All Subfolders\" by default on startup so images nested inside customer subfolders are never missed.",
          "Synchronized Auto Find with the active customer across all actions: clicking a customer, checking a box, manually removing a customer (advancing to the next), restoring from Trash, or filtering via Check Status now loads codes immediately.",
          "Automatically clears previous customer codes and prevents race conditions when rapidly switching between customers.",
        ],
      },
    ],
  },
  {
    version: "v3.4.1",
    date: "2026-11-19",
    title: "Bản vá tối ưu hiệu năng Lọc ảnh Pro — Xử lý triệt để lỗi treo khi quét và tăng tốc chép file",
    titleEn: "Photo Picker Pro Performance Patch — Eliminated indexing stalls & boosted copy speed",
    sections: [
      {
        title: "Lọc ảnh Pro — Sửa lỗi treo Indexing & Khớp mã tức thì khi chỉnh sửa",
        titleEn: "Photo Picker Pro — Fixed Indexing Hang & Instant Code Matching on Edit",
        type: "fix",
        items: [
          "Loại bỏ hoàn toàn bước gọi stat()/metadata() đa luồng lên từng file khi quét thư mục, khắc phục triệt để lỗi đơ ở 0.0% (Found ... image files, indexing...) trên Google Drive (CloudStorage) và ổ cứng ngoài.",
          "Lưu bộ nhớ đệm phiên quét thông minh trong RAM: khi sửa mã trực tiếp trong ô nhập, ứng dụng tự động đối chiếu lại ngay lập tức (< 1ms) hoặc phản hồi tức thì khi bấm Quét file mà không phải quét lại ổ đĩa.",
          "Khắc phục lỗi độ trễ debounce làm sót mã vừa chỉnh sửa khi sửa mã xong và bấm Quét file ngay.",
        ],
        itemsEn: [
          "Removed redundant per-file stat()/metadata() calls during folder traversal, fixing 0.0% indexing stalls on Google Drive (CloudStorage) and external drives.",
          "Added in-RAM scan session caching: editing codes directly in the input re-matches instantly (< 1ms) without re-scanning the drive.",
          "Fixed debounce timing causing newly edited codes to be missed when clicking Scan & Match immediately after editing.",
        ],
      },
      {
        title: "Tăng tốc Lọc & Chép file đa luồng (Fast Copy Engine)",
        titleEn: "Multi-threaded Fast Copy Engine",
        type: "improvement",
        items: [
          "Nâng cấp bộ chép file sang kiến trúc đa luồng 4 luồng song song kết hợp cơ chế nhân bản tức thì clonefile (APFS Copy-on-Write) trên macOS, tăng tốc độ lọc gấp 3–4 lần.",
          "Khóa ngữ cảnh dòng khách hàng vừa lọc xong trước khi Auto Find chuyển sang khách kế tiếp để cập nhật trạng thái \"Đã lọc\" chính xác trên Google Sheet.",
          "Tắt tiến trình ngầm quét ổ đĩa mỗi 1.5 giây khi Tray Popover đang ẩn, loại bỏ hoàn toàn hiện tượng tranh chấp I/O làm tốc độ lọc lúc nhanh lúc chậm.",
        ],
        itemsEn: [
          "Upgraded copy engine to 4-thread parallel execution with macOS APFS clonefile (Copy-on-Write), speeding up filtering 3–4x.",
          "Locked completed customer sheet row context before Auto Find advances so Google Sheet status updates remain accurate.",
          "Paused background disk polling every 1.5s while the Tray Popover is hidden, eliminating I/O contention during photo copy.",
        ],
      },
    ],
  },
  {
    version: "v3.4.0",
    date: "2026-11-12",
    title: "Tái thiết giao diện Contact the Sheet & Bộ nhận diện Logo Camera Light mới",
    titleEn: "Contact the Sheet UI Redesign & New Camera Light App Icon",
    sections: [
      {
        title: "Contact the Sheet — Quản lý Tab thông minh & Tái thiết giao diện",
        titleEn: "Contact the Sheet — Smart Tab Management & Minimalist Redesign",
        type: "improvement",
        items: [
          "Tái thiết toàn bộ giao diện Contact the Sheet theo phong cách tối giản, gọn gàng, loại bỏ các nhãn màu rực và bố cục rườm rà.",
          "Khung chọn Tab ở Thực thi Batch tự động thu gọn khi có nhiều tab (chỉ hiển thị bản tóm tắt gọn gàng và có thể mở rộng kèm ô tìm kiếm nhanh).",
          "Bổ sung nút \"Bỏ chọn tất cả\" và \"Chọn tất cả\" ngay trên thanh Thực thi Batch, cho phép bỏ chọn tự do hoặc gỡ từng tab khỏi danh sách thực thi.",
          "Hỗ trợ \"Hoàn tác\" khi lỡ bấm \"Áp dụng cho tất cả Tab\" và cho phép bật/tắt áp dụng cấu hình riêng lẻ cho từng tab trong Cấu hình Sheet.",
        ],
        itemsEn: [
          "Redesigned the entire Contact the Sheet interface with a cleaner minimalist aesthetic, removing loud badges and cluttered layouts.",
          "Batch Runner tab selector automatically collapses when many tabs exist, showing a compact summary expandable with quick search.",
          "Added \"Deselect All\" and \"Select All\" actions directly in Batch Runner, allowing individual tab toggling or removal.",
          "Added \"Undo\" support for \"Apply to all tabs\" and per-tab configuration toggle in Sheet Settings.",
        ],
      },
      {
        title: "Bộ nhận diện Logo App mới (Camera Lens Light Theme)",
        titleEn: "New Brand Iconography (Camera Lens Light Theme)",
        type: "design",
        items: [
          "Thiết kế lại biểu tượng ứng dụng (App Icon & Brand Logo) trên nền sáng tinh tế, khung máy ảnh tối giản bên ngoài bao bọc biểu tượng hình học DH bên trong ống kính.",
          "Đồng bộ nhất quán biểu tượng giao diện sáng trên thanh Dock, Sidebar, Launcher và toàn bộ hệ thống.",
        ],
        itemsEn: [
          "Redesigned App Icon & Brand Logo on a crisp light canvas with a minimalist camera frame and geometric DH lens motif.",
          "Synchronized light iconography consistently across Dock, Sidebar, Launcher, and system surfaces.",
        ],
      },
    ],
  },
  {
    version: "v3.3.0",
    date: "2026-11-11",
    title: "Nâng cấp Chuyển đổi file - Sửa ngày chụp EXIF hàng loạt hiệu năng cao",
    titleEn: "MVD Convert Upgrade - High-performance batch EXIF capture date fixer",
    sections: [
      {
        title: "Sửa ngày chụp EXIF hàng loạt",
        titleEn: "Batch EXIF Capture Date Fixer",
        type: "feature",
        items: [
          "Tích hợp tính năng \"Sửa ngày chụp\" trực tiếp vào quy trình Chuyển đổi file hiện tại mà không thay đổi thao tác chọn nguồn đầu vào hay thư mục xuất.",
          "Quét nhanh header EXIF và phân loại tự động thành 4 nhóm: Hợp lệ, Có dấu hiệu bất thường, Thiếu metadata và Không xác định.",
          "Nhận diện linh hoạt các bất thường: thiếu DateTimeOriginal/CreateDate, lệch thời gian giữa các trường, ngày reset thiết bị (1970, 1980, 1999, 2000), ngày tương lai, định dạng ngày lỗi; đồng thời giữ nguyên tuyệt đối các ảnh cũ có ngày chụp hợp lệ.",
          "Hỗ trợ 4 nguồn ngày giờ thay thế: Ngày hiện tại, Ngày tạo file (Creation/Modification Time), Ngày tùy chỉnh (hỗ trợ giữ nguyên giờ chụp gốc) và Ngày từ ảnh tham chiếu.",
          "Đồng bộ nhất quán 6 trường ngày giờ & múi giờ EXIF, bảo toàn 100% thông tin máy ảnh (Camera Model, Lens, ISO, khẩu độ, tốc độ, GPS, Rating, ICC Color Profile).",
        ],
        itemsEn: [
          "Integrated \"Fix Capture Date\" directly into MVD Convert without altering input selection or output workflows.",
          "Fast EXIF header scan categorizing files into 4 groups: Valid, Anomalous, Missing metadata, and Unknown.",
          "Detects missing DateTimeOriginal/CreateDate, mismatched timestamps, camera reset dates (1970/1980/1999/2000), future dates, and malformed values while strictly preserving valid photos.",
          "Supports 4 timestamp sources: Current date, File timestamps, Custom date (with original time preservation), and Reference photo.",
          "Updates all 6 EXIF timestamp & timezone tags while preserving 100% camera metadata (Camera Model, Lens, ISO, shutter, GPS, Rating, ICC Profile).",
        ],
      },
      {
        title: "Kiến trúc Metadata-Only & Tăng tốc đa luồng",
        titleEn: "Metadata-Only Architecture & Multi-threaded Speed",
        type: "improvement",
        items: [
          "Sửa metadata trực tiếp trên container đầu ra (JPEG APP1, PNG eXIf, WebP EXIF, TIFF IFD) không giải mã hay nén lại pixel ảnh, đạt tốc độ trên 9.000 file JPEG/giây.",
          "Thực thi chuyển đổi đa luồng giới hạn tài nguyên kèm cơ chế ghi nguyên tử (atomic rollback) và xác thực EXIF tự động sau xử lý.",
          "Bổ sung thẻ báo cáo kết quả xử lý chi tiết và nút dừng tiến trình trực tiếp.",
        ],
        itemsEn: [
          "Updates metadata directly in output containers (JPEG APP1, PNG eXIf, WebP EXIF, TIFF IFD) without re-encoding pixels, exceeding 9,000 JPEG files/sec.",
          "Resource-bounded parallel processing with atomic write rollback and automatic post-write EXIF verification.",
          "Added detailed processing summary card and live stop button.",
        ],
      },
    ],
  },
  {
    version: "v3.2.0",
    date: "2026-11-11",
    title: "Tinh gọn Contact the Sheet - Bỏ chức năng đồng bộ tên thư mục con",
    titleEn: "Streamlined Contact the Sheet - Removed subfolder rename sync",
    sections: [
      {
        title: "Contact the Sheet",
        titleEn: "Contact the Sheet",
        type: "improvement",
        items: [
          "Gỡ bỏ chức năng \"Đồng bộ tên thư mục con\" cùng toàn bộ quy trình đổi tên thư mục tự động. Ứng dụng không còn đổi tên thư mục của bạn trên đĩa trong quá trình xử lý.",
          "Thanh điều hướng gọn hơn: các tab còn lại gồm Thực thi Batch, Cấu hình Sheet, Google Drive và Nhật ký.",
          "Thực thi Batch vẫn nhận thư mục bằng kéo thả hoặc nút chọn thư mục, với tính năng mở rộng thư mục thông minh giữ nguyên như trước.",
        ],
        itemsEn: [
          "Removed \"Subfolder Name Sync\" and automatic folder renaming so folders on disk are never altered during processing.",
          "Streamlined navigation tabs to Batch Runner, Sheet Settings, Google Drive, and History.",
          "Batch Runner retains drag-and-drop and folder picker with smart subfolder expansion.",
        ],
      },
      {
        title: "Sửa lỗi hệ thống",
        titleEn: "System Fixes",
        type: "fix",
        items: [
          "Khắc phục lỗi ứng dụng tự đóng khi chạy ở chế độ phát triển trên macOS do khởi tạo thông báo hệ thống ngoài gói ứng dụng.",
        ],
        itemsEn: [
          "Fixed unexpected crash in macOS development mode caused by initializing native notifications outside an app bundle.",
        ],
      },
    ],
  },
  {
    version: "v3.1.0",
    date: "2026-11-02",
    title: "Giao diện mới Devhouse Liquid Glass - Gọn gàng, hiện đại và nhất quán",
    titleEn: "Devhouse Liquid Glass UI Redesign - Clean, modern, and consistent",
    sections: [
      {
        title: "Ngôn ngữ thiết kế Liquid Glass",
        titleEn: "Liquid Glass Design Language",
        type: "design",
        items: [
          "Thiết kế lại toàn bộ giao diện theo phong cách Liquid Glass: bề mặt kính mờ trong suốt, viền sáng tinh tế và bóng đổ mềm, nổi trên nền canvas có ánh màu thương hiệu.",
          "Bảng màu mới theo nhận diện Devhouse (xanh ngọc, cyan, xanh dương trên nền navy). Các tông tím, hồng, cam rời rạc được hợp nhất để toàn bộ ứng dụng đồng nhất một hệ màu.",
          "Hoàn thiện song song chế độ Sáng và Tối: kính trắng mờ trên nền sáng, kính khói trên nền navy sâu, cửa sổ hộp thoại được làm đặc hơn để luôn dễ đọc.",
          "Bộ icon đơn sắc nét mảnh thống nhất, loại bỏ emoji và các biểu tượng nhiều màu gây rối mắt.",
          "Chuẩn hóa nhãn tiêu đề sang kiểu viết hoa đầu câu, bỏ các nhãn chữ in hoa giãn chữ.",
        ],
        itemsEn: [
          "Redesigned the entire UI with Liquid Glass aesthetics: translucent frosted glass surfaces, crisp highlights, and soft shadows.",
          "Unified Devhouse brand palette (emerald, cyan, navy) replacing scattered purple, pink, and orange tones.",
          "Refined both Light and Dark themes with high-legibility solid modal backdrops.",
          "Unified monochrome thin-stroke iconography, removing cluttered emojis and multi-color icons.",
          "Standardized headings to sentence case.",
        ],
      },
      {
        title: "Thanh bên, thanh trên và tìm kiếm",
        titleEn: "Sidebar, TopBar, and Smart Search",
        type: "improvement",
        items: [
          "Thanh bên dạng tấm kính nổi bo góc, mục đang chọn hiển thị dạng viên kính nổi với icon màu thương hiệu.",
          "Chân thanh bên tinh gọn: gói bản quyền, ủng hộ tác giả, bộ chuyển giao diện Sáng, Tối, Tự động và thẻ tài khoản có chấm trạng thái trực tuyến.",
          "Thanh trên có nút quay lại Bảng điều khiển, tiêu đề lớn rõ ràng và nhãn cập nhật phiên bản dễ nhận biết.",
          "Thanh tìm kiếm thông minh dạng viên kính, danh sách kết quả trên tấm kính mờ.",
        ],
        itemsEn: [
          "Floating glass sidebar with pill active state and brand-accented icons.",
          "Refined sidebar footer with license status, donate trigger, 3-way theme switcher, and online user status card.",
          "TopBar with Back to Dashboard control, bold module titles, and clear update indicator.",
          "Pill-shaped Smart Search Bar with frosted glass dropdown results.",
        ],
      },
      {
        title: "Bảng điều khiển thông minh",
        titleEn: "Smart Launcher Dashboard",
        type: "feature",
        items: [
          "Lời chào theo thời điểm trong ngày kèm ngày tháng và số ứng dụng đang sẵn sàng.",
          "Thẻ ứng dụng mới với biểu tượng màu thương hiệu, trạng thái bản quyền dạng chấm màu và thao tác mở nhanh.",
          "Khu vực Hiệu suất hệ thống và Kho Tài Nguyên Creative được làm lại gọn gàng, dễ quét thông tin.",
        ],
        itemsEn: [
          "Time-of-day personalized greeting with localized date and ready-app counter.",
          "Refreshed app cards with brand icons, license indicator dots, and quick launch.",
          "Reorganized System Performance Monitor and Creative Resources sections.",
        ],
      },
      {
        title: "Sửa lỗi giao diện",
        titleEn: "UI Bug Fixes",
        type: "fix",
        items: [
          "Sửa lỗi viền mặc định ghi đè các phần tử cần viền trong suốt, khiến một số nút và hàng hiển thị khung thừa.",
          "Bổ sung tiêu đề cho màn Trung tâm thông báo trên thanh trên.",
        ],
        itemsEn: [
          "Fixed default border overrides on transparent elements causing unwanted outlines on buttons and rows.",
          "Added Notification Center title in TopBar.",
        ],
      },
    ],
  },
  {
    version: "v3.0.0",
    date: "2026-10-31",
    title: "Phát hành phiên bản lớn 3.0 - Nâng cấp Trung tâm Thông báo, Tinh chỉnh Khay hệ thống và Tối ưu Bản phát hành",
    titleEn: "Major Release 3.0 - Notification Center Upgrade, Menu Bar Popover & Build Pipeline",
    isCurrent: false,
    sections: [
      {
        title: "Khay hệ thống Menu Bar và Điều khiển Nhanh",
        titleEn: "Menu Bar System Tray & Quick Controls",
        type: "improvement",
        items: [
          "Cấu hình biểu tượng thanh trạng thái hiển thị chuẩn màu trắng sắc nét trên menu bar macOS, khắc phục triệt để lỗi biểu tượng bị ám đen khi chuyển đổi chế độ hệ thống.",
          "Khôi phục và chuẩn hóa biểu tượng Lọc ảnh Pro (kính lúp kết hợp khung ảnh) đồng bộ trên toàn bộ thanh điều hướng chính và khay điều khiển nhanh.",
          "Chuẩn hóa tên gọi Contact Sheet và sửa lỗi điều hướng truy cập nhanh từ Menu Bar popover vào giao diện ứng dụng chính.",
          "Căn chỉnh vị trí cửa sổ Overview bám sát chân Menu Bar macOS, tối ưu trải nghiệm bật mở mượt mà và trực quan.",
        ],
        itemsEn: [
          "Configured crisp monochrome macOS menu bar template icon across system appearance changes.",
          "Restored consistent Photo Picker Pro icon across main navigation and quick controls.",
          "Standardized Contact Sheet naming and fixed quick navigation from the Menu Bar popover.",
          "Aligned Menu Bar popover positioning cleanly beneath the macOS Menu Bar.",
        ],
      },
      {
        title: "Trung tâm Thông báo và Cảnh báo Tới hạn",
        titleEn: "Notification Center & Urgent Alerts",
        type: "feature",
        items: [
          "Tích hợp kiến trúc thông báo bản địa trên macOS thông qua UserNotifications.framework, hỗ trợ hiển thị banner và âm thanh theo thời gian thực.",
          "Nâng cấp kiến trúc lưu trữ Cấu hình thông báo bằng persistent store: Đảm bảo toàn bộ thiết lập studio, tab, điều kiện quét và quyền thông báo được lưu trữ vĩnh viễn và đồng bộ ngay cả khi chuyển tab hoặc khởi động lại ứng dụng.",
          "Cá nhân hóa nội dung thông báo khẩn cấp theo thông tin tài khoản người dùng đang đăng nhập.",
          "Tối ưu quy trình quét hạn và đồng bộ dữ liệu thông báo tức thời giữa cửa sổ chính và khay hệ thống.",
          "Tự động ẩn các nút kiểm tra thông báo trong bản phát hành chính thức, giữ giao diện gọn gàng.",
        ],
        itemsEn: [
          "Integrated native macOS UserNotifications.framework with banner and sound support.",
          "Upgraded persistent storage for notification config across studio tabs, rules, and permissions.",
          "Personalized urgent alert messages using the active user account details.",
          "Optimized due-date scanning and real-time sync between main window and tray popover.",
          "Automatically hid developer test buttons in production releases.",
        ],
      },
      {
        title: "Tối ưu hóa Hệ thống và Quy trình Phát hành",
        titleEn: "System Optimization & Release Pipeline",
        type: "fix",
        items: [
          "Khắc phục triệt để lỗi biên dịch liên kết thư viện nền tảng trên quy trình phát hành macOS Apple Silicon và Intel.",
          "Tối ưu hóa hiệu ứng chuyển đổi chủ đề Sáng và Tối, loại bỏ hoàn toàn độ trễ hiển thị.",
          "Cải thiện độ ổn định và quản lý tài nguyên khi ứng dụng chạy chế độ nền.",
        ],
        itemsEn: [
          "Fixed native framework linking errors for macOS Apple Silicon and Intel release builds.",
          "Removed visual lag when switching between Light and Dark themes.",
          "Improved background stability and resource management.",
        ],
      },
    ],
  },
  {
    version: "v2.9.6",
    date: "2026-10-31",
    title: "Trung tâm Thông báo Hệ điều hành, Tối ưu Menu Bar Popover và Chuyển đổi Theme Siêu Mượt",
    titleEn: "Native OS Notifications, Menu Bar Popover Polish & Ultra-smooth Theme Transitions",
    isCurrent: false,
    sections: [
      {
        title: "Trung tâm Thông báo và Cảnh báo Khẩn cấp",
        titleEn: "Notification Center & Urgent Reminders",
        type: "feature",
        items: [
          "Tích hợp UserNotifications.framework chuẩn native Cocoa trên macOS: Quản lý quyền thông báo hệ thống và đăng ký ứng dụng DH Studio Pro chính thức trong Cài đặt Hệ thống macOS.",
          "Cá nhân hóa nội dung thông báo khẩn cấp theo họ và tên tài khoản người dùng đang đăng nhập.",
          "Chuẩn hóa cấu trúc Trung tâm thông báo: Tập trung vào 3 tác vụ chính gồm Lịch sử thông báo, Đọc tất cả và Cấu hình thông báo.",
          "Tự động ẩn nút kiểm tra thông báo trên các bản phát hành chính thức, chỉ hiển thị trong môi trường phát triển (DEV).",
          "Tự động đồng bộ hóa lịch sử thông báo theo thời gian thực giữa cửa sổ chính và thanh menu ngầm.",
        ],
        itemsEn: [
          "Integrated native macOS Cocoa UserNotifications.framework with System Settings registration.",
          "Personalized urgent alerts using the signed-in user's full name.",
          "Focused Notification Center around History, Mark All Read, and Settings.",
          "Hidden dev-only test notification buttons in production builds.",
          "Real-time notification history sync between main window and tray menu.",
        ],
      },
      {
        title: "Menu Bar Tray Popover và Trải nghiệm Điều khiển Nhanh",
        titleEn: "Menu Bar Tray Popover & Quick Controls",
        type: "improvement",
        items: [
          "Căn chỉnh vị trí cửa sổ Overview nằm sát chân Menu Bar macOS, khắc phục triệt để khoảng cách trống dư thừa.",
          "Lược bỏ thẻ trạng thái ổn định khi không có khách cần lọc gấp, chỉ hiển thị cảnh báo nổi bật khi phát hiện khách hàng tới hạn hoặc quá hạn.",
          "Áp dụng biểu tượng ứng dụng Lọc ảnh Pro chuẩn nhận diện thay cho các ký tự phụ.",
          "Tích hợp hiệu ứng drop-down trượt nhẹ và bo góc tròn 22px chuẩn thiết kế macOS Control Center hiện đại.",
          "Cấu hình Tray Icon thành Template Image, tự động đổi màu sắc tương thích hoàn hảo với cả chế độ Menu Bar sáng và tối.",
        ],
        itemsEn: [
          "Flush popover alignment directly underneath the macOS Menu Bar.",
          "Simplified Overview status to highlight only when urgent or overdue shoots exist.",
          "Applied official Photo Picker Pro icon across quick actions.",
          "Added smooth slide-down motion with modern 22px macOS Control Center styling.",
          "Configured Tray Icon as Template Image adapting to dark and light menu bars.",
        ],
      },
      {
        title: "Tối ưu hóa Hiệu năng và Đồng bộ Giao diện",
        titleEn: "Performance Optimization & Visual Sync",
        type: "fix",
        items: [
          "Loại bỏ hoàn toàn hiện tượng giật khung hình khi đổi chế độ Sáng, Tối và Auto nhờ cơ chế đồng pha chuyển tiếp 250ms toàn diện.",
          "Tách biệt hoạt ảnh co giãn của thanh bên khỏi luồng xử lý màu sắc để loại bỏ độ trễ tính toán bố cục DOM.",
          "Đồng bộ tức thời trạng thái giao diện giữa cửa sổ ứng dụng chính và cửa sổ thả xuống từ Menu Bar.",
          "Khôi phục thanh tiêu đề cửa sổ chuẩn macOS và bổ sung vùng kéo di chuyển cửa sổ linh hoạt trên thanh công cụ.",
          "Gỡ bỏ mục cấu hình thông báo trùng lặp trong Cài đặt hệ thống để tối ưu hóa không gian làm việc.",
        ],
        itemsEn: [
          "Eliminated frame stutters when switching Light/Dark/System themes using unified 250ms transitions.",
          "Isolated sidebar collapse animation from color transitions.",
          "Synchronized theme state instantaneously between main window and tray popover.",
          "Restored native macOS title bar ergonomics and flexible window drag regions.",
          "Removed duplicate notification config section from System Settings.",
        ],
      },
    ],
  },
  {
    version: "v2.9.5",
    date: "2026-10-31",
    title: "Hệ thống Giám sát Hiệu suất Thực (Real System Monitor), Tùy chỉnh Avatar & Trải nghiệm Dashboard Pro",
    titleEn: "Real OS System Performance Monitor, Custom Avatar & Dashboard Pro",
    isCurrent: false,
    sections: [
      {
        title: "Hệ thống Giám sát Hiệu suất Thực (Native OS System Performance)",
        titleEn: "Native OS System Performance Monitor",
        type: "feature",
        items: [
          "Thu thập 100% dữ liệu thực từ hệ điều hành qua Rust backend: Theo dõi riêng biệt CPU (%) và RAM (MB/GB) tiêu thụ bởi tiến trình DH Studio Pro.",
          "Theo dõi toàn bộ tài nguyên máy tính: Tổng CPU Usage, RAM (Tổng, Đã dùng, Còn trống, Tỷ lệ %) với biểu đồ sparkline mượt mà.",
          "Cơ chế Memory Pressure thông minh: Đánh giá áp lực bộ nhớ thực tế (macOS kernel pressure & Windows commit/paging) với 2 trạng thái rõ ràng NORMAL và WARNING.",
          "Storage Disks: Vòng tròn đo dung lượng Circular Progress Rings tự động nhận diện tất cả ổ đĩa và hiển thị dung lượng trống (Free Space) nổi bật.",
        ],
        itemsEn: [
          "Collects 100% real OS metrics via Rust backend, tracking DH Studio Pro CPU (%) and RAM usage.",
          "Monitors system-wide CPU and RAM (Total, Used, Free, %) with live sparkline charts.",
          "Reports real macOS kernel & Windows memory pressure with NORMAL / WARNING indicators.",
          "Detects all mounted disks and renders Circular Progress Rings highlighting free space.",
        ],
      },
      {
        title: "Tùy biến Avatar & Trải nghiệm người dùng",
        titleEn: "Avatar Customization & UX",
        type: "improvement",
        items: [
          "Hỗ trợ người dùng đổi ảnh đại diện cá nhân hóa (PNG, JPG, WebP), tự động crop vuông tâm và tối ưu hóa kích thước 256×256 px.",
          "Mặc định sử dụng icon User trang nhã thay vì chữ cái viết tắt.",
          "Đồng bộ avatar thời gian thực giữa thanh bên và modal Tài khoản & Bảo mật.",
          "Hỗ trợ mở popover menu tài khoản đầy đủ ngay cả khi thanh bên ở chế độ thu gọn (collapsed).",
        ],
        itemsEn: [
          "Upload custom profile avatars (PNG, JPG, WebP) with automatic center-square cropping to 256x256 px.",
          "Refined default User icon instead of monogram letters.",
          "Real-time avatar synchronization between Sidebar and Account & Security modal.",
          "Supports full account popover even when Sidebar is collapsed.",
        ],
      },
      {
        title: "Tái cấu trúc Bố cục Dashboard & Điều hướng chuyên nghiệp",
        titleEn: "Dashboard Layout Overhaul & Navigation",
        type: "design",
        items: [
          "Thiết lập chuẩn thứ tự ưu tiên: 1. Ứng dụng làm việc (4 công cụ cốt lõi) -> 2. Kho Tài Nguyên Creative -> 3. Giám sát hiệu suất.",
          "Mô tả các ứng dụng hiển thị trọn vẹn, không còn bị cắt ngắn ba chấm.",
          "Đổi icon Bảng điều khiển thành Trang chủ (Home) trực quan.",
          "Bổ sung hiệu ứng chuyển động scale mượt mà (animate-app-enter) khi mở và chuyển đổi giữa các ứng dụng.",
        ],
        itemsEn: [
          "Structured Dashboard hierarchy: 1. Studio Apps -> 2. Creative Resources -> 3. System Performance.",
          "Removed truncated ellipsis from app descriptions.",
          "Replaced Dashboard icon with intuitive Home icon.",
          "Added subtle entrance animation when launching or switching modules.",
        ],
      },
      {
        title: "Hoàn thiện Thanh bên (Sidebar) & Nhận diện thương hiệu",
        titleEn: "Sidebar Polish & Branding",
        type: "design",
        items: [
          "Bố trí chân thanh bên thoáng đãng: Mỗi mục một hàng riêng biệt (Bản quyền, Key, Donate, Theme Switcher 3 chế độ, Thẻ người dùng và Trạng thái).",
          "Loại bỏ viền và nền của khối chân trang, hòa quyện tự nhiên với Sidebar.",
          "Đồng bộ tuyệt đối chiều cao thanh TopBar và Header thanh bên (h-14 / 56px), căn thẳng hàng 100% đường border ngang.",
          "Chuẩn hóa tên thương hiệu Devhouse Software (chữ h viết thường).",
        ],
        itemsEn: [
          "Spacious sidebar footer rows for License, Key, Donate, Theme Switcher, and User profile.",
          "Borderless seamless footer styling integrated into the sidebar surface.",
          "Matched 56px header height between TopBar and Sidebar for pixel-aligned borders.",
          "Standardized Devhouse Software casing.",
        ],
      },
    ],
  },
  {
    version: "v2.9.4",
    date: "2026-10-30",
    title: "Tái thiết lập giao diện Studio Dashboard toàn diện & Tối ưu không gian làm việc macOS",
    titleEn: "Complete Studio Dashboard UI Redesign & macOS Workspace Polish",
    isCurrent: false,
    sections: [
      {
        title: "Tái thiết lập giao diện Studio Dashboard & Phong cách macOS hiện đại",
        titleEn: "Studio Dashboard Redesign & Modern macOS Style",
        type: "design",
        items: [
          "Tái thiết kế toàn diện bảng màu Light Mode & Dark Mode theo ngôn ngữ thiết kế macOS hiện đại, độ tương phản mượt mà, chiều sâu viền và bóng đổ mềm mại.",
          "Tối ưu bố cục Launcher với 2 Hero Card lớn đặt song song: Thẻ giám sát bộ nhớ & RAM với đồng hồ đo tỷ lệ tròn (Circular Gauge) cùng Thẻ tiêu điểm Kho Tài Nguyên Creative.",
          "Tinh chỉnh 4 ứng dụng Studio (Photo Picker Pro, Contact The Sheet, MVD Convert, Thống kê) thành các khối module nhỏ gọn, cân đối, hiển thị đầy đủ thông tin trạng thái.",
          "Căn giữa bảng điều khiển tự nhiên theo chiều dọc và ngang, thu gọn khoảng cách (gap) giữa các thành phần, loại bỏ khoảng trống thừa trên màn hình độ phân giải cao.",
        ],
        itemsEn: [
          "Redesigned Light & Dark palettes inspired by modern macOS ergonomics with balanced depth and shadows.",
          "Balanced side-by-side Launcher hero cards for System Monitor and Creative Resources.",
          "Refined all 4 Studio modules into compact, balanced cards with clear status indicators.",
          "Tightened spacing and natural alignment for high-resolution displays.",
        ],
      },
      {
        title: "Tối ưu hóa Thanh bên sinh thái (Ecosystem Sidebar) & Hub người dùng",
        titleEn: "Ecosystem Sidebar & User Hub Optimization",
        type: "design",
        items: [
          "Tích hợp đầy đủ nhận diện thương hiệu DH Studio Pro & Devhouse Software cùng logo chính thức.",
          "Chuyển toàn bộ thông tin người dùng, trạng thái gói bản quyền (Full App), mã kích hoạt Key và nút ủng hộ Cafe xuống chân thanh bên (footer) gọn gàng, trực quan.",
          "Lược bỏ các mục điều hướng không cần thiết như Thùng rác và Lịch sử thao tác trên thanh bên chính.",
        ],
        itemsEn: [
          "Integrated official DH Studio Pro & Devhouse Software branding.",
          "Moved account info, license status, license key activation, and Donate trigger cleanly into the sidebar footer.",
          "Removed redundant navigation items from the primary sidebar.",
        ],
      },
      {
        title: "Tinh chỉnh thanh điều hướng TopBar & Trải nghiệm tổng thể",
        titleEn: "TopBar & Overall UX Refinements",
        type: "improvement",
        items: [
          "Bổ sung bộ chuyển đổi giao diện hình con nhộng trực quan (Tự động, Sáng, Tối) ngay trên thanh TopBar.",
          "Lược bỏ các tab con chuyển chế độ riêng lẻ của Photo Picker trên thanh đầu trang, tăng cường diện tích thanh tìm kiếm thông minh.",
          "Căn chỉnh đối xứng lề trái và phải (16px) cho khu vực làm việc chính của ứng dụng.",
          "Đảm bảo 100% tất cả các tính năng, kết nối IPC và luồng xử lý dữ liệu của các ứng dụng hoạt động ổn định và chính xác.",
        ],
        itemsEn: [
          "Added segmented theme pill switcher (System, Light, Dark) directly in TopBar.",
          "Removed redundant Photo Picker sub-tabs in TopBar to give more space to Smart Search.",
          "Unified 16px horizontal padding across the workspace.",
          "Verified stability of all module workflows and IPC commands.",
        ],
      },
    ],
  },
  {
    version: "v2.9.3",
    date: "2026-10-28",
    title: "Tự động đổi trạng thái lọc & Khắc phục phân quyền Batch Contact The Sheet",
    titleEn: "Auto Filter Status Update & Contact The Sheet Batch Permissions Fix",
    sections: [
      {
        title: "Tự động hóa Trạng thái lọc (Status Automation)",
        titleEn: "Filter Status Automation",
        type: "feature",
        items: [
          "Tự động điền trạng thái lọc hoàn tất (ví dụ 'Đã lọc') vào cột Trạng Thái Lọc (cột M) trên Google Sheets khi thực thi Batch hoàn thành cùng Tên Editor và Link Edit.",
          "Bổ sung cấu hình quyền READ_WRITE và chính sách ALWAYS_REPLACE cho cột Trạng Thái Lọc trong Studio Workspace Wizard.",
          "Bảo tồn tuyệt đối các cột có công thức bảo vệ hoặc khi ô tính đã có sẵn trạng thái hoàn tất để tránh ghi đè dư thừa.",
        ],
        itemsEn: [
          "Automatically writes completed filter status (e.g. 'Đã lọc') to the Filter Status column on Google Sheets alongside Editor and Edit Link.",
          "Added READ_WRITE and ALWAYS_REPLACE policy for Filter Status column in Workspace Wizard.",
          "Strictly preserves formula cells and already-completed statuses.",
        ],
      },
      {
        title: "Khắc phục phân quyền ghi và đồng bộ Drive trong Batch Runner",
        titleEn: "Fixed Write Permissions & Drive Resolver in Batch Runner",
        type: "fix",
        items: [
          "Loại bỏ hoàn toàn lỗi hiển thị sai 'Bị chặn bởi quyền hạn' khi chuyển tiếp tự động từ màn hình Đồng bộ tên thư mục sang Thực thi Batch.",
          "Nâng cấp thuật toán Strategy A của Drive Resolver: Tự động phát hiện và định vị thư mục thành phẩm con (leaf delivery folder) trên Google Drive ngay cả khi tên thư mục con vừa được đổi đồng bộ khớp với tên thư mục khách hàng.",
          "Phân giải phân quyền ghi đa tab (effectiveProfile): Đánh giá quyền ghi và phạm vi dòng (rowScope) chuẩn xác theo từng Tab riêng biệt, ngăn ngừa xung đột phân quyền chéo giữa các tháng.",
          "Khi thiếu liên kết Drive, chuyển trạng thái thông minh sang NEEDS_REVIEW kèm hướng dẫn kiểm tra Google Drive Desktop thay vì báo lỗi đỏ giả lập.",
        ],
        itemsEn: [
          "Fixed false 'Blocked by permission' errors when handing off folders to Batch Runner.",
          "Upgraded Drive Resolver Strategy A to accurately locate leaf delivery folders on Google Drive.",
          "Per-tab effectiveProfile write-permission resolution preventing cross-month permission conflicts.",
          "Gracefully marks missing Drive links as NEEDS_REVIEW with troubleshooting hints.",
        ],
      },
      {
        title: "Tối ưu hóa hiệu năng & độ trễ chuyển tiếp",
        titleEn: "Handoff Performance Optimization",
        type: "improvement",
        items: [
          "Tăng độ trễ chuyển tiếp an toàn lên 1.5s để Google Drive Desktop kịp đồng bộ siêu dữ liệu file system cục bộ.",
          "Tối ưu bộ nhớ đệm spreadsheetMergesCache với phương thức dọn dẹp tức thì, bảo đảm dữ liệu ô gộp luôn tươi mới.",
        ],
        itemsEn: [
          "Increased safe transition delay to 1.5s for Google Drive Desktop local metadata sync.",
          "Added instant cache invalidation to spreadsheetMergesCache so merged cells remain fresh.",
        ],
      },
    ],
  },
  {
    version: "v2.9.2",
    date: "2026-10-26",
    title: "Chế độ Auto Find thông minh đa khách hàng & Hiệu ứng Thùng rác tương tác",
    titleEn: "Smart Multi-Customer Auto Find & Interactive Trash Toss Animation",
    sections: [
      {
        title: "Auto Find — Lọc liên tục nhiều khách hàng",
        titleEn: "Auto Find — Continuous Multi-Customer Filtering",
        type: "feature",
        items: [
          "Bổ sung công tắc Auto Find cạnh chế độ so khớp, tự động truy xuất và nạp mã khách tiếp theo từ Google Sheet ngay khi hoàn tất khách trước.",
          "Cơ chế an toàn: Dừng lại ở bước nạp mã để người dùng kiểm tra danh sách mã trước khi bấm Quét file.",
          "Tự động nhận diện tháng trong tên thư mục (ví dụ '20-10' -> Tháng 10) để ưu tiên quét đúng tab tháng tương ứng.",
          "Bộ nhớ đệm thông minh (Cache TTL 5 phút) ngăn chặn vượt hạn mức Google Sheets API (HTTP 429) và cho tốc độ chuyển tiếp tức thì (<1ms).",
          "Tự động đồng bộ trạng thái 'Đã lọc' của khách cũ ở chế độ chạy ngầm (asynchronous background), không làm nghẽn hoặc đơ luồng xử lý khách mới.",
          "Bổ sung nút 'Bỏ qua sang khách tiếp' trên thanh thông báo khi khách chưa có mã chọn trên Google Sheet.",
        ],
        itemsEn: [
          "Added Auto Find toggle beside match mode to automatically fetch and load codes for the next customer when one completes.",
          "Pauses cleanly at the loaded code list so you can review before scanning.",
          "Infers sheet month tab automatically from folder date patterns.",
          "5-minute smart cache prevents Google Sheets API rate limits (HTTP 429) with <1ms transitions.",
          "Updates previous customer 'Đã lọc' status asynchronously in the background without blocking.",
          "Added 'Skip to next customer' button when a customer has no codes on Sheet.",
        ],
      },
      {
        title: "Hiệu ứng Thùng rác tương tác (macOS Trash Toss)",
        titleEn: "Interactive Trash Toss Animation",
        type: "design",
        items: [
          "Thùng rác thu nhỏ (Mini Trash Bin) tại cột Dashboard với nắp mở đóng tương tác bật nảy.",
          "Hiệu ứng vo tròn thẻ khách thành cục giấy 3D ném theo quỹ đạo parabol qua màn hình vào thùng rác.",
          "Vị trí bắt đầu vo giấy được căn chỉnh chính xác ngay tại vị trí ô khách ở cột hàng đợi bên trái.",
          "Tích hợp âm thanh đáp rác chân thực trích xuất từ hệ thống CoreAudio của macOS (trash.wav).",
          "Cửa sổ Quản lý khách đã đá ra (Ejected Customers Modal) hỗ trợ xem lại, khôi phục về hàng đợi hoặc dọn sạch thùng rác (chỉ quản lý trong app, hoàn toàn không xoá file trên ổ đĩa).",
        ],
        itemsEn: [
          "Mini Trash Bin in the dashboard column with spring-animated lid.",
          "3D crumpled-paper toss animation following a parabolic arc from the customer row into the bin.",
          "Includes crisp CoreAudio sound feedback (trash.wav).",
          "Ejected Customers Modal supports reviewing, restoring to queue, or clearing (UI queue only, never deletes disk files).",
        ],
      },
      {
        title: "Sửa lỗi & Tối ưu luồng truy xuất trang tính",
        titleEn: "Sheet Extraction Fixes",
        type: "fix",
        items: [
          "Khắc phục sự cố lệch tên Tab Google Sheet giữa Auto Find và modal Truy xuất trang tính thủ công.",
          "Xử lý tự động trường hợp nhiều hàng trùng khớp hoặc điểm tương đồng (NEEDS_REVIEW) bằng cách chọn hàng có điểm cao nhất chưa bị đánh dấu 'Đã lọc'.",
          "Bổ sung cơ chế Timeout 8s cho các lệnh gọi API Google Sheets, loại bỏ triệt để hiện tượng đứng app hoặc tắc nghẽn hàng đợi.",
        ],
        itemsEn: [
          "Fixed sheet tab mismatch between Auto Find and manual Sheet Extractor modal.",
          "Automatically selects the highest-scoring unfiltered row when multiple candidates exist.",
          "Added 8s timeout to Google Sheets API requests to prevent queue stalls.",
        ],
      },
    ],
  },
  {
    version: "v2.9.1",
    date: "2026-10-26",
    title: "Làm mới giao diện Đăng nhập & Bổ sung Lịch sử phiên bản (Release Notes)",
    titleEn: "Refreshed Login UI & Added Release Notes History",
    sections: [
      {
        title: "Làm mới giao diện Đăng nhập (Auth UI)",
        titleEn: "Auth UI Refresh",
        type: "design",
        items: [
          "Bố cục Split-screen hiện đại: Trình chiếu ảnh dự án mượt mà bên trái, biểu mẫu đăng nhập liền mạch bên phải.",
          "Tích hợp bộ chọn giao diện tức thì (Sáng / Tối / Theo hệ thống) ngay trên màn hình đăng nhập.",
          "Bo góc mềm mại chuẩn mực (rounded-xl) cho tất cả các trường dữ liệu và nút bấm.",
          "Căn chỉnh hàng tùy chọn Tự động đăng nhập, Lưu mật khẩu và Quên mật khẩu chống tràn dòng trên màn hình hẹp.",
        ],
        itemsEn: [
          "Modern split-screen layout with showcase gallery and clean auth form.",
          "Instant Light / Dark / System theme toggle right on LoginPage.",
          "Standardized rounded-xl corners across inputs and buttons.",
          "Responsive alignment for Auto Login, Remember Password, and Forgot Password links.",
        ],
      },
      {
        title: "Lịch sử phiên bản & Ghi chú phát hành (Release Notes)",
        titleEn: "Version History & Release Notes",
        type: "feature",
        items: [
          "Bổ sung cửa sổ xem lịch sử 7 phiên bản gần nhất kèm ghi chú phát hành chi tiết từng bản cập nhật.",
          "Tích hợp linh hoạt vào Cài đặt chung, Thông tin phiên bản và Hộp thoại cập nhật ứng dụng.",
          "Tự động nhận diện và hiển thị giao diện thông báo phiên bản mới nhất thân thiện.",
        ],
        itemsEn: [
          "Added Release Notes modal displaying detailed changelogs for recent versions.",
          "Accessible from General Settings, Version Info, and the Update Dialog.",
          "Displays friendly up-to-date status notice when no update is pending.",
        ],
      },
      {
        title: "Sửa lỗi hiển thị đồ họa",
        titleEn: "Rendering Fixes",
        type: "fix",
        items: [
          "Khắc phục triệt để lỗi vỡ nền / ô vuông màu trên WebKit macOS khi chuyển đổi màn hình đăng nhập bằng dải màu Radial Gradients GPU.",
        ],
        itemsEn: [
          "Fixed macOS WebKit gradient tiling artifacts during login view transitions.",
        ],
      },
    ],
  },
  {
    version: "v2.9.0",
    date: "2026-10-25",
    title: "Làm mới giao diện toàn bộ ứng dụng & Tối ưu toàn diện",
    titleEn: "Full Application UI Refresh & Holistic Performance Optimization",
    sections: [
      {
        title: "Làm mới giao diện toàn bộ ứng dụng",
        titleEn: "Application UI Refresh",
        type: "design",
        items: [
          "Bảng màu mới đạt chuẩn tương phản cao, dễ đọc ở cả giao diện Sáng và Tối.",
          "Chữ lớn và rõ hơn (cỡ chữ tối thiểu tăng lên 11px), tăng độ tương phản.",
          "Giao diện gọn gàng, bớt icon gây nhiễu, chuẩn hóa các thẻ ứng dụng Launcher.",
          "Hỗ trợ bàn phím, con trỏ và chế độ giảm chuyển động của hệ điều hành tốt hơn.",
          "Đồng bộ thương hiệu DH Studio Pro trên toàn bộ hệ thống.",
        ],
        itemsEn: [
          "High-contrast accessible palette across Light and Dark modes.",
          "Improved typography legibility with minimum 11px UI sizing.",
          "Cleaner Launcher cards with reduced visual clutter.",
          "Improved keyboard accessibility, focus indicators, and reduced-motion support.",
          "Consistent DH Studio Pro branding across all modules.",
        ],
      },
      {
        title: "Contact The Sheet — Quét và điền link Drive chính xác hơn",
        titleEn: "Contact The Sheet — Improved Scanning & Drive Matching",
        type: "feature",
        items: [
          "Tải dữ liệu nhiều tab Google Sheet song song và tra cứu Drive đa luồng có kiểm soát hạn mức.",
          "Kiểm tra chủ sở hữu thư mục, tránh chọn nhầm thư mục của tài khoản khác.",
          "Đọc chuẩn xác các ô gộp (merged cells) cho ngày hẹn trả ảnh.",
        ],
        itemsEn: [
          "Parallel Google Sheet tab fetching and rate-limited concurrent Drive resolution.",
          "Folder ownership validation to avoid matching shared/unrelated Drive folders.",
          "Accurate merged-cell parsing for shoot and due date columns.",
        ],
      },
      {
        title: "Photo Picker — Truy xuất mã & kiểm tra trạng thái lọc",
        titleEn: "Photo Picker — Code Extraction & Filter Status Check",
        type: "feature",
        items: [
          "Truy xuất mã từ nhiều tab Sheet cùng lúc, ưu tiên các dòng còn mã và chưa lọc.",
          "Nhận diện trạng thái 'Chưa lọc' chính xác hơn (hỗ trợ Unicode tổ hợp, khoảng trắng đặc biệt).",
          "Hỗ trợ đọc ngày hẹn dạng dd/mm chuẩn theo múi giờ Việt Nam.",
        ],
        itemsEn: [
          "Multi-tab sheet code extraction prioritizing unfiltered rows with codes.",
          "Improved 'Chưa lọc' detection with Unicode NFC/NFD normalization.",
          "Vietnam timezone dd/mm date parsing support.",
        ],
      },
      {
        title: "Cải thiện & Tối ưu hiệu năng",
        titleEn: "Performance Improvements",
        type: "improvement",
        items: [
          "Giảm mức sử dụng CPU khi máy ở trạng thái rảnh (tự tạm dừng hiệu ứng nền).",
          "Tối ưu tốc độ mở app ban đầu, nạp ứng dụng theo cơ chế lazy-loading.",
        ],
        itemsEn: [
          "Reduced idle CPU usage by pausing background animations.",
          "Faster startup via module lazy-loading.",
        ],
      },
    ],
  },
  {
    version: "v2.8.1",
    date: "2026-10-23",
    title: "Ổn định kết nối Google Drive & Kiểm tra trạng thái lọc đa tab",
    titleEn: "Google Drive Connection Stability & Multi-tab Filter Status Checker",
    sections: [
      {
        title: "Giữ kết nối tài khoản Google ổn định (Sheet & Drive)",
        titleEn: "Persistent Google Account Connection (Sheet & Drive)",
        type: "fix",
        items: [
          "Khắc phục triệt để lỗi bị đăng xuất tài khoản Google sau khi tắt máy hoặc thoát ứng dụng.",
          "Không tự động xoá kết nối Google khi gói hết hạn, tự kích hoạt lại khi gia hạn.",
          "Lưu dự phòng an toàn trên máy, tự động khôi phục kết nối kể cả khi xoá cache tạm.",
        ],
        itemsEn: [
          "Fixed Google account disconnection after reboot or app restart.",
          "Preserves Google connection state across plan expiration and automatically restores upon renewal.",
          "Local encrypted credential backup recovers cleanly even if temporary caches are cleared.",
        ],
      },
      {
        title: "Contact The Sheet & Photo Picker",
        titleEn: "Contact The Sheet & Photo Picker",
        type: "improvement",
        items: [
          "Chỉ chọn thư mục giao ảnh cuối cùng có chứa file, tránh điền nhầm thư mục rỗng.",
          "Hỗ trợ kiểm tra nhiều tab Google Sheet đồng thời và ghi nhớ cấu hình quét.",
          "Tuỳ chọn quét các khách hàng có ngày hẹn trả ảnh từ hôm nay trở về trước.",
        ],
        itemsEn: [
          "Prefers non-empty delivery folders to avoid linking empty directories.",
          "Supports checking multiple Google Sheet tabs at once while remembering scan config.",
          "Optional scan for customers whose due dates are today or earlier.",
        ],
      },
    ],
  },
  {
    version: "v2.8.0",
    date: "2026-10-20",
    title: "Bảo mật Keychain hệ điều hành & Duy trì phiên đăng nhập thông minh",
    titleEn: "OS Keychain Security & Smart Session Persistence",
    sections: [
      {
        title: "Giữ đăng nhập ổn định & Bảo mật",
        titleEn: "Persistent Sign-In & Security",
        type: "security",
        items: [
          "Không còn phải đăng nhập lại mỗi lần mở app khi đã bật 'Tự động đăng nhập'.",
          "Bỏ cơ chế tự đăng xuất lúc 0h00, phiên làm việc tự gia hạn liên tục.",
          "Mật khẩu lưu được bảo vệ trong Keychain macOS và Windows Credential Manager.",
          "Khả năng chịu lỗi cao, không bị ngắt phiên khi mạng chập chờn hoặc máy chủ bận.",
        ],
        itemsEn: [
          "Eliminated repeated logins on launch when Auto Login is enabled.",
          "Removed midnight forced logout so active sessions renew seamlessly.",
          "Saved credentials protected inside macOS Keychain and Windows Credential Manager.",
          "Resilient token refresh over flaky networks or temporary server hiccups.",
        ],
      },
      {
        title: "Tính năng Contact The Sheet",
        titleEn: "Contact The Sheet Features",
        type: "feature",
        items: [
          "Tự động kết nối lại Google Sheet/Drive khi máy có mạng sau khi khởi động.",
          "Bổ sung nút 'Sao chép nhanh link Drive' trực tiếp trong cửa sổ xem trước thay đổi.",
        ],
        itemsEn: [
          "Auto-reconnects Google Sheet/Drive once network connectivity resumes after boot.",
          "Added 'Quick Copy Drive Link' button inside Preview Plan modal.",
        ],
      },
    ],
  },
  {
    version: "v2.7.1",
    date: "2026-10-05",
    title: "Chuẩn hóa Dock Icon Apple HIG & Tối ưu đồ họa Native macOS",
    titleEn: "Apple HIG Dock Icon Compliance & Native macOS Graphics Optimization",
    sections: [
      {
        title: "Giao diện & Dock Icon Native",
        titleEn: "Native Interface & Dock Icon",
        type: "design",
        items: [
          "Chuẩn hóa kích thước icon ứng dụng theo tỉ lệ Apple HIG chuẩn 824x824 trên canvas 1024x1024.",
          "Tích hợp hiệu ứng đổ bóng đa tầng (ambient + key shadow) cho thanh Dock macOS.",
          "Đồng bộ icon thời gian thực từ mã nguồn Native Cocoa tự động theo Dark/Light Mode.",
          "Cập nhật định danh tiến trình hiển thị trên macOS chính thức thành DH Studio Pro.",
        ],
        itemsEn: [
          "Standardized app icon proportions to Apple HIG 824x824 within 1024x1024 canvas.",
          "Multi-layered ambient & key Dock shadows for macOS.",
          "Real-time Native Cocoa Dock icon adaptation between Dark and Light modes.",
          "Updated macOS process display name to DH Studio Pro.",
        ],
      },
    ],
  },
  {
    version: "v2.7.0",
    date: "2026-10-05",
    title: "Nâng cấp thương hiệu DH Studio Pro & Bộ nhận diện Squircle mới",
    titleEn: "DH Studio Pro Rebranding & New Squircle App Iconography",
    sections: [
      {
        title: "Chuyển đổi thương hiệu & Nhận diện (Rebranding)",
        titleEn: "Brand Transition & Identity",
        type: "feature",
        items: [
          "Chính thức chuyển giao và đổi tên thành DH Studio Pro trực thuộc Devhouse Software.",
          "Bộ biểu tượng Logo Squircle mới sang trọng mô phỏng chu trình làm việc Studio khép kín.",
          "Đồng bộ nhận diện thương hiệu trên TopBar, Launcher, Sidebar, Đăng nhập và Bản quyền.",
        ],
        itemsEn: [
          "Official transition and rebranding to DH Studio Pro by Devhouse Software.",
          "New Squircle brand emblem representing an end-to-end studio workflow.",
          "Consistent branding across TopBar, Launcher, Sidebar, Login, and License views.",
        ],
      },
      {
        title: "Cải thiện hệ thống phát hành",
        titleEn: "Release Installer Improvements",
        type: "improvement",
        items: [
          "Tối ưu đồ họa trong suốt chuẩn nét trên cả giao diện Sáng và Tối.",
          "Bộ cài đặt DMG và NSIS mới hỗ trợ Auto-updater mượt mà không xung đột mã cũ.",
        ],
        itemsEn: [
          "Refined crisp transparent graphic assets across Light and Dark UI.",
          "New DMG and NSIS installers supporting conflict-free Auto-updater.",
        ],
      },
    ],
  },
];
