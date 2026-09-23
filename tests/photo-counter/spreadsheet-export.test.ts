import test from "node:test";
import assert from "node:assert";
import {
  buildSpreadsheetMatrix,
  formatMatrixToCSV,
  formatMatrixToTSV,
  extractDaysSummary,
  type SpreadsheetExportData,
} from "../../src/modules/photo-counter/services/spreadsheetExportService.ts";

function createMockExportData(): SpreadsheetExportData {
  return {
    monthName: "Tháng 9/2026",
    monthPath: "/Volumes/Data/PHOTOS_09_2026",
    salaryConfig: {
      daysInMonth: 30,
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
      type2Weight: 0.5,
    },
    calc: {
      actualWorkingDays: 27,
      monthKpi: 3510,
      actualPhotos: 4200,
      rawScannedPhotos: 4500,
      isKpiAchieved: true,
      appliedBaseSalary: 11000000,
      baseSalary: 11000000,
      excessPhotos: 690,
      excessSalary: 3450000,
      efficiencyBonus: 2000000,
      vipBonus: 1000000,
      allowance: 500000,
      deduction: 75000,
      totalSalary: 17875000,
    },
    scanResult: {
      month_path: "/Volumes/Data/PHOTOS_09_2026",
      month_name: "Tháng 9/2026",
      total_photos: 4500,
      active_days: 2,
      total_days: 2,
      days: [
        {
          day_name: "22-9",
          day_path: "/Volumes/Data/PHOTOS_09_2026/22-9",
          total_photos: 2000,
          job_count: 5,
          deepest_folders: [
            {
              folder_path: "/Volumes/Data/PHOTOS_09_2026/22-9/JobA/done",
              folder_name: "done",
              relative_path: "JobA/done",
              job_name: "JobA",
              photo_count: 1500,
              sample_files: [],
              extensions: {},
            },
            {
              folder_path: "/Volumes/Data/PHOTOS_09_2026/22-9/JobB/raw",
              folder_name: "raw",
              relative_path: "JobB/raw",
              job_name: "JobB",
              photo_count: 500,
              sample_files: [],
              extensions: {},
            },
          ],
        },
        {
          day_name: "23-9",
          day_path: "/Volumes/Data/PHOTOS_09_2026/23-9",
          total_photos: 2500,
          job_count: 6,
          deepest_folders: [
            {
              folder_path: "/Volumes/Data/PHOTOS_09_2026/23-9/JobC/done",
              folder_name: "done",
              relative_path: "JobC/done",
              job_name: "JobC",
              photo_count: 2500,
              sample_files: [],
              extensions: {},
            },
          ],
        },
      ],
    },
    excludedFolderPaths: {},
    folderTypeMap: {
      "/Volumes/Data/PHOTOS_09_2026/22-9/JobB/raw": "type2",
    },
  };
}

test("Spreadsheet Export: Extracts daily summary with weights accurately", () => {
  const data = createMockExportData();
  const summary = extractDaysSummary(data);

  assert.strictEqual(summary.length, 2);
  assert.strictEqual(summary[0].dayName, "22-9");
  // 1500 * 1.0 + 500 * 0.5 = 1750
  assert.strictEqual(summary[0].photoCount, 1750);

  assert.strictEqual(summary[1].dayName, "23-9");
  // 2500 * 1.0 = 2500
  assert.strictEqual(summary[1].photoCount, 2500);
});

test("Spreadsheet Export: Builds clean 2-column daily table and formulas with semicolons (;)", () => {
  const data = createMockExportData();
  const { values, totalFormulaRowIndex } = buildSpreadsheetMatrix(data);

  const flatValues = values.flat().map((v) => String(v));

  // 1. Verify working days formula
  assert.ok(flatValues.some((v) => v.includes("=B5-B6")));

  // 2. Verify month KPI formula
  assert.ok(flatValues.some((v) => v.includes("=B7*B8")));

  // 3. Verify total salary formula
  assert.ok(flatValues.some((v) => v.includes("=SUM(C18:C22)-C23")));

  // 4. Verify that formulas with IF use semicolon (;) and NOT comma (,) between arguments
  const ifFormulas = flatValues.filter((v) => v.startsWith("=IF("));
  assert.ok(ifFormulas.length > 0, "Must contain IF formulas");
  for (const formula of ifFormulas) {
    assert.ok(
      formula.includes(";"),
      `Formula must use semicolon separator for Google Sheets compatibility: ${formula}`
    );
  }

  // 5. Verify daily table has only 2 columns: Ngày & Số ảnh làm được
  const dayRowHeader = values.find((r) => r[0] === "Ngày");
  assert.ok(dayRowHeader);
  assert.strictEqual(dayRowHeader.length, 2);
  assert.strictEqual(dayRowHeader[1], "Số ảnh làm được");

  // 6. Verify SUM row
  const sumRow = values.find((r) => r[0] === "TỔNG CỘNG CẢ THÁNG");
  assert.ok(sumRow);
  assert.strictEqual(sumRow[1], "=SUM(B29:B30)");

  // 7. Verify totalDayRowIndex is row 31 (start at 29, 2 days -> 29, 30, SUM at 31)
  assert.strictEqual(totalFormulaRowIndex, 31);
});

test("Spreadsheet Export: CSV formatting preserves formulas and UTF-8 BOM", () => {
  const data = createMockExportData();
  const { values } = buildSpreadsheetMatrix(data);
  const csv = formatMatrixToCSV(values, ";");

  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("BẢNG TỔNG HỢP LƯƠNG VÀ SẢN LƯỢNG"));
  assert.ok(csv.includes("=SUM(C18:C22)-C23"));
  assert.ok(csv.includes("Ngày 22-9"));
});

test("Spreadsheet Export: TSV formatting produces valid tab-separated structure", () => {
  const data = createMockExportData();
  const { values } = buildSpreadsheetMatrix(data);
  const tsv = formatMatrixToTSV(values);

  assert.ok(tsv.includes("\t"));
  assert.ok(tsv.includes("👉 TỔNG LƯƠNG THỰC LĨNH (VNĐ)"));
});
