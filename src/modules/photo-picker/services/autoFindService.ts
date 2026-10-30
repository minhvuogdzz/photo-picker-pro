import { useAppStore } from "@/core/stores/useAppStore";
import { useContactSheetStore } from "@/modules/contact-the-sheet/stores/useContactSheetStore";
import { googleCredentialManager } from "@/modules/contact-the-sheet/services/googleCredentialBridge";
import { sheetDiscoveryService } from "@/modules/contact-the-sheet/services/sheetDiscoveryService";
import { sheetExtractorService } from "@/modules/contact-the-sheet/services/sheetExtractorService";
import {
  extractCodesAcrossTabs,
  getTabProfile,
  getTabStartRow,
  getTabStatusMapping,
  parseSavedTabs,
  resolveCheckedTabs,
  type TabRows,
  type MultiTabExtractionResult,
} from "./sheetTabExtractionService";
import { getFolderName } from "@/core/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import type { CustomerCode } from "@/core/types";

export interface AutoFindResult {
  success: boolean;
  folderName: string;
  folderPath: string;
  customerName?: string;
  codeCount?: number;
  matchedRow?: number;
  tabTitle?: string;
  reason?: string;
}

interface CachedTabEntry {
  rows: Array<{ row: number; values: Record<string, string> }>;
  timestamp: number;
}

const DEFAULT_TABS = [
  "Edit 6/2026",
  "Edit 7/2026",
  "Edit 8/2026",
  "Edit 9/2026",
  "Edit 10/2026",
  "Edit 11/2026",
  "Edit 12/2026",
];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function detectMonthFromFolderName(folderName: string): number | null {
  // 1. "DD-MM" or "DD/MM" (e.g. "20-10", "05-09", "1/12")
  const ddmMatch = folderName.match(/(?:^|[^\d])([0-2]?[0-9]|3[01])[-/](0?[1-9]|1[0-2])(?:[^\d]|$)/);
  if (ddmMatch && ddmMatch[2]) {
    return parseInt(ddmMatch[2], 10);
  }
  // 2. "T10", "Tháng 10", "T09"
  const tMatch = folderName.match(/(?:thang|tháng|t)\s*(0?[1-9]|1[0-2])(?:[^\d]|$)/i);
  if (tMatch && tMatch[1]) {
    return parseInt(tMatch[1], 10);
  }
  // 3. "MM-YYYY" or "MM/YYYY" (e.g. "10-2026", "10/2026")
  const myMatch = folderName.match(/(?:^|[^\d])(0?[1-9]|1[0-2])[-/](202[4-9])(?:[^\d]|$)/);
  if (myMatch && myMatch[1]) {
    return parseInt(myMatch[1], 10);
  }
  return null;
}

function doesTabMatchMonth(tabTitle: string, month: number): boolean {
  const mStr = String(month);
  const mPadded = month < 10 ? `0${month}` : mStr;
  const regex = new RegExp(`(?:^|[^\\d])(?:${mStr}|${mPadded})(?:[^\\d]|$)`, "i");
  return regex.test(tabTitle);
}

class AutoFindService {
  /**
   * In-memory cache for sheet tab rows to prevent hitting Google Sheets API rate limits (HTTP 429)
   * and ensure instant matching (<1ms) across batch customer transitions.
   */
  private tabRowsCache = new Map<string, CachedTabEntry>();
  private sheetMetadataCache = new Map<string, { tabs: string[]; timestamp: number }>();
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds (fresh enough for active studio workflows)

  private cacheKey(spreadsheetId: string, tabTitle: string, startRow: number): string {
    return `${spreadsheetId}::${tabTitle}::${startRow}`;
  }

  /**
   * Clears the tab rows and metadata cache to force a fresh download from Google Sheets.
   */
  public clearCache(): void {
    this.tabRowsCache.clear();
    this.sheetMetadataCache.clear();
  }

