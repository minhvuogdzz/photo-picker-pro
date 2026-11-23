import { useAppStore } from "@/core/stores/useAppStore";
import { CoffeeSteamIcon } from "@/core/components/CoffeeSteamIcon";
import { useTranslation } from "@/core/lib/i18n";

export function BottomBar() {
  const { tr } = useTranslation();
  const setIsDonateModalOpen = useAppStore((s) => s.setIsDonateModalOpen);

  return (
    <div className="bg-card/95 backdrop-blur-md px-3.5 py-1.5 flex items-center justify-between select-none gap-3 border-t border-border/40">
      {/* Left: System Ready & Status Badge */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-medium tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse" />
          <span>{tr("Sẵn sàng lọc ảnh", "Ready to pick photos")}</span>
        </span>
        <span className="text-[10px] text-muted-foreground/80 hidden xl:inline font-mono">
          Photo Picker Pro
        </span>
      </div>

      {/* Right: Animated Coffee Button */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={() => setIsDonateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/12 hover:bg-amber-500/22 text-amber-700 dark:text-amber-300 border border-amber-500/35 hover:border-amber-500/60 transition-all cursor-pointer shadow-2xs group shrink-0 active:scale-[0.97]"
          title={tr("Ủng hộ tác giả một ly cafe", "Buy the author a coffee")}
        >
          <CoffeeSteamIcon
            size={14}
            className="text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform"
          />
          <span>Donate Cafe</span>
        </button>
      </div>
    </div>
  );
}
