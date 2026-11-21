/**
 * Spreadsheet Export Service for Photo Counter
 * Generates dynamic spreadsheets with embedded formulas (=SUM, =IF, =INT)
 * using semicolon (;) argument separators for full Google Sheets & Excel compatibility.
 * 
 * Supports:
 * 1. Direct Google Sheets creation via Google Sheets API (single clean tab)
 * 2. Downloading spreadsheet CSV with UTF-8 BOM & live formulas
 * 3. Copying live TSV data for 1-click Ctrl+V pasting into Google Sheets/Excel
 */

import type { MonthScanResult, SalaryConfig, SalaryCalculationResult } from "../types.ts";
import { googleCredentialManager } from "../../contact-the-sheet/services/googleCredentialBridge.ts";
import { trText } from "../../../core/lib/i18n.ts";

function isTauri(): boolean {
  return typeof window !== "undefined" && typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
}

export interface DayRowData {
  dayName: string;
  photoCount: number;
}

export interface SpreadsheetExportData {
  monthName: string;
  monthPath: string;
  salaryConfig: SalaryConfig;
  calc: SalaryCalculationResult;
  scanResult: MonthScanResult | null;
  excludedFolderPaths: Record<string, boolean>;
  folderTypeMap: Record<string, "type1" | "type2">;
}

/**
 * Builds array of day data from scanResult with only dayName and actual photos count
 */
export function extractDaysSummary(data: SpreadsheetExportData): DayRowData[] {
  if (!data.scanResult || !data.scanResult.days) {
    return [];
  }

  const cfg = data.salaryConfig;

  return data.scanResult.days.map((day) => {
    let dayTotal = 0;
    day.deepest_folders.forEach((folder) => {
      if (data.excludedFolderPaths[folder.folder_path]) return;
      const type = data.folderTypeMap[folder.folder_path] || "type1";
      const weight = type === "type2" ? cfg.type2Weight : cfg.type1Weight;
      dayTotal += folder.photo_count * weight;
    });

    return {
      dayName: day.day_name,
      photoCount: Math.round(dayTotal),
    };
  });
}

/**
 * Builds 2D array of rows for Google Sheets / TSV / CSV
 * All formulas strictly use semicolon (;) for argument separation to prevent #ERROR! in Google Sheets.
 */
