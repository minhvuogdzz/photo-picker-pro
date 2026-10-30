import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { MemoryPressureMetrics } from "./types";

interface MemoryPressureCardProps {
  pressure: MemoryPressureMetrics | null;
}

export function MemoryPressureCard({ pressure }: MemoryPressureCardProps) {
  const isWarning = pressure?.status === "WARNING";
  const statusLabel = isWarning ? "WARNING" : "NORMAL";
  const description = pressure?.description || (isWarning ? "Hệ thống đang nén trang bộ nhớ" : "Bộ nhớ hoạt động bình thường");

  return (
    <div
      className={`rounded-2xl p-3 border shadow-xs flex flex-col justify-between gap-2 transition-all ${
        isWarning
          ? "bg-amber-500/8 border-amber-500/25 text-amber-900 dark:text-amber-200"
          : "bg-card/80 border-border/60 text-foreground"
      }`}
    >
      {/* Header: Title + Status Badge */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
              isWarning
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-muted border border-border text-foreground"
            }`}
          >
            <ShieldCheck size={12} className={isWarning ? "text-amber-500" : "text-emerald-500"} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-foreground tracking-tight leading-none truncate">
              Áp Lực Bộ Nhớ
            </h3>
            <span className="text-[9px] text-muted-foreground leading-none">
              Memory Pressure
            </span>
          </div>
        </div>

        <span
          className={`text-[9px] font-bold px-2 py-0.5 rounded-md border tracking-wider transition-colors shrink-0 ${
            isWarning
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Main Status Callout */}
      <div className="flex items-center gap-2 px-0.5">
        <div
          className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
            isWarning ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
          }`}
        />
        <div className="min-w-0">
          <span className="text-xs font-bold text-foreground block truncate leading-tight">
            {isWarning ? "Hệ thống chịu áp lực" : "Bộ nhớ hoạt động tối ưu"}
          </span>
          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            {description}
          </p>
        </div>
      </div>

      {/* Visual Health Gauge Meter */}
      <div className="w-full pt-1">
        <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden flex gap-0.5">
          <div
            className={`h-full rounded-l-full transition-all duration-500 ${
              isWarning ? "w-1/3 bg-muted-foreground/30" : "w-full bg-emerald-500/80"
            }`}
          />
          <div
            className={`h-full rounded-r-full transition-all duration-500 ${
              isWarning ? "w-2/3 bg-amber-500" : "w-0 bg-transparent"
            }`}
          />
        </div>
        <div className="flex items-center justify-between text-[8px] text-muted-foreground/60 mt-1 leading-none font-mono">
          <span>TỐI ƯU</span>
          <span>ÁP LỰC</span>
        </div>
      </div>
    </div>
  );
}
