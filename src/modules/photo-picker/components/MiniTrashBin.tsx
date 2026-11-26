import React, { useEffect, useState } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "@/core/lib/i18n";

export function MiniTrashBin() {
  const { tr } = useTranslation();
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
      className={`relative p-2.5 rounded-lg border transition-all cursor-pointer select-none group flex items-center justify-between gap-2.5 overflow-visible ${
        isBouncing
          ? "scale-105 border-success bg-success/15 shadow-[0_0_16px_rgba(63,176,127,0.3)]"
          : isLidOpen
          ? "border-success/80 bg-success/10 ring-2 ring-success/30"
          : count > 0
          ? "border-border bg-foreground/[0.02] hover:bg-foreground/[0.04] hover:border-border-strong"
          : "border-border bg-foreground/[0.02] hover:bg-foreground/[0.04]"
      }`}
      title={tr("Bấm để xem danh sách khách đã lọc và khôi phục khi cần", "Click to view filtered customers and restore if needed")}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Animated Trash Bin SVG with 3D Lid */}
        <div
          className={`relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform ${
            count > 0 || isLidOpen
              ? "bg-success/12 text-success border border-success/25"
              : "bg-foreground/[0.04] text-muted-foreground border border-border"
          } ${isBouncing ? "scale-120" : "group-hover:scale-105"}`}
        >
          <svg
            width="17"
            height="17"
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
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-foreground truncate">
              {tr("Thùng rác đã lọc", "Completed Trash")}
            </span>
            {count > 0 && (
              <span className="px-1.5 py-0.2 text-[11px] font-medium tabular-nums rounded-full bg-success/12 text-success">
                {count}
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground truncate block">
            {count > 0 ? tr("Bấm xem & khôi phục khách", "Click to inspect or restore") : tr("Chưa có khách nào bị đá", "Trash is empty")}
          </span>
        </div>
      </div>

      {/* Quiet Safety Indicator */}
      <div
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0"
        title={tr("An toàn file", "File-safe")}
      >
        <ShieldCheck size={13} className="text-success shrink-0" />
        <span className="hidden sm:inline">{tr("An toàn file", "File-safe")}</span>
      </div>

      {/* Floating Sparkle Pill on Impact */}
      {showPlusOne && (
        <div className="absolute -top-3 right-4 px-2 py-0.5 rounded-full bg-success text-white font-mono font-bold text-[9px] shadow-lg animate-bounce flex items-center gap-1 z-30">
          <Sparkles size={10} />
          <span>+1</span>
        </div>
      )}
    </div>
  );
}
