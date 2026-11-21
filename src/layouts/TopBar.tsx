import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useTranslation } from "@/core/lib/i18n";
import {
  ArrowUpCircle,
  ChevronLeft,
  Clock,
} from "lucide-react";
import { useUpdaterStore } from "@/core/stores/useUpdaterStore";
import { SmartSearchBar } from "./SmartSearchBar";
import { useSessionTimeout } from "@/core/hooks/useSessionTimeout";

export function TopBar() {
  const updateResult = useUpdaterStore((s) => s.updateResult);
  const openModal = useUpdaterStore((s) => s.openModal);
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const session = useAuthStore((s) => s.session);
  const { formattedTime, isExpiringSoon, isUnlimited } = useSessionTimeout();
  const { t, tr } = useTranslation();

  const getModuleTitle = () => {
    switch (activeModule) {
      case "launcher":
        return tr("Bảng điều khiển", "Dashboard");
      case "photo-picker":
        return tr("Lọc ảnh Pro", "Photo Picker Pro");
      case "contact-the-sheet":
        return "Contact Sheet";
      case "mvd-convert":
        return t("convert_file");
      case "resources":
        return tr("Kho Tài nguyên Creative", "Creative Resources Hub");
      case "photo-counter":
        return tr("Thống kê sản lượng", "Photo Analytics");
      case "system":
        return tr("Cài đặt & Bản quyền", "Settings & License");
      case "notifications":
        return tr("Trung tâm thông báo", "Notifications");
      default:
        return "DH Studio Pro";
    }
  };

  return (
    <header className="h-full w-full flex items-center justify-between gap-4 select-none" data-tauri-drag-region>
      {/* Left: Module Title Breadcrumb */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        {activeModule !== "launcher" && (
          <button
            type="button"
            onClick={() => setActiveModule("launcher")}
            className="w-7 h-7 -ml-1 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors cursor-pointer"
            title={tr("Về Bảng điều khiển", "Back to Dashboard")}
            aria-label={tr("Về Bảng điều khiển", "Back to Dashboard")}
          >
            <ChevronLeft size={17} strokeWidth={1.75} />
          </button>
        )}

        <h1 className="text-[15px] font-semibold text-foreground tracking-tight truncate">
          {getModuleTitle()}
        </h1>

        {/* Update badge */}
        {updateResult?.hasUpdate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openModal();
            }}
            className="ml-1 h-6 px-2.5 text-[11px] bg-primary/10 hover:bg-primary/15 text-primary font-medium flex items-center gap-1.5 rounded-full cursor-pointer transition-colors"
            title={tr(`Có bản cập nhật mới v${updateResult.version}`, `New update v${updateResult.version} available`)}
          >
            <ArrowUpCircle size={12} strokeWidth={2} className="shrink-0" />
            <span>{tr(`Cập nhật v${updateResult.version}`, `Update v${updateResult.version}`)}</span>
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
            className={`h-7 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] tabular-nums transition-colors select-none ${
              isExpiringSoon
                ? "bg-destructive/10 text-destructive font-medium"
                : "glass-pill text-muted-foreground"
            }`}
            title={tr("Thời gian phiên làm việc còn lại", "Remaining session time")}
          >
            <Clock size={12} strokeWidth={1.75} />
            <span>{formattedTime}</span>
          </div>
        )}
      </div>
    </header>
  );
}
