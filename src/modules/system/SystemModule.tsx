import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useTranslation } from "@/core/lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  Sun,
  Moon,
  Globe,
  DownloadCloud,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  Info,
  ShieldCheck,
  ExternalLink,
  Camera,
  Sparkles,
} from "lucide-react";
import { UpdateDialog } from "@/core/updater_ui";
import { checkForUpdates, UpdateCheckResult } from "@/core/updater";

type Tab = "general" | "about";

export function SystemModule() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const session = useAuthStore((s) => s.session);
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [manualUpdateResult, setManualUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [version, setVersion] = useState("1.0.0");

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);

  const handleManualUpdateCheck = async () => {
    setIsCheckingUpdate(true);
    try {
      const result = await checkForUpdates();
      if (!result.hasUpdate) {
        alert("Bạn đang sử dụng phiên bản mới nhất!");
      } else {
        setManualUpdateResult(result);
      }
    } catch (err) {
      alert("Không thể kiểm tra cập nhật lúc này. Lỗi: " + String(err));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleSave = async () => {
    try {
      await invoke("save_settings", { settings });
      alert("Lưu cài đặt thành công!");
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  return (
    <div className="flex-1 flex w-full h-full animate-fade-in bg-card/30 rounded-2xl overflow-hidden border border-white/5">
      {/* Sidebar */}
      <div className="w-64 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-3 px-2 py-4 mb-4 border-b border-white/5">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          <div>
            <h2 className="text-sm font-bold tracking-tight">Hệ thống</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tuỳ chọn chung</p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "general" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          <Settings2 size={16} />
          Cài đặt chung
        </button>

        <button
          onClick={() => setActiveTab("about")}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "about" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          <Info size={16} />
          Thông tin phiên bản
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-transparent to-background/50">
        <div className="flex-1 overflow-y-auto p-8 lg:p-12 flex justify-center">
          {activeTab === "general" && (
            <div className="max-w-2xl w-full space-y-10 animate-slide-up">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">Cài đặt chung</h1>
                <button onClick={handleSave} className="btn-primary py-2.5 px-6 font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center gap-2">
                  <Save size={16} /> Lưu thay đổi
                </button>
              </div>
              
              {/* Theme */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Giao diện (Theme)</h3>
                <div className="flex gap-4">
                  {["dark", "light"].map((theme) => (
                    <button
                      key={theme}
                      onClick={() => updateSetting("theme", theme)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all cursor-pointer ${
                        settings.theme === theme 
                          ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" 
                          : "border-white/5 bg-black/20 text-muted-foreground hover:border-white/20 hover:bg-black/40"
                      }`}
                    >
                      {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
                      <span className="font-medium text-sm">{theme === "dark" ? "Chế độ Tối" : "Chế độ Sáng"}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Ngôn ngữ (Language)</h3>
                <div className="relative w-full">
                  <select
                    className="w-full appearance-none bg-black/20 border border-white/10 text-foreground py-4 px-6 rounded-2xl font-medium outline-none focus:border-primary/50 transition-colors cursor-pointer"
                    value={settings.language}
                    onChange={(e) => updateSetting("language", e.target.value)}
                  >
                    <option value="en" className="bg-background text-foreground">English</option>
                    <option value="vi" className="bg-background text-foreground">Tiếng Việt</option>
                  </select>
                  <Globe size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Updates */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Cập nhật phần mềm</h3>
                  <button
                    onClick={handleManualUpdateCheck}
                    disabled={isCheckingUpdate}
                    className="btn-outline border-white/10 hover:border-primary/50 text-xs py-2 px-4 rounded-xl flex items-center gap-2 transition-colors"
                  >
                    {isCheckingUpdate ? <Loader2 size={14} className="animate-spin text-primary" /> : <RefreshCw size={14} className="text-primary" />}
                    Kiểm tra cập nhật
                  </button>
                </div>

                <div className="bg-black/20 rounded-2xl p-6 border border-white/5 space-y-6 w-full">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="space-y-1 pr-6">
                      <span className="block text-sm font-medium group-hover:text-primary transition-colors">Kiểm tra tự động</span>
                      <span className="block text-xs text-muted-foreground leading-relaxed">Hệ thống sẽ tự động tìm kiếm các bản vá lỗi và tính năng mới khi khởi động ứng dụng.</span>
                    </div>
                    <div className={`shrink-0 w-12 h-6 rounded-full p-1 transition-colors ${settings.auto_check_updates ? 'bg-primary' : 'bg-white/10'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${settings.auto_check_updates ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.auto_check_updates}
                      onChange={(e) => updateSetting("auto_check_updates", e.target.checked)}
                      className="hidden"
                    />
                  </label>

                  <div className="h-px bg-white/5" />

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="space-y-1 pr-6">
                      <span className="block text-sm font-medium group-hover:text-primary transition-colors">Tải xuống tự động</span>
                      <span className="block text-xs text-muted-foreground leading-relaxed">Các bản cập nhật mới sẽ được tự động tải xuống dưới nền để sẵn sàng cài đặt.</span>
                    </div>
                    <div className={`shrink-0 w-12 h-6 rounded-full p-1 transition-colors ${settings.auto_download_updates ? 'bg-primary' : 'bg-white/10'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${settings.auto_download_updates ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.auto_download_updates}
                      onChange={(e) => updateSetting("auto_download_updates", e.target.checked)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div className="flex flex-col items-center justify-start min-h-full space-y-8 animate-slide-up text-center max-w-2xl mx-auto w-full py-4">
              <div className="relative mb-2">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-125" />
                <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain relative z-10 drop-shadow-xl" />
              </div>
              
              <div className="space-y-1">
                <h1 className="text-xl font-bold tracking-tight text-gradient">MVD PHOTOSHOP ACADEMY</h1>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Ecosystem Version {version}</p>
              </div>
              
              <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 text-emerald-500 text-xs font-semibold rounded-xl border border-emerald-500/20 shadow-sm">
                <ShieldCheck size={16} /> Bản quyền hợp lệ
              </div>

              {/* Thông tin phần mềm gộp từ Photo Picker */}
              <div className="w-full bg-black/20 rounded-2xl p-6 border border-white/5 text-left space-y-5">
                <div className="text-sm text-foreground/80 leading-relaxed space-y-3">
                  <p>
                    <strong>MVD Photoshop Academy Ecosystem</strong> là hệ sinh thái phần mềm toàn diện được thiết kế chuyên biệt dành cho các nhiếp ảnh gia, thợ ảnh sự kiện và các Studio ảnh cưới chuyên nghiệp. Chúng tôi cung cấp các giải pháp tối ưu giúp tự động hóa quy trình làm việc, từ khâu quản lý, chọn lọc đến xử lý hậu kỳ.
                  </p>
                  <p>
                    Với hàng loạt các công cụ mạnh mẽ như <strong>Photo Picker Pro</strong> (Lọc ảnh thông minh bằng AI), <strong>Retouch App</strong> (Chỉnh sửa ảnh hàng loạt) và <strong>Client Gallery</strong> (Nền tảng gửi ảnh cho khách hàng), hệ sinh thái MVD cam kết mang lại hiệu suất vượt trội, tiết kiệm lên đến 80% thời gian xử lý thủ công, đồng thời đảm bảo tính bảo mật dữ liệu tuyệt đối (100% Offline - Không có dữ liệu nào rời khỏi máy tính của bạn nếu bạn không cho phép).
                  </p>
                  <p>
                    Phần mềm liên tục được cập nhật các thuật toán AI mới nhất và lắng nghe ý kiến phản hồi từ cộng đồng nhiếp ảnh để ngày càng hoàn thiện hơn, xứng đáng là trợ thủ đắc lực không thể thiếu của mọi Photographer.
                  </p>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground bg-black/20 p-4 rounded-xl border border-white/5">
                  <p className="flex items-center gap-2">
                    <Camera size={14} className="text-primary" />
                    Thiết kế tối ưu cho Wedding Studios, Event Photographers & Freelancers
                  </p>
                  <p className="flex items-center gap-2">
                    <Sparkles size={14} className="text-primary" />
                    Hiệu suất cao, xử lý hàng nghìn ảnh chỉ trong chớp mắt
                  </p>
                </div>
                
                <div className="h-px bg-white/5 my-4" />
                
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Bản quyền thuộc về:</span>
                    <span className="font-bold">MVD Photoshop Academy</span>
                  </div>
                  <div className="hidden sm:block w-px h-4 bg-white/10" />
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">Nhà phát hành:</span>
                    <span className="font-bold text-foreground">Minh Vuong Dev</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm pt-2 border-t border-white/5">
                  <div className="flex gap-2 w-full justify-between sm:justify-start">
                    <span className="text-muted-foreground">Cấp phép cho:</span>
                    <span className="font-bold text-primary">{session?.name || "Người dùng"}</span>
                  </div>
                </div>
              </div>

              <div className="flex w-full max-w-sm gap-3 pt-2">
                <a 
                  href="https://zalo.me/0869528304" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
                >
                  Hỗ trợ Zalo
                </a>
                <a 
                  href="https://zalo.me/0869528304" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 bg-white/5 hover:bg-white/10 text-foreground py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:-translate-y-0.5 border border-white/5"
                >
                  Cộng đồng <ExternalLink size={16} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {manualUpdateResult && (
        <UpdateDialog
          updateResult={manualUpdateResult}
          onClose={() => setManualUpdateResult(null)}
          onSkip={() => setManualUpdateResult(null)}
        />
      )}
    </div>
  );
}
