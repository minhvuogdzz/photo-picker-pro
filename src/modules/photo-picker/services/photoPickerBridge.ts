import { useAuthStore } from "../../../core/stores/useAuthStore.ts";
import { useAppStore, type SheetFilterContext, type SheetUpdateStatus } from "../../../core/stores/useAppStore.ts";
import { useSettingsStore } from "../../../core/stores/useSettingsStore.ts";
import { checkAppAccess, hasGoogleFeatureAccess } from "../../../core/services/appEntitlementPolicy.ts";
import { useContactSheetStore } from "../../contact-the-sheet/stores/useContactSheetStore.ts";
import { googleCredentialManager } from "../../contact-the-sheet/services/googleCredentialBridge.ts";
import { sheetDiscoveryService } from "../../contact-the-sheet/services/sheetDiscoveryService.ts";
import {
  sheetExtractorService,
  type ExtractedCodeColumn,
} from "../../contact-the-sheet/services/sheetExtractorService.ts";
import { sheetFilterAutomationService } from "../../contact-the-sheet/services/sheetFilterAutomationService.ts";
import {
  extractCodesAcrossTabs,
  getTabStartRow,
  getTabStatusMapping,
  parseSavedTabs,
  resolveCheckedTabs,
  type MultiTabExtractionResult,
  type PreferredRow,
  type SameFileRow,
  type TabRows,
} from "./sheetTabExtractionService.ts";
import { formatPastedCodes } from "../utils/codeFormatter.ts";
import {
  analyzeCodeInputLines,
  type LinePrimaryStatus,
} from "../utils/codeLineHighlighter.ts";
import {
  BridgeError,
  type BridgeProgressReporter,
} from "../../contact-the-sheet/services/contactSheetBridge.ts";
import type {
  AppSettings,
  CopyOptions,
  CopyResult,
  CustomerCode,
  MatchResult,
  MatchStatus,
  OutputMode,
  PhotoFile,
  ProgressEvent,
  ScanOptions,
  ScanResult,
} from "../../../core/types/index.ts";
import type { MatchScoreResult } from "../../contact-the-sheet/services/jobMatchingService.ts";

const AUTH_HYDRATION_TIMEOUT_MS = 8_000;
const AUTH_POLL_INTERVAL_MS = 100;
const EXTRACT_TABS_STORAGE_KEY = "mvd_extract_selected_tabs";
const DEFAULT_TABS = [
  "Edit 6/2026",
  "Edit 7/2026",
  "Edit 8/2026",
  "Edit 9/2026",
  "Edit 10/2026",
  "Edit 11/2026",
  "Edit 12/2026",
];

export interface PhotoPickerBridgeLine {
  lineIndex: number;
  lineNumber: number;
  rawText: string;
  primaryStatus: LinePrimaryStatus;
  duplicateOfLineNumber?: number;
  peerDuplicateLineNumbers?: number[];
  fileMatchCount?: number;
  missingCountOnLine: number;
  duplicateCountOnLine: number;
}

export interface PhotoPickerBridgeErrorLocation {
  matchIndex: number;
  code: string;
  status: MatchStatus;
  lineIndex: number;
  lineNumber: number;
  duplicateOfLineNumber?: number;
  allDuplicateLineNumbers?: number[];
  fileMatchCount?: number;
}

export interface PhotoPickerBridgeLineAnalysis {
  missingLineCount: number;
  duplicateLineCount: number;
  lines: PhotoPickerBridgeLine[];
  matchErrorLocations: PhotoPickerBridgeErrorLocation[];
}

export interface PhotoPickerBridgeSheetProfileSummary {
  id: string;
  displayName: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  selectedTabTitle: string;
  isMockSandbox: boolean;
}

export interface PhotoPickerBridgeContext {
  authenticated: boolean;
  userEmail: string | null;
  hasAccess: boolean;
  accessReason: string;
  hasSheetAccess: boolean;
  google: {
    status: string;
    accountEmail: string | null;
    hasDriveAccess: boolean;
    hasSheetsAccess: boolean;
  };
  sheetProfile: PhotoPickerBridgeSheetProfileSummary | null;
  folderPath: string;
  folderName: string;
  rawCodeInput: string;
  parsedCodeCount: number;
  scannedFilesCount: number;
  phase: string;
  matchMode: string;
  regexPattern: string;
  scanOptions: ScanOptions;
  inheritExtensionEnabled: boolean;
  inheritedExtensions: string[];
  outputMode: OutputMode;
  outputFolder: string;
  sheetFilterContext: SheetFilterContext | null;
  sheetUpdateStatus: SheetUpdateStatus | null;
  matchResult: MatchResult | null;
  lineAnalysis: PhotoPickerBridgeLineAnalysis;
  copyResult: CopyResult | null;
}

export interface PhotoPickerBridgeSheetTabsResult {
  sheetProfile: PhotoPickerBridgeSheetProfileSummary | null;
  availableTabs: string[];
  checkedTabs: string[];
  completedStatusValue: string;
}

export interface PhotoPickerBridgeSheetExtractResult {
  status: "READY" | "NEEDS_REVIEW" | "NO_MATCH";
  matchedRow?: number;
  matchedTabTitle?: string;
  customerName?: string;
  jobFolderName: string;
  confidence?: number;
  reason?: string;
  candidateColumns: ExtractedCodeColumn[];
  defaultSelectedColumns: string[];
  candidateRows: MatchScoreResult[];
  sameFileRows: SameFileRow[];
  searchedTabs: string[];
  failedTabs: string[];
  totalLoadedRows: number;
  statusColumnLetter?: string;
  statusColumnWritable: boolean;
  completedStatusValue: string;
}

/** Injectable Tauri runtime primitives (overridden in unit tests outside Tauri). */
export interface PhotoPickerRuntime {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  listen<T>(event: string, handler: (event: { payload: T }) => void): Promise<() => void>;
}

