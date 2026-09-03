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
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  Info,
  ShieldCheck,
  ExternalLink,
  Camera,
  FileText,
  X,
  Send,
  Zap,
  Layers,
  Crown,
  Lock,
  Cpu,
} from "lucide-react";
import { useUpdaterStore } from "@/core/stores/useUpdaterStore";
import { apiRequest } from "@/core/services/apiClient";
import { TermsDialog } from "@/core/components/TermsDialog";

type Tab = "general" | "about";

export function SystemModule() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const session = useAuthStore((s) => s.session);
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>("general");
  const isCheckingUpdate = useUpdaterStore((s) => s.isChecking);
  const checkForUpdatesStore = useUpdaterStore((s) => s.checkForUpdates);
  const [version, setVersion] = useState("2.0.0");
  
  // Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackName, setFeedbackName] = useState(session?.name || "");
  const [feedbackPhone, setFeedbackPhone] = useState("");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackImage, setFeedbackImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Terms Dialog State
  const [showTermsDialog, setShowTermsDialog] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);

  const handleManualUpdateCheck = async () => {
    try {
      const result = await checkForUpdatesStore({ isManual: true });
      if (result && !result.hasUpdate) {
        alert(t("latest_version"));
      }
    } catch (err) {
      alert(t("update_check_failed") + String(err));
    }
  };

  const handleSave = async () => {
    try {
      await invoke("save_settings", { settings });
      alert(t("settings_saved"));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const handlePasteImage = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new globalThis.Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const MAX_WIDTH = 1200;
              const MAX_HEIGHT = 1200;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
                setFeedbackImage(compressedBase64);
              }
            };
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackContent.trim()) {
      alert(t("feedback_content_required"));
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("/feedback", {
        method: "POST",
        body: {
          name: feedbackName,
          phone: feedbackPhone,
          content: feedbackContent,
          imageBase64: feedbackImage
        }
      });
      alert(t("feedback_success"));
      setShowFeedbackModal(false);
      setFeedbackContent("");
      setFeedbackImage(null);
    } catch (error) {
      alert(t("feedback_error") + String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPremium = session?.subscription?.isPremium === true;
  const isLifetime = session?.subscription?.status === "LIFETIME";

  return (
    <div className="flex-1 flex w-full h-full animate-fade-in bg-card/85 backdrop-blur-2xl rounded-2xl overflow-hidden border border-border text-foreground">
      {/* Sidebar */}
      <div className="w-56 bg-muted/30 border-r border-border p-3 flex flex-col gap-1 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-3 mb-2 border-b border-border">
          <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
          <div>
            <h2 className="text-xs font-extrabold tracking-tight text-foreground">{t("system")}</h2>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{t("general_options")}</p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "general" ? "bg-primary/15 text-primary shadow-sm border border-primary/25" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
          }`}
        >
          <Settings2 size={15} />
          {t("general_settings")}
        </button>

        <button
          onClick={() => setActiveTab("about")}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "about" ? "bg-primary/15 text-primary shadow-sm border border-primary/25" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
          }`}
        >
          <Info size={15} />
          {t("version_info")}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-background/50">
        <div className="flex-1 overflow-y-auto p-6 flex justify-center custom-scrollbar">
          
          {/* TAB 1: CÀI ĐẶT CHUNG */}
          {activeTab === "general" && (
            <div className="max-w-xl w-full space-y-6 animate-slide-up pb-8">
              <div className="flex items-center justify-between pb-3.5 border-b border-border">
                <div>
                  <h1 className="text-sm font-extrabold tracking-tight text-foreground">{t("general_settings")}</h1>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Tùy biến môi trường làm việc và cập nhật phần mềm</p>
                </div>
                <button onClick={handleSave} className="py-2 px-3.5 bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer">
                  <Save size={13} /> {t("save_changes")}
                </button>
              </div>
              
              {/* Theme Settings */}
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("theme_section")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "dark", label: t("dark_mode"), icon: Moon },
                    { id: "light", label: t("light_mode"), icon: Sun },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = settings.theme === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => updateSetting("theme", item.id)}
                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border transition-all cursor-pointer text-xs font-semibold ${
                          isSelected 
                            ? "border-primary bg-primary/15 text-primary shadow-sm" 
                            : "border-border bg-card/60 text-muted-foreground hover:border-foreground/20 hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <Icon size={14} className={isSelected ? "text-primary" : "text-muted-foreground"} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language Settings */}
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("language_section")}</h3>
                <div className="relative w-full">
                  <select
                    className="w-full appearance-none bg-card/80 border border-border text-foreground py-2.5 pl-3.5 pr-9 rounded-xl text-xs font-semibold outline-none focus:border-primary/50 transition-colors cursor-pointer shadow-sm"
                    value={settings.language}
                    onChange={(e) => updateSetting("language", e.target.value)}
                  >
                    <option value="vi" className="bg-card text-foreground">Tiếng Việt (Mặc định)</option>
                    <option value="en" className="bg-card text-foreground">English (International)</option>
                  </select>
                  <Globe size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Software Updates */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("software_updates")}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleManualUpdateCheck}
                      disabled={isCheckingUpdate}
                      className="border border-border hover:border-foreground/20 bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground text-[11px] font-semibold py-1.5 px-3 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      {isCheckingUpdate ? <Loader2 size={12} className="animate-spin text-primary" /> : <RefreshCw size={12} />}
                      {t("check_for_updates")}
                    </button>
                  </div>
                </div>

                <div className="bg-card/60 rounded-2xl p-4 border border-border space-y-4 w-full shadow-sm">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="space-y-0.5 pr-4">
                      <span className="block text-xs font-bold text-foreground group-hover:text-primary transition-colors">{t("auto_check_label")}</span>
                      <span className="block text-[11px] text-muted-foreground leading-relaxed">{t("auto_check_desc")}</span>
                    </div>
                    <div className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors ${settings.auto_check_updates ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${settings.auto_check_updates ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.auto_check_updates}
                      onChange={(e) => updateSetting("auto_check_updates", e.target.checked)}
                      className="hidden"
                    />
                  </label>

                  <div className="h-px bg-border" />

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="space-y-0.5 pr-4">
                      <span className="block text-xs font-bold text-foreground group-hover:text-primary transition-colors">{t("auto_download_label")}</span>
                      <span className="block text-[11px] text-muted-foreground leading-relaxed">{t("auto_download_desc")}</span>
                    </div>
                    <div className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors ${settings.auto_download_updates ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${settings.auto_download_updates ? 'translate-x-4' : 'translate-x-0'}`} />
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

              {/* Support & Feedback */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("support_feedback")}</h3>
                </div>
                <div className="bg-card/60 rounded-2xl p-4 border border-border flex items-center justify-between gap-4 shadow-sm">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">{t("report_bugs")}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t("report_bugs_desc")}</p>
                  </div>
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="py-2 px-3.5 bg-muted hover:bg-muted/80 active:scale-95 text-foreground font-bold rounded-xl text-xs transition-colors shrink-0 cursor-pointer border border-border shadow-sm"
                  >
                    {t("send_feedback")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THÔNG TIN PHIÊN BẢN & HỆ SINH THÁI MVD */}
          {activeTab === "about" && (
            <div className="flex flex-col items-center justify-start min-h-full space-y-4 animate-slide-up text-center max-w-xl mx-auto w-full py-2 pb-8">
              <div className="relative mb-0.5">
                <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain relative z-10 drop-shadow-lg" />
              </div>
              
              <div className="space-y-0.5">
                <h1 className="text-sm md:text-base font-extrabold tracking-wider text-foreground uppercase">
                  MVD PHOTOSHOP ACADEMY
                </h1>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
                  HỆ SINH THÁI NHIẾP ẢNH & HẬU KỲ CHUYÊN NGHIỆP • PHIÊN BẢN V{version}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 text-emerald-500 text-[11px] font-bold rounded-full border border-emerald-500/30">
                  <ShieldCheck size={13} />
                  <span>{isLifetime ? "Bản Quyền Vĩnh Viễn (Lifetime)" : "Bản Quyền Hợp Lệ"}</span>
                </div>

                {isPremium && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 text-amber-400 text-[11px] font-extrabold rounded-full border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                    <Crown size={12} className="fill-amber-400/40" />
                    <span>Đặc Quyền VIP Premium</span>
                  </div>
                )}
              </div>

              {/* Thông tin hệ sinh thái chi tiết */}
              <div className="w-full bg-card/75 rounded-2xl p-5 border border-border text-left space-y-4 shadow-sm">
                
                {/* Giới thiệu tổng quan */}
                <div className="text-xs text-foreground/90 leading-relaxed space-y-2">
                  <p>
                    <strong className="text-foreground font-extrabold">MVD Photoshop Academy Ecosystem</strong> là hệ sinh thái phần mềm toàn diện được xây dựng chuyên biệt dành cho các Nhiếp ảnh gia, Thợ ảnh sự kiện, Retoucher và Studio ảnh cưới chuyên nghiệp.
                  </p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Hệ sinh thái cung cấp giải pháp đồng bộ từ khâu chọn lọc ảnh thông minh bằng AI, chuyển đổi đa định dạng siêu tốc, tự động hóa Photoshop Actions, cho đến thư viện tài nguyên sáng tạo độc quyền.
                  </p>
                </div>

                {/* 4 Trụ cột Module trong hệ sinh thái */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/80 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Camera size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Photo Picker Pro</h4>
                      <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                        Lọc ảnh AI nhận diện mắt nhắm, nét mờ, cảm xúc với tốc độ hàng nghìn ảnh chỉ trong vài giây.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 border border-border/80 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">MVD Convert Fast</h4>
                      <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                        Bộ nén & chuyển đổi đa luồng RAW, JPG, PNG, WebP giữ trọn dải màu và độ sắc nét.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 border border-border/80 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Layers size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Retouch Agent Bridge</h4>
                      <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                        Cầu nối tự động hóa Photoshop Actions, Color Grading và xử lý da tự động mượt mà.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/40 border border-border/80 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Crown size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Kho Tài Nguyên Creative</h4>
                      <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                        Tuyển tập Actions D&B, Presets màu, Brushes vẽ tóc và giáo trình Retouch VIP độc quyền.
                      </p>
                    </div>
                  </div>

                </div>

                {/* Cam kết bảo mật 100% Offline */}
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-2.5 text-[11px] text-muted-foreground">
                  <Cpu size={16} className="text-primary shrink-0" />
                  <span>
                    <strong className="text-foreground font-semibold">100% Offline Engine:</strong> Toàn bộ dữ liệu và hình ảnh được phân tích hoàn toàn cục bộ trên máy tính của bạn, đảm bảo an toàn và bảo mật tuyệt đối.
                  </span>
                </div>

                <div className="h-px bg-border" />
                
                {/* Thông tin bản quyền */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
                  <div className="flex gap-1.5">
                    <span className="text-muted-foreground">{t("copyright_owner")}:</span>
                    <span className="font-bold text-foreground">MVD Photoshop Academy</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="text-muted-foreground">{t("publisher")}:</span>
                    <span className="font-bold text-foreground">Minh Vương Dev</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-border">
                  <span className="text-muted-foreground">{t("licensed_to")}:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-primary">{session?.name || t("user")}</span>
                    {isPremium && <Crown size={12} className="text-amber-400" />}
                  </div>
                </div>
              </div>

              {/* Action Links */}
              <div className="flex w-full max-w-sm gap-2.5 pt-1">
                <a 
                  href="https://zalo.me/0869528304" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 bg-muted hover:bg-muted/80 active:scale-95 text-foreground py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all border border-border shadow-sm"
                >
                  Zalo: 0869528304
                </a>
                <a 
                  href="https://zalo.me/0869528304" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 bg-primary/10 hover:bg-primary/20 active:scale-95 text-primary py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all border border-primary/20 shadow-sm"
                >
                  {t("community")} <ExternalLink size={12} />
                </a>
              </div>

              {/* Điều khoản */}
              <button
                onClick={() => setShowTermsDialog(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium cursor-pointer pt-1"
              >
                <FileText size={13} />
                {t("terms_and_services")}
              </button>
            </div>
          )}
        </div>
      </div>

      {showTermsDialog && (
        <TermsDialog onClose={() => setShowTermsDialog(false)} />
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-card rounded-3xl w-full max-w-md border border-border shadow-2xl flex flex-col overflow-hidden animate-scale-in text-foreground">
            <div className="flex justify-between items-center px-5 py-4 border-b border-border bg-muted/30">
              <h3 className="text-xs font-bold text-foreground">{t("feedback_title")}</h3>
              <button 
                onClick={() => setShowFeedbackModal(false)}
                className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="p-5 space-y-3.5 overflow-y-auto max-h-[70vh] custom-scrollbar text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("feedback_name")}</label>
                  <input 
                    type="text" 
                    value={feedbackName} 
                    onChange={e => setFeedbackName(e.target.value)} 
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("feedback_phone")}</label>
                  <input 
                    type="tel" 
                    value={feedbackPhone} 
                    onChange={e => setFeedbackPhone(e.target.value)} 
                    placeholder={t("feedback_phone_hint")}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("feedback_content")}</label>
                <textarea 
                  value={feedbackContent} 
                  onChange={e => setFeedbackContent(e.target.value)} 
                  onPaste={handlePasteImage}
                  placeholder={t("feedback_placeholder")}
                  rows={4}
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs outline-none focus:border-primary/50 transition-colors resize-none"
                />
              </div>

              {feedbackImage && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("feedback_attachment")}</label>
                    <button 
                      onClick={() => setFeedbackImage(null)}
                      className="text-[10px] text-destructive hover:underline cursor-pointer"
                    >
                      Xóa ảnh
                    </button>
                  </div>
                  <div className="relative rounded-xl overflow-hidden border border-border max-h-36 bg-black/20 flex items-center justify-center">
                    <img src={feedbackImage} alt="Feedback Preview" className="max-h-36 object-contain" />
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground italic">
                {t("feedback_footer")}
              </p>
            </div>

            <div className="px-5 py-3.5 border-t border-border bg-muted/20 flex justify-end gap-2.5">
              <button 
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button 
                onClick={handleSubmitFeedback}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                {t("feedback_submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
