import { useAppStore } from "@/core/stores/useAppStore";
import { CoffeeSteamIcon } from "@/core/components/CoffeeSteamIcon";
import { useTranslation } from "@/core/lib/i18n";

export function BottomBar() {
  const { tr } = useTranslation();
  const setIsDonateModalOpen = useAppStore((s) => s.setIsDonateModalOpen);

  return (
    <div className="bg-card px-3 py-1.5 flex items-center justify-between select-none gap-3">
      {/* Left: System Ready & Status */}
      <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
        <span>{tr("Sẵn sàng lọc ảnh", "Ready to pick photos")}</span>
        <span className="hidden xl:inline text-muted-foreground/60">· Photo Picker Pro</span>
      </div>

      {/* Right: Animated Coffee Button */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={() => setIsDonateModalOpen(true)}
          className="btn-macos inline-flex items-center gap-1.5 h-7.5 px-3 rounded-full text-xs cursor-pointer group shrink-0"
          title={tr("Ủng hộ tác giả một ly cafe", "Buy the author a coffee")}
        >
          <CoffeeSteamIcon
            size={14}
            className="text-warning group-hover:scale-110 transition-transform"
          />
          <span>Donate Cafe</span>
        </button>
      </div>
    </div>
  );
}