export function buildSpreadsheetMatrix(data: SpreadsheetExportData): {
  values: (string | number)[][];
  totalFormulaRowIndex: number;
} {
  const days = extractDaysSummary(data);
  const cfg = data.salaryConfig;

  const values: (string | number)[][] = [];

  // Row 1-3: Headers
  values.push([
    trText("BẢNG TỔNG HỢP LƯƠNG VÀ SẢN LƯỢNG STUDIO", "STUDIO SALARY & OUTPUT SUMMARY REPORT"),
    "",
    "",
  ]);
  values.push([
    trText(
      `Tháng / Thư mục: ${data.monthName || "Tháng này"}`,
      `Month / Folder: ${data.monthName || "This Month"}`,
    ),
    trText(`Đường dẫn: ${data.monthPath || ""}`, `Path: ${data.monthPath || ""}`),
    "",
  ]);
  values.push([]);

  // Section 1: Tham số & Chỉ số đầu vào (Rows 4-15 -> 1-based index)
  values.push([
    trText("I. THÔNG SỐ ĐẦU VÀO & ĐỊNH MỨC KPI", "I. INPUT PARAMETERS & KPI QUOTAS"),
    "",
    "",
  ]);
  values.push([
    trText("Số ngày trong tháng (ngày)", "Days in month (days)"),
    cfg.daysInMonth,
    trText("Tháng 30 hoặc 31 ngày", "30 or 31 days"),
  ]); // Row 5
  values.push([
    trText("Số ngày nghỉ (ngày)", "Days off (days)"),
    cfg.daysOff,
    trText("Ngày nghỉ theo quy định", "Scheduled days off"),
  ]); // Row 6
  values.push([
    trText("Ngày công thực tế (A) (ngày)", "Actual working days (A) (days)"),
    "=B5-B6",
    trText(
      "Biến A = Số ngày trong tháng - Ngày nghỉ",
      "Variable A = Days in month - Days off",
    ),
  ]); // Row 7
  values.push([
    trText("KPI 1 ngày (file/ngày)", "Daily KPI (files/day)"),
    cfg.dailyKpi,
    trText("Định mức giao theo ngày", "Assigned daily quota"),
  ]); // Row 8
  values.push([
    trText("KPI tháng chuẩn (file)", "Monthly KPI target (files)"),
    "=B7*B8",
    trText("Biến MonthKPI = A * KPI 1 ngày", "MonthKPI = A * Daily KPI"),
  ]); // Row 9
  values.push([
    trText("Lương cứng danh nghĩa (VNĐ)", "Nominal base salary (VND)"),
    cfg.baseSalary,
    trText("Mức lương cơ bản thỏa thuận", "Agreed base salary"),
  ]); // Row 10
  values.push([
    trText("Đơn giá 1 file vượt KPI (VNĐ)", "Rate per excess file (VND)"),
    cfg.unitPriceKpi,
    trText("Đơn giá thưởng mỗi file vượt", "Bonus rate per excess file"),
  ]); // Row 11
  values.push([
    trText("Số bộ VIP (bộ)", "VIP sets (sets)"),
    cfg.vipSets,
    trText("Số lượng bộ ảnh VIP", "Number of VIP photo sets"),
  ]); // Row 12
  values.push([
    trText("Đơn giá 1 bộ VIP (VNĐ)", "Rate per VIP set (VND)"),
    cfg.vipPrice,
    trText("Đơn giá thưởng mỗi bộ VIP", "Bonus rate per VIP set"),
  ]); // Row 13
  values.push([
    trText("Trợ cấp (VNĐ)", "Allowance (VND)"),
    cfg.allowance,
    trText("Trợ cấp cố định theo tháng", "Fixed monthly allowance"),
  ]); // Row 14
  values.push([
    trText("Phụ thu / Khấu trừ khác (VNĐ)", "Deductions / Other charges (VND)"),
    cfg.deduction,
    trText("Giảm trừ vi phạm / phụ thu", "Deductions / penalties / advances"),
  ]); // Row 15
  values.push([]); // Row 16

  // Determine Daily Table rows layout
  // Section 3 starts at Row 27. Headers at Row 28. Data rows start at Row 29.
  const startDayRowIndex = 29;
  const dayCount = Math.max(1, days.length);
  const endDayRowIndex = startDayRowIndex + dayCount - 1;
  const totalDayRowIndex = endDayRowIndex + 1; // row of SUM

  // Cell of Total Actual Photos (Biến T)
  const totalPhotosCell = `B${totalDayRowIndex}`;

  // Section 2: Financial statement (Rows 17 to 24)
  // All IF formulas use semicolon (;) between arguments for full compatibility with Google Sheets!
  values.push([
    trText(
      "II. BẢNG KÊ CHI TIẾT CÁC KHOẢN LƯƠNG & TỔNG THỰC LĨNH",
      "II. DETAILED EARNINGS & NET SALARY BREAKDOWN",
    ),
    trText("Căn cứ tính", "Calculation Basis"),
    trText("Số tiền (VNĐ)", "Amount (VND)"),
  ]); // Row 17
  values.push([
    trText("1. Lương cơ bản / Lương sản lượng", "1. Base Salary / Per-file Pay"),
    trText(
      `=IF(${totalPhotosCell}>=B9; "Hưởng trọn lương cứng (Đạt KPI)"; "Tính theo sản lượng (Chưa đạt KPI)")`,
      `=IF(${totalPhotosCell}>=B9; "Full base salary (KPI met)"; "Per-file pay (KPI missed)")`,
    ),
    `=IF(${totalPhotosCell}>=B9; B10; ${totalPhotosCell}*B11)`,
  ]); // Row 18
  values.push([
    trText("2. Lương vượt KPI", "2. Excess KPI Bonus"),
    trText(
      `=IF(${totalPhotosCell}>B9; (${totalPhotosCell}-B9)&" file vượt"; "0 file vượt")`,
      `=IF(${totalPhotosCell}>B9; (${totalPhotosCell}-B9)&" excess files"; "0 excess files")`,
    ),
    `=IF(${totalPhotosCell}>B9; (${totalPhotosCell}-B9)*B11; 0)`,
  ]); // Row 19
  values.push([
    trText("3. Thưởng hiệu suất công việc", "3. Performance Tier Bonus"),
    trText("Mỗi 1.000 file thưởng +500.000đ", "+500,000 VND per 1,000 files"),
    `=INT(${totalPhotosCell}/1000)*500000`,
  ]); // Row 20
  values.push([
    trText("4. Thưởng bộ VIP", "4. VIP Set Bonus"),
    trText(`=B12&" bộ VIP x "&B13`, `=B12&" VIP sets x "&B13`),
    "=B12*B13",
  ]); // Row 21
  values.push([
    trText("5. Trợ cấp", "5. Allowance"),
    trText("Trợ cấp cố định theo tháng", "Fixed monthly allowance"),
    "=B14",
  ]); // Row 22
  values.push([
    trText("6. Phụ thu / Khấu trừ khác", "6. Deductions / Other charges"),
    trText("Giảm trừ vi phạm / phụ thu", "Deductions / penalties / advances"),
    "=B15",
  ]); // Row 23
  values.push([
    trText("👉 TỔNG LƯƠNG THỰC LĨNH (VNĐ)", "👉 TOTAL NET SALARY (VND)"),
    trText(
      `=IF(${totalPhotosCell}>=B9; "ĐẠT KPI CHUẨN"; "CHƯA ĐẠT KPI")`,
      `=IF(${totalPhotosCell}>=B9; "KPI ACHIEVED"; "KPI NOT MET")`,
    ),
    "=SUM(C18:C22)-C23", // Grand Total Formula!
  ]); // Row 24
  values.push([]); // Row 25
  values.push([]); // Row 26

  // Section 3: Bảng kê chi tiết sản lượng ảnh từng ngày trong tháng
  // Only 2 essential columns: Ngày & Số ảnh làm được
  values.push([
    trText(
      "III. BẢNG KÊ CHI TIẾT SẢN LƯỢNG ẢNH TỪNG NGÀY TRONG THÁNG",
      "III. DAILY PHOTO OUTPUT BREAKDOWN",
    ),
    "",
  ]); // Row 27
  values.push([trText("Ngày", "Day"), trText("Số ảnh làm được", "Weighted Photo Count")]); // Row 28 (Headers)

  if (days.length === 0) {
    values.push([trText("Không có dữ liệu", "No data"), 0]);
  } else {
    days.forEach((day) => {
      values.push([
        trText(`Ngày ${day.dayName}`, `Day ${day.dayName}`),
        day.photoCount,
      ]);
    });
  }

  // Row SUM of whole month
  values.push([
    trText("TỔNG CỘNG CẢ THÁNG", "MONTHLY TOTAL"),
    `=SUM(B${startDayRowIndex}:B${endDayRowIndex})`,
  ]);

  return {
    values,
    totalFormulaRowIndex: totalDayRowIndex,
  };
}

