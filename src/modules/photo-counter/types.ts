export type PhotoType = "type1" | "type2";

export interface DeepestFolderInfo {
  folder_path: string;
  folder_name: string;
  relative_path: string;
  job_name: string;
  photo_count: number;
  sample_files: string[];
  extensions: Record<string, number>;
}

export interface DayScanResult {
  day_name: string;
  day_path: string;
  total_photos: number;
  job_count: number;
  deepest_folders: DeepestFolderInfo[];
}

export interface MonthScanResult {
  month_path: string;
  month_name: string;
  total_photos: number;
  active_days: number;
  total_days: number;
  days: DayScanResult[];
}

export interface ScanMonthOptions {
  extensions_preset?: "finished" | "all" | "custom";
  custom_extensions?: string[];
  count_mode?: "deepest_folder" | "all_recursive";
  exclude_patterns?: string[];
  enable_exclude_patterns?: boolean;
}

export interface SalaryConfig {
  daysInMonth: 30 | 31;         // Lựa chọn tháng 30 hoặc 31 ngày
  daysOff: number;              // Số ngày nghỉ (ví dụ: 3)
  baseSalary: number;           // Lương cứng (ví dụ: 11.000.000)
  dailyKpi: number;             // KPI 1 ngày (ví dụ: 130 file)
  manualPhotos: number | null;  // Sản lượng thực tế nhập tay (nếu để null thì lấy tự động từ hệ thống)
  vipSets: number;              // Số bộ VIP (ví dụ: 20)
  unitPriceKpi: number;         // Đơn giá 1 file vượt KPI tháng (ví dụ: 5.000)
  vipPrice: number;             // Đơn giá 1 bộ VIP (ví dụ: 50.000)
  allowance: number;            // Trợ cấp (ví dụ: 500.000)
  deduction: number;            // Phụ thu khác (ví dụ: 75.000)
  efficiencyFormula: string;    // Công thức thưởng hiệu suất (mặc định lấy T // 1000 * 500.000, có thể dùng A)
  type1Weight: number;          // Hệ số quy đổi ảnh Loại 1 (mặc định 1.0)
  type2Weight: number;          // Hệ số quy đổi ảnh Loại 2 (ví dụ: 0.5 nghĩa là 1 ảnh Loại 1 = 2 ảnh Loại 2)
}

export interface SalaryCalculationResult {
  actualWorkingDays: number;    // Biến A = Tổng ngày trong tháng - Ngày nghỉ
  monthKpi: number;             // KPI tháng = A * dailyKpi
  actualPhotos: number;         // Tổng số file thực tế T (đã quy đổi Loại 1/Loại 2 hoặc ghi đè)
  rawScannedPhotos: number;     // Số file đếm thuần từ hệ thống chưa tính hệ số
  isKpiAchieved: boolean;       // true nếu actualPhotos >= monthKpi
  appliedBaseSalary: number;    // Nếu đạt KPI: nhận đủ baseSalary. Nếu chưa đạt: actualPhotos * unitPriceKpi
  baseSalary: number;           // Mức lương cứng lý thuyết
  excessPhotos: number;         // Số file vượt KPI = isKpiAchieved ? (actualPhotos - monthKpi) : 0
  excessSalary: number;         // Thưởng vượt KPI = excessPhotos * unitPriceKpi (0 nếu chưa đạt KPI)
  efficiencyBonus: number;      // Thưởng hiệu suất công việc
  vipBonus: number;             // Lương thưởng VIP = vipSets * vipPrice
  allowance: number;            // Trợ cấp
  deduction: number;            // Phụ thu
  totalSalary: number;          // Tổng lương thực lĩnh
}
