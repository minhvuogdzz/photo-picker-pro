import type { WorkspaceProfile } from "../../contact-the-sheet/types/index.ts";
import type { SheetRowRecord } from "../../contact-the-sheet/services/jobMatchingService.ts";
import { sheetExtractorService } from "../../contact-the-sheet/services/sheetExtractorService.ts";
import { folderParserService } from "../../contact-the-sheet/services/folderParserService.ts";

/**
 * Pure logic behind "Check TT": decides which customer folders in the queue are kept
 * by looking up their row(s) on the selected sheet tabs and checking the configured conditions.
 */

export interface FolderCheckResult {
  folderPath: string;
  folderName: string;
  isKept: boolean;
  matchedRow?: number;
  tabTitle?: string;
  actualStatus: string;
  photoCode1Value?: string;
  photoCode2Value?: string;
  dueDateValue?: string;
  reason: string;
}

export interface FilterCheckConditions {
  statusColumn: string;
  targetStatusValue: string;
  /** null = not checked */
  photoCode1Column: string | null;
  photoCode2Column: string | null;
  dueDateColumn: string | null;
  /** Link edit column — when enabled, must be EMPTY (chưa có dữ liệu link bàn giao/link edit) */
  linkEditColumn?: string | null;
  /** Today in Vietnam as yyyymmdd (see getVietnamTodayKey) */
  todayKey: number;
}

export interface TabRows {
  tabTitle: string;
  rows: SheetRowRecord[];
}

/**
 * Canonical form for comparing sheet text typed by different people / IMEs:
 * Unicode composition (NFC vs "tổ hợp"), non-breaking & zero-width spaces, repeated spaces,
 * letter case and Vietnamese diacritics are all ignored. "Chưa  lọc" == "chưa lọc" == "Chua loc".
 */
export function foldText(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Trimmed cell value; zero-width characters count as empty */
function cellValue(row: SheetRowRecord, col: string | null): string {
  if (!col) return "";
  return (row.values[col] || "").replace(/[​-‍﻿]/g, "").trim();
}

// Today's date in Vietnam (GMT+7) as a comparable yyyymmdd number, independent of the machine timezone
export function getVietnamTodayKey(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get("year") * 10000 + get("month") * 100 + get("day");
}

export function formatDateKey(key: number): string {
  const d = key % 100;
  const m = Math.floor(key / 100) % 100;
  const y = Math.floor(key / 10000);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function toDateKey(day: number, month: number, year: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return null;
  return year * 10000 + month * 100 + day;
}

function dateKeyToUtc(key: number): number {
  return Date.UTC(Math.floor(key / 10000), (Math.floor(key / 100) % 100) - 1, key % 100);
}

/**
 * Parses a "Hẹn trả ảnh" cell into yyyymmdd. Accepts what studios actually type:
 * dd/mm/yyyy, d/m/yyyy, dd/mm/yy, dd/mm (no year), "-" or "." separators, text around the date
 * ("T6 24/10", "24/10 sáng"), ISO yyyy-mm-dd and raw Google Sheets serial numbers.
 * When the year is missing, the year that puts the date closest to today is used
 * (so "28/12" read in January means last December).
 */
export function parseDueDateKey(raw: string, todayKey: number): number | null {
  const text = (raw || "").trim();
  if (!text) return null;

  // Raw Sheets serial (cell lost its date format), days since 1899-12-30
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    if (serial < 30000 || serial > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  }

  // No lookbehind: older macOS WebViews (Safari < 16.4) fail to parse it
  const iso = text.match(/(?:^|\D)(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?!\d)/);
  if (iso) return toDateKey(Number(iso[3]), Number(iso[2]), Number(iso[1]));

  const dmy = text.match(/(?:^|\D)(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{4}|\d{2}))?(?!\d)/);
  if (!dmy) return null;

  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  if (dmy[3]) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return toDateKey(day, month, year);
  }

  const thisYear = Math.floor(todayKey / 10000);
  const todayUtc = dateKeyToUtc(todayKey);
  let best: number | null = null;
  for (const year of [thisYear - 1, thisYear, thisYear + 1]) {
    const key = toDateKey(day, month, year);
    if (key === null) continue;
    if (best === null || Math.abs(dateKeyToUtc(key) - todayUtc) < Math.abs(dateKeyToUtc(best) - todayUtc)) {
      best = key;
    }
  }
  return best;
}

