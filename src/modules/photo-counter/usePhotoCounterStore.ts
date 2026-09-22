import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  MonthScanResult,
  DayScanResult,
  SalaryConfig,
  ScanMonthOptions,
  SalaryCalculationResult,
  PhotoType,
} from "./types";

const STORAGE_PREFIX = "mvd_stat_";

const DEFAULT_SALARY_CONFIG: SalaryConfig = {
  daysInMonth: 31,
  daysOff: 3,
  baseSalary: 11000000,
  dailyKpi: 130,
  manualPhotos: null,
  vipSets: 20,
  unitPriceKpi: 5000,
  vipPrice: 50000,
  allowance: 500000,
  deduction: 75000,
  efficiencyFormula: "Math.floor(T / 1000) * 500000",
  type1Weight: 1.0,
  type2Weight: 0.5, // Ví dụ: 1 ảnh Loại 1 = 2 ảnh Loại 2 (nghĩa là 1 ảnh Loại 2 quy đổi thành 0.5 ảnh Loại 1)
};

function loadStoredSalaryConfig(): SalaryConfig {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}salary_config`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SALARY_CONFIG, ...parsed };
    }
  } catch {
    // Ignore error
  }
  return DEFAULT_SALARY_CONFIG;
}

function saveStoredSalaryConfig(cfg: SalaryConfig) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}salary_config`, JSON.stringify(cfg));
  } catch {
    // Ignore error
  }
}

interface PhotoCounterState {
  monthPath: string;
  monthName: string;
  isScanning: boolean;
  scanResult: MonthScanResult | null;
  error: string | null;
  salaryConfig: SalaryConfig;
  options: ScanMonthOptions;
  excludedFolderPaths: Record<string, boolean>; // true = excluded
  folderTypeMap: Record<string, PhotoType>;     // "type1" | "type2"

  // Actions
  setMonthPath: (path: string) => void;
  setSalaryConfig: (config: Partial<SalaryConfig>) => void;
  setOptions: (options: Partial<ScanMonthOptions>) => void;
  toggleFolderExclusion: (folderPath: string) => void;
  setFolderType: (folderPath: string, type: PhotoType) => void;
  setDayAllFoldersType: (day: DayScanResult, type: PhotoType) => void;
  removeDay: (dayPath: string) => void;
  removeFolder: (folderPath: string) => void;
  scanMonth: (path?: string) => Promise<void>;
  rescan: () => Promise<void>;
  reset: () => void;
}

