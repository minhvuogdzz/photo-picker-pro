import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useTranslation } from "@/core/lib/i18n";
import {
  Clock,
  RefreshCw,
  Sun,
  Moon,
  CircleDot,
} from "lucide-react";
import { useUpdaterStore } from "@/core/stores/useUpdaterStore";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { SmartSearchBar } from "./SmartSearchBar";
import { useSessionTimeout } from "@/core/hooks/useSessionTimeout";

export function TopBar() {
  const updateResult = useUpdaterStore((s) => s.updateResult);
  const openModal = useUpdaterStore((s) => s.openModal);
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const session = useAuthStore((s) => s.session);
  const { formattedTime, isExpiringSoon, isUnlimited } = useSessionTimeout();
  const { t } = useTranslation();

  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const getModuleTitle = () => {
    switch (activeModule) {
      case "launcher":
        return "Bảng điều khiển";
      case "photo-picker":
        return "Lọc ảnh Pro";
      case "contact-the-sheet":
        return "Contact the Sheet";
      case "mvd-convert":
        return "MVD Convert";
      case "resources":
        return "Kho Tài nguyên Creative";
      case "photo-counter":
        return "Thống kê sản lượng";
      case "system":
        return "Cài đặt & Bản quyền";
      default:
        return "DH Studio Pro";
    }
  };

  return (
    <header className="h-12 w-full flex items-center justify-between gap-4 px-2 select-none">
      {/* Left: Capsule Theme Switcher + Module Title */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Capsule Theme Switcher [ 🌓 | ☀️ | 🌙 ] */}
        <div
          className="flex items-center p-0.5 rounded-full bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 transition-colors"
          title="Chế độ giao diện (Tự động / Sáng / Tối)"
        >
          {/* Auto / System */}
          <button
            type="button"
            onClick={() => updateSetting("theme", "system")}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              theme === "system"
                ? "bg-white dark:bg-[#2c2d33] text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Tự động theo hệ điều hành (Auto)"
            aria-label="Chế độ tự động"
          >
            <CircleDot size={12} className="rotate-45" />
          </button>

          {/* Light */}
          <button
            type="button"
            onClick={() => updateSetting("theme", "light")}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              theme === "light"
                ? "bg-white text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Giao diện Sáng (Light mode)"
            aria-label="Chế độ sáng"
          >
            <Sun size={12} className="text-amber-500" />
          </button>

          {/* Dark */}
          <button
            type="button"
            onClick={() => updateSetting("theme", "dark")}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              theme === "dark"
                ? "bg-[#2c2d33] text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Giao diện Tối (Dark mode)"
            aria-label="Chế độ tối"
          >
            <Moon size={12} className="text-blue-400" />
          </button>
        </div>

        {/* Current Module Title Breadcrumb */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-foreground tracking-tight">
            {getModuleTitle()}
          </span>

          {activeModule !== "launcher" && (
            <button
              type="button"
              onClick={() => setActiveModule("launcher")}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              · Về Bảng điều khiển
            </button>
          )}
        </div>

        {/* Update badge */}
        {updateResult?.hasUpdate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openModal();
            }}
            className="text-[10px] py-0.5 px-2 bg-primary/10 hover:bg-primary/15 text-primary font-medium flex items-center gap-1 rounded-full cursor-pointer border border-primary/20 transition-all"
            title={`Có bản cập nhật mới v${updateResult.version}`}
          >
            <RefreshCw size={10} className="shrink-0 animate-spin" />
            <span>v{updateResult.version}</span>
          </button>
        )}
      </div>

      {/* Center: Smart Search Bar (Spotlight Style) */}
      <div className="flex-1 flex justify-center max-w-md">
        {activeModule === "launcher" && (
          <div className="w-full">
            <SmartSearchBar />
          </div>
        )}
      </div>

      {/* Right: Session Timer */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Session Countdown (only when expiring soon or limited) */}
        {session && !isUnlimited && (
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono border transition-all select-none ${
              isExpiringSoon
                ? "bg-destructive/10 text-destructive border-destructive/30 font-semibold animate-pulse"
                : "bg-black/5 dark:bg-white/10 text-muted-foreground border-border/40"
            }`}
            title="Thời gian phiên làm việc còn lại"
          >
            <Clock size={10} className={isExpiringSoon ? "text-destructive" : "text-muted-foreground"} />
            <span>{formattedTime}</span>
          </div>
        )}
      </div>
    </header>
  );
}
