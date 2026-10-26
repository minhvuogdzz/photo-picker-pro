import React, { useEffect, useState } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { ShieldCheck, Sparkles } from "lucide-react";

export function MiniTrashBin() {
  const ejectedCustomers = useAppStore((s) => s.ejectedCustomers);
  const setIsTrashModalOpen = useAppStore((s) => s.setIsTrashModalOpen);
  const tossAnimationTrigger = useAppStore((s) => s.tossAnimationTrigger);

  const [isLidOpen, setIsLidOpen] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);
  const [showPlusOne, setShowPlusOne] = useState(false);

  // Sync lid open/close & bounce with toss animation trigger
  useEffect(() => {
    if (!tossAnimationTrigger) return;

    // Open lid wide as paper ball flies high in the air (~400ms)
    const openTimer = setTimeout(() => {
      setIsLidOpen(true);
    }, 400);

    // Ball enters trash can, lid snaps shut with elastic bounce (~960ms)
    const bounceTimer = setTimeout(() => {
      setIsLidOpen(false);
      setIsBouncing(true);
      setShowPlusOne(true);
    }, 960);

    const resetTimer = setTimeout(() => {
      setIsBouncing(false);
      setShowPlusOne(false);
    }, 1500);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(bounceTimer);
      clearTimeout(resetTimer);
    };
  }, [tossAnimationTrigger]);

  const count = ejectedCustomers.length;

  return (
    <div
      id="mini-trash-bin-anchor"
      onClick={() => setIsTrashModalOpen(true)}
      className={`relative p-3 rounded-xl border transition-all cursor-pointer select-none group flex items-center justify-between gap-3 overflow-visible ${
        isBouncing
          ? "scale-105 border-emerald-500 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
          : isLidOpen
          ? "border-emerald-500/80 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-2 ring-emerald-500/40"
          : count > 0
          ? "bg-card hover:bg-muted/30 border-border/80 hover:border-emerald-500/50 shadow-2xs"
          : "bg-muted/10 hover:bg-muted/20 border-border/40 hover:border-border/60"
      }`}
      title="Bấm để xem danh sách khách đã lọc và khôi phục khi cần"
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Animated Trash Bin SVG with 3D Lid */}
        <div
          className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
            count > 0 || isLidOpen
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-muted/40 text-muted-foreground border border-border/40"
          } ${isBouncing ? "scale-125" : "group-hover:scale-110"}`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="overflow-visible"
          >
            {/* Trash Lid (Animated Angle Opening up to -55deg) */}
            <g
              className="transition-transform duration-300 origin-[2px_6px] ease-out"
              style={{
                transform: isLidOpen ? "rotate(-55deg) translateY(-3px) translateX(-1px)" : "rotate(0deg)",
              }}
            >
              <line x1="2" y1="6" x2="22" y2="6" strokeWidth="2.5" />
              <path d="M8 6V3.5a1.5 1.5 0 0 1 1.5-1.5h5a1.5 1.5 0 0 1 1.5 1.5V6" strokeWidth="2" />
            </g>

            {/* Trash Can Body with ribs */}
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <line x1="10" y1="11" x2="10" y2="17" strokeWidth="1.5" />
            <line x1="14" y1="11" x2="14" y2="17" strokeWidth="1.5" />
          </svg>

          {/* Paper peek indicator inside when not empty */}
          {count > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background shadow-xs animate-pulse" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground truncate">
              Thùng rác đã lọc
            </span>
            {count > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                {count}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground truncate block">
            {count > 0 ? "Bấm xem & khôi phục khách" : "Chưa có khách nào bị đá"}
          </span>
        </div>
      </div>

      {/* Safety Badge hint */}
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 shrink-0 font-medium bg-muted/30 px-2 py-0.5 rounded-md border border-border/40">
        <ShieldCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
        <span className="hidden sm:inline">An toàn file</span>
      </div>

      {/* Floating Sparkle Pill on Impact */}
      {showPlusOne && (
        <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-full bg-emerald-500 text-white font-mono font-bold text-[9px] shadow-lg animate-bounce flex items-center gap-1 z-30">
          <Sparkles size={10} />
          <span>+1</span>
        </div>
      )}
    </div>
  );
}
