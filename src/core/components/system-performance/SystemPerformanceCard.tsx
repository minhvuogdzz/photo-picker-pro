import { useState } from "react";
import { Laptop } from "lucide-react";
import { SystemMetrics, MetricDataPoint } from "./types";
import { PerformanceLineChart } from "./PerformanceLineChart";
import { formatGb } from "@/core/services/systemPerformanceService";
import { useTranslation } from "@/core/lib/i18n";

interface SystemPerformanceCardProps {
  metrics: SystemMetrics | null;
  history: MetricDataPoint[];
}

export function SystemPerformanceCard({ metrics, history }: SystemPerformanceCardProps) {
  const { tr } = useTranslation();
  const [activeTab, setActiveTab] = useState<"cpu" | "ram">("cpu");

  const systemCpuData = history.map((h) => h.systemCpu);
  const systemRamData = history.map((h) => h.systemMemoryPct);
  const timestamps = history.map((h) => h.timestamp);

  const totalRam = metrics?.total_memory_bytes ?? 0;
  const usedRam = metrics?.used_memory_bytes ?? 0;
  const availRam = metrics?.available_memory_bytes ?? 0;
  const ramPct = metrics?.memory_usage_pct ?? 0;
  const cpuPct = metrics?.cpu_usage ?? 0;

  return (
    <div className="bg-card/80 rounded-2xl p-3 border border-border/60 shadow-xs flex flex-col justify-between gap-2 transition-all">
      {/* Header: Title + Mode Toggle */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-muted border border-border flex items-center justify-center text-foreground shrink-0">
            <Laptop size={12} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-foreground tracking-tight leading-none truncate">
              {tr("Toàn Hệ Thống", "System Overall")}
            </h3>
            <span className="text-[9px] text-muted-foreground leading-none">
              {tr("Tài nguyên máy tính", "Hardware resources")}
            </span>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/50 text-[9px] font-medium shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("cpu")}
            className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
              activeTab === "cpu"
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            CPU
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ram")}
            className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
              activeTab === "ram"
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            RAM
          </button>
        </div>
      </div>

      {/* Primary Metric Stat Row */}
      <div className="flex items-baseline justify-between px-0.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-black text-foreground font-mono tracking-tight leading-none">
            {activeTab === "cpu" ? `${cpuPct.toFixed(1)}%` : `${ramPct.toFixed(0)}%`}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">
            {activeTab === "cpu"
              ? cpuPct < 35
                ? tr("Tải nhẹ", "Light load")
                : cpuPct < 70
                  ? tr("Bình thường", "Normal")
                  : tr("Tải nặng", "Heavy load")
              : `${tr("Dùng", "Used")} ${formatGb(usedRam)}`}
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground font-mono">
          {activeTab === "cpu"
            ? `${tr("Đỉnh", "Peak")} ${Math.max(...systemCpuData, cpuPct).toFixed(0)}%`
            : `${tr("Trống", "Free")} ${formatGb(availRam)}`}
        </span>
      </div>

      {/* Dynamic Line Chart */}
      <div className="w-full">
        {activeTab === "cpu" ? (
          <PerformanceLineChart
            data={systemCpuData}
            timestamps={timestamps}
            unit="%"
            label="System CPU"
            height={38}
            maxVal={100}
            formatValue={(v) => `${v.toFixed(1)}%`}
          />
        ) : (
          <PerformanceLineChart
            data={systemRamData}
            timestamps={timestamps}
            unit="%"
            label="System RAM"
            height={38}
            maxVal={100}
            formatValue={(v) => `${v.toFixed(1)}%`}
          />
        )}
      </div>
    </div>
  );
}
