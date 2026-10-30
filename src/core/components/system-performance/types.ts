export interface ProcessMetrics {
  cpu_usage: number;
  memory_bytes: number;
  memory_formatted: string;
}

export interface SystemMetrics {
  cpu_usage: number;
  total_memory_bytes: number;
  used_memory_bytes: number;
  available_memory_bytes: number;
  memory_usage_pct: number;
}

export interface MemoryPressureMetrics {
  status: "NORMAL" | "WARNING";
  description: string;
}

export interface DiskStorageItem {
  id: string;
  name: string;
  mount_point: string;
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
  used_pct: number;
  is_removable: boolean;
}

export interface SystemPerformanceReport {
  app: ProcessMetrics;
  system: SystemMetrics;
  memory_pressure: MemoryPressureMetrics;
  storage: DiskStorageItem[];
  timestamp: number;
}

export interface MetricDataPoint {
  timestamp: number;
  appCpu: number;
  appMemoryMb: number;
  systemCpu: number;
  systemMemoryPct: number;
}
