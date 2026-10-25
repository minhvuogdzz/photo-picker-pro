import type { DiscoveredJob, FieldMapping, WorkspaceProfile } from "../../contact-the-sheet/types/index.ts";
import { jobMatchingService, type SheetRowRecord } from "../../contact-the-sheet/services/jobMatchingService.ts";
import {
  sheetExtractorService,
  type ExtractedCodeColumn,
  type SheetExtractionResult,
} from "../../contact-the-sheet/services/sheetExtractorService.ts";
import { folderParserService } from "../../contact-the-sheet/services/folderParserService.ts";
import { foldText, type TabRows } from "./filterStatusCheckService.ts";

/**
 * Pure logic behind "Truy xuất trang tính" when several sheet tabs are checked:
 * which tabs to load, how each tab is read (its own column mapping / start row),
 * and which row across those tabs belongs to the customer folder.
 */

export type { TabRows };

/** A row whose "Tên file" equals the folder name (several when the customer is listed more than once) */
export interface SameFileRow {
  tabTitle: string;
  row: number;
  hasCodes: boolean;
  isCompleted: boolean;
}

export interface MultiTabExtractionResult extends SheetExtractionResult {
  /** Tab the matched row came from — status write-back must target this tab */
  matchedTabTitle?: string;
  /** Tabs whose rows were searched */
  searchedTabs: string[];
  /** Every exact "Tên file" hit, in tab/row order (empty when matched by the fuzzy matcher) */
  sameFileRows: SameFileRow[];
}

export interface PreferredRow {
  tabTitle: string;
  row: number;
}

/** Profile as seen from one tab: that tab's saved column mapping / row scope, else the profile defaults */
export function getTabProfile(profile: WorkspaceProfile, tabTitle: string): WorkspaceProfile {
  const tabConfig = profile.tabConfigurations?.[tabTitle];
  if (!tabConfig) return { ...profile, selectedTabTitle: tabTitle };
  return {
    ...profile,
    selectedTabTitle: tabTitle,
    selectedTabId: tabConfig.sheetId,
    headerRow: tabConfig.headerRow,
    rowScope: tabConfig.rowScope || profile.rowScope,
    fieldMappings: tabConfig.fieldMappings || profile.fieldMappings,
  };
}

/** First data row to fetch for a tab */
export function getTabStartRow(profile: WorkspaceProfile, tabTitle: string): number {
  return profile.tabConfigurations?.[tabTitle]?.rowScope?.startRow || profile.rowScope?.startRow || 4;
}

/** "Trạng thái lọc" mapping of a tab (raw, permission included) */
export function getTabStatusMapping(profile: WorkspaceProfile, tabTitle: string): FieldMapping | null {
  const mappings = getTabProfile(profile, tabTitle).fieldMappings || [];
  return mappings.find((m) => m.semanticField === "PHOTO_PICK_STATUS") || null;
}

/** Parses the persisted checked-tab list; null when nothing usable was saved */
export function parseSavedTabs(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const tabs = parsed.filter((t): t is string => typeof t === "string" && t.trim() !== "");
    return tabs.length > 0 ? Array.from(new Set(tabs)) : null;
  } catch {
    return null;
  }
}

/**
 * Tabs to search, in sheet order.
 * - selected === null (nothing saved yet) or none of the saved tabs exist on this sheet → the profile's active tab
 *   (or the first tab of the sheet when the active tab is not on it).
 * - selected === [] (user unchecked everything) → [] so the UI can ask for at least one tab.
 */
export function resolveCheckedTabs(
  selected: string[] | null,
  availableTabs: string[],
  activeTab: string
): string[] {
  if (selected !== null) {
    if (selected.length === 0) return [];
    const kept = availableTabs.filter((t) => selected.includes(t));
    if (kept.length > 0) return kept;
  }
  if (activeTab && availableTabs.includes(activeTab)) return [activeTab];
  if (availableTabs.length > 0) return [availableTabs[0]];
  return activeTab ? [activeTab] : [];
}

function columnLetterOf(mapping: FieldMapping | undefined): string | undefined {
  const col = mapping?.columnLetter;
  return col && col !== "NONE" ? col : undefined;
}

function isInRowScope(profile: WorkspaceProfile, row: SheetRowRecord): boolean {
  const scope = profile.rowScope;
  if (scope?.startRow && row.row < scope.startRow) return false;
  if (scope?.endRow && row.row > scope.endRow) return false;
  return true;
}

interface Candidate extends SameFileRow {
  record: SheetRowRecord;
  columns: ExtractedCodeColumn[];
}

function buildCandidate(
  profile: WorkspaceProfile,
  tabTitle: string,
  record: SheetRowRecord,
  completedStatusValue: string
): Candidate {
  const tabProfile = getTabProfile(profile, tabTitle);
  // Code columns come from THIS tab's mapping, not the active tab's
  const columns = sheetExtractorService.detectCodeColumns(tabProfile, record.values);
  const statusMapping = getTabStatusMapping(profile, tabTitle);
  const statusCol = statusMapping && statusMapping.permission !== "IGNORE" ? columnLetterOf(statusMapping) : undefined;
  const isCompleted =
    !!statusCol &&
    !!completedStatusValue.trim() &&
    foldText(record.values[statusCol] || "") === foldText(completedStatusValue);

  return {
    tabTitle,
    row: record.row,
    hasCodes: columns.some((c) => c.codeCount > 0),
    isCompleted,
    record,
    columns,
  };
}

