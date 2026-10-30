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
    <div className="w-full bg-card/60 rounded-2xl p-3 sm:p-3.5 border border-border/70 shadow-xs flex flex-col gap-2.5 text-foreground transition-all">
      {/* Header: Title + Live Status + Refresh */}
      <div className="flex items-center justify-between gap-2 px-0.5 pb-1 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-muted border border-border/60 flex items-center justify-center text-foreground shrink-0">
            <Activity size={12} className="text-primary" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              GIÁM SÁT HIỆU SUẤT (SYSTEM PERFORMANCE)
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8px] font-mono bg-muted text-muted-foreground border border-border/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Real-time
            </span>
          </div>
        </div>

        {/* Subtle Refresh Button */}
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer border border-transparent hover:border-border disabled:opacity-50"
          title="Làm mới thông số ngay"
          aria-label="Làm mới"
        >
          <RefreshCw size={11} className={isRefreshing ? "animate-spin text-primary" : ""} />
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
