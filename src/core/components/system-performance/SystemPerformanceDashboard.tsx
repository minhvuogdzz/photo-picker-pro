import { useEffect, useState } from "react";
import { HardDrive, Activity, RefreshCw } from "lucide-react";
import { SystemPerformanceReport, MetricDataPoint } from "./types";
import { systemPerformanceService } from "@/core/services/systemPerformanceService";
import { AppPerformanceCard } from "./AppPerformanceCard";
import { SystemPerformanceCard } from "./SystemPerformanceCard";
import { MemoryPressureCard } from "./MemoryPressureCard";
import { StorageDiskRing } from "./StorageDiskRing";

export function SystemPerformanceDashboard() {
  const [report, setReport] = useState<SystemPerformanceReport | null>(null);
  const [history, setHistory] = useState<MetricDataPoint[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Subscribe to live OS system metrics updates (every 1.5s, auto-pauses when window hidden)
    const unsubscribe = systemPerformanceService.subscribe((newReport, newHistory) => {
      setReport(newReport);
      setHistory(newHistory);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await systemPerformanceService.fetchOnce();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const disks = report?.storage || [];

  return (
    <div className="w-full bg-card rounded-[22px] p-4 border border-border shadow-sm flex flex-col gap-3 text-foreground">
      {/* Header: Title + Live Status + Refresh */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-2">
          <Activity size={14} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] font-semibold text-foreground">
              Hiệu suất hệ thống
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Trực tiếp
            </span>
          </div>
        </div>

        {/* Subtle Refresh Button */}
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors cursor-pointer disabled:opacity-50"
          title="Làm mới thông số ngay"
          aria-label="Làm mới"
        >
          <RefreshCw size={13} strokeWidth={1.75} className={isRefreshing ? "animate-spin text-primary" : ""} />
        </button>
      </div>

      {/* Row 1: 3 Peer Metric Cards (App CPU/RAM | System CPU/RAM | Memory Pressure) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <AppPerformanceCard
          metrics={report?.app || null}
          history={history}
        />

        <SystemPerformanceCard
          metrics={report?.system || null}
          history={history}
        />

        <MemoryPressureCard
          pressure={report?.memory_pressure || null}
        />
      </div>

      {/* Row 2: Storage Section (Circular Indicator) */}
      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground tracking-tight">
            <HardDrive size={12} className="text-muted-foreground" />
            <span>Dung Lượng Ổ Đĩa (Storage)</span>
          </div>
          <span className="text-[9px] text-muted-foreground font-mono">
            {disks.length} ổ đĩa nhận diện
          </span>
        </div>

        {disks.length === 0 ? (
          <div className="w-full py-4 rounded-xl border border-dashed border-border/60 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1">
            <HardDrive size={16} className="text-muted-foreground/40" />
            <span>Đang đọc danh sách ổ đĩa từ hệ điều hành...</span>
          </div>
        ) : disks.length === 1 ? (
          <StorageDiskRing disk={disks[0]} isSingle={true} />
        ) : (
          <div
            className={`grid gap-2.5 ${
              disks.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {disks.map((disk) => (
              <StorageDiskRing key={disk.id} disk={disk} isSingle={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