  /**
   * Invalidate cached rows for a specific tab.
   */
  public clearTabCache(spreadsheetId: string, tabTitle: string): void {
    const prefix = `${spreadsheetId}::${tabTitle}::`;
    for (const key of Array.from(this.tabRowsCache.keys())) {
      if (key.startsWith(prefix)) {
        this.tabRowsCache.delete(key);
      }
    }
  }

  /**
   * Updates a cell value in the cached rows directly in memory.
   * Useful when a row is marked "Đã lọc" so subsequent customer matching doesn't need to re-fetch the entire sheet.
   */
  public updateCachedRowStatus(
    spreadsheetId: string,
    tabTitle: string,
    rowNumber: number,
    statusCol: string,
    statusValue: string
  ): void {
    const prefix = `${spreadsheetId}::${tabTitle}::`;
    for (const [key, entry] of this.tabRowsCache.entries()) {
      if (key.startsWith(prefix)) {
        const found = entry.rows.find((r) => r.row === rowNumber);
        if (found) {
          found.values[statusCol] = statusValue;
        }
      }
    }
  }

  /**
   * Retrieves real tab titles from the Google Sheet with in-memory caching and timeout protection.
   */
  private async getSpreadsheetTabs(spreadsheetId: string, isMock: boolean): Promise<string[]> {
    const cached = this.sheetMetadataCache.get(spreadsheetId);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.tabs;
    }

    try {
      const meta = await withTimeout(
        sheetDiscoveryService.fetchSpreadsheetMetadata(spreadsheetId, isMock),
        7000,
        "Quá thời gian tải danh sách Tab trang tính (7s)"
      );

      if (meta && meta.tabs && meta.tabs.length > 0) {
        const tabs = meta.tabs.map((t) => t.title);
        this.sheetMetadataCache.set(spreadsheetId, { tabs, timestamp: now });
        return tabs;
      }
    } catch (err) {
      console.warn("[AutoFindService] Failed to load remote spreadsheet tabs:", err);
    }

