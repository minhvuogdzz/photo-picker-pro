import { HardDrive, Usb } from "lucide-react";
import { DiskStorageItem } from "./types";
import { formatGb } from "@/core/services/systemPerformanceService";

interface StorageDiskRingProps {
  disk: DiskStorageItem;
  isSingle?: boolean;
}

export function StorageDiskRing({ disk, isSingle = false }: StorageDiskRingProps) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const usedPct = Math.max(0, Math.min(100, disk.used_pct));
  const strokeDashoffset = circumference - (circumference * usedPct) / 100;

  // Warning color only when near full (> 90%)
  const isCritical = usedPct >= 95;
  const isWarning = usedPct >= 88 && !isCritical;

  const ringStrokeColor = isCritical
    ? "#ef4444"
    : isWarning
    ? "#f59e0b"
    : "var(--color-primary, #3b82f6)";

  if (isSingle) {
    return (
      <div className="w-full bg-card/80 hover:bg-card rounded-2xl p-3 border border-border/60 hover:border-border transition-all flex flex-col sm:flex-row items-center justify-between gap-4 group">
        {/* Left: Circular Ring + Disk Identity */}
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Circular Progress Ring */}
          <div className="relative flex items-center justify-center w-[58px] h-[58px] shrink-0">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 58 58">
              <circle
                cx="29"
                cy="29"
                r={radius}
                className="stroke-black/5 dark:stroke-white/10"
                strokeWidth="4.5"
                fill="none"
              />
              <circle
                cx="29"
                cy="29"
                r={radius}
                stroke={ringStrokeColor}
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                fill="none"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="text-[10px] font-black text-foreground font-mono tracking-tight">
                {formatGb(disk.available_bytes, 0)}
              </span>
              <span className="text-[7px] font-bold text-muted-foreground uppercase mt-0.5">
                Trống
              </span>
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              {disk.is_removable ? (
                <Usb size={13} className="text-muted-foreground shrink-0" />
              ) : (
                <HardDrive size={13} className="text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-bold text-foreground truncate" title={disk.name}>
                {disk.name}
              </span>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/40">
                {disk.mount_point}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-sm font-bold text-foreground font-mono">
                {formatGb(disk.available_bytes)}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                dung lượng khả dụng
              </span>
            </div>
          </div>
        </div>

        {/* Right: Storage Capacity Horizontal Bar */}
        <div className="w-full sm:w-64 flex flex-col gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-muted-foreground">Đã dùng: {formatGb(disk.used_bytes)}</span>
            <span className="font-bold text-foreground">{usedPct.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${usedPct}%`,
                backgroundColor: ringStrokeColor,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-muted-foreground/75 font-mono">
            <span>Tổng dung lượng</span>
            <span>{formatGb(disk.total_bytes)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/80 hover:bg-card rounded-2xl p-2.5 sm:p-3 border border-border/60 hover:border-border transition-all flex items-center gap-3 group">
      {/* Circular Progress Ring */}
      <div className="relative flex items-center justify-center w-[52px] h-[52px] shrink-0">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 52 52">
          <circle
            cx="26"
            cy="26"
            r={radius}
            className="stroke-black/5 dark:stroke-white/10"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="26"
            cy="26"
            r={radius}
            stroke={ringStrokeColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            fill="none"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-[9px] font-black text-foreground font-mono tracking-tight">
            {formatGb(disk.available_bytes, 0)}
          </span>
          <span className="text-[7px] font-bold text-muted-foreground uppercase mt-0.5">
            Trống
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {disk.is_removable ? (
              <Usb size={11} className="text-muted-foreground shrink-0" />
            ) : (
              <HardDrive size={11} className="text-muted-foreground shrink-0" />
            )}
            <span className="text-xs font-bold text-foreground truncate" title={disk.name}>
              {disk.name}
            </span>
          </div>
          <span className="font-mono text-[8px] px-1 py-0.2 rounded bg-muted text-muted-foreground shrink-0 border border-border/40">
            {disk.mount_point}
          </span>
        </div>

        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xs font-bold text-foreground font-mono">
            {formatGb(disk.available_bytes)}
          </span>
          <span className="text-[9px] text-muted-foreground font-medium">
            còn trống
          </span>
        </div>

        <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono mt-0.5">
          <span>{formatGb(disk.used_bytes)} / {formatGb(disk.total_bytes)}</span>
          <span className="font-semibold">{usedPct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}
