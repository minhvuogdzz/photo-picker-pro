import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Megaphone, CheckCircle2, Sparkles, ExternalLink } from "lucide-react";
import { useAppStore } from "@/core/stores/useAppStore";
import { apiRequest } from "@/core/services/apiClient";

interface AnnouncementConfig {
  enabled: boolean;
  title: string;
  htmlContent: string;
  updatedAt?: string;
}

export function AnnouncementPopup() {
  const hasSeenWelcome = useAppStore((s) => s.hasSeenWelcome);
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<AnnouncementConfig | null>(null);

  // Fetch dynamic announcement configuration from public config
  useEffect(() => {
    let isMounted = true;

    apiRequest<{
      announcementPopup?: {
        enabled?: boolean;
        title?: string;
        htmlContent?: string;
        updatedAt?: string;
      };
    }>("/config/public")
      .then((res) => {
        if (!isMounted || !res?.announcementPopup) return;
        const ap = res.announcementPopup;
        if (ap.enabled && ap.htmlContent && ap.htmlContent.trim().length > 0) {
          setConfig({
            enabled: !!ap.enabled,
            title: ap.title?.trim() || "Thông Báo Từ Nhà Phát Triển",
            htmlContent: ap.htmlContent.trim(),
            updatedAt: ap.updatedAt,
          });
        }
      })
      .catch(() => {
        // Silently ignore if offline
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Show popup automatically right after the welcome screen finishes
  useEffect(() => {
    if (!hasSeenWelcome || !config?.enabled || !config.htmlContent) {
      return;
    }

    // Check if the user has already seen the announcement in this active app session
    try {
      const sessionSeen = sessionStorage.getItem("mvd_announcement_seen_session");
      if (sessionSeen === "true") {
        return;
      }
    } catch {
      // ignore storage error
    }

    // Small delay after welcome screen fades out for smooth visual transition
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 350);

    return () => clearTimeout(timer);
  }, [hasSeenWelcome, config]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    try {
      sessionStorage.setItem("mvd_announcement_seen_session", "true");
    } catch {
      // ignore
    }
  }, []);

  // Escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen || !config || !config.htmlContent) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[115] flex items-center justify-center p-3 sm:p-5 bg-black/55 backdrop-blur-xs dark:bg-black/75 dark:backdrop-blur-md animate-fade-in select-none">
      {/* Click outside to close backdrop */}
      <div className="absolute inset-0" onClick={handleClose} />

      {/* Main Popup Modal */}
      <div
        className="relative z-10 w-full max-w-xl sm:max-w-2xl bg-card text-card-foreground border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/80 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <Megaphone size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground leading-tight">
                  {config.title}
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-400">
                  <Sparkles size={10} />
                  Thông báo
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cập nhật thông tin chính thức từ MVD Tech & Design Studio
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-border"
            title="Đóng thông báo (ESC)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Fixed Bounding Content Div (Chứa code HTML/CSS inline do Admin cấu hình) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar text-foreground">
          <div
            className="mvd-announcement-container w-full rounded-2xl bg-muted/20 border border-border/60 p-4 sm:p-5 select-text leading-relaxed text-xs sm:text-sm overflow-hidden"
            dangerouslySetInnerHTML={{ __html: config.htmlContent }}
          />
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-border/70 bg-muted/20 shrink-0 flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <span>Thông báo đã được xác thực từ nhà cung cấp</span>
          </span>

          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
