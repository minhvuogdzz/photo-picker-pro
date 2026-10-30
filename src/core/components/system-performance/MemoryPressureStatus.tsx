import { CheckCircle2, AlertTriangle } from "lucide-react";
import { MemoryPressureMetrics } from "./types";

interface MemoryPressureStatusProps {
  pressure: MemoryPressureMetrics | null;
  compact?: boolean;
}

export function MemoryPressureStatus({ pressure, compact = false }: MemoryPressureStatusProps) {
  const isWarning = pressure?.status === "WARNING";
  const statusLabel = isWarning ? "Áp Lực (Warning)" : "Bình Thường (Normal)";
  const description = pressure?.description || (isWarning ? "Hệ thống đang chịu áp lực bộ nhớ" : "Bộ nhớ hoạt động bình thường");

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors duration-300 ${
          isWarning
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
            : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground"
        }`}
        title={description}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
            isWarning ? "bg-amber-500 animate-pulse" : "bg-emerald-500/80"
          }`}
        />
        <span className="font-semibold tracking-tight">{isWarning ? "Bộ nhớ: Cảnh báo" : "Bộ nhớ: Tối ưu"}</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-3.5 border transition-all duration-300 flex items-start gap-3 ${
        isWarning
          ? "bg-amber-500/8 border-amber-500/25 text-amber-900 dark:text-amber-200"
          : "bg-card/60 border-border/60 text-foreground"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
          isWarning
            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isWarning ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} className="text-emerald-500" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            ÁP LỰC BỘ NHỚ (MEMORY PRESSURE)
          </span>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
              isWarning
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
          {description}
        </p>
      </div>
    </div>
  );
}