/** Rank of an exact hit: not filtered yet beats has codes, both beats neither */
function candidateRank(c: Candidate): number {
  return (c.isCompleted ? 0 : 2) + (c.hasCodes ? 1 : 0);
}

/**
 * Finds the customer's row across every checked tab and extracts its code columns.
 *
 * 1. Rows whose "Tên file" (each tab's own JOB_FOLDER_NAME column) equals the folder name win.
 *    When there are several (re-shoot, row copied to the next month's tab), the one that still has
 *    codes and is not yet marked with the completed status is used; `preferred` lets the user pick another.
 * 2. Otherwise the fuzzy matcher runs once over all tabs' rows tagged with tabTitle, so it applies
 *    each tab's column mapping / row scope and reports which tab the match is on.
 */
export function extractCodesAcrossTabs(
  folderName: string,
  folderPath: string,
  tabRows: TabRows[],
  profile: WorkspaceProfile,
  completedStatusValue: string,
  preferred?: PreferredRow | null
): MultiTabExtractionResult {
  const rawName = folderName.split(/[/\\]+/).filter(Boolean).pop() || folderName;
  const metadata = folderParserService.parseFolderName(rawName);
  const normName = folderParserService.normalizeForComparison(rawName);
  const searchedTabs = tabRows.map((t) => t.tabTitle);
  const multiTab = tabRows.length > 1;

  // 1. Exact "Tên file" hits on every checked tab
  const candidates: Candidate[] = [];
  if (normName) {
    for (const { tabTitle, rows } of tabRows) {
      const tabProfile = getTabProfile(profile, tabTitle);
      const fileCol = columnLetterOf(tabProfile.fieldMappings.find((m) => m.semanticField === "JOB_FOLDER_NAME"));
      if (!fileCol) continue;
      for (const record of rows) {
        if (!isInRowScope(tabProfile, record)) continue;
        const cell = (record.values[fileCol] || "").trim();
        if (!cell || jobMatchingService.isErrorValue(cell)) continue;
        if (folderParserService.normalizeForComparison(cell) === normName) {
          candidates.push(buildCandidate(profile, tabTitle, record, completedStatusValue));
        }
      }
    }
  }

  if (candidates.length > 0) {
    const picked =
      (preferred && candidates.find((c) => c.tabTitle === preferred.tabTitle && c.row === preferred.row)) ||
      candidates.reduce((best, c) => (candidateRank(c) > candidateRank(best) ? c : best), candidates[0]);
    const fileCol = columnLetterOf(
      getTabProfile(profile, picked.tabTitle).fieldMappings.find((m) => m.semanticField === "JOB_FOLDER_NAME")
    );

    let reason = `Khớp chính xác Tên file (Cột ${fileCol})${multiTab ? ` trên Tab ${picked.tabTitle}` : ""}`;
    if (candidates.length > 1) {
      reason += ` • Tên file có ở ${candidates.length} dòng: ${candidates
        .map((c) => `${multiTab ? `${c.tabTitle} dòng ${c.row}` : `dòng ${c.row}`}${c.isCompleted ? " (đã lọc)" : ""}`)
        .join(", ")}`;
    }

    return {
      matchedRow: picked.row,
      matchedTabTitle: picked.tabTitle,
      customerName: metadata.customerName,
      jobFolderName: rawName,
      confidence: 1.0,
      status: "READY",
      reason,
      targetSnapshot: picked.record.values,
      candidateColumns: picked.columns,
      searchedTabs,
      sameFileRows: candidates.map(({ tabTitle, row, hasCodes, isCompleted }) => ({ tabTitle, row, hasCodes, isCompleted })),
    };
  }

  // 2. Fuzzy fallback across all tabs at once (same job shape as sheetExtractorService.extractCodesForFolder)
  const tagged: SheetRowRecord[] = tabRows.flatMap(({ tabTitle, rows }) => rows.map((r) => ({ ...r, tabTitle })));
  const job: DiscoveredJob = {
    id: `extract_${Date.now()}`,
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: rawName,
    finalFolderName: rawName,
    finalFolderPath: folderPath || rawName,
    metadata,
    imageCount: 0,
    status: "PENDING",
  };
  const match = jobMatchingService.matchJobToSheetRows(job, tagged, profile);

  if (match.status === "NO_MATCH" || !match.targetRow || !match.targetSnapshot) {
    return {
      jobFolderName: rawName,
      customerName: metadata.customerName,
      status: "NO_MATCH",
      reason: match.reason || `Không tìm thấy dòng tương ứng với "${rawName}" trên bảng tính.`,
      candidateColumns: [],
      candidateRows: match.candidateRows,
      searchedTabs,
      sameFileRows: [],
    };
  }

  const matchedTabTitle = match.targetTabTitle || profile.selectedTabTitle;
  return {
    matchedRow: match.targetRow,
    matchedTabTitle,
    customerName: metadata.customerName,
    jobFolderName: rawName,
    confidence: match.confidence,
    status: match.status,
    reason: match.reason,
    targetSnapshot: match.targetSnapshot,
    candidateColumns: sheetExtractorService.detectCodeColumns(getTabProfile(profile, matchedTabTitle), match.targetSnapshot),
    candidateRows: match.candidateRows,
    searchedTabs,
    sameFileRows: [],
  };
}