/** Column holding the file / job folder name for a tab (tab config first, then profile default) */
function jobFolderColumn(profile: WorkspaceProfile, tabTitle: string): string | undefined {
  const mappings = profile.tabConfigurations?.[tabTitle]?.fieldMappings || profile.fieldMappings || [];
  const col = mappings.find((m) => m.semanticField === "JOB_FOLDER_NAME")?.columnLetter;
  return col && col !== "NONE" ? col : undefined;
}

/** Applies the configured conditions to one sheet row */
export function evaluateRow(
  row: SheetRowRecord,
  conditions: FilterCheckConditions
): Omit<FolderCheckResult, "folderPath" | "folderName" | "tabTitle"> {
  const statusCol = conditions.statusColumn.toUpperCase().trim();
  const code1Col = conditions.photoCode1Column?.toUpperCase().trim() || null;
  const code2Col = conditions.photoCode2Column?.toUpperCase().trim() || null;
  const dueCol = conditions.dueDateColumn?.toUpperCase().trim() || null;

  const actualVal = cellValue(row, statusCol);
  const code1Val = code1Col ? cellValue(row, code1Col) : null;
  const code2Val = code2Col ? cellValue(row, code2Col) : null;
  const dueVal = dueCol ? cellValue(row, dueCol) : null;
  const dueKey = dueVal ? parseDueDateKey(dueVal, conditions.todayKey) : null;
  const linkEditCol = conditions.linkEditColumn?.toUpperCase().trim() || null;
  const linkEditVal = linkEditCol ? cellValue(row, linkEditCol) : null;

  // Status must match AND photo code columns (if enabled) must NOT be empty
  // AND due date (if enabled) must be today or earlier (Vietnam time)
  // AND link edit column (if enabled) must be EMPTY (chưa có dữ liệu / rỗng)
  const statusOk = foldText(actualVal) === foldText(conditions.targetStatusValue);
  const code1Ok = code1Col === null || code1Val !== "";
  const code2Ok = code2Col === null || code2Val !== "";
  const dueOk = dueCol === null || (dueKey !== null && dueKey <= conditions.todayKey);
  const linkEditOk = linkEditCol === null || linkEditVal === "";
  const isKept = statusOk && code1Ok && code2Ok && dueOk && linkEditOk;

  let reason: string;
  if (isKept) {
    reason = `Khớp trạng thái "${actualVal}" (Dòng ${row.row})`;
    if (dueCol && dueKey !== null) reason += ` • Tới hạn trả ${formatDateKey(dueKey)}`;
    if (linkEditCol) reason += ` • Link edit đang rỗng`;
  } else {
    const reasons: string[] = [];
    if (!statusOk) {
      reasons.push(`Trạng thái là "${actualVal || "Trống"}" (Dòng ${row.row}), khác "${conditions.targetStatusValue}"`);
    }
    if (!code1Ok) reasons.push(`Cột ${code1Col} (Mã ảnh chọn 1) trống — không có mã ảnh`);
    if (!code2Ok) reasons.push(`Cột ${code2Col} (Mã ảnh chọn 2) trống — không có mã ảnh`);
    if (!dueOk) {
      if (!dueVal) {
        reasons.push(`Cột ${dueCol} (Hẹn trả ảnh) trống`);
      } else if (dueKey === null) {
        reasons.push(`Cột ${dueCol} (Hẹn trả ảnh) "${dueVal}" không đọc được ngày`);
      } else {
        reasons.push(`Hẹn trả ${formatDateKey(dueKey)} — chưa tới hạn (hôm nay ${formatDateKey(conditions.todayKey)})`);
      }
    }
    if (!linkEditOk) {
      reasons.push(`Cột ${linkEditCol} (Link edit) đã có dữ liệu — đã xong, không cần lọc gấp`);
    }
    reason = reasons.join(" • ");
  }

  return {
    isKept,
    matchedRow: row.row,
    actualStatus: actualVal || "(Trống)",
    photoCode1Value: code1Val ?? undefined,
    photoCode2Value: code2Val ?? undefined,
    dueDateValue: dueVal ?? undefined,
    reason,
  };
}

