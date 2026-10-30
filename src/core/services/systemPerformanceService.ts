import { invoke } from "@tauri-apps/api/core";
import { SystemPerformanceReport, MetricDataPoint } from "../components/system-performance/types";

const MAX_HISTORY_POINTS = 60; // 60 data points * 1.5s ≈ 90 seconds
const POLLING_INTERVAL_MS = 1500;

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0 || isNaN(bytes)) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${val} ${sizes[i] || "B"}`;
}

export function formatGb(bytes: number, decimals = 1): string {
  if (bytes <= 0 || isNaN(bytes)) return "0 GB";
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(decimals)} GB`;
}

type MetricsListener = (report: SystemPerformanceReport, history: MetricDataPoint[]) => void;

class SystemPerformanceService {
  private listeners = new Set<MetricsListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private history: MetricDataPoint[] = [];
  private lastReport: SystemPerformanceReport | null = null;
  private isPolling = false;
  private isPausedByVisibility = false;

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.isPausedByVisibility = true;
      this.stopTimer();
    } else {
      this.isPausedByVisibility = false;
      if (this.listeners.size > 0) {
        this.fetchOnce();
        this.startTimer();
      }
    }
  };

  public subscribe(listener: MetricsListener): () => void {
    this.listeners.add(listener);

    // If we have previous report, notify subscriber immediately
    if (this.lastReport) {
      listener(this.lastReport, [...this.history]);
    }

    if (!this.isPolling && !document.hidden) {
      this.fetchOnce();
      this.startTimer();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stopTimer();
        this.isPolling = false;
      }
    };
  }

  public async fetchOnce(): Promise<SystemPerformanceReport | null> {
    try {
      const report = await invoke<SystemPerformanceReport>("get_system_performance_metrics");
      this.handleNewReport(report);
      return report;
    } catch (err) {
      console.warn("Failed to fetch system performance metrics:", err);
      return null;
    }
  }

  private startTimer() {
    this.stopTimer();
    this.isPolling = true;
    this.timer = setInterval(async () => {
      if (this.isPausedByVisibility || this.listeners.size === 0) return;
      await this.fetchOnce();
    }, POLLING_INTERVAL_MS);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private handleNewReport(report: SystemPerformanceReport) {
    this.lastReport = report;

    const dataPoint: MetricDataPoint = {
      timestamp: report.timestamp,
      appCpu: Math.max(0, report.app.cpu_usage),
      appMemoryMb: Math.round(report.app.memory_bytes / (1024 * 1024)),
      systemCpu: Math.max(0, report.system.cpu_usage),
      systemMemoryPct: Math.max(0, Math.min(100, report.system.memory_usage_pct)),
    };

    this.history.push(dataPoint);
    if (this.history.length > MAX_HISTORY_POINTS) {
      this.history.shift();
    }

    const currentHistory = [...this.history];
    for (const listener of this.listeners) {
      try {
        listener(report, currentHistory);
      } catch (e) {
        console.error("Error in system metrics subscriber:", e);
      }
    }
  }

  public getLastReport(): SystemPerformanceReport | null {
    return this.lastReport;
  }

  public getHistory(): MetricDataPoint[] {
    return [...this.history];
  }
}

export const systemPerformanceService = new SystemPerformanceService();
