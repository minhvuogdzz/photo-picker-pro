import { useSettingsStore } from "../stores/useSettingsStore.ts";

export const translations = {
  en: {
    app_title: "DH STUDIO PRO",
    input_folders: "Input Folders",
    no_folders_added: "No folders added",
    click_add_folder: "Click Add Folder or drag and drop folders here",
    favorites: "Favorites",
    add_folder: "Add Folder",
    dashboard: "Dashboard",
    found: "Found",
    missing: "Missing",
    duplicate: "Duplicate",
    scanned: "Scanned",
    scanning: "Scanning",
    copying: "Copying",
    operation_complete: "Operation Complete",
    success: "Success",
    skipped: "Skipped",
    errors: "Errors",
    output_destination: "Output Destination",
    choose_folder: "Choose Folder",
    same_as_original: "Same as Original",
    select_output_folder: "Select output folder...",
    ready_status: "Ready — Add folders and paste codes to begin",
    scanning_status: "Scanning folders...",
    matching_status: "Matching codes...",
    copying_status: "Copying files...",
    cancel: "Cancel",
    scan_match: "Scan & Match",
    copy: "Copy",
    move: "Move",
    customer_codes: "Customer Codes",
    codes_count: "codes",
    mode: "Mode",
    exact: "Exact",
    contains: "Contains",
    regex: "Regex",
    regex_placeholder: "e.g. ^abc{code} or \\d{5}",
    regex_hint: "Use {code} as placeholder for each customer code. Ex: ^abc{code} → matches abc01234",
    paste_codes_here: "Paste customer codes here (one per line)...",
    settings: "Settings",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    language: "Language",
    english: "English",
    vietnamese: "Tiếng Việt",
    default_match_mode: "Default Match Mode",
    exact_number: "Exact Number",
    default_output_folder: "Default Output Folder",
    no_default_output: "No default output folder set",
    default_duplicate_policy: "Default Duplicate Policy",
    copy_first: "Copy First",
    copy_all: "Copy All",
    rename_auto: "Rename Automatically",
    skip: "Skip",
    preserve_folder: "Preserve Folder Structure",
    maintain_hierarchy: "Maintain original folder hierarchy in output",
    save_settings: "Save Settings",
    history: "History",
    clear_history: "Clear History",
    no_history: "No history found",
    home: "Home",
    about: "About",
    version: "Version 1.0.0",
    same_as_original_hint: "Photos will be saved to a Selects subfolder inside their original location.",
    remove: "Remove",
    convert_file: "Convert file",
    footer_text: "Minh Vuong Dev — If you find this useful, please support the author.",
    // Auth
    login: "Login",
    login_subtitle: "Sign in to continue",
    login_footer: "7-day free trial · Offline First",
    logging_in: "Signing in...",
    logout: "Logout",
    password: "Password",
    forgot_password: "Forgot password?",
    login_again: "Login Again",
    session_expired_device_title: "Session Ended",
    session_expired_device_desc: "Your session has been ended because your account was logged in on another device.",
    subscription_expired_title: "Subscription Expired",
    subscription_expired_desc: "Your subscription has expired. Please renew to continue using the app.",
    offline_expired_title: "Internet Required",
    offline_expired_desc: "You have been offline for more than 7 days. Please connect to the internet to verify your subscription.",
    // System Module
    system: "System",
    general_options: "General Options",
    general_settings: "General Settings",
    save_changes: "Save Changes",
    theme_section: "Theme",
    dark_mode: "Dark Mode",
    light_mode: "Light Mode",
    language_section: "Language",
    software_updates: "Software Updates",
    check_for_updates: "Check for Updates",
    auto_check_label: "Auto Check",
    auto_check_desc: "The system will automatically look for patches and new features when the app starts.",
    auto_download_label: "Auto Download",
    auto_download_desc: "New updates will be automatically downloaded in the background, ready to install.",
    support_feedback: "Support & Feedback",
    report_bugs: "Report bugs or suggestions",
    report_bugs_desc: "Help us improve your experience.",
    send_feedback: "Send Feedback",
    version_info: "Version Information",
    valid_license: "Valid License",
    software_description_1: "DH Studio Pro is a comprehensive software suite developed by Devhouse Software, designed specifically for photographers, event photographers, and professional wedding studios. We provide optimal solutions to automate workflows, from management and selection to post-processing.",
    software_description_2: "With powerful tools like Photo Picker Pro (AI-powered smart photo filtering), the DH Studio Pro suite delivers superior performance, saving up to 80% of manual processing time while ensuring absolute data security (100% Offline - No data leaves your computer without your permission).",
    software_description_3: "The software is continuously updated with the latest AI algorithms and listens to feedback from the photography community to keep improving, making it an indispensable assistant for every Photographer.",
    designed_for: "Optimized for Wedding Studios, Event Photographers & Freelancers",
    high_performance: "High performance, processing thousands of photos in the blink of an eye",
    copyright_owner: "Copyright",
    publisher: "Publisher",
    licensed_to: "Licensed to",
    user: "User",
    terms_and_services: "Terms & Conditions",
    community: "Community",
    // Feedback modal
    feedback_title: "Report Bug / Feedback",
    feedback_name: "Name (Optional)",
    feedback_phone: "Phone Number (Optional)",
    feedback_phone_hint: "So we can contact you for support",
    feedback_content: "Details *",
    feedback_placeholder: "Please describe the issue and paste images here...",
    feedback_attachment: "Attachment",
    feedback_footer: "Your feedback helps us improve the system.",
    feedback_submit: "Send Feedback",
    settings_saved: "Settings saved successfully!",
    latest_version: "You are using the latest version!",
    update_check_failed: "Unable to check for updates. Error: ",
    feedback_content_required: "Please fill in the feedback content.",
    feedback_success: "Thank you for your feedback!",
    feedback_error: "Error sending feedback: ",
  },
  vi: {
    app_title: "DH STUDIO PRO",
    input_folders: "Thư mục đầu vào",
    no_folders_added: "Chưa có thư mục",
    click_add_folder: "Bấm Thêm Thư mục hoặc kéo thả vào đây",
    favorites: "Yêu thích",
    add_folder: "Thêm Thư mục",
    dashboard: "Bảng điều khiển",
    found: "Đã tìm thấy",
    missing: "Thiếu",
    duplicate: "Trùng lặp",
    scanned: "Đã quét",
    scanning: "Đang quét",
    copying: "Đang sao chép",
    operation_complete: "Hoàn tất",
    success: "Thành công",
    skipped: "Đã bỏ qua",
    errors: "Lỗi",
    output_destination: "Thư mục đầu ra",
    choose_folder: "Chọn thư mục",
    same_as_original: "Cùng nơi ảnh gốc",
    select_output_folder: "Chọn thư mục lưu ảnh...",
    ready_status: "Sẵn sàng — Thêm thư mục và dán mã để bắt đầu",
    scanning_status: "Đang quét thư mục...",
    matching_status: "Đang lọc ảnh...",
    copying_status: "Đang chép file...",
    cancel: "Huỷ",
    scan_match: "Quét file",
    copy: "Lọc file",
    move: "Di chuyển",
    customer_codes: "Mã lọc của khách",
    codes_count: "mã",
    mode: "Chế độ",
    exact: "Chính xác",
    contains: "Chứa",
    regex: "Biểu thức Regex",
    regex_placeholder: "VD: ^abc{code} hoặc \\d{5}",
    regex_hint: "Dùng {code} để thay thế mã khách. VD: ^abc{code} → chỉ match file abc01234",
    paste_codes_here: "Dán mã vào đây",
    settings: "Cài đặt",
    theme: "Giao diện",
    dark: "Tối",
    light: "Sáng",
    language: "Ngôn ngữ",
    english: "English",
    vietnamese: "Tiếng Việt",
    default_match_mode: "Chế độ lọc mặc định",
    exact_number: "Trùng khớp chính xác",
    default_output_folder: "Thư mục đích mặc định",
    no_default_output: "Chưa đặt thư mục đích mặc định",
    default_duplicate_policy: "Xử lý khi trùng lặp",
    copy_first: "Lấy file đầu tiên",
    copy_all: "Lấy tất cả",
    rename_auto: "Tự động đổi tên",
    skip: "Bỏ qua",
    preserve_folder: "Giữ cấu trúc thư mục",
    maintain_hierarchy: "Giữ nguyên cấu trúc thư mục gốc khi lưu",
    save_settings: "Lưu Cài đặt",
    history: "Lịch sử",
    clear_history: "Xoá lịch sử",
    no_history: "Chưa có lịch sử lọc ảnh",
    home: "Trang chủ",
    about: "Thông tin",
    version: "Phiên bản 1.0.0",
    same_as_original_hint: "Ảnh sẽ được lưu vào thư mục con Selects nằm ngay trong thư mục chứa ảnh gốc.",
    remove: "Xoá",
    convert_file: "Chuyển đổi file",
    footer_text: "Minh Vương Dev — Nếu thấy hay hãy ủng hộ tác giả nhé.",
    // Auth
    login: "Đăng nhập",
    login_subtitle: "Đăng nhập để tiếp tục",
    login_footer: "Dùng thử 7 ngày miễn phí · Offline First",
    logging_in: "Đang đăng nhập...",
    logout: "Đăng xuất",
    password: "Mật khẩu",
    forgot_password: "Quên mật khẩu?",
    login_again: "Đăng nhập lại",
    session_expired_device_title: "Phiên đã kết thúc",
    session_expired_device_desc: "Phiên của bạn đã kết thúc vì tài khoản được đăng nhập trên thiết bị khác.",
    subscription_expired_title: "Hết hạn sử dụng",
    subscription_expired_desc: "Gói đăng ký của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng.",
    offline_expired_title: "Cần kết nối Internet",
    offline_expired_desc: "Bạn đã ngoại tuyến hơn 7 ngày. Vui lòng kết nối Internet để xác minh đăng ký.",
    // System Module
    system: "Hệ thống",
    general_options: "Tuỳ chọn chung",
    general_settings: "Cài đặt chung",
    save_changes: "Lưu thay đổi",
    theme_section: "Giao diện (Theme)",
    dark_mode: "Chế độ Tối",
    light_mode: "Chế độ Sáng",
    language_section: "Ngôn ngữ (Language)",
    software_updates: "Cập nhật phần mềm",
    check_for_updates: "Kiểm tra cập nhật",
    auto_check_label: "Kiểm tra tự động",
    auto_check_desc: "Hệ thống sẽ tự động tìm kiếm các bản vá lỗi và tính năng mới khi khởi động ứng dụng.",
    auto_download_label: "Tải xuống tự động",
    auto_download_desc: "Các bản cập nhật mới sẽ được tự động tải xuống dưới nền để sẵn sàng cài đặt.",
    support_feedback: "Hỗ trợ & Góp ý",
    report_bugs: "Báo cáo lỗi phần mềm hoặc Góp ý",
    report_bugs_desc: "Giúp chúng tôi cải thiện trải nghiệm tốt hơn cho bạn.",
    send_feedback: "Gửi phản hồi",
    version_info: "Thông tin phiên bản",
    valid_license: "Bản quyền hợp lệ",
    software_description_1: "DH Studio Pro là hệ sinh thái phần mềm toàn diện được phát triển bởi Devhouse Software chuyên biệt dành cho các nhiếp ảnh gia, thợ ảnh sự kiện và các Studio ảnh cưới chuyên nghiệp. Chúng tôi cung cấp các giải pháp tối ưu giúp tự động hóa quy trình làm việc, từ khâu quản lý, chọn lọc đến xử lý hậu kỳ.",
    software_description_2: "Với các công cụ mạnh mẽ như Photo Picker Pro (Lọc ảnh thông minh bằng AI), hệ sinh thái DH Studio Pro của Devhouse Software cam kết mang lại hiệu suất vượt trội, tiết kiệm lên đến 80% thời gian xử lý thủ công, đồng thời đảm bảo tính bảo mật dữ liệu tuyệt đối (100% Offline - Không có dữ liệu nào rời khỏi máy tính của bạn nếu bạn không cho phép).",
    software_description_3: "Phần mềm liên tục được cập nhật các thuật toán AI mới nhất và lắng nghe ý kiến phản hồi từ cộng đồng nhiếp ảnh để ngày càng hoàn thiện hơn, xứng đáng là trợ thủ đắc lực không thể thiếu của mọi Photographer.",
    designed_for: "Thiết kế tối ưu cho Wedding Studios, Event Photographers & Freelancers",
    high_performance: "Hiệu suất cao, xử lý hàng nghìn ảnh chỉ trong chớp mắt",
    copyright_owner: "Bản quyền thuộc về",
    publisher: "Nhà phát hành",
    licensed_to: "Cấp phép cho",
    user: "Người dùng",
    terms_and_services: "Điều khoản và Dịch vụ",
    community: "Cộng đồng",
    // Feedback modal
    feedback_title: "Báo cáo lỗi / Góp ý",
    feedback_name: "Họ tên (Không bắt buộc)",
    feedback_phone: "Số điện thoại (Không bắt buộc)",
    feedback_phone_hint: "Để chúng tôi liên hệ hỗ trợ",
    feedback_content: "Nội dung chi tiết *",
    feedback_placeholder: "Vui lòng báo lỗi và dán hình ảnh vào đây...",
    feedback_attachment: "Ảnh đính kèm",
    feedback_footer: "Phản hồi của bạn sẽ giúp chúng tôi cải thiện hệ thống tốt hơn.",
    feedback_submit: "Gửi phản hồi",
    settings_saved: "Lưu cài đặt thành công!",
    latest_version: "Bạn đang sử dụng phiên bản mới nhất!",
    update_check_failed: "Không thể kiểm tra cập nhật lúc này. Lỗi: ",
    feedback_content_required: "Vui lòng điền Nội dung phản hồi.",
    feedback_success: "Cảm ơn bạn đã gửi phản hồi!",
    feedback_error: "Lỗi gửi phản hồi: ",
  },
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;
export type TranslationParams = Record<string, string | number>;

// Compile-time guard: ensure `vi` and `en` always maintain identical translation keys
type MissingInVi = Exclude<keyof typeof translations.en, keyof typeof translations.vi>;
type MissingInEn = Exclude<keyof typeof translations.vi, keyof typeof translations.en>;
const _assertNoMissingInVi: MissingInVi extends never ? true : never = true;
const _assertNoMissingInEn: MissingInEn extends never ? true : never = true;
void _assertNoMissingInVi;
void _assertNoMissingInEn;

function formatTemplate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
}