export const usePhotoCounterStore = create<PhotoCounterState>((set, get) => ({
  monthPath: "",
  monthName: "",
  isScanning: false,
  scanResult: null,
  error: null,
  salaryConfig: loadStoredSalaryConfig(),
  options: {
    extensions_preset: "finished",
    count_mode: "deepest_folder",
    enable_exclude_patterns: true,
  },
  excludedFolderPaths: {},
  folderTypeMap: {},

  setMonthPath: (path) => set({ monthPath: path }),

  setSalaryConfig: (config) => {
    set((state) => {
      const updated = { ...state.salaryConfig, ...config };
      saveStoredSalaryConfig(updated);
      return { salaryConfig: updated };
    });
  },

  setOptions: (newOpts) => {
    set((state) => ({ options: { ...state.options, ...newOpts } }));
    if (get().monthPath) {
      get().scanMonth(get().monthPath);
    }
  },

  toggleFolderExclusion: (folderPath) => {
    set((state) => ({
      excludedFolderPaths: {
        ...state.excludedFolderPaths,
        [folderPath]: !state.excludedFolderPaths[folderPath],
      },
    }));
  },

  setFolderType: (folderPath, type) => {
    set((state) => ({
      folderTypeMap: {
        ...state.folderTypeMap,
        [folderPath]: type,
      },
    }));
  },

  setDayAllFoldersType: (day, type) => {
    set((state) => {
      const updated = { ...state.folderTypeMap };
      day.deepest_folders.forEach((f) => {
        updated[f.folder_path] = type;
      });
      return { folderTypeMap: updated };
    });
  },

  removeDay: (dayPath) => {
    set((state) => {
      if (!state.scanResult) return state;
      const targetDay = state.scanResult.days.find((d) => d.day_path === dayPath);
      const updatedDays = state.scanResult.days.filter((d) => d.day_path !== dayPath);
      const totalPhotos = updatedDays.reduce((acc, d) => acc + d.total_photos, 0);
      const activeDays = updatedDays.filter((d) => d.total_photos > 0).length;

      // Clean up mapping
      const updatedExcluded = { ...state.excludedFolderPaths };
      const updatedTypeMap = { ...state.folderTypeMap };
      if (targetDay) {
        targetDay.deepest_folders.forEach((f) => {
          delete updatedExcluded[f.folder_path];
          delete updatedTypeMap[f.folder_path];
        });
      }

      return {
        excludedFolderPaths: updatedExcluded,
        folderTypeMap: updatedTypeMap,
        scanResult: {
          ...state.scanResult,
          total_photos: totalPhotos,
          total_days: updatedDays.length,
          active_days: activeDays,
          days: updatedDays,
        },
      };
    });
  },

  removeFolder: (folderPath) => {
    set((state) => {
      if (!state.scanResult) return state;
      const updatedDays = state.scanResult.days.map((day) => {
        const hasFolder = day.deepest_folders.some((f) => f.folder_path === folderPath);
        if (!hasFolder) return day;

        const updatedFolders = day.deepest_folders.filter((f) => f.folder_path !== folderPath);
        const dayPhotos = updatedFolders.reduce((acc, f) => acc + f.photo_count, 0);
        const uniqueJobs = new Set(updatedFolders.map((f) => f.job_name));
        return {
          ...day,
          total_photos: dayPhotos,
          job_count: uniqueJobs.size,
          deepest_folders: updatedFolders,
        };
      });

      const totalPhotos = updatedDays.reduce((acc, d) => acc + d.total_photos, 0);
      const activeDays = updatedDays.filter((d) => d.total_photos > 0).length;

      const updatedExcluded = { ...state.excludedFolderPaths };
      delete updatedExcluded[folderPath];
      const updatedTypeMap = { ...state.folderTypeMap };
      delete updatedTypeMap[folderPath];

      return {
        excludedFolderPaths: updatedExcluded,
        folderTypeMap: updatedTypeMap,
        scanResult: {
          ...state.scanResult,
          total_photos: totalPhotos,
          active_days: activeDays,
          days: updatedDays,
        },
      };
    });
  },

  scanMonth: async (pathInput) => {
    const targetPath = pathInput || get().monthPath;
    if (!targetPath) return;

    set({ isScanning: true, error: null, monthPath: targetPath });

    try {
      const result = await invoke<MonthScanResult>("scan_month_photos", {
        monthPath: targetPath,
        options: get().options,
      });

      // Try auto-detecting 30 vs 31 days if possible from month name
      let autoDaysInMonth: 30 | 31 = get().salaryConfig.daysInMonth;
      const lowerName = result.month_name.toLowerCase();
      const monthMatch = lowerName.match(/(?:tháng|thang|t|th)\s*(\d{1,2})/);
      if (monthMatch) {
        const m = parseInt(monthMatch[1], 10);
        if ([4, 6, 9, 11].includes(m)) {
          autoDaysInMonth = 30;
        } else if ([1, 3, 5, 7, 8, 10, 12].includes(m)) {
          autoDaysInMonth = 31;
        }
      }

      set({
        scanResult: result,
        monthName: result.month_name,
        isScanning: false,
        error: null,
        salaryConfig: {
          ...get().salaryConfig,
          daysInMonth: autoDaysInMonth,
        },
      });
    } catch (err) {
      console.error("Failed to scan month photos:", err);
      set({
        isScanning: false,
        error: typeof err === "string" ? err : String(err),
      });
    }
  },

  rescan: async () => {
    const path = get().monthPath;
    if (path) {
      await get().scanMonth(path);
    }
  },

  reset: () => {
    set({
      monthPath: "",
      monthName: "",
      isScanning: false,
      scanResult: null,
      error: null,
      excludedFolderPaths: {},
      folderTypeMap: {},
    });
  },
}));

// Safe custom formula evaluator for efficiency bonus
export function evaluateEfficiencyBonus(
  formulaStr: string | undefined,
  T: number,
  A: number
): number {
  const defaultFormula = (t: number) => Math.floor(t / 1000) * 500000;
  if (!formulaStr || !formulaStr.trim()) {
    return defaultFormula(T);
  }

  try {
    // Sanitize: allow only math functions, T, A, operators, digits, whitespace
    const cleanFormula = formulaStr.trim();
    // Use Function constructor in isolated scope
    const fn = new Function("T", "A", `"use strict"; return (${cleanFormula});`);
    const val = fn(T, A);
    if (typeof val === "number" && !isNaN(val) && isFinite(val)) {
      return Math.max(0, Math.floor(val));
    }
    return defaultFormula(T);
  } catch (err) {
    console.warn("Lỗi tính công thức thưởng hiệu suất:", err);
    return defaultFormula(T);
  }
}