    return [];
  }

  /**
   * Fetches rows for a tab with caching, stale fallback, retry logic, and timeout protection.
   */
  private async getTabRowsCached(
    spreadsheetId: string,
    tabTitle: string,
    startRow: number,
    isMock: boolean,
    forceFresh: boolean = false
  ): Promise<Array<{ row: number; values: Record<string, string> }>> {
    const key = this.cacheKey(spreadsheetId, tabTitle, startRow);
    const existing = this.tabRowsCache.get(key);
    const now = Date.now();

    // 1. Return fresh cached rows immediately if not forced fresh
    if (!forceFresh && existing && now - existing.timestamp < this.CACHE_TTL_MS) {
      return existing.rows;
    }

    // 2. Fetch from Google Sheets API with retry on rate limit
    let lastError: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const rows = await withTimeout(
          sheetDiscoveryService.fetchSheetRowsForMatching(
            spreadsheetId,
            tabTitle,
            startRow,
            undefined,
            isMock
          ),
          8000,
          `Quá thời gian tải dữ liệu Tab "${tabTitle}" (8s)`
        );

        this.tabRowsCache.set(key, { rows, timestamp: now });
        return rows;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AutoFindService] Tab "${tabTitle}" fetch attempt ${attempt} failed:`, err);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    // 3. Fallback to stale cache if remote fetch failed
    if (existing) {
      console.warn(`[AutoFindService] Reusing stale cache for tab "${tabTitle}" due to fetch error.`);
      return existing.rows;
    }

    throw lastError || new Error(`Không tải được dữ liệu cho Tab "${tabTitle}"`);
  }

  /**
   * Automatically queries Google Sheet for the specified customer folder,
   * extracts selection codes, and sets them into Photo Picker.
   */
  public async fetchAndApplyCodesForCustomer(
    folderPath: string,
    providedFolderName?: string,
    options?: { forceFresh?: boolean }
  ): Promise<AutoFindResult> {
    if (options?.forceFresh) {
      this.clearCache();
    }
    const rawName =
      providedFolderName ||
      getFolderName(folderPath) ||
      folderPath;

    const { sheetFilterContext } = useAppStore.getState();
    const { profiles, activeProfile } = useContactSheetStore.getState();
    const profile =
      activeProfile ||
      (sheetFilterContext?.profileId
        ? profiles.find((p) => p.id === sheetFilterContext.profileId)
        : null) ||
      profiles[0];

    if (!profile || !profile.spreadsheetId) {
      const reason = "Chưa cấu hình hồ sơ Google Sheet.";
      useAppStore.getState().setAutoFindStatus({
        state: "error",
        targetCustomerName: rawName,
        message: reason,
      });
      return {
        success: false,
        folderName: rawName,
        folderPath,
        reason,
      };
    }

    const isMock = Boolean(
      profile.isMockSandbox || profile.spreadsheetId.startsWith("mock")
    );

    if (!isMock && !googleCredentialManager.isConnected()) {
      const reason = "Tài khoản Google chưa được kết nối.";
      useAppStore.getState().setAutoFindStatus({
        state: "error",
        targetCustomerName: rawName,
        message: reason,
      });
      return {
        success: false,
        folderName: rawName,
        folderPath,
        reason,
      };
    }

    // Indicate loading state with target customer name
    useAppStore.getState().setIsAutoFinding(true);
    useAppStore.getState().setAutoFindStatus({
      state: "loading",
      targetCustomerName: rawName,
      message: `Đang truy xuất mã của "${rawName}" từ Google Sheet...`,
    });

    try {
      // 1. Fetch real sheet tabs from Google Sheets (or cache)
      const remoteTabs = await this.getSpreadsheetTabs(profile.spreadsheetId, isMock);

      // Read saved checked tabs from localStorage (same as "Truy xuất trang tính" modal)
      const savedExtractTabs = parseSavedTabs(localStorage.getItem("mvd_extract_selected_tabs"));
      const savedCheckTabs = parseSavedTabs(localStorage.getItem("mvd_check_selected_tabs"));
      const savedLegacyTabs = parseSavedTabs(localStorage.getItem(`mvd_checked_sheet_tabs_${profile.id}`));
      const savedTabs = savedExtractTabs || savedCheckTabs || savedLegacyTabs;

      const configuredTabs = Object.keys(profile.tabConfigurations || {});
      const activeTab = profile.selectedTabTitle || "";

      // Available tabs: real remote tabs from Google Sheet take absolute priority,
      // merged with configured, active, saved, and default tabs.
      const availableTabs = Array.from(
        new Set([
          ...remoteTabs,
          ...(activeTab ? [activeTab] : []),
          ...configuredTabs,
          ...(savedTabs || []),
          ...DEFAULT_TABS,
        ])
      );

      // 2. Intelligent Tab Prioritization:
      // If customer folder contains a month indicator (e.g. "20-10" -> month 10),
      // prioritize the tab that matches that month!
      const detectedMonth = detectMonthFromFolderName(rawName);
      let checkedTabs = resolveCheckedTabs(savedTabs, availableTabs, activeTab);

      if (detectedMonth !== null) {
        const matchingMonthTabs = availableTabs.filter((t) => doesTabMatchMonth(t, detectedMonth));
        if (matchingMonthTabs.length > 0) {
          // Prepend matching month tabs to checkedTabs if not already present
          checkedTabs = Array.from(new Set([...matchingMonthTabs, ...checkedTabs]));
          console.log(
            `[AutoFindService] Detected Month ${detectedMonth} in "${rawName}". Prioritizing tabs:`,
            matchingMonthTabs
          );
        }
      }

      if (checkedTabs.length === 0) {
        const reason = "Chưa chọn tab làm việc nào trên Google Sheet.";
        useAppStore.getState().setAutoFindStatus({
          state: "error",
          targetCustomerName: rawName,
          message: reason,
        });
        return {
          success: false,
          folderName: rawName,
          folderPath,
          reason,
        };
      }

      // 4. Status mapping
      const configuredStatusValue =
        profile.valueMappings?.find((v) => v.semanticRole === "PHOTO_PICK_STATUS_COMPLETED")
          ?.sheetValue || "Đã lọc";

      // 3. Intelligent Fetching & Fast-Path Matching:
      // If customer folder contains a month indicator or active tab is prioritized:
      // Try the primary tab FIRST to avoid downloading multiple tabs when match is readily available.
      let extraction: MultiTabExtractionResult | null = null;
      const tabRows: TabRows[] = [];
      const failedTabs: string[] = [];

      // Determine the highest priority tab
      const primaryCandidateTab = checkedTabs[0];

      if (primaryCandidateTab && checkedTabs.length > 1) {
        try {
          const startRow = getTabStartRow(profile, primaryCandidateTab);
          const rows = await this.getTabRowsCached(
            profile.spreadsheetId,
            primaryCandidateTab,
            startRow,
            isMock,
            options?.forceFresh
          );
          tabRows.push({ tabTitle: primaryCandidateTab, rows });

          // Fast check on primary tab
          const candidateExtraction = extractCodesAcrossTabs(
            rawName,
            folderPath,
            [{ tabTitle: primaryCandidateTab, rows }],
            profile,
            configuredStatusValue
          );

          const candidateHasCodes = (candidateExtraction.candidateColumns || []).some(
            (c: any) => c.codeCount > 0
          );

          // Fast-path only claims victory if it actually found a row WITH CODES!
          // If the customer row exists but has 0 codes on this primary tab,
          // we MUST proceed to load the remaining tabs to find where the codes actually reside.
          if (
            candidateExtraction.status !== "NO_MATCH" &&
            candidateExtraction.matchedRow &&
            candidateHasCodes
          ) {
            extraction = candidateExtraction;
            console.log(
              `[AutoFindService] Fast-path match succeeded with codes on primary tab "${primaryCandidateTab}"!`
            );
          } else {
            console.log(
              `[AutoFindService] Primary tab "${primaryCandidateTab}" yielded no codes for "${rawName}". Continuing search on remaining tabs...`
            );
          }
        } catch (fetchErr) {
          console.warn(`[AutoFindService] Primary tab "${primaryCandidateTab}" fetch error:`, fetchErr);
          failedTabs.push(primaryCandidateTab);
        }
      }

      // If fast-path did not produce a match with codes, fetch the remaining checked tabs in parallel
      if (!extraction) {
        const remainingTabs = checkedTabs.filter((t) => t !== primaryCandidateTab);
        if (remainingTabs.length > 0) {
          const fetchPromises = remainingTabs.map(async (tabTitle) => {
            const startRow = getTabStartRow(profile, tabTitle);
            const rows = await this.getTabRowsCached(
              profile.spreadsheetId,
              tabTitle,
              startRow,
              isMock,
              options?.forceFresh
            );
            return { tabTitle, rows };
          });

          const results = await Promise.allSettled(fetchPromises);
          for (let i = 0; i < results.length; i++) {
            const res = results[i];
            const tabTitle = remainingTabs[i];
            if (res.status === "fulfilled") {
              tabRows.push(res.value);
            } else {
              console.warn(`[AutoFindService] Parallel fetch error for tab "${tabTitle}":`, res.reason);
              failedTabs.push(tabTitle);
            }
          }
        }

        if (tabRows.length === 0) {
          const reason = `Không thể kết nối tải dữ liệu trang tính (Lỗi tại Tab: ${failedTabs.join(", ")}).`;
          useAppStore.getState().setAutoFindStatus({
            state: "error",
            targetCustomerName: rawName,
            message: reason,
          });
          return {
            success: false,
            folderName: rawName,
            folderPath,
            reason,
          };
        }

        // Run full extraction across all loaded tabs
        extraction = extractCodesAcrossTabs(
          rawName,
          folderPath,
          tabRows,
          profile,
          configuredStatusValue
        );
      }

      // 6. Intelligent Fallback: If checked tabs missed the customer, search remaining available tabs in parallel
      if (extraction.status === "NO_MATCH" || !extraction.matchedRow) {
        const unsearchedTabs = availableTabs.filter((t) => !checkedTabs.includes(t));

        const prioritizedFallbackTabs = [...unsearchedTabs].sort((a, b) => {
          if (detectedMonth !== null) {
            const aHas = doesTabMatchMonth(a, detectedMonth) ? 1 : 0;
            const bHas = doesTabMatchMonth(b, detectedMonth) ? 1 : 0;
            if (aHas !== bHas) return bHas - aHas;
          }
          return 0;
        });

        const batchFallback = prioritizedFallbackTabs.slice(0, 3);
        const fallbackResults = await Promise.allSettled(
          batchFallback.map(async (fallbackTab) => {
            const startRow = getTabStartRow(profile, fallbackTab);
            const rows = await this.getTabRowsCached(
              profile.spreadsheetId,
              fallbackTab,
              startRow,
              isMock,
              options?.forceFresh
            );
            return { fallbackTab, rows };
          })
        );

        for (const res of fallbackResults) {
          if (res.status === "fulfilled") {
            const { fallbackTab, rows } = res.value;
            const fallbackExtraction = extractCodesAcrossTabs(
              rawName,
              folderPath,
              [{ tabTitle: fallbackTab, rows }],
              profile,
              configuredStatusValue
            );

            if (fallbackExtraction.status !== "NO_MATCH" && fallbackExtraction.matchedRow) {
              extraction = fallbackExtraction;
              console.log(`[AutoFindService] Successfully matched "${rawName}" on fallback tab "${fallbackTab}"!`);
              // Auto-persist this tab into mvd_extract_selected_tabs so user stays synchronized
              try {
                const existing = savedTabs || [];
                if (!existing.includes(fallbackTab)) {
                  localStorage.setItem("mvd_extract_selected_tabs", JSON.stringify([...existing, fallbackTab]));
                }
              } catch {}
              break;
            }
          }
        }
      }

      // 7. Handle ambiguous candidate rows (NEEDS_REVIEW):
      // If multiple candidates were found, pick the highest-scoring candidate row that has codes and is not completed
      if (
        extraction &&
        (extraction.status === "NEEDS_REVIEW" || !extraction.matchedRow) &&
        extraction.candidateRows &&
        extraction.candidateRows.length > 0
      ) {
        const bestCandidate =
          extraction.candidateRows.find((c: any) => {
            const statusCol = profile.fieldMappings?.find((m) => m.semanticField === "PHOTO_PICK_STATUS")?.columnLetter || "G";
            const val = c.values[statusCol] || "";
            return !val.toLowerCase().includes("đã lọc");
          }) || extraction.candidateRows[0];

        if (bestCandidate) {
          const candidateTab = bestCandidate.tabTitle || profile.selectedTabTitle || checkedTabs[0] || "";
          const tabProfile = getTabProfile(profile, candidateTab);
          const cols = sheetExtractorService.detectCodeColumns(tabProfile, bestCandidate.values);

          extraction = {
            ...extraction,
            matchedRow: bestCandidate.row,
            matchedTabTitle: candidateTab,
            status: "READY",
            reason: `Tự động khớp theo hàng điểm cao nhất (${bestCandidate.matchedFields.join(", ")})`,
            targetSnapshot: bestCandidate.values,
            candidateColumns: cols,
          };
          console.log(`[AutoFindService] Resolved ambiguous match to Row ${bestCandidate.row} on Tab "${candidateTab}"`);
        }
      }

      if (!extraction || extraction.status === "NO_MATCH" || !extraction.matchedRow) {
        const reason = `Không tìm thấy dòng tương ứng với "${rawName}" trên Google Sheet.`;
        useAppStore.getState().setAutoFindStatus({
          state: "error",
          targetCustomerName: rawName,
          message: reason,
        });
        return {
          success: false,
          folderName: rawName,
          folderPath,
          reason,
        };
      }

      // 7.1. Check if the matched row has NO codes, but another sameFileRow or candidateRow DOES have codes!
      let candidateCols = extraction.candidateColumns || [];
      let columnsWithCodes = candidateCols.filter((c: any) => c.codeCount > 0);

      if (columnsWithCodes.length === 0 && extraction.sameFileRows && extraction.sameFileRows.length > 1) {
        const altSameFile =
          extraction.sameFileRows.find((r) => r.hasCodes && !r.isCompleted) ||
          extraction.sameFileRows.find((r) => r.hasCodes);

        if (altSameFile) {
          const altExtraction = extractCodesAcrossTabs(
            rawName,
            folderPath,
            tabRows,
            profile,
            configuredStatusValue,
            { tabTitle: altSameFile.tabTitle, row: altSameFile.row }
          );
          if (altExtraction.candidateColumns.some((c: any) => c.codeCount > 0)) {
            extraction = altExtraction;
            candidateCols = extraction.candidateColumns || [];
            columnsWithCodes = candidateCols.filter((c: any) => c.codeCount > 0);
            console.log(
              `[AutoFindService] Switched to same-file row with codes: Row ${altSameFile.row} on Tab "${altSameFile.tabTitle}"`
            );
          }
        }
      }

      if (columnsWithCodes.length === 0 && extraction.candidateRows && extraction.candidateRows.length > 0) {
        for (const cand of extraction.candidateRows) {
          if (cand.row === extraction.matchedRow && cand.tabTitle === extraction.matchedTabTitle) continue;
          const candTab = cand.tabTitle || profile.selectedTabTitle || checkedTabs[0] || "";
          const tabProfile = getTabProfile(profile, candTab);
          const cols = sheetExtractorService.detectCodeColumns(tabProfile, cand.values);
          if (cols.some((c: any) => c.codeCount > 0)) {
            extraction = {
              ...extraction,
              matchedRow: cand.row,
              matchedTabTitle: candTab,
              status: "READY",
              reason: `Khớp theo hàng có mã ảnh (${cand.matchedFields.join(", ")})`,
              targetSnapshot: cand.values,
              candidateColumns: cols,
            };
            candidateCols = cols;
            columnsWithCodes = candidateCols.filter((c: any) => c.codeCount > 0);
            console.log(
              `[AutoFindService] Switched to candidate row with codes: Row ${cand.row} on Tab "${candTab}"`
            );
            break;
          }
        }
      }

      // 7.2. ULTRA STABILITY FEATURE: Auto fresh fetch from Google Sheets if row is found but codes are empty!
      // This happens when the Google Sheet was JUST updated by studio staff but the app was using cached rows.
      if (columnsWithCodes.length === 0 && extraction.matchedRow && !options?.forceFresh) {
        const matchedTab = extraction.matchedTabTitle || primaryCandidateTab;
        console.log(
          `[AutoFindService] Row ${extraction.matchedRow} on "${matchedTab}" has 0 codes in cache. Invalidation and fresh fetch from Google Sheets...`
        );
        this.clearTabCache(profile.spreadsheetId, matchedTab);
        try {
          const startRow = getTabStartRow(profile, matchedTab);
          const freshRows = await this.getTabRowsCached(
            profile.spreadsheetId,
            matchedTab,
            startRow,
            isMock,
            true
          );
          const freshExtraction = extractCodesAcrossTabs(
            rawName,
            folderPath,
            [{ tabTitle: matchedTab, rows: freshRows }],
            profile,
            configuredStatusValue,
            { tabTitle: matchedTab, row: extraction.matchedRow }
          );
          if (freshExtraction.candidateColumns.some((c: any) => c.codeCount > 0)) {
            extraction = freshExtraction;
            candidateCols = extraction.candidateColumns || [];
            columnsWithCodes = candidateCols.filter((c: any) => c.codeCount > 0);
            console.log(
              `[AutoFindService] Fresh fetch succeeded! Found codes for Row ${extraction.matchedRow}!`
            );
          }
        } catch (freshErr) {
          console.warn("[AutoFindService] Fresh fetch retry failed:", freshErr);
        }
      }

      // 8. Pick candidate columns with codes
      const activeCols = columnsWithCodes.length > 0 ? columnsWithCodes : candidateCols.slice(0, 1);

      const formattedCodes = sheetExtractorService.formatExtractedCodes(activeCols);

      if (!formattedCodes.trim()) {
        const reason = `Đã tìm thấy dòng ${extraction.matchedRow} nhưng khách chưa có mã chọn trên Sheet.`;
        useAppStore.getState().setAutoFindStatus({
          state: "error",
          targetCustomerName: rawName,
          message: reason,
        });
        return {
          success: false,
          folderName: rawName,
          folderPath,
          matchedRow: extraction.matchedRow,
          tabTitle: extraction.matchedTabTitle,
          reason,
        };
      }

      // 9. Set codes into Photo Picker store
      const store = useAppStore.getState();
      store.setRawCodeInput(formattedCodes);

      // Parse codes immediately
      try {
        const parsed = await invoke<CustomerCode[]>("parse_customer_codes", {
          input: formattedCodes,
        });
        store.setParsedCodes(parsed);
      } catch (parseErr) {
        console.warn("[AutoFindService] parse_customer_codes error:", parseErr);
      }

      // 10. Save Sheet filter context for auto-status update on copy complete
      const matchedTab = extraction.matchedTabTitle || profile.selectedTabTitle || checkedTabs[0] || "";
      const statusMapping = getTabStatusMapping(profile, matchedTab);

      store.setSheetFilterContext({
        profileId: profile.id,
        spreadsheetId: profile.spreadsheetId,
        tabTitle: matchedTab,
        matchedRow: extraction.matchedRow!,
        jobName: extraction.jobFolderName,
        folderName: rawName,
        statusColumnLetter: statusMapping?.columnLetter,
        statusValue: configuredStatusValue,
        autoUpdateOnFilterComplete: true,
      });

      // Synchronize this tab into saved tabs so user sees it in modal
      try {
        const currentSaved = parseSavedTabs(localStorage.getItem("mvd_extract_selected_tabs")) || [];
        if (!currentSaved.includes(matchedTab)) {
          localStorage.setItem("mvd_extract_selected_tabs", JSON.stringify([...currentSaved, matchedTab]));
        }
      } catch {}

      const codeCount = formattedCodes.split("\n").filter(Boolean).length;

      // Update Auto Find status to SUCCESS
      useAppStore.getState().setAutoFindStatus({
        state: "success",
        targetCustomerName: rawName,
        codeCount,
        message: `Đã nạp ${codeCount} mã cho ${rawName}`,
        updatedAt: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      });

      return {
        success: true,
        folderName: rawName,
        folderPath,
        customerName: extraction.customerName,
        codeCount,
        matchedRow: extraction.matchedRow,
        tabTitle: matchedTab,
      };
    } catch (err: any) {
      console.error("[AutoFindService] Unexpected error:", err);
      const reason = err?.message || String(err);
      useAppStore.getState().setAutoFindStatus({
        state: "error",
        targetCustomerName: rawName,
        message: reason,
      });
      return {
        success: false,
        folderName: rawName,
        folderPath,
        reason,
      };
    } finally {
      useAppStore.getState().setIsAutoFinding(false);
    }
  }
}

export const autoFindService = new AutoFindService();