export function getCurrentLanguage(): Language {
  try {
    const raw = useSettingsStore.getState().settings.language;
    return raw === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
}

export function getLocaleCode(lang?: Language): string {
  const effective = lang ?? getCurrentLanguage();
  return effective === "en" ? "en-US" : "vi-VN";
}

export function translate(key: TranslationKey, params?: TranslationParams, lang?: Language): string {
  const effective = lang ?? getCurrentLanguage();
  const dict = translations[effective] || translations.vi;
  const raw = dict[key] || translations.en[key] || key;
  return formatTemplate(raw, params);
}

/**
 * Bilingual inline helper for imperative code (services, stores, utilities).
 * Always provide both Vietnamese (`vi`) and English (`en`) strings.
 */
export function trText(vi: string, en: string, lang?: Language): string {
  const effective = lang ?? getCurrentLanguage();
  return effective === "en" ? en : vi;
}

/**
 * Translates progress, memory pressure, and log messages emitted in Vietnamese by the Rust backend
 * when the UI language is switched to English.
 */
export function localizeBackendMessage(message: string, lang?: Language): string {
  const effective = lang ?? getCurrentLanguage();
  if (!message || effective !== "en") return message;

  const exactMap: Record<string, string> = {
    "Đang đọc danh sách file ảnh...": "Reading image file list...",
    "Chuẩn bị lọc ảnh...": "Preparing to match photos...",
    "Hoàn tất lọc ảnh!": "Photo matching complete!",
    "Hoàn tất: 0 file cần chép": "Complete: 0 files to copy",
    "Hoàn tất": "Complete",
    "Hệ thống đang chịu áp lực nén trang bộ nhớ (macOS VM Pressure)":
      "System is experiencing memory page compression pressure (macOS VM Pressure)",
    "Bộ nhớ hoạt động tối ưu, không có áp lực nén trang":
      "Memory is operating optimally with no compression pressure",
    "Bộ nhớ hoạt động bình thường": "Memory is operating normally",
    "Bộ nhớ hoạt động ổn định, đủ dung lượng khả dụng":
      "Memory is stable with sufficient available capacity",
    "Dung lượng bộ nhớ khả dụng ở mức thấp": "Available memory capacity is low",
  };

  if (exactMap[message]) {
    return exactMap[message];
  }

  let m = message.match(/^Đã quét (\d+) file ảnh\.\.\.$/);
  if (m) return `Scanned ${m[1]} image files...`;

  m = message.match(/^Hoàn tất quét: (\d+) file trong (\d+)ms$/);
  if (m) return `Scan complete: ${m[1]} files in ${m[2]}ms`;

  m = message.match(/^Đang lọc mã (.+)\.\.\.$/);
  if (m) return `Matching code ${m[1]}...`;

  m = message.match(/^Đang chuẩn bị lọc (\d+) file\.\.\.$/);
  if (m) return `Preparing to process ${m[1]} files...`;

  m = message.match(/^Đang lọc (\d+)\/(\d+) file$/);
  if (m) return `Processing ${m[1]}/${m[2]} files`;

  m = message.match(/^Hoàn tất: (\d+) thành công, (\d+) lỗi, (\d+) bỏ qua$/);
  if (m) return `Complete: ${m[1]} succeeded, ${m[2]} errors, ${m[3]} skipped`;

  m = message.match(/^Hệ thống đang chịu áp lực bộ nhớ \(Commit: (\d+)%, RAM khả dụng: (\d+)%\)$/);
  if (m) return `System is under memory pressure (Commit: ${m[1]}%, Available RAM: ${m[2]}%)`;

  m = message.match(/^Định dạng (.+) chỉ chuyển đổi được trên macOS$/);
  if (m) return `Format ${m[1]} can only be converted on macOS`;

  m = message.match(/^Bỏ qua (.+): (.+)$/);
  if (m) return `Skipped ${m[1]}: ${localizeBackendMessage(m[2], effective)}`;

  m = message.match(
    /^Hoàn tất trong (\d+)ms \(([\d.]+) files\/s\) — Convert thành công: (\d+)\/(\d+) \| Đã sửa EXIF: (\d+) \| Giữ nguyên EXIF: (\d+) \| Không hỗ trợ EXIF: (\d+) \| Lỗi: (\d+)$/
  );
  if (m) {
    return `Completed in ${m[1]}ms (${m[2]} files/s) — Converted: ${m[3]}/${m[4]} | EXIF Fixed: ${m[5]} | EXIF Kept: ${m[6]} | Unsupported EXIF: ${m[7]} | Errors: ${m[8]}`;
  }

  m = message.match(/^Đã hoàn tất quá trình chuyển đổi ảnh \((\d+)\/(\d+) thành công trong (\d+)ms\)\.$/);
  if (m) return `Image conversion complete (${m[1]}/${m[2]} succeeded in ${m[3]}ms).`;

  return message;
}

export function useTranslation() {
  const rawLang = useSettingsStore((s) => s.settings.language);
  const lang: Language = rawLang === "en" ? "en" : "vi";
  const currentLang = translations[lang] || translations.vi;

  return {
    t: (key: TranslationKey, params?: TranslationParams) =>
      formatTemplate(currentLang[key] || translations.en[key] || key, params),
    tr: (vi: string, en: string) => (lang === "en" ? en : vi),
    lang,
  };
}