let customRuntime: PhotoPickerRuntime | null = null;

export function setPhotoPickerBridgeRuntime(runtime: PhotoPickerRuntime | null): void {
  customRuntime = runtime;
}

async function getRuntime(): Promise<PhotoPickerRuntime> {
  if (customRuntime) return customRuntime;
  const [{ invoke }, { listen }] = await Promise.all([
    import("@tauri-apps/api/core"),
    import("@tauri-apps/api/event"),
  ]);
  return { invoke, listen };
}

function folderBaseName(path: string): string {
  if (!path) return "";
  const parts = path.split(/[/\\]+/).filter(Boolean);
  return parts[parts.length - 1] || path;
}

function buildScanRequestForSingle(state: {
  selectedInputFolders: string[];
  inputFolders: string[];
  scanOptions: ScanOptions;
  outputMode: OutputMode;
  outputFolder: string;
}) {
  const folders =
    state.selectedInputFolders.length > 0 ? state.selectedInputFolders : state.inputFolders;
  const singleFolder = folders.length > 0 ? [folders[0]] : [];
  const outputFolder = state.outputMode === "Folder" ? state.outputFolder.trim() : "";
  const options = {
    ...state.scanOptions,
    exclude_paths: outputFolder ? [outputFolder] : [],
  };
  const signature = JSON.stringify({ paths: singleFolder, options });
  return { folders: singleFolder, options, signature };
}

function buildLineAnalysis(
  rawCodeInput: string,
  matchResult: MatchResult | null,
  inheritExtensionEnabled: boolean,
  inheritedExtensions: string[]
): PhotoPickerBridgeLineAnalysis {
  const raw = analyzeCodeInputLines(
    rawCodeInput,
    matchResult,
    inheritExtensionEnabled ? inheritedExtensions : null
  );
  return {
    missingLineCount: raw.missingLineCount,
    duplicateLineCount: raw.duplicateLineCount,
    lines: raw.lines.map((line) => ({
      lineIndex: line.lineIndex,
      lineNumber: line.lineNumber,
      rawText: line.rawText,
      primaryStatus: line.primaryStatus,
      duplicateOfLineNumber: line.duplicateOfLineNumber,
      peerDuplicateLineNumbers: line.peerDuplicateLineNumbers
        ? [...line.peerDuplicateLineNumbers]
        : undefined,
      fileMatchCount: line.fileMatchCount,
      missingCountOnLine: line.missingCountOnLine,
      duplicateCountOnLine: line.duplicateCountOnLine,
    })),
    matchErrorLocations: raw.matchErrorLocations.map((loc) => ({
      matchIndex: loc.matchIndex,
      code: loc.match.code,
      status: loc.match.status,
      lineIndex: loc.lineIndex,
      lineNumber: loc.lineNumber,
      duplicateOfLineNumber: loc.duplicateOfLineNumber,
      allDuplicateLineNumbers: loc.allDuplicateLineNumbers
        ? [...loc.allDuplicateLineNumbers]
        : undefined,
      fileMatchCount: loc.match.all_matches?.length ?? 0,
    })),
  };
}

function getActiveSheetProfile() {
  const store = useContactSheetStore.getState();
  return store.activeProfile || store.profiles[0] || null;
}

function toSheetProfileSummary(): PhotoPickerBridgeSheetProfileSummary | null {
  const profile = getActiveSheetProfile();
  if (!profile) return null;
  return {
    id: profile.id,
    displayName: profile.displayName,
    spreadsheetId: profile.spreadsheetId,
    spreadsheetTitle: profile.spreadsheetTitle,
    selectedTabTitle: profile.selectedTabTitle,
    isMockSandbox: Boolean(profile.isMockSandbox),
  };
}

export function buildPhotoPickerContext(): PhotoPickerBridgeContext {
  const authState = useAuthStore.getState();
  const session = authState.session;
  const access = checkAppAccess(session, "photo-picker");
  const hasSheetAccess = hasGoogleFeatureAccess(session);
  const contactStore = useContactSheetStore.getState();
  const appState = useAppStore.getState();
  const settings = useSettingsStore.getState().settings;

  const folderPath = appState.selectedInputFolders[0] || appState.inputFolders[0] || "";
  const effectiveOutputFolder = appState.outputFolder || settings.default_output || "";

  return {
    authenticated: Boolean(session),
    userEmail: session?.email || null,
    hasAccess: access.hasAccess,
    accessReason: access.reason,
    hasSheetAccess,
    google: {
      status: contactStore.googleConnection.status,
      accountEmail: contactStore.googleConnection.accountEmail || null,
      hasDriveAccess: contactStore.googleConnection.hasDriveAccess,
      hasSheetsAccess: contactStore.googleConnection.hasSheetsAccess,
    },
    sheetProfile: toSheetProfileSummary(),
    folderPath,
    folderName: folderBaseName(folderPath),
    rawCodeInput: appState.rawCodeInput,
    parsedCodeCount: appState.parsedCodes.length,
    scannedFilesCount: appState.scannedFiles.length,
    phase: appState.phase,
    matchMode: appState.matchMode,
    regexPattern: appState.regexPattern,
    scanOptions: { ...appState.scanOptions },
    inheritExtensionEnabled: appState.inheritExtensionEnabled,
    inheritedExtensions: [...appState.inheritedExtensions],
    outputMode: appState.outputMode,
    outputFolder: effectiveOutputFolder,
    sheetFilterContext: appState.sheetFilterContext,
    sheetUpdateStatus: appState.sheetUpdateStatus,
    matchResult: appState.matchResult,
    lineAnalysis: buildLineAnalysis(
      appState.rawCodeInput,
      appState.matchResult,
      appState.inheritExtensionEnabled,
      appState.inheritedExtensions
    ),
    copyResult: appState.copyResult,
  };
}

