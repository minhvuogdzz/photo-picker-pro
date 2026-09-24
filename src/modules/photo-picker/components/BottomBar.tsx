import { useAppStore } from "@/core/stores/useAppStore";
import { CoffeeSteamIcon } from "@/core/components/CoffeeSteamIcon";
import { Sparkles } from "lucide-react";

export function BottomBar() {
  const setIsDonateModalOpen = useAppStore((s) => s.setIsDonateModalOpen);

  return (
    <div className="bg-card/95 backdrop-blur-md px-3.5 py-1.5 flex items-center justify-between select-none gap-3 border-t border-border/40">
      {/* Left: System Ready & Status Badge */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-medium tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse" />
          <span>Sẵn sàng lọc ảnh</span>
        </span>
        <span className="text-[10px] text-muted-foreground/60 hidden xl:inline font-mono">
          Photo Picker Pro
        </span>
      </div>

      {/* Center: Clean & Balanced Branding / Encouragement Badge */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-muted/40 border border-border/50 text-[11px] text-muted-foreground font-medium shadow-2xs max-w-full truncate">
          <Sparkles size={11} className="text-amber-500 shrink-0" />
          <span className="truncate font-semibold text-foreground/80">Minh Vương Dev</span>
          <span className="text-border shrink-0">·</span>
          <span className="truncate text-muted-foreground/90">Nếu thấy hay hãy ủng hộ tác giả nhé</span>
        </div>
      </div>

      {/* Right: Animated Coffee Button */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={() => setIsDonateModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/12 hover:bg-amber-500/22 text-amber-700 dark:text-amber-300 border border-amber-500/35 hover:border-amber-500/60 transition-all cursor-pointer shadow-2xs group shrink-0 active:scale-[0.97]"
          title="Ủng hộ tác giả một ly cafe ☕"
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