/**
 * Checks one customer folder against every selected tab.
 *
 * 1. Every row whose "Tên file" cell equals the folder name is a candidate — a customer can be listed
 *    more than once (re-shoot, second package, row copied to a new month), and only one of those rows
 *    may still be "Chưa lọc". The fuzzy matcher only returns one row, so it is not used for exact hits.
 * 2. Without an exact hit, fall back to the fuzzy matcher, run with each tab's own column/row config.
 * The folder is kept if ANY candidate row passes all conditions.
 */
export function checkFolder(
  folderPath: string,
  folderName: string,
  tabRows: TabRows[],
  profile: WorkspaceProfile,
  conditions: FilterCheckConditions
): FolderCheckResult {
  const multiTab = tabRows.length > 1;
  const normName = folderParserService.normalizeForComparison(folderName);
  const candidates: Array<{ tabTitle: string; row: SheetRowRecord }> = [];

  if (normName) {
    for (const { tabTitle, rows } of tabRows) {
      const fileCol = jobFolderColumn(profile, tabTitle);
      if (!fileCol) continue;
      const endRow = (profile.tabConfigurations?.[tabTitle]?.rowScope || profile.rowScope)?.endRow;
      for (const row of rows) {
        if (endRow && row.row > endRow) continue;
        const cell = row.values[fileCol];
        if (cell && folderParserService.normalizeForComparison(cell) === normName) {
          candidates.push({ tabTitle, row });
        }
      }
    }
  }

  let noMatchReason = "";
  if (candidates.length === 0) {
    for (const { tabTitle, rows } of tabRows) {
      // Tag rows so the matcher applies this tab's column mappings and row scope, not the active tab's
      const tagged = rows.map((r) => ({ ...r, tabTitle }));
      const match = sheetExtractorService.extractCodesForFolder(folderName, folderPath, tagged, profile);
      const row = match.matchedRow ? rows.find((r) => r.row === match.matchedRow) : undefined;
      if (row) {
        candidates.push({ tabTitle, row });
      } else if (!noMatchReason && match.status === "NEEDS_REVIEW" && match.reason) {
        noMatchReason = `[${tabTitle}] ${match.reason}`;
      }
    }
  }

  if (candidates.length === 0) {
    return {
      folderPath,
      folderName,
      isKept: false,
      actualStatus: "Không tìm thấy trên Sheet",
      reason:
        noMatchReason ||
        `Tên thư mục không khớp với dòng nào trên Tab: ${tabRows.map((t) => t.tabTitle).join(", ")}`,
    };
  }

  const evaluated = candidates.map(({ tabTitle, row }) => ({ tabTitle, ...evaluateRow(row, conditions) }));
  const best = evaluated.find((r) => r.isKept) || evaluated[0];
  let reason = multiTab ? `[${best.tabTitle}] ${best.reason}` : best.reason;
  if (evaluated.length > 1) {
    reason += ` • Tên file có ở ${evaluated.length} dòng: ${evaluated
      .map((r) => (multiTab ? `${r.tabTitle} dòng ${r.matchedRow}` : `dòng ${r.matchedRow}`))
      .join(", ")}`;
  }

  return { folderPath, folderName, ...best, reason };
}
