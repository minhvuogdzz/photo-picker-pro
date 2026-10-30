import { useState } from "react";
import { Cpu } from "lucide-react";
import { ProcessMetrics, MetricDataPoint } from "./types";
import { PerformanceLineChart } from "./PerformanceLineChart";

interface AppPerformanceCardProps {
  metrics: ProcessMetrics | null;
  history: MetricDataPoint[];
}

export function AppPerformanceCard({ metrics, history }: AppPerformanceCardProps) {
  const [activeMetric, setActiveMetric] = useState<"cpu" | "memory">("cpu");

  const cpuData = history.map((h) => h.appCpu);
  const memoryData = history.map((h) => h.appMemoryMb);
  const timestamps = history.map((h) => h.timestamp);

  const currentCpu = metrics?.cpu_usage ?? 0;
  const currentMemory = metrics?.memory_formatted ?? "0 MB";

  return (
    <div className="bg-card/80 rounded-2xl p-3 border border-border/60 shadow-xs flex flex-col justify-between gap-2 transition-all">
      {/* Header: Title + Mode Toggle */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Cpu size={12} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-foreground tracking-tight leading-none truncate">
              DH Studio Pro
            </h3>
            <span className="text-[9px] text-muted-foreground leading-none">
              Tiến trình ứng dụng
            </span>
          </div>
        </div>

        {/* Chart Selector Pill */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/50 text-[9px] font-medium shrink-0">
          <button
            type="button"
            onClick={() => setActiveMetric("cpu")}
            className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
              activeMetric === "cpu"
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            CPU
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric("memory")}
            className={`px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
              activeMetric === "memory"
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
            {activeMetric === "cpu" ? `${currentCpu.toFixed(1)}%` : currentMemory}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium">
            {activeMetric === "cpu" ? "sử dụng" : "đang chiếm"}
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground font-mono">
          {activeMetric === "cpu" ? `Đỉnh ${Math.max(...cpuData, currentCpu).toFixed(0)}%` : "Bộ nhớ thực"}
        </span>
      </div>

      {/* Dynamic Line Chart */}
      <div className="w-full">
        {activeMetric === "cpu" ? (
          <PerformanceLineChart
            data={cpuData}
            timestamps={timestamps}
            unit="%"
            label="App CPU"
            height={38}
            maxVal={100}
            formatValue={(v) => `${v.toFixed(1)}%`}
          />
        ) : (
          <PerformanceLineChart
            data={memoryData}
            timestamps={timestamps}
            unit=" MB"
            label="App RAM"
            height={38}
            formatValue={(v) => `${Math.round(v)} MB`}
          />
        )}
      </div>
    </div>
  );
}