// Compute comprehensive salary and metrics
export function computeFullSalary(
  scanResult: MonthScanResult | null,
  excludedPaths: Record<string, boolean>,
  folderTypeMap: Record<string, PhotoType>,
  salaryConfig: SalaryConfig
): SalaryCalculationResult {
  let rawScannedPhotos = 0;
  let convertedScannedPhotos = 0;

  if (scanResult && scanResult.days) {
    scanResult.days.forEach((day) => {
      day.deepest_folders.forEach((folder) => {
        if (!excludedPaths[folder.folder_path]) {
          const count = folder.photo_count;
          rawScannedPhotos += count;
          const type = folderTypeMap[folder.folder_path] || "type1";
          const weight = type === "type2" ? salaryConfig.type2Weight : salaryConfig.type1Weight;
          convertedScannedPhotos += count * weight;
        }
      });
    });
  }

  // Determine actual photos T
  const actualPhotos =
    salaryConfig.manualPhotos !== null && salaryConfig.manualPhotos !== undefined
      ? salaryConfig.manualPhotos
      : Math.round(convertedScannedPhotos);

  // A: Actual working days = daysInMonth - daysOff
  const actualWorkingDays = Math.max(0, salaryConfig.daysInMonth - salaryConfig.daysOff);

  // Month KPI = A * dailyKpi
  const monthKpi = actualWorkingDays * salaryConfig.dailyKpi;

  // Quy chế mới:
  // Lương cứng CHỈ áp dụng khi hoàn thành ĐỦ hoặc VƯỢT KPI (actualPhotos >= monthKpi).
  // Nếu chưa đạt KPI: Tính theo đơn giá 1 file (bằng đơn giá vượt KPI) * actualPhotos, và KHÔNG có lương vượt KPI.
  const isKpiAchieved = actualPhotos >= monthKpi;

  // Số file vượt KPI: chỉ có khi đã đạt KPI
  const excessPhotos = isKpiAchieved ? Math.max(0, actualPhotos - monthKpi) : 0;
  const excessSalary = excessPhotos * salaryConfig.unitPriceKpi;

  // Lương cơ bản/sản lượng thực tế được nhận
  const appliedBaseSalary = isKpiAchieved
    ? salaryConfig.baseSalary
    : actualPhotos * salaryConfig.unitPriceKpi;

  // Efficiency bonus (default: floor(T / 1000) * 500,000, or user custom formula)
  const efficiencyBonus = evaluateEfficiencyBonus(
    salaryConfig.efficiencyFormula,
    actualPhotos,
    actualWorkingDays
  );

  // VIP Bonus = vipSets * vipPrice
  const vipBonus = salaryConfig.vipSets * salaryConfig.vipPrice;

  // Total salary:
  // Lương cơ bản/sản lượng + lương vượt kpi + lương thưởng hiệu suất + lương thưởng VIP + lương trợ cấp - phụ thu
  const totalSalary =
    appliedBaseSalary +
    excessSalary +
    efficiencyBonus +
    vipBonus +
    salaryConfig.allowance -
    salaryConfig.deduction;

  return {
    actualWorkingDays,
    monthKpi,
    actualPhotos,
    rawScannedPhotos,
    isKpiAchieved,
    appliedBaseSalary,
    baseSalary: salaryConfig.baseSalary,
    excessPhotos,
    excessSalary,
    efficiencyBonus,
    vipBonus,
    allowance: salaryConfig.allowance,
    deduction: salaryConfig.deduction,
    totalSalary,
  };
}

// Helper to get day statistics with photo types
export function getDayStats(
  day: DayScanResult,
  excludedPaths: Record<string, boolean>,
  folderTypeMap: Record<string, PhotoType>,
  type1Weight: number,
  type2Weight: number
) {
  let type1Photos = 0;
  let type2Photos = 0;
  let rawCount = 0;
  let convertedCount = 0;

  day.deepest_folders.forEach((folder) => {
    if (!excludedPaths[folder.folder_path]) {
      const count = folder.photo_count;
      rawCount += count;
      const type = folderTypeMap[folder.folder_path] || "type1";
      if (type === "type2") {
        type2Photos += count;
        convertedCount += count * type2Weight;
      } else {
        type1Photos += count;
        convertedCount += count * type1Weight;
      }
    }
  });

  return {
    type1Photos,
    type2Photos,
    rawCount,
    convertedCount: Math.round(convertedCount),
  };
}