/**
 * Formats 2D values into CSV string (semicolon separated) with UTF-8 BOM
 */
export function formatMatrixToCSV(matrix: (string | number)[][], delimiter = ";"): string {
  let csv = "\uFEFF"; // UTF-8 BOM for Excel
  for (const row of matrix) {
    if (!row || row.length === 0) {
      csv += "\n";
      continue;
    }
    const line = row
      .map((cell) => {
        if (cell === null || cell === undefined) return "";
        const str = String(cell);
        if (str.includes(delimiter) || str.includes("\n") || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(delimiter);
    csv += line + "\n";
  }
  return csv;
}

/**
 * Formats 2D values into Tab-Separated Values (TSV) for direct clipboard paste into Google Sheets / Excel
 */
export function formatMatrixToTSV(matrix: (string | number)[][]): string {
  let tsv = "";
  for (const row of matrix) {
    if (!row || row.length === 0) {
      tsv += "\n";
      continue;
    }
    const line = row
      .map((cell) => {
        if (cell === null || cell === undefined) return "";
        const str = String(cell);
        if (str.includes("\t") || str.includes("\n") || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join("\t");
    tsv += line + "\n";
  }
  return tsv;
}

/**
 * Export 1: Trigger download of spreadsheet CSV with formulas
 */
export function downloadSpreadsheetFile(data: SpreadsheetExportData): string {
  const { values } = buildSpreadsheetMatrix(data);
  const csvContent = formatMatrixToCSV(values, ";");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const cleanMonth = (data.monthName || trText("Thang", "Month")).replace(/\s+/g, "_");
  const fileName = trText(
    `Trang_Tinh_Luong_Thong_Ke_${cleanMonth}.csv`,
    `Salary_Output_Report_${cleanMonth}.csv`,
  );
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return fileName;
}

/**
 * Export 2: Copy TSV to clipboard for direct 1-click Ctrl+V pasting into Google Sheets
 */
export async function copySpreadsheetToClipboard(data: SpreadsheetExportData): Promise<void> {
  const { values } = buildSpreadsheetMatrix(data);
  const tsv = formatMatrixToTSV(values);
  await navigator.clipboard.writeText(tsv);
}

/**
 * Export 3: Direct online export to Google Sheets via Google Sheets API (single clean tab)
 */
export async function exportDirectlyToGoogleSheets(
  data: SpreadsheetExportData,
  onProgress?: (msg: string) => void
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  onProgress?.(trText("Đang kiểm tra kết nối tài khoản Google...", "Checking Google account connection..."));
  const token = await googleCredentialManager.getValidAccessToken();
  if (!token) {
    throw new Error(
      trText(
        "Chưa kết nối tài khoản Google. Vui lòng kết nối Google trong ứng dụng hoặc chọn Tải tệp Trang tính.",
        "Google account is not connected. Please connect Google in the app or choose Download Spreadsheet CSV.",
      ),
    );
  }

  onProgress?.(trText("Đang tạo bảng tính mới trên Google Drive...", "Creating new spreadsheet on Google Drive..."));
  const cleanMonth = data.monthName
    ? data.monthName.toUpperCase()
    : trText("THỐNG KÊ THÁNG", "MONTHLY REPORT");
  const title = trText(
    `BẢNG LƯƠNG & SẢN LƯỢNG - ${cleanMonth}`,
    `SALARY & OUTPUT REPORT - ${cleanMonth}`,
  );
  const sheetTabTitle = trText("Bảng Lương & Sản Lượng", "Salary & Output");

  // 1. Create Spreadsheet with single sheet
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: sheetTabTitle,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => null);
    throw new Error(
      trText(
        `Không thể tạo Google Sheet: HTTP ${createRes.status} - ${
          err?.error?.message || createRes.statusText
        }`,
        `Could not create Google Sheet: HTTP ${createRes.status} - ${
          err?.error?.message || createRes.statusText
        }`,
      ),
    );
  }

  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  onProgress?.(trText("Đang điền công thức và dữ liệu chi tiết...", "Populating formulas and detailed data..."));
  const { values } = buildSpreadsheetMatrix(data);

  // 2. Batch update values with USER_ENTERED so formulas (=SUM, =IF) are evaluated dynamically!
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `'${sheetTabTitle}'!A1`,
            values: values.map((r) => r.map((c) => (c === undefined || c === null ? "" : c))),
          },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => null);
    throw new Error(
      trText(
        `Không thể ghi dữ liệu bảng tính: HTTP ${updateRes.status} - ${
          err?.error?.message || updateRes.statusText
        }`,
        `Could not write spreadsheet data: HTTP ${updateRes.status} - ${
          err?.error?.message || updateRes.statusText
        }`,
      ),
    );
  }

  onProgress?.(trText("Đang mở trang tính trên trình duyệt...", "Opening spreadsheet in browser..."));
  try {
    if (isTauri()) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(spreadsheetUrl);
    } else {
      window.open(spreadsheetUrl, "_blank");
    }
  } catch {
    window.open(spreadsheetUrl, "_blank");
  }

  return { spreadsheetId, spreadsheetUrl };
}