async function waitForPhotoPickerHydration(): Promise<void> {
  const start = Date.now();
  while (useAuthStore.getState().isLoading) {
    if (Date.now() - start >= AUTH_HYDRATION_TIMEOUT_MS) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, AUTH_POLL_INTERVAL_MS));
  }

  // Hydrate default_output from settings if store does not have one yet
  const settingsState = useSettingsStore.getState();
  if (!settingsState.settings.default_output) {
    try {
      const runtime = await getRuntime();
      const loaded = await runtime.invoke<AppSettings>("load_settings");
      if (loaded) {
        settingsState.setSettings(loaded);
      }
    } catch {
      // Ignore in non-Tauri test environment
    }
  }
  const latestSettings = useSettingsStore.getState().settings;
  const appState = useAppStore.getState();
  if (!appState.outputFolder && latestSettings.default_output) {
    appState.setOutputFolder(latestSettings.default_output);
  }

  const session = useAuthStore.getState().session;
  const googleStatus = useContactSheetStore.getState().googleConnection.status;
  if (session && hasGoogleFeatureAccess(session) && googleStatus === "DISCONNECTED") {
    googleCredentialManager.restoreSavedSession();
    if (useContactSheetStore.getState().googleConnection.status === "DISCONNECTED") {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

function assertPhotoPickerAccess(): void {
  const session = useAuthStore.getState().session;
  if (!session) {
    throw new BridgeError(
      "NOT_AUTHENTICATED",
      "Bạn chưa đăng nhập DH Studio Pro. Hãy mở DH Studio Pro để đăng nhập trước."
    );
  }
  const access = checkAppAccess(session, "photo-picker");
  if (!access.hasAccess) {
    throw new BridgeError(
      "ENTITLEMENT_DENIED",
      "Tài khoản hiện tại chưa mở khóa bản quyền Photo Picker Pro (Lọc ảnh)."
    );
  }
}

function formatProgressMessage(prefix: string, ev: ProgressEvent): string {
  const parts: string[] = [];
  if (ev.message && ev.message.trim()) {
    parts.push(ev.message.trim());
  } else {
    parts.push(prefix);
  }
  if (ev.speed && ev.speed.trim()) {
    parts.push(ev.speed.trim());
  }
  if (ev.eta_seconds != null && ev.eta_seconds > 0) {
    const secs = Math.ceil(ev.eta_seconds);
    parts.push(secs >= 60 ? `còn ${Math.floor(secs / 60)}p ${secs % 60}s` : `còn ${secs}s`);
  }
  return parts.join(" · ");
}

async function parseAndRematchInMemory(runtime: PhotoPickerRuntime): Promise<void> {
  const st = useAppStore.getState();
  const input = st.rawCodeInput;
  const allowedExtensions = st.inheritExtensionEnabled ? st.inheritedExtensions : null;

  let activeCodes: CustomerCode[] = [];
  if (input.trim()) {
    activeCodes = await runtime.invoke<CustomerCode[]>("parse_customer_codes", {
      input,
      allowedExtensions,
    });
    st.setParsedCodes(activeCodes);
  } else {
    st.setParsedCodes([]);
    if (st.matchResult && st.phase !== "scanning" && st.phase !== "copying") {
      st.setMatchResult(null);
      if (st.scannedFiles.length > 0) {
        st.setPhase("scanned");
      }
    }
    return;
  }

  const latest = useAppStore.getState();
  const { folders, signature } = buildScanRequestForSingle(latest);
  if (
    latest.scannedFiles.length > 0 &&
    latest.lastScanSignature === signature &&
    latest.phase !== "scanning" &&
    latest.phase !== "copying"
  ) {
    if (activeCodes.length > 0) {
      const result = await runtime.invoke<MatchResult>("match_photos", {
        codes: activeCodes,
        files: latest.scannedFiles,
        mode: latest.matchMode,
        regexPattern: latest.matchMode === "Regex" ? latest.regexPattern : null,
        folderCount: folders.length,
        allowedExtensions,
      });
      latest.setMatchResult(result);
      latest.setPhase("matched");
    } else {
      latest.setMatchResult(null);
      latest.setPhase("scanned");
    }
  }
}

async function runSingleScanAndMatch(
  runtime: PhotoPickerRuntime,
  forceRescan: boolean,
  onProgress?: BridgeProgressReporter
): Promise<{ elapsedMs: number }> {
  const initState = useAppStore.getState();
  if (initState.phase === "scanning" || initState.phase === "copying") {
    throw new BridgeError("BUSY", "DH Studio Pro đang bận xử lý một tác vụ lọc/chép khác.");
  }

  const { folders: effectiveFolders } = buildScanRequestForSingle(initState);
  if (effectiveFolders.length === 0) {
    throw new BridgeError("INVALID_REQUEST", "Chưa chọn thư mục khách để quét.");
  }

  let unlistenScan: (() => void) | null = null;
  let unlistenMatch: (() => void) | null = null;
  let elapsedMs = 0;

  try {
    initState.setCopyResult(null);
    initState.setSheetUpdateStatus(null);

    const allowedExtensions = initState.inheritExtensionEnabled
      ? initState.inheritedExtensions
      : null;
    let activeCodes: CustomerCode[] = [];
    if (initState.rawCodeInput.trim()) {
      activeCodes = await runtime.invoke<CustomerCode[]>("parse_customer_codes", {
        input: initState.rawCodeInput,
        allowedExtensions,
      });
      initState.setParsedCodes(activeCodes);
    } else {
      initState.setParsedCodes([]);
    }

    const currentState = useAppStore.getState();
    const { options: scanOptions, signature: currentSignature } =
      buildScanRequestForSingle(currentState);
    const matchMode = currentState.matchMode;
    const regexPattern = currentState.regexPattern;

    let filesToMatch: PhotoFile[] = currentState.scannedFiles;
    const canReuseCachedScan =
      !forceRescan &&
      currentState.lastScanSignature === currentSignature &&
      filesToMatch.length > 0;

    if (!canReuseCachedScan) {
      currentState.setMatchResult(null);
      currentState.setScannedFiles([]);
      currentState.setPhase("scanning");
      currentState.setProgress(null);
      onProgress?.(0, 100, "Đang quét danh sách ảnh trong thư mục...");

      unlistenScan = await runtime.listen<ProgressEvent>("scan-progress", (event) => {
        const ev = event.payload;
        useAppStore.getState().setProgress(ev);
        const pct = Math.max(0, Math.min(100, Math.round(ev.percentage || 0)));
        onProgress?.(pct, 100, formatProgressMessage("Đang quét thư mục...", ev));
      });

      const scanResult = await runtime.invoke<ScanResult>("scan_folders", {
        paths: effectiveFolders,
        options: scanOptions,
      });

      unlistenScan();
      unlistenScan = null;

      elapsedMs = scanResult.elapsed_ms || 0;
      filesToMatch = [...scanResult.files];
      const postScan = useAppStore.getState();
      postScan.setScannedFiles(filesToMatch);
      postScan.setLastScanSignature(currentSignature);
    }

    if (activeCodes.length > 0) {
      const matchState = useAppStore.getState();
      matchState.setPhase("matching");
      onProgress?.(85, 100, `Đang đối chiếu ${activeCodes.length} mã...`);

      unlistenMatch = await runtime.listen<ProgressEvent>("match-progress", (event) => {
        const ev = event.payload;
        useAppStore.getState().setProgress(ev);
        const pct = Math.max(0, Math.min(100, Math.round(ev.percentage || 0)));
        onProgress?.(pct, 100, formatProgressMessage("Đang đối chiếu mã ảnh...", ev));
      });

      const activeAllowedExtensions = matchState.inheritExtensionEnabled
        ? matchState.inheritedExtensions
        : null;

      let result = await runtime.invoke<MatchResult>("match_photos", {
        codes: activeCodes,
        files: filesToMatch,
        mode: matchMode,
        regexPattern: matchMode === "Regex" ? regexPattern : null,
        folderCount: effectiveFolders.length,
        allowedExtensions: activeAllowedExtensions,
      });

      unlistenMatch();
      unlistenMatch = null;

      // Mirror useScanAndMatch: if cached scan had missing codes, refresh disk once
      if (canReuseCachedScan && result.missing_count > 0) {
        const st = useAppStore.getState();
        st.setPhase("scanning");
        st.setProgress(null);
        onProgress?.(50, 100, "Đang kiểm tra lại tệp mới trong thư mục...");

        unlistenScan = await runtime.listen<ProgressEvent>("scan-progress", (event) => {
          const ev = event.payload;
          useAppStore.getState().setProgress(ev);
          const pct = Math.max(0, Math.min(100, Math.round(ev.percentage || 0)));
          onProgress?.(pct, 100, formatProgressMessage("Đang quét lại thư mục...", ev));
        });
        const refreshed = await runtime.invoke<ScanResult>("scan_folders", {
          paths: effectiveFolders,
          options: scanOptions,
        });
        unlistenScan();
        unlistenScan = null;
        elapsedMs = refreshed.elapsed_ms || elapsedMs;

        if (refreshed.files.length !== filesToMatch.length) {
          filesToMatch = [...refreshed.files];
          st.setScannedFiles(filesToMatch);
          st.setLastScanSignature(currentSignature);
          result = await runtime.invoke<MatchResult>("match_photos", {
            codes: activeCodes,
            files: filesToMatch,
            mode: matchMode,
            regexPattern: matchMode === "Regex" ? regexPattern : null,
            folderCount: effectiveFolders.length,
            allowedExtensions: activeAllowedExtensions,
          });
        }
      }

      const finalSt = useAppStore.getState();
      finalSt.setMatchResult(result);
      finalSt.setPhase("matched");
    } else {
      const finalSt = useAppStore.getState();
      finalSt.setMatchResult(null);
      finalSt.setPhase("scanned");
    }

    useAppStore.getState().setProgress(null);
    onProgress?.(100, 100, "Đã hoàn tất quét.");
    return { elapsedMs };
  } catch (err: any) {
    useAppStore.getState().setPhase("idle");
    useAppStore.getState().setProgress(null);
    if (err instanceof BridgeError) throw err;
    throw new BridgeError("INTERNAL_ERROR", err?.message || String(err));
  } finally {
    if (unlistenScan) unlistenScan();
    if (unlistenMatch) unlistenMatch();
  }
}

let lastSheetTabRowsCache: {
  spreadsheetId: string;
  tabsKey: string;
  tabRows: TabRows[];
} | null = null;
let lastSheetExtractionCache: MultiTabExtractionResult | null = null;

function readSavedExtractTabs(): string[] | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return parseSavedTabs(localStorage.getItem(EXTRACT_TABS_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeSavedExtractTabs(tabs: string[]): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(EXTRACT_TABS_STORAGE_KEY, JSON.stringify(tabs));
    }
  } catch {
    // ignore
  }
}

export async function handlePhotoPickerBridgeRequest(
  action: string,
  rawParams: unknown,
  onProgress?: BridgeProgressReporter
): Promise<unknown> {
  const params = (rawParams && typeof rawParams === "object" ? rawParams : {}) as Record<
    string,
    any
  >;

  await waitForPhotoPickerHydration();

  switch (action) {
    case "photo_picker.get_context": {
      return buildPhotoPickerContext();
    }

    case "photo_picker.set_folder": {
      assertPhotoPickerAccess();
      const folderPath = typeof params.folderPath === "string" ? params.folderPath.trim() : "";
      if (!folderPath) {
        throw new BridgeError("INVALID_REQUEST", "Thiếu đường dẫn thư mục khách (folderPath).");
      }

      const store = useAppStore.getState();
      const previousFolder = store.selectedInputFolders[0] || store.inputFolders[0] || "";
      store.setPickerMode("single");
      store.addInputFolder(folderPath);
      if (previousFolder !== folderPath) {
        // Fresh customer session: clear previous customer's codes & sheet context
        store.setRawCodeInput("");
        store.setParsedCodes([]);
        store.setSheetFilterContext(null);
        store.setSheetUpdateStatus(null);
        store.setCopyResult(null);
        store.setMatchResult(null);
        lastSheetExtractionCache = null;
      }
      return buildPhotoPickerContext();
    }

    case "photo_picker.format_codes": {
      const text = typeof params.text === "string" ? params.text : "";
      return { formatted: formatPastedCodes(text) };
    }

    case "photo_picker.set_codes": {
      assertPhotoPickerAccess();
      const rawCodeInput = typeof params.rawCodeInput === "string" ? params.rawCodeInput : "";
      const store = useAppStore.getState();
      store.setRawCodeInput(rawCodeInput);
      const runtime = await getRuntime();
      await parseAndRematchInMemory(runtime);
      const ctx = buildPhotoPickerContext();
      return {
        rawCodeInput: ctx.rawCodeInput,
        parsedCodeCount: ctx.parsedCodeCount,
        phase: ctx.phase,
        matchResult: ctx.matchResult,
        lineAnalysis: ctx.lineAnalysis,
      };
    }

    case "photo_picker.set_options": {
      assertPhotoPickerAccess();
      const store = useAppStore.getState();
      const runtime = await getRuntime();
      let scanOptionsChanged = false;
      let matchSettingsChanged = false;

      if (typeof params.matchMode === "string" && params.matchMode.trim()) {
        if (store.matchMode !== params.matchMode) {
          store.setMatchMode(params.matchMode);
          matchSettingsChanged = true;
        }
      }

      if (typeof params.regexPattern === "string") {
        if (store.regexPattern !== params.regexPattern) {
          store.setRegexPattern(params.regexPattern);
          matchSettingsChanged = true;
        }
      }

      if (params.scanOptions && typeof params.scanOptions === "object") {
        const patch: { -readonly [K in keyof ScanOptions]?: ScanOptions[K] } = {};
        if (typeof params.scanOptions.filter_raw === "boolean") {
          patch.filter_raw = params.scanOptions.filter_raw;
        }
        if (typeof params.scanOptions.filter_jpg === "boolean") {
          patch.filter_jpg = params.scanOptions.filter_jpg;
        }
        if (typeof params.scanOptions.recursive === "boolean") {
          patch.recursive = params.scanOptions.recursive;
        }
        if (Object.keys(patch).length > 0) {
          store.setScanOptions(patch);
          scanOptionsChanged = true;
        }
      }

      if (typeof params.inheritExtensionEnabled === "boolean") {
        if (store.inheritExtensionEnabled !== params.inheritExtensionEnabled) {
          store.setInheritExtensionEnabled(params.inheritExtensionEnabled);
          matchSettingsChanged = true;
        }
      }

      if (Array.isArray(params.inheritedExtensions)) {
        const cleaned = params.inheritedExtensions
          .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
          .map((e) => e.trim().toLowerCase());
        store.setInheritedExtensions(cleaned);
        matchSettingsChanged = true;
      }

      if (params.outputMode === "Folder" || params.outputMode === "SameAsOriginal") {
        if (store.outputMode !== params.outputMode) {
          store.setOutputMode(params.outputMode);
        }
      }

      if (typeof params.outputFolder === "string") {
        const trimmedOut = params.outputFolder.trim();
        if (trimmedOut !== store.outputFolder) {
          store.setOutputFolder(trimmedOut);
          if (trimmedOut) {
            const settingsStore = useSettingsStore.getState();
            settingsStore.updateSetting("default_output", trimmedOut);
            try {
              await runtime.invoke("save_settings", {
                settings: { ...settingsStore.settings, default_output: trimmedOut },
              });
            } catch {
              // Ignore outside Tauri
            }
          }
        }
      }

      const latest = useAppStore.getState();
      const hasFolder =
        latest.selectedInputFolders.length > 0 || latest.inputFolders.length > 0;
      const shouldAutoRescan = params.autoRescan !== false;

      if (
        scanOptionsChanged &&
        shouldAutoRescan &&
        hasFolder &&
        (latest.scannedFiles.length > 0 ||
          latest.matchResult !== null ||
          latest.rawCodeInput.trim().length > 0) &&
        latest.phase !== "scanning" &&
        latest.phase !== "copying"
      ) {
        await runSingleScanAndMatch(runtime, true, onProgress);
      } else if (matchSettingsChanged) {
        await parseAndRematchInMemory(runtime);
      }

      return buildPhotoPickerContext();
    }

    case "photo_picker.scan_and_match": {
      assertPhotoPickerAccess();
      const forceRescan = Boolean(params.forceRescan);
      const runtime = await getRuntime();
      const { elapsedMs } = await runSingleScanAndMatch(runtime, forceRescan, onProgress);
      return {
        ...buildPhotoPickerContext(),
        elapsedMs,
      };
    }

    case "photo_picker.sheet_tabs": {
      assertPhotoPickerAccess();
      const profile = getActiveSheetProfile();
      if (!profile || !profile.spreadsheetId) {
        throw new BridgeError(
          "NO_ACTIVE_PROFILE",
          "Chưa cấu hình bảng tính Google Sheet trong DH Studio Pro."
        );
      }
      const isSandbox = Boolean(
        profile.isMockSandbox || profile.spreadsheetId.startsWith("mock")
      );
      if (!isSandbox && !googleCredentialManager.isConnected()) {
        throw new BridgeError(
          "GOOGLE_NOT_CONNECTED",
          "Chưa kết nối tài khoản Google trong DH Studio Pro."
        );
      }

      const configuredTabs = Object.keys(profile.tabConfigurations || {});
      const activeTab = profile.selectedTabTitle || "";
      let availableTabs: string[];

      if (isSandbox) {
        availableTabs = Array.from(
          new Set([...(activeTab ? [activeTab] : []), ...configuredTabs, ...DEFAULT_TABS])
        );
      } else {
        try {
          const meta = await sheetDiscoveryService.fetchSpreadsheetMetadata(
            profile.spreadsheetId,
            false
          );
          if (meta && meta.tabs && meta.tabs.length > 0) {
            availableTabs = meta.tabs.map((t) => t.title);
          } else {
            availableTabs = Array.from(
              new Set([...(activeTab ? [activeTab] : []), ...configuredTabs, ...DEFAULT_TABS])
            );
          }
        } catch {
          availableTabs = Array.from(
            new Set([...(activeTab ? [activeTab] : []), ...configuredTabs, ...DEFAULT_TABS])
          );
        }
      }

      const saved = readSavedExtractTabs();
      const checkedTabs = resolveCheckedTabs(saved, availableTabs, activeTab);
      const completedStatusValue =
        profile.valueMappings?.find((v) => v.semanticRole === "PHOTO_PICK_STATUS_COMPLETED")
          ?.sheetValue || "Đã lọc";

      const result: PhotoPickerBridgeSheetTabsResult = {
        sheetProfile: toSheetProfileSummary(),
        availableTabs,
        checkedTabs,
        completedStatusValue,
      };
      return result;
    }

    case "photo_picker.sheet_extract": {
      assertPhotoPickerAccess();
      const profile = getActiveSheetProfile();
      if (!profile || !profile.spreadsheetId) {
        throw new BridgeError(
          "NO_ACTIVE_PROFILE",
          "Chưa cấu hình bảng tính Google Sheet trong DH Studio Pro."
        );
      }

      const isSandbox = Boolean(
        profile.isMockSandbox || profile.spreadsheetId.startsWith("mock")
      );
      if (!isSandbox && !googleCredentialManager.isConnected()) {
        throw new BridgeError(
          "GOOGLE_NOT_CONNECTED",
          "Chưa kết nối tài khoản Google trong DH Studio Pro."
        );
      }

      const appState = useAppStore.getState();
      const activeFolder = appState.selectedInputFolders[0] || appState.inputFolders[0] || "";
      const targetName =
        (typeof params.folderName === "string" && params.folderName.trim()) ||
        folderBaseName(activeFolder);
      if (!targetName) {
        throw new BridgeError("INVALID_REQUEST", "Thiếu tên thư mục khách để truy xuất Sheet.");
      }

      const requestedTabs: string[] = Array.isArray(params.tabTitles)
        ? params.tabTitles.filter(
            (t): t is string => typeof t === "string" && t.trim().length > 0
          )
        : [];
      const tabsToSearch =
        requestedTabs.length > 0
          ? requestedTabs
          : resolveCheckedTabs(
              readSavedExtractTabs(),
              Object.keys(profile.tabConfigurations || {}),
              profile.selectedTabTitle || ""
            );
      if (tabsToSearch.length === 0) {
        throw new BridgeError("NO_TABS_SELECTED", "Vui lòng chọn ít nhất một tab để truy xuất.");
      }

      writeSavedExtractTabs(tabsToSearch);

      const forceFresh = Boolean(params.forceFresh);
      const tabsKey = tabsToSearch.join("\u0001");
      let loadedTabRows: TabRows[] = [];
      const failedTabs: string[] = [];

      if (
        !forceFresh &&
        lastSheetTabRowsCache &&
        lastSheetTabRowsCache.spreadsheetId === profile.spreadsheetId &&
        lastSheetTabRowsCache.tabsKey === tabsKey
      ) {
        loadedTabRows = lastSheetTabRowsCache.tabRows;
      } else {
        onProgress?.(20, 100, `Đang tải dữ liệu ${tabsToSearch.length} tab Google Sheet...`);
        if (!isSandbox) {
          try {
            await googleCredentialManager.getValidAccessToken();
          } catch {
            // let individual calls surface auth errors cleanly
          }
        }

        const settled = await Promise.allSettled(
          tabsToSearch.map(async (tabTitle) => {
            const rows = await sheetDiscoveryService.fetchSheetRowsForMatching(
              profile.spreadsheetId,
              tabTitle,
              getTabStartRow(profile, tabTitle),
              undefined,
              isSandbox
            );
            return { tabTitle, rows };
          })
        );

        let firstError = "";
        for (let i = 0; i < settled.length; i++) {
          const item = settled[i];
          if (item.status === "fulfilled") {
            loadedTabRows.push(item.value);
          } else {
            failedTabs.push(tabsToSearch[i]);
            if (!firstError) {
              firstError = item.reason?.message || String(item.reason);
            }
          }
        }

        if (loadedTabRows.length === 0 && failedTabs.length > 0) {
          throw new BridgeError(
            "INTERNAL_ERROR",
            `Không tải được dữ liệu từ Tab: ${failedTabs.join(", ")}. ${firstError}`
          );
        }

        lastSheetTabRowsCache = {
          spreadsheetId: profile.spreadsheetId,
          tabsKey,
          tabRows: loadedTabRows,
        };
      }

      onProgress?.(80, 100, "Đang đối chiếu dòng khách hàng...");

      const completedStatusValue =
        profile.valueMappings?.find((v) => v.semanticRole === "PHOTO_PICK_STATUS_COMPLETED")
          ?.sheetValue || "Đã lọc";

      let preferredRow: PreferredRow | null = null;
      if (
        params.preferredRow &&
        typeof params.preferredRow === "object" &&
        typeof params.preferredRow.tabTitle === "string" &&
        typeof params.preferredRow.row === "number"
      ) {
        preferredRow = {
          tabTitle: params.preferredRow.tabTitle,
          row: params.preferredRow.row,
        };
      }

      const extraction = extractCodesAcrossTabs(
        targetName,
        activeFolder,
        loadedTabRows,
        profile,
        completedStatusValue,
        preferredRow
      );
      lastSheetExtractionCache = extraction;

      // Auto-select columns containing codes (identical to SheetCodeExtractorModal)
      let defaultSelectedColumns: string[] = [];
      const nonEmptyCols = extraction.candidateColumns.filter((c) => c.codeCount > 0);
      if (nonEmptyCols.length > 0) {
        defaultSelectedColumns = nonEmptyCols.map((c) => c.columnLetter);
      } else if (extraction.candidateColumns.length > 0) {
        const primary =
          extraction.candidateColumns.find((c) => c.isPrimary) || extraction.candidateColumns[0];
        defaultSelectedColumns = [primary.columnLetter];
      }

      const matchedTab =
        extraction.matchedTabTitle || tabsToSearch[0] || profile.selectedTabTitle || "";
      const statusMapping = getTabStatusMapping(profile, matchedTab);
      const statusColumnLetter =
        statusMapping && statusMapping.permission !== "IGNORE" && statusMapping.columnLetter !== "NONE"
          ? statusMapping.columnLetter
          : undefined;
      const statusColumnWritable = Boolean(
        statusMapping &&
          statusMapping.permission === "READ_WRITE" &&
          statusMapping.columnLetter !== "NONE"
      );

      onProgress?.(100, 100, "Đã hoàn tất truy xuất.");

      const response: PhotoPickerBridgeSheetExtractResult = {
        status: extraction.status,
        matchedRow: extraction.matchedRow,
        matchedTabTitle: extraction.matchedTabTitle,
        customerName: extraction.customerName,
        jobFolderName: extraction.jobFolderName,
        confidence: extraction.confidence,
        reason: extraction.reason,
        candidateColumns: extraction.candidateColumns,
        defaultSelectedColumns,
        candidateRows: extraction.candidateRows || [],
        sameFileRows: extraction.sameFileRows || [],
        searchedTabs: extraction.searchedTabs,
        failedTabs,
        totalLoadedRows: loadedTabRows.reduce((sum, t) => sum + t.rows.length, 0),
        statusColumnLetter,
        statusColumnWritable,
        completedStatusValue,
      };
      return response;
    }

    case "photo_picker.sheet_apply_codes": {
      assertPhotoPickerAccess();
      const profile = getActiveSheetProfile();
      const store = useAppStore.getState();

      const columnLetters: string[] = Array.isArray(params.columnLetters)
        ? params.columnLetters.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        : [];
      const sourceColumns: ExtractedCodeColumn[] = Array.isArray(params.candidateColumns)
        ? params.candidateColumns
        : lastSheetExtractionCache?.candidateColumns || [];

      const pickedColumns =
        columnLetters.length > 0
          ? sourceColumns.filter((c) => columnLetters.includes(c.columnLetter))
          : sourceColumns.filter((c) => c.codeCount > 0);

      const formatted = sheetExtractorService.formatExtractedCodes(pickedColumns);
      if (!formatted.trim()) {
        throw new BridgeError("INVALID_REQUEST", "Các cột đã chọn không có mã ảnh nào.");
      }

      const insertMode = params.mode === "append" ? "append" : "replace";
      const nextRaw =
        insertMode === "append" && store.rawCodeInput.trim()
          ? `${store.rawCodeInput.trimEnd()}\n${formatted}`
          : formatted;

      store.setRawCodeInput(nextRaw);

      const updateStatusOnCopy = params.updateStatusOnCopy !== false;
      const matchedRow =
        typeof params.matchedRow === "number"
          ? params.matchedRow
          : lastSheetExtractionCache?.matchedRow;
      const tabTitle =
        (typeof params.tabTitle === "string" && params.tabTitle.trim()) ||
        lastSheetExtractionCache?.matchedTabTitle ||
        profile?.selectedTabTitle ||
        "";

      if (updateStatusOnCopy && profile && matchedRow && tabTitle) {
        const statusMapping = getTabStatusMapping(profile, tabTitle);
        const completedStatusValue =
          (typeof params.statusValue === "string" && params.statusValue.trim()) ||
          profile.valueMappings?.find((v) => v.semanticRole === "PHOTO_PICK_STATUS_COMPLETED")
            ?.sheetValue ||
          "Đã lọc";
        const activeFolder = store.selectedInputFolders[0] || store.inputFolders[0] || "";
        store.setSheetFilterContext({
          profileId: profile.id,
          spreadsheetId: profile.spreadsheetId,
          tabTitle,
          matchedRow,
          jobName: lastSheetExtractionCache?.jobFolderName || folderBaseName(activeFolder),
          folderName: folderBaseName(activeFolder),
          statusColumnLetter:
            (typeof params.statusColumnLetter === "string" && params.statusColumnLetter.trim()) ||
            statusMapping?.columnLetter,
          statusValue: completedStatusValue,
          autoUpdateOnFilterComplete: true,
        });
      } else if (!updateStatusOnCopy) {
        store.setSheetFilterContext(null);
      }

      const runtime = await getRuntime();
      await parseAndRematchInMemory(runtime);
      return buildPhotoPickerContext();
    }

    case "photo_picker.copy": {
      assertPhotoPickerAccess();
      const store = useAppStore.getState();
      if (store.phase === "scanning" || store.phase === "copying") {
        throw new BridgeError("BUSY", "DH Studio Pro đang bận xử lý một tác vụ khác.");
      }
      if (!store.matchResult || store.matchResult.found_count === 0) {
        throw new BridgeError("INVALID_REQUEST", "Chưa có ảnh khớp nào để sao chép.");
      }

      const outputMode: OutputMode =
        params.outputMode === "SameAsOriginal" || params.outputMode === "Folder"
          ? params.outputMode
          : store.outputMode;
      const outputFolder =
        typeof params.outputFolder === "string" && params.outputFolder.trim()
          ? params.outputFolder.trim()
          : store.outputFolder || useSettingsStore.getState().settings.default_output || "";

      if (outputMode === "Folder" && !outputFolder) {
        throw new BridgeError("INVALID_REQUEST", "Vui lòng chọn thư mục đầu ra trước khi sao chép.");
      }

      const effectiveFolders =
        store.selectedInputFolders.length > 0 ? [store.selectedInputFolders[0]] : store.inputFolders.slice(0, 1);
      const operation = params.operation === "Move" ? "Move" : "Copy";
      const runtime = await getRuntime();
      let unlistenCopy: (() => void) | null = null;

      try {
        store.setPhase("copying");
        store.setProgress(null);
        store.setSheetUpdateStatus(null);
        onProgress?.(0, store.matchResult.found_count, "Đang bắt đầu sao chép ảnh...");

        unlistenCopy = await runtime.listen<ProgressEvent>("copy-progress", (event) => {
          const ev = event.payload;
          useAppStore.getState().setProgress(ev);
          const total = Math.max(1, ev.total || 100);
          const current = Math.max(0, Math.min(total, ev.current || 0));
          onProgress?.(current, total, formatProgressMessage("Đang sao chép ảnh...", ev));
        });

        const options: CopyOptions = {
          operation,
          output_mode: outputMode,
          output_folder: outputMode === "Folder" ? outputFolder : "",
          duplicate_policy: "CopyFirst",
          folder_structure: "Flat",
          prefix: null,
          suffix: null,
          input_folders: effectiveFolders,
        };

        const result = await runtime.invoke<CopyResult>("copy_files", {
          matches: store.matchResult.matches,
          options,
        });

        unlistenCopy();
        unlistenCopy = null;

        const postStore = useAppStore.getState();
        postStore.setCopyResult(result);
        postStore.setProgress(null);
        postStore.setPhase("done");

        const shouldUpdateSheet = params.updateSheetStatus !== false;
        const completedSheetCtx = postStore.sheetFilterContext;
        if (
          shouldUpdateSheet &&
          (result.success_count > 0 || result.skipped_count > 0) &&
          (completedSheetCtx || (getActiveSheetProfile() && googleCredentialManager.isConnected()))
        ) {
          onProgress?.(
            result.success_count,
            Math.max(1, result.success_count),
            "Đang cập nhật trạng thái trên Google Sheet..."
          );
          try {
            await sheetFilterAutomationService.updateStatusOnFilterComplete(
              effectiveFolders,
              result,
              completedSheetCtx
            );
          } catch (sheetErr) {
            console.warn("[DH Bridge] Photo Picker sheet status update error:", sheetErr);
          }
        }

        const finalCtx = buildPhotoPickerContext();
        let destinationFolder = "";
        if (outputMode === "Folder" && outputFolder) {
          const base = outputFolder.replace(/[/\\]+$/, "");
          destinationFolder = finalCtx.folderName ? `${base}/${finalCtx.folderName}` : base;
        } else {
          const firstFound = store.matchResult.matches.find((m) => m.status === "Found" && m.photo);
          const srcDir = firstFound?.photo?.folder || effectiveFolders[0] || "";
          destinationFolder = srcDir ? `${srcDir.replace(/[/\\]+$/, "")}/Selects` : "";
        }
        return {
          copyResult: result,
          sheetUpdateStatus: finalCtx.sheetUpdateStatus,
          destinationFolder,
          context: finalCtx,
        };
      } catch (err: any) {
        useAppStore.getState().setPhase("matched");
        useAppStore.getState().setProgress(null);
        if (err instanceof BridgeError) throw err;
        throw new BridgeError("INTERNAL_ERROR", err?.message || String(err));
      } finally {
        if (unlistenCopy) unlistenCopy();
      }
    }

    case "photo_picker.retry_sheet_status": {
      assertPhotoPickerAccess();
      const store = useAppStore.getState();
      const effectiveFolders =
        store.selectedInputFolders.length > 0 ? [store.selectedInputFolders[0]] : store.inputFolders.slice(0, 1);
      await sheetFilterAutomationService.updateStatusOnFilterComplete(
        effectiveFolders,
        store.copyResult
      );
      return {
        sheetUpdateStatus: useAppStore.getState().sheetUpdateStatus,
      };
    }

    case "photo_picker.export_report": {
      assertPhotoPickerAccess();
      const store = useAppStore.getState();
      if (!store.matchResult) {
        throw new BridgeError("INVALID_REQUEST", "Chưa có kết quả khớp để xuất báo cáo.");
      }
      const format = params.format === "csv" ? "csv" : params.format === "json" ? "json" : "txt";
      const outputPath = typeof params.outputPath === "string" ? params.outputPath.trim() : "";
      if (!outputPath) {
        throw new BridgeError("INVALID_REQUEST", "Thiếu đường dẫn xuất báo cáo (outputPath).");
      }
      const runtime = await getRuntime();
      await runtime.invoke("export_log", {
        result: store.matchResult,
        format,
        outputPath,
      });
      return { outputPath };
    }

    default:
      throw new BridgeError("UNKNOWN_ACTION", `Action không được hỗ trợ: ${action}`);
  }
}
