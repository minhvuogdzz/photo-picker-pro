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
  FileText,
} from "lucide-react";
import { UpdateDialog } from "@/core/updater_ui";
import { checkForUpdates, UpdateCheckResult } from "@/core/updater";
import { apiRequest } from "@/core/services/apiClient";
import { X, Image as ImageIcon, Send } from "lucide-react";
import { TermsDialog } from "@/core/components/TermsDialog";

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
    setIsCheckingUpdate(true);
    try {
      const result = await checkForUpdates();
      if (!result.hasUpdate) {
        alert(t("latest_version"));
      } else {
        setManualUpdateResult(result);
      }
    } catch (err) {
      alert(t("update_check_failed") + String(err));
    } finally {
      setIsCheckingUpdate(false);
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
                // Nén thành JPEG 70% để giảm thiểu dung lượng tránh lỗi Payload Too Large
                setFeedbackImage(canvas.toDataURL("image/jpeg", 0.7));
              }
            };
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackContent) {
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

  return (
    <div className="flex-1 flex w-full h-full animate-fade-in bg-card/50 rounded-2xl overflow-hidden border border-border/50">
      {/* Sidebar */}
      <div className="w-64 bg-black/5 dark:bg-black/20 border-r border-border/50 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-3 px-2 py-4 mb-4 border-b border-border/50">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          <div>
            <h2 className="text-sm font-bold tracking-tight">{t("system")}</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("general_options")}</p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "general" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
          }`}
        >
          <Settings2 size={16} />
          {t("general_settings")}
        </button>

        <button
          onClick={() => setActiveTab("about")}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "about" ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
          }`}
        >
          <Info size={16} />
          {t("version_info")}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-transparent to-background/50">
        <div className="flex-1 overflow-y-auto p-8 lg:p-12 flex justify-center">
          {activeTab === "general" && (
            <div className="max-w-2xl w-full space-y-10 animate-slide-up">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">{t("general_settings")}</h1>
                <button onClick={handleSave} className="btn-primary py-2.5 px-6 font-bold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center gap-2">
                  <Save size={16} /> {t("save_changes")}
                </button>
              </div>
              
              {/* Theme */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("theme_section")}</h3>
                <div className="flex gap-4">
                  {["dark", "light"].map((theme) => (
                    <button
                      key={theme}
                      onClick={() => updateSetting("theme", theme)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition-all cursor-pointer ${
                        settings.theme === theme 
                          ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" 
                          : "border-border/50 bg-black/5 dark:bg-black/20 text-muted-foreground hover:border-border hover:bg-black/10 dark:hover:bg-black/40"
                      }`}
                    >
                      {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
                      <span className="font-medium text-sm">{theme === "dark" ? t("dark_mode") : t("light_mode")}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("language_section")}</h3>
                <div className="relative w-full">
                  <select
                    className="w-full appearance-none bg-black/5 dark:bg-black/20 border border-border/50 text-foreground py-4 px-6 rounded-2xl font-medium outline-none focus:border-primary/50 transition-colors cursor-pointer"
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
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("software_updates")}</h3>
                  <button
                    onClick={handleManualUpdateCheck}
                    disabled={isCheckingUpdate}
                    className="btn-outline border-white/10 hover:border-primary/50 text-xs py-2 px-4 rounded-xl flex items-center gap-2 transition-colors"
                  >
                    {isCheckingUpdate ? <Loader2 size={14} className="animate-spin text-primary" /> : <RefreshCw size={14} className="text-primary" />}
                    {t("check_for_updates")}
                  </button>
                </div>

                <div className="bg-black/5 dark:bg-black/20 rounded-2xl p-6 border border-border/50 space-y-6 w-full">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="space-y-1 pr-6">
                      <span className="block text-sm font-medium group-hover:text-primary transition-colors">{t("auto_check_label")}</span>
                      <span className="block text-xs text-muted-foreground leading-relaxed">{t("auto_check_desc")}</span>
                    </div>
                    <div className={`shrink-0 w-12 h-6 rounded-full p-1 transition-colors ${settings.auto_check_updates ? 'bg-primary' : 'bg-black/20 dark:bg-white/10'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${settings.auto_check_updates ? 'translate-x-6' : 'translate-x-0'}`} />
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.auto_check_updates}
                      onChange={(e) => updateSetting("auto_check_updates", e.target.checked)}
                      className="hidden"
                    />
                  </label>

                  <div className="h-px bg-border/50" />

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div className="space-y-1 pr-6">
                      <span className="block text-sm font-medium group-hover:text-primary transition-colors">{t("auto_download_label")}</span>
                      <span className="block text-xs text-muted-foreground leading-relaxed">{t("auto_download_desc")}</span>
                    </div>
                    <div className={`shrink-0 w-12 h-6 rounded-full p-1 transition-colors ${settings.auto_download_updates ? 'bg-primary' : 'bg-black/20 dark:bg-white/10'}`}>
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

              {/* Feedback */}
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("support_feedback")}</h3>
                </div>
                <div className="bg-black/5 dark:bg-black/20 rounded-2xl p-6 border border-border/50 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{t("report_bugs")}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{t("report_bugs_desc")}</p>
                  </div>
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    className="btn-primary py-2 px-5 font-bold rounded-xl shadow-md text-xs"
                  >
                    {t("send_feedback")}
                  </button>
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
                <ShieldCheck size={16} /> {t("valid_license")}
              </div>

              {/* Thông tin phần mềm */}
              <div className="w-full bg-black/5 dark:bg-black/20 rounded-2xl p-6 border border-border/50 text-left space-y-5">
                <div className="text-sm text-foreground/80 leading-relaxed space-y-3">
                  <p>
                    <strong>MVD Photoshop Academy Ecosystem</strong> {t("software_description_1").replace("MVD Photoshop Academy Ecosystem ", "")}
                  </p>
                  <p>{t("software_description_2")}</p>
                  <p>{t("software_description_3")}</p>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground bg-black/5 dark:bg-black/20 p-4 rounded-xl border border-border/50">
                  <p className="flex items-center gap-2">
                    <Camera size={14} className="text-primary" />
                    {t("designed_for")}
                  </p>
                  <p className="flex items-center gap-2">
                    <Sparkles size={14} className="text-primary" />
                    {t("high_performance")}
                  </p>
                </div>
                
                <div className="h-px bg-border/50 my-4" />
                
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">{t("copyright_owner")}:</span>
                    <span className="font-bold">MVD Photoshop Academy</span>
                  </div>
                  <div className="hidden sm:block w-px h-4 bg-border/50" />
                  <div className="flex gap-2">
                    <span className="text-muted-foreground">{t("publisher")}:</span>
                    <span className="font-bold text-foreground">Minh Vuong Dev</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm pt-2 border-t border-border/50">
                  <div className="flex gap-2 w-full justify-between sm:justify-start">
                    <span className="text-muted-foreground">{t("licensed_to")}:</span>
                    <span className="font-bold text-primary">{session?.name || t("user")}</span>
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
                  Zalo: 0869528304
                </a>
                <a 
                  href="https://zalo.me/0869528304" 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex-1 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-foreground py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all hover:-translate-y-0.5 border border-border/50"
                >
                  {t("community")} <ExternalLink size={16} />
                </a>
              </div>

              {/* Điều khoản và Dịch vụ */}
              <button
                onClick={() => setShowTermsDialog(true)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-medium mt-2"
              >
                <FileText size={16} />
                {t("terms_and_services")}
              </button>
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

      {/* Terms Dialog */}
      {showTermsDialog && (
        <TermsDialog onClose={() => setShowTermsDialog(false)} />
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-background rounded-3xl w-full max-w-lg border border-border shadow-2xl flex flex-col overflow-hidden animate-scale-in">
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-card/50">
              <h3 className="text-lg font-bold">{t("feedback_title")}</h3>
              <button 
                onClick={() => setShowFeedbackModal(false)}
                className="w-8 h-8 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-muted-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">{t("feedback_name")}</label>
                  <input 
                    type="text" 
                    value={feedbackName} 
                    onChange={e => setFeedbackName(e.target.value)} 
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">{t("feedback_phone")}</label>
                  <input 
                    type="tel" 
                    value={feedbackPhone} 
                    onChange={e => setFeedbackPhone(e.target.value)} 
                    placeholder={t("feedback_phone_hint")}
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">{t("feedback_content")}</label>
                <textarea 
                  value={feedbackContent} 
                  onChange={e => setFeedbackContent(e.target.value)} 
                  onPaste={handlePasteImage}
                  placeholder={t("feedback_placeholder")}
                  className="w-full h-32 bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              {feedbackImage && (
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-1"><ImageIcon size={14} /> {t("feedback_attachment")}</label>
                  <div className="relative inline-block border border-border rounded-xl overflow-hidden shadow-md">
                    <img src={feedbackImage} alt="Attachment" className="max-h-40 object-contain" />
                    <button 
                      onClick={() => setFeedbackImage(null)} 
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground">
                {t("feedback_footer")}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-border bg-card/50 flex justify-end">
              <button 
                onClick={handleSubmitFeedback}
                disabled={isSubmitting}
                className={`btn-primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {t("feedback_submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

