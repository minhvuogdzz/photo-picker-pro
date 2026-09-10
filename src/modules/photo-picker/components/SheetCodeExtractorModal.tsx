import React, { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  X,
  Check,
  Search,
  Folder,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layers,
  LogIn,
  Settings2,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Save,
  CheckSquare,
  Square,
  ArrowRight,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAppStore } from "@/core/stores/useAppStore";
import { useContactSheetStore } from "@/modules/contact-the-sheet/stores/useContactSheetStore";
import { googleCredentialManager } from "@/modules/contact-the-sheet/services/googleCredentialBridge";
import { sheetDiscoveryService } from "@/modules/contact-the-sheet/services/sheetDiscoveryService";
import {
  sheetExtractorService,
  type ExtractedCodeColumn,
  type SheetExtractionResult,
} from "@/modules/contact-the-sheet/services/sheetExtractorService";
import { sheetUpdateService } from "@/modules/contact-the-sheet/services/sheetUpdateService";
import type { SheetRowRecord } from "@/modules/contact-the-sheet/services/jobMatchingService";
import type {
  FieldMapping,
  TabConfiguration,
  WritePolicy,
  FieldPermission,
  SemanticField,
  WorkspaceProfile,
} from "@/modules/contact-the-sheet/types/index";
import { getFolderName } from "@/core/lib/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "extract" | "config";
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

const STANDARD_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
  "U", "V", "W", "X", "Y", "Z"
];

export function SheetCodeExtractorModal({ isOpen, onClose, initialTab = "extract" }: Props) {
  const inputFolders = useAppStore((s) => s.inputFolders);
  const rawCodeInput = useAppStore((s) => s.rawCodeInput);
  const setRawCodeInput = useAppStore((s) => s.setRawCodeInput);
  const setSheetFilterContext = useAppStore((s) => s.setSheetFilterContext);

  const profiles = useContactSheetStore((s) => s.profiles);
  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const setActiveProfile = useContactSheetStore((s) => s.setActiveProfile);
  const switchActiveTab = useContactSheetStore((s) => s.switchActiveTab);
  const saveTabConfiguration = useContactSheetStore((s) => s.saveTabConfiguration);
  const saveProfile = useContactSheetStore((s) => s.saveProfile);
  const googleConnection = useContactSheetStore((s) => s.googleConnection);

  // Active top-level modal tab: 'extract' | 'config'
  const [modalTab, setModalTab] = useState<"extract" | "config">(initialTab);

  // Available sheet tabs
  const [availableTabs, setAvailableTabs] = useState<string[]>(DEFAULT_TABS);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);

  // Selected folder to extract from
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [customFolderName, setCustomFolderName] = useState<string>("");
  const [useCustomFolder, setUseCustomFolder] = useState<boolean>(false);

  // Sheet data & matching state (Tab 1: Extract)
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [sheetRows, setSheetRows] = useState<SheetRowRecord[]>([]);
  const [extractionResult, setExtractionResult] = useState<SheetExtractionResult | null>(null);
  const [selectedColumnLetters, setSelectedColumnLetters] = useState<Set<string>>(new Set());
  const [insertMode, setInsertMode] = useState<"replace" | "append">("replace");
  const [updateFilterStatus, setUpdateFilterStatus] = useState<boolean>(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // Tab 2: Config form state
  const [configTabTitle, setConfigTabTitle] = useState<string>("");
  const [configHeaderRow, setConfigHeaderRow] = useState<number>(4);
  const [configStartRow, setConfigStartRow] = useState<number>(5);
  const [configJobFolderCol, setConfigJobFolderCol] = useState<string>("H");
  const [configCodeCol1, setConfigCodeCol1] = useState<string>("I");
  const [configCodeCol2, setConfigCodeCol2] = useState<string>("J");
  const [configCodeCol2Permission, setConfigCodeCol2Permission] = useState<FieldPermission>("READ_ONLY");
  const [configStatusCol, setConfigStatusCol] = useState<string>("G");
  const [configStatusPermission, setConfigStatusPermission] = useState<FieldPermission>("READ_WRITE");
  const [configStatusValue, setConfigStatusValue] = useState<string>("Đã lọc");
  const [configStatusWritePolicy, setConfigStatusWritePolicy] = useState<WritePolicy>("SET_IF_EMPTY");
  const [isScanningTabColumns, setIsScanningTabColumns] = useState(false);
  const [scannedColumns, setScannedColumns] = useState<Array<{ letter: string; header: string }>>([]);
  const [configSavedSuccess, setConfigSavedSuccess] = useState(false);

  // Current effective profile
  const profile = useMemo(() => {
    return activeProfile || profiles[0] || null;
  }, [activeProfile, profiles]);

  // Current target folder name
  const targetFolderName = useMemo(() => {
    if (useCustomFolder) {
      return customFolderName.trim();
    }
    return getFolderName(selectedFolder) || selectedFolder;
  }, [useCustomFolder, customFolderName, selectedFolder]);

  // Determine current active tab
  const currentTabTitle = useMemo(() => {
    return profile?.selectedTabTitle || "Edit 9/2026";
  }, [profile?.selectedTabTitle]);

  // Active tab's specific configuration
  const activeTabConfig = useMemo(() => {
    return profile?.tabConfigurations?.[currentTabTitle] || null;
  }, [profile?.tabConfigurations, currentTabTitle]);

  // Effective profile merged with active tab configuration
  const effectiveProfile = useMemo(() => {
    if (!profile) return null;
    if (!activeTabConfig) return profile;
    return {
      ...profile,
      selectedTabTitle: currentTabTitle,
      selectedTabId: activeTabConfig.sheetId,
      headerRow: activeTabConfig.headerRow,
      rowScope: activeTabConfig.rowScope,
      fieldMappings: activeTabConfig.fieldMappings,
    };
  }, [profile, activeTabConfig, currentTabTitle]);

  // Check if status column is configured for READ_WRITE
  const statusMapping = useMemo(() => {
    if (!effectiveProfile) return null;
    return effectiveProfile.fieldMappings.find((m) => m.semanticField === "PHOTO_PICK_STATUS") || null;
  }, [effectiveProfile?.fieldMappings]);

  const configuredStatusValue = useMemo(() => {
    return (
      profile?.valueMappings?.find((v) => v.semanticRole === "PHOTO_PICK_STATUS_COMPLETED")?.sheetValue ||
      "Đã lọc"
    );
  }, [profile?.valueMappings]);

  // Initialize modal state on open
  useEffect(() => {
    if (isOpen) {
      setModalTab(initialTab);
      if (inputFolders.length > 0) {
        setSelectedFolder(inputFolders[0]);
        setUseCustomFolder(false);
      } else {
        setUseCustomFolder(true);
      }
      setErrorMessage(null);

      // Load config defaults from current profile
      if (profile) {
        const activeTab = profile.selectedTabTitle || "Edit 9/2026";
        setConfigTabTitle(activeTab);
        loadTabConfigIntoForm(activeTab);
      }

      // Refresh metadata tabs if connected
      fetchSheetTabsMetadata();
    }
  }, [isOpen, initialTab, inputFolders, profile?.id]);

  // Fetch real sheet tabs from Google Sheets API
  const fetchSheetTabsMetadata = async () => {
    if (!profile || profile.isMockSandbox) return;
    try {
      setIsLoadingMetadata(true);
      const meta = await sheetDiscoveryService.fetchSpreadsheetMetadata(profile.spreadsheetId, false);
      if (meta && meta.tabs && meta.tabs.length > 0) {
        const tabTitles = meta.tabs.map((t) => t.title);
        setAvailableTabs(tabTitles);
      }
    } catch (err) {
      console.warn("Could not fetch remote tabs metadata, falling back to defaults:", err);
      // Fallback: merge saved tabConfigurations
      const saved = Object.keys(profile.tabConfigurations || {});
      const merged = Array.from(new Set([...saved, ...DEFAULT_TABS]));
      setAvailableTabs(merged);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  // Populate config form when selecting a tab to configure
  const loadTabConfigIntoForm = (tabName: string) => {
    if (!profile) return;
    const tabConfig = profile.tabConfigurations?.[tabName];

    if (tabConfig) {
      setConfigHeaderRow(tabConfig.headerRow);
      setConfigStartRow(tabConfig.rowScope?.startRow || tabConfig.headerRow + 1);

      const job = tabConfig.fieldMappings.find((m) => m.semanticField === "JOB_FOLDER_NAME");
      if (job) setConfigJobFolderCol(job.columnLetter);

      const c1 = tabConfig.fieldMappings.find((m) => m.semanticField === "SELECTED_IMAGE_CODES_PRIMARY");
      if (c1) setConfigCodeCol1(c1.columnLetter);

      const c2 = tabConfig.fieldMappings.find((m) => m.semanticField === "SELECTED_IMAGE_CODES_SECONDARY");
      setConfigCodeCol2(c2 && c2.permission !== "IGNORE" ? c2.columnLetter : (c2?.columnLetter || "NONE"));
      setConfigCodeCol2Permission(c2?.permission === "IGNORE" ? "IGNORE" : "READ_ONLY");

      const st = tabConfig.fieldMappings.find((m) => m.semanticField === "PHOTO_PICK_STATUS");
      if (st) {
        setConfigStatusCol(st.permission !== "IGNORE" ? st.columnLetter : "NONE");
        setConfigStatusPermission(st.permission !== "IGNORE" ? st.permission : "READ_WRITE");
        setConfigStatusWritePolicy(st.writePolicy);
      }
    } else {
      // Fallback to activeProfile mappings or defaults
      const job = profile.fieldMappings.find((m) => m.semanticField === "JOB_FOLDER_NAME");
      setConfigJobFolderCol(job?.columnLetter || "H");

      const c1 = profile.fieldMappings.find((m) => m.semanticField === "SELECTED_IMAGE_CODES_PRIMARY");
      setConfigCodeCol1(c1?.columnLetter || "I");

      const c2 = profile.fieldMappings.find((m) => m.semanticField === "SELECTED_IMAGE_CODES_SECONDARY");
      setConfigCodeCol2(c2 && c2.permission !== "IGNORE" ? c2.columnLetter : "J");
      setConfigCodeCol2Permission(c2?.permission === "IGNORE" ? "IGNORE" : "READ_ONLY");

      const st = profile.fieldMappings.find((m) => m.semanticField === "PHOTO_PICK_STATUS");
      setConfigStatusCol(st && st.permission !== "IGNORE" ? st.columnLetter : "G");
      setConfigStatusPermission(st?.permission && st.permission !== "IGNORE" ? st.permission : "READ_WRITE");
      setConfigStatusWritePolicy(st?.writePolicy || "SET_IF_EMPTY");
      setConfigHeaderRow(profile.headerRow || 4);
      setConfigStartRow(profile.rowScope?.startRow || 5);
    }

    const stVal = profile.valueMappings?.find((v) => v.semanticRole === "PHOTO_PICK_STATUS_COMPLETED");
    setConfigStatusValue(stVal?.sheetValue || "Đã lọc");
  };

  // Switch tab in Tab 1 (Extract)
  const handleQuickSwitchTab = async (newTabTitle: string) => {
    if (!profile) return;
    switchActiveTab(newTabTitle);
    setSheetRows([]);
    setExtractionResult(null);
    setSelectedColumnLetters(new Set());

    // Automatically reload rows for this tab and run extraction
    try {
      setIsLoadingRows(true);
      const rows = await sheetDiscoveryService.fetchSheetRowsForMatching(
        profile.spreadsheetId,
        newTabTitle,
        profile.rowScope?.startRow || 4,
        1500,
        profile.isMockSandbox
      );
      setSheetRows(rows);
      if (targetFolderName) {
        runExtractionWithRows(rows, newTabTitle);
      }
    } catch (err: any) {
      console.error("Failed to switch and load tab rows:", err);
      setErrorMessage(err.message || String(err));
    } finally {
      setIsLoadingRows(false);
    }
  };

  // Load sheet rows
  const loadRows = async (tabToLoad?: string) => {
    if (!profile) return [];
    setIsLoadingRows(true);
    setErrorMessage(null);
    const tabName = tabToLoad || currentTabTitle;
    try {
      const rows = await sheetDiscoveryService.fetchSheetRowsForMatching(
        profile.spreadsheetId,
        tabName,
        profile.rowScope?.startRow || 4,
        1500,
        profile.isMockSandbox
      );
      setSheetRows(rows);
      return rows;
    } catch (err: any) {
      console.error("Failed to load sheet rows:", err);
      setErrorMessage(err.message || String(err));
      return [];
    } finally {
      setIsLoadingRows(false);
    }
  };

  // Run extraction matching with specific rows
  const runExtractionWithRows = (rows: SheetRowRecord[], _tabName?: string) => {
    if (!profile || !targetFolderName) return;

    try {
      const activeProf = effectiveProfile || profile;
      const result = sheetExtractorService.extractCodesForFolder(
        targetFolderName,
        selectedFolder,
        rows,
        activeProf
      );

      setExtractionResult(result);

      // Default checked columns: select primary column if it has codes, or first column with codes
      const defaultCols = new Set<string>();
      if (result.candidateColumns.length > 0) {
        const primary = result.candidateColumns.find((c) => c.isPrimary && c.codeCount > 0);
        if (primary) {
          defaultCols.add(primary.columnLetter);
        } else {
          const firstWithCodes = result.candidateColumns.find((c) => c.codeCount > 0);
          if (firstWithCodes) {
            defaultCols.add(firstWithCodes.columnLetter);
          } else {
            // Default to primary even if empty so user can see it
            defaultCols.add(result.candidateColumns[0].columnLetter);
          }
        }
      }
      setSelectedColumnLetters(defaultCols);
    } catch (err: any) {
      console.error("Extraction error:", err);
      setErrorMessage(err.message || String(err));
    }
  };

  // Run extraction matching
  const runExtraction = async () => {
    if (!profile) {
      setErrorMessage("Chưa cấu hình hồ sơ Google Sheet. Vui lòng kiểm tra lại cấu hình.");
      return;
    }

    if (!targetFolderName) {
      setErrorMessage("Vui lòng nhập hoặc chọn một thư mục ảnh đầu vào để đối chiếu.");
      return;
    }

    let rows = sheetRows;
    if (rows.length === 0) {
      rows = await loadRows();
      if (rows.length === 0) return;
    }

    runExtractionWithRows(rows, currentTabTitle);
  };

  // Auto-run search when opened or folder changes
  useEffect(() => {
    if (isOpen && profile && targetFolderName && modalTab === "extract") {
      runExtraction();
    }
  }, [isOpen, profile?.id, currentTabTitle, targetFolderName, modalTab]);

  // Handle picking custom folder from disk
  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Chọn thư mục chụp cần lấy mã ảnh",
      });
      if (selected && typeof selected === "string") {
        setSelectedFolder(selected);
        setCustomFolderName(getFolderName(selected));
        setUseCustomFolder(false);
      }
    } catch (err) {
      console.error("Open directory error:", err);
    }
  };

  // Handle Google OAuth login
  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    setErrorMessage(null);
    try {
      await googleCredentialManager.connectGoogle();
      await fetchSheetTabsMetadata();
      await loadRows();
    } catch (err: any) {
      setErrorMessage(`Lỗi kết nối Google: ${err.message || err}`);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  // Toggle column selection checkbox
  const handleToggleColumn = (letter: string) => {
    const next = new Set(selectedColumnLetters);
    if (next.has(letter)) {
      next.delete(letter);
    } else {
      next.add(letter);
    }
    setSelectedColumnLetters(next);
  };

  // Calculate selected columns and code items
  const activeSelectedColumns = useMemo(() => {
    if (!extractionResult) return [];
    return extractionResult.candidateColumns.filter((c) => selectedColumnLetters.has(c.columnLetter));
  }, [extractionResult, selectedColumnLetters]);

  const formattedCodePreview = useMemo(() => {
    if (activeSelectedColumns.length === 0) return "";
    return sheetExtractorService.formatExtractedCodes(activeSelectedColumns);
  }, [activeSelectedColumns]);

  const totalCodesCount = useMemo(() => {
    if (!formattedCodePreview) return 0;
    return formattedCodePreview.split("\n").filter(Boolean).length;
  }, [formattedCodePreview]);

  // Apply codes to main input and optionally update status on Sheet
  const handleApplyCodes = () => {
    if (!formattedCodePreview) return;

    // 1. Set codes into Photo Picker
    if (insertMode === "append" && rawCodeInput.trim()) {
      setRawCodeInput(rawCodeInput.trim() + "\n" + formattedCodePreview);
    } else {
      setRawCodeInput(formattedCodePreview);
    }

    // 2. Remember sheet filter context so that when user clicks "Lọc file" and the operation completes,
    // the app automatically updates the status on Google Sheet!
    if (profile && extractionResult?.matchedRow) {
      setSheetFilterContext({
        profileId: profile.id,
        spreadsheetId: profile.spreadsheetId,
        tabTitle: currentTabTitle,
        matchedRow: extractionResult.matchedRow,
        jobName: extractionResult.jobFolderName,
        folderName: targetFolderName,
        statusColumnLetter: statusMapping?.columnLetter,
        statusValue: configuredStatusValue,
        autoUpdateOnFilterComplete: updateFilterStatus,
      });
      console.log(
        `[SheetCodeExtractor] Saved sheet filter context for Row ${extractionResult.matchedRow}, tab "${currentTabTitle}", status: "${configuredStatusValue}"`
      );
    }

    // 3. Immediately close modal so user can work in Photo Picker without waiting
    onClose();
  };

  // Tab 2: Scan headers from target tab
  const handleScanTabStructure = async () => {
    if (!profile) return;
    setIsScanningTabColumns(true);
    setErrorMessage(null);
    try {
      const tabInfo = {
        sheetId: profile.selectedTabId,
        title: configTabTitle || currentTabTitle,
        index: 0,
        rowCount: 1000,
        columnCount: 26,
        hidden: false,
      };

      const analysis = await sheetDiscoveryService.analyzeTabSchema(
        profile.spreadsheetId,
        tabInfo,
        30,
        profile.isMockSandbox
      );

      if (analysis.columns && analysis.columns.length > 0) {
        const mapped = analysis.columns.map((c) => ({
          letter: c.letter,
          header: c.headerName || `Cột ${c.letter}`,
        }));
        setScannedColumns(mapped);
      }

      if (analysis.detectedHeaderRow) {
        setConfigHeaderRow(analysis.detectedHeaderRow);
        setConfigStartRow(analysis.detectedHeaderRow + 1);
      }
    } catch (err: any) {
      console.warn("Failed to scan tab structure, falling back to profile mappings:", err);
      // Fallback to active profile mappings
      const fromMappings = profile.fieldMappings.map((m) => ({
        letter: m.columnLetter,
        header: m.columnHeader || `Cột ${m.columnLetter}`,
      }));
      setScannedColumns(fromMappings);
    } finally {
      setIsScanningTabColumns(false);
    }
  };

  // Tab 2: Available column choices - all A-Z columns enriched with detected or mapped headers
  const displayColumnsList = useMemo(() => {
    const headerMap = new Map<string, string>();
    (profile?.fieldMappings || []).forEach((m) => {
      if (m.columnHeader) headerMap.set(m.columnLetter, m.columnHeader);
    });
    scannedColumns.forEach((c) => {
      if (c.header) headerMap.set(c.letter, c.header);
    });

    return STANDARD_LETTERS.map((letter) => ({
      letter,
      header: headerMap.get(letter) || `Cột ${letter}`,
    }));
  }, [scannedColumns, profile?.fieldMappings]);

  // Tab 2: Save configuration for selected tab
  const handleSaveTabConfig = () => {
    const baseProfile = activeProfile || profiles[0];
    if (!baseProfile) return;

    // Build or clone tab mappings
    const currentTabConfig = baseProfile.tabConfigurations?.[configTabTitle];
    const baseMappings: FieldMapping[] = (
      currentTabConfig?.fieldMappings || baseProfile.fieldMappings || []
    ).map((m) => ({ ...m }));

    const upsertField = (
      semanticField: SemanticField,
      letter: string,
      defaultHeader: string,
      permission: FieldPermission,
      writePolicy: WritePolicy
    ) => {
      const idx = baseMappings.findIndex((m) => m.semanticField === semanticField);
      if (!letter || letter === "NONE") {
        if (idx >= 0) {
          baseMappings[idx].permission = "IGNORE";
        }
        return;
      }

      const colIdx = letter.toUpperCase().charCodeAt(0) - 65;
      const colHeader = displayColumnsList.find((c) => c.letter === letter)?.header || defaultHeader;

      if (idx >= 0) {
        baseMappings[idx].columnLetter = letter.toUpperCase();
        baseMappings[idx].columnIndex = colIdx;
        baseMappings[idx].columnHeader = colHeader;
        baseMappings[idx].permission = permission;
        baseMappings[idx].writePolicy = writePolicy;
      } else {
        baseMappings.push({
          semanticField,
          columnLetter: letter.toUpperCase(),
          columnIndex: colIdx,
          columnHeader: colHeader,
          permission,
          isFormulaDerived: false,
          writePolicy,
        });
      }
    };

    // 1. Tên file (H - Tên file)
    upsertField("JOB_FOLDER_NAME", configJobFolderCol, "Tên file", "READ_ONLY", "SET_IF_EMPTY");

    // 2. Mã ảnh chọn (1) (I - Mã ảnh chọn (1))
    upsertField("SELECTED_IMAGE_CODES_PRIMARY", configCodeCol1, "Mã ảnh chọn (1)", "READ_ONLY", "SET_IF_EMPTY");

    // 3. Mã ảnh chọn (2) (J - Mã ảnh chọn (2))
    upsertField(
      "SELECTED_IMAGE_CODES_SECONDARY",
      configCodeCol2,
      "Mã ảnh chọn (2)",
      configCodeCol2 === "NONE" || configCodeCol2Permission === "IGNORE" ? "IGNORE" : "READ_ONLY",
      "SET_IF_EMPTY"
    );

    // 4. Trạng thái lọc (G - Trạng Thái 1)
    upsertField(
      "PHOTO_PICK_STATUS",
      configStatusCol,
      "Trạng Thái 1",
      configStatusCol === "NONE" ? "IGNORE" : configStatusPermission,
      configStatusWritePolicy
    );

    const tabConfig: TabConfiguration = {
      sheetId: baseProfile.selectedTabId,
      tabTitle: configTabTitle,
      headerRow: configHeaderRow,
      rowScope: {
        startRow: configStartRow,
        ignoreEmptyRows: true,
      },
      fieldMappings: baseMappings,
      schemaFingerprint: `fp_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };

    const existingConfigs = baseProfile.tabConfigurations || {};
    const updatedConfigs = {
      ...existingConfigs,
      [configTabTitle]: tabConfig,
    };

    const isCurrentTab = baseProfile.selectedTabTitle === configTabTitle;
    const existingValues = baseProfile.valueMappings || [];
    const updatedValues = [
      ...existingValues.filter((v) => v.semanticRole !== "PHOTO_PICK_STATUS_COMPLETED"),
      ...(configStatusValue.trim()
        ? [
            {
              semanticRole: "PHOTO_PICK_STATUS_COMPLETED" as const,
              sheetValue: configStatusValue.trim(),
            },
          ]
        : []),
    ];

    const updatedProfile: WorkspaceProfile = {
      ...baseProfile,
      tabConfigurations: updatedConfigs,
      valueMappings: updatedValues,
      ...(isCurrentTab
        ? {
            selectedTabTitle: configTabTitle,
            selectedTabId: tabConfig.sheetId,
            headerRow: tabConfig.headerRow,
            fieldMappings: tabConfig.fieldMappings,
            rowScope: tabConfig.rowScope,
            schemaFingerprint: tabConfig.schemaFingerprint,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    // Save atomically so tabConfigurations and fieldMappings are preserved together!
    saveProfile(updatedProfile);

    setConfigSavedSuccess(true);
    setTimeout(() => setConfigSavedSuccess(false), 3500);
  };

  if (!isOpen) return null;

  const isConnected = googleConnection.status === "CONNECTED" || profile?.isMockSandbox;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-card border border-border/80 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden h-[82vh] max-h-[720px] min-h-[480px] my-auto">
        {/* Header with Navigation Tabs */}
        <div className="shrink-0 px-5 py-3.5 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Kết nối & Truy xuất Google Sheet
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Lọc ảnh Studio
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Tự động lấy mã chọn từ Google Sheet dựa theo tên thư mục ảnh
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Tab Switcher: [ ⚡ Truy xuất mã ] and [ ⚙️ Cấu hình Sheet & Cột ] */}
        <div className="shrink-0 px-5 pt-2.5 pb-0 bg-muted/10 border-b border-border/40 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalTab("extract")}
            className={`px-3.5 py-1.5 rounded-t-lg text-xs font-medium flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              modalTab === "extract"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-background font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Sparkles size={13} className={modalTab === "extract" ? "text-emerald-500" : ""} />
            <span>⚡ Truy xuất mã chọn</span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab("config")}
            className={`px-3.5 py-1.5 rounded-t-lg text-xs font-medium flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              modalTab === "config"
                ? "border-primary text-primary bg-background font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <Settings2 size={13} className={modalTab === "config" ? "text-primary" : ""} />
            <span>⚙️ Cấu hình Sheet & Cột</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Connection status banner */}
          {!isConnected && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertCircle size={16} className="shrink-0" />
                <span>Chưa kết nối tài khoản Google Sheet để đọc dữ liệu.</span>
              </div>
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={isConnectingGoogle}
                className="px-3 py-1 bg-amber-500 text-white rounded-md text-xs font-medium hover:bg-amber-600 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isConnectingGoogle ? <RefreshCw size={12} className="animate-spin" /> : <LogIn size={12} />}
                Kết nối Google
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-destructive/10 border border-destructive/25 text-destructive rounded-lg flex items-start gap-2 text-xs">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed whitespace-pre-wrap">{errorMessage}</div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: TRUY XUẤT MÃ                                                      */}
          {/* ========================================================================= */}
          {modalTab === "extract" && (
            <div className="space-y-4">
              {/* Quick Tab & Account Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/30 border border-border/50 rounded-lg">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-1">
                    Tab làm việc (Trang tính)
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={currentTabTitle}
                      onChange={(e) => handleQuickSwitchTab(e.target.value)}
                      className="flex-1 bg-background border border-border/60 rounded px-2.5 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:border-primary"
                    >
                      {availableTabs.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setModalTab("config")}
                      className="p-1.5 border border-border/60 hover:bg-muted/50 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Cấu hình cột cho Tab này"
                    >
                      <Settings2 size={13} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-1">
                    Tài khoản & Bảng tính
                  </label>
                  <div className="text-muted-foreground flex items-center justify-between py-1">
                    <span className="truncate max-w-[200px] text-[11px] font-medium text-foreground">
                      {googleConnection.accountEmail || (profile?.isMockSandbox ? "Sandbox Mode (Mock)" : "Chưa đăng nhập")}
                    </span>
                    <button
                      type="button"
                      onClick={() => loadRows(currentTabTitle).then((r) => runExtractionWithRows(r, currentTabTitle))}
                      disabled={isLoadingRows}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      title="Tải lại dữ liệu dòng mới nhất"
                    >
                      <RefreshCw size={11} className={isLoadingRows ? "animate-spin" : ""} />
                      Làm mới
                    </button>
                  </div>
                </div>
              </div>

              {/* Folder Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                    <Folder size={13} className="text-primary" />
                    Thư mục ảnh đầu vào:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUseCustomFolder(!useCustomFolder)}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      {useCustomFolder ? "Chọn từ thư mục đã thêm vào app" : "Nhập tên / đường dẫn khác"}
                    </button>
                  </div>
                </div>

                {!useCustomFolder && inputFolders.length > 0 ? (
                  <div className="flex gap-2">
                    <select
                      value={selectedFolder}
                      onChange={(e) => setSelectedFolder(e.target.value)}
                      className="flex-1 bg-background border border-border/60 rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    >
                      {inputFolders.map((f, idx) => (
                        <option key={idx} value={f}>
                          {getFolderName(f)} ({f})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleBrowseFolder}
                      className="px-2.5 py-1.5 border border-border/60 bg-muted/30 hover:bg-muted/60 rounded-md text-[11px] text-foreground transition-colors cursor-pointer"
                    >
                      Thư mục khác
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ví dụ: 4-9 8h phuog_thyur08 - peppa 2cc..."
                      value={customFolderName}
                      onChange={(e) => setCustomFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runExtraction()}
                      className="flex-1 bg-background border border-border/60 rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleBrowseFolder}
                      className="px-2.5 py-1.5 border border-border/60 bg-muted/30 hover:bg-muted/60 rounded-md text-[11px] text-foreground transition-colors cursor-pointer"
                    >
                      Duyệt
                    </button>
                    <button
                      type="button"
                      onClick={() => runExtraction()}
                      disabled={isLoadingRows}
                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {isLoadingRows ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                      Dò tìm
                    </button>
                  </div>
                )}
              </div>

              {/* Extraction Progress or Results */}
              {isLoadingRows ? (
                <div className="p-8 border border-border/60 rounded-xl bg-muted/10 flex flex-col items-center justify-center gap-2.5 text-muted-foreground">
                  <RefreshCw size={24} className="animate-spin text-primary" />
                  <p className="text-xs">Đang đối chiếu dòng khách hàng trên Tab "{currentTabTitle}"...</p>
                </div>
              ) : extractionResult ? (
                <div className="space-y-3">
                  {/* Row Match Banner */}
                  <div
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      extractionResult.status === "READY"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
                        : extractionResult.status === "NEEDS_REVIEW"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {extractionResult.status === "READY" ? (
                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                      ) : extractionResult.status === "NEEDS_REVIEW" ? (
                        <AlertCircle size={18} className="text-amber-500 shrink-0" />
                      ) : (
                        <X size={18} className="text-destructive shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-xs flex items-center gap-2">
                          {extractionResult.matchedRow ? (
                            <span>Dòng {extractionResult.matchedRow}: {extractionResult.customerName || extractionResult.jobFolderName}</span>
                          ) : (
                            <span>Không tìm thấy dòng khớp trên Tab "{currentTabTitle}"</span>
                          )}
                          {extractionResult.confidence && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-current/20 font-mono">
                              {Math.round(extractionResult.confidence * 100)}% Khớp
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                          {extractionResult.reason || "Đã khớp đúng tên thư mục với Cột H (Tên file)."}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Candidate Columns Checkboxes */}
                  {extractionResult.candidateColumns.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                          <Layers size={13} className="text-primary" />
                          Chọn ô cột mã ảnh cần sao chép:
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {activeSelectedColumns.length} cột đã chọn ({totalCodesCount} mã ảnh)
                        </span>
                      </div>

                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {extractionResult.candidateColumns.map((col) => {
                          const isChecked = selectedColumnLetters.has(col.columnLetter);
                          return (
                            <div
                              key={col.columnLetter}
                              onClick={() => handleToggleColumn(col.columnLetter)}
                              className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                                isChecked
                                  ? "bg-emerald-500/5 border-emerald-500/40 shadow-2xs"
                                  : "bg-muted/10 border-border/60 hover:bg-muted/30"
                              }`}
                            >
                              <button
                                type="button"
                                className="mt-0.5 text-primary focus:outline-none"
                              >
                                {isChecked ? (
                                  <CheckSquare size={16} className="text-emerald-500" />
                                ) : (
                                  <Square size={16} className="text-muted-foreground" />
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs text-foreground">
                                      Cột {col.columnLetter}: {col.columnHeader}
                                    </span>
                                    {col.isPrimary ? (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/30">
                                        Mã chính (1)
                                      </span>
                                    ) : (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/30">
                                        Mã phụ (2)
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                                      col.codeCount > 0
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : "bg-muted/60 text-muted-foreground"
                                    }`}
                                  >
                                    {col.codeCount > 0 ? `${col.codeCount} mã` : "0 mã (trống)"}
                                  </span>
                                </div>

                                <p className="text-[11px] font-mono text-muted-foreground mt-1 truncate">
                                  {col.sampleCodes.length > 0
                                    ? col.sampleCodes.join(", ") + (col.codeCount > col.sampleCodes.length ? "..." : "")
                                    : "(Ô trên dòng này chưa có mã ảnh)"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Filter Status Update Checkbox */}
                  {statusMapping && statusMapping.permission === "READ_WRITE" && extractionResult.matchedRow && (
                    <div
                      onClick={() => setUpdateFilterStatus(!updateFilterStatus)}
                      className="p-2.5 bg-muted/30 border border-border/60 rounded-lg flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <button type="button" className="text-primary focus:outline-none">
                          {updateFilterStatus ? (
                            <CheckSquare size={15} className="text-emerald-500" />
                          ) : (
                            <Square size={15} className="text-muted-foreground" />
                          )}
                        </button>
                        <span className="text-xs font-medium text-foreground">
                          Tự động đổi trạng thái thành <span className="font-semibold text-emerald-600 dark:text-emerald-400">"{configuredStatusValue}"</span> vào Cột {statusMapping.columnLetter} ({statusMapping.columnHeader}) trên Sheet ngay khi lọc file xong
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium">
                        Tự động đổi khi lọc xong
                      </span>
                    </div>
                  )}

                  {/* Formatted Preview Box */}
                  {formattedCodePreview && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-foreground">Xem trước mã lọc sẽ đẩy vào:</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground">
                            <input
                              type="radio"
                              name="insertMode"
                              checked={insertMode === "replace"}
                              onChange={() => setInsertMode("replace")}
                              className="text-primary"
                            />
                            Ghi đè ô mã
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground">
                            <input
                              type="radio"
                              name="insertMode"
                              checked={insertMode === "append"}
                              onChange={() => setInsertMode("append")}
                              className="text-primary"
                            />
                            Nối tiếp
                          </label>
                        </div>
                      </div>

                      <div className="p-2.5 bg-muted/20 border border-border/50 rounded-lg font-mono text-[11px] text-foreground max-h-24 overflow-y-auto leading-relaxed whitespace-pre">
                        {formattedCodePreview}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: CẤU HÌNH SHEET & CỘT                                              */}
          {/* ========================================================================= */}
          {modalTab === "config" && (
            <div className="space-y-4">
              {/* Tab Selector & Survey Banner */}
              <div className="p-3 bg-muted/30 border border-border/50 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                    <FileSpreadsheet size={13} className="text-primary" />
                    Chọn Tab để cấu hình vai trò cột:
                  </label>
                  <button
                    type="button"
                    onClick={handleScanTabStructure}
                    disabled={isScanningTabColumns}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} className={isScanningTabColumns ? "animate-spin" : ""} />
                    {isScanningTabColumns ? "Đang quét..." : "Quét cấu trúc Tab thực tế"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={configTabTitle}
                    onChange={(e) => {
                      setConfigTabTitle(e.target.value);
                      loadTabConfigIntoForm(e.target.value);
                    }}
                    className="flex-1 bg-background border border-border/60 rounded px-3 py-1.5 text-xs text-foreground font-medium focus:outline-none focus:border-primary"
                  >
                    {availableTabs.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Column Role Mappings */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider text-[10px] text-muted-foreground">
                  Phân công vai trò cột cho Tab "{configTabTitle}"
                </h3>

                {/* 1. Job Folder Name */}
                <div className="p-3 bg-background border border-border/60 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs text-foreground">
                        1. Cột Tên file / Thư mục (Dò tìm dòng)
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Cột chứa tên thư mục ảnh khách hàng để đối chiếu tìm dòng (mặc định: Cột H)
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50">
                      Chỉ đọc (READ_ONLY)
                    </span>
                  </div>

                  <select
                    value={configJobFolderCol}
                    onChange={(e) => setConfigJobFolderCol(e.target.value)}
                    className="w-full bg-muted/20 border border-border/60 rounded px-2.5 py-1.5 text-xs text-foreground font-medium"
                  >
                    {displayColumnsList.map((c) => (
                      <option key={c.letter} value={c.letter}>
                        Cột {c.letter} — {c.header}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Code Column 1 */}
                <div className="p-3 bg-background border border-border/60 rounded-lg space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs text-foreground">
                        2. Cột Mã ảnh chọn (1) — Chính
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Cột chứa danh sách mã ảnh khách chọn chính (mặc định: Cột I)
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      Đọc / Sao chép
                    </span>
                  </div>

                  <select
                    value={configCodeCol1}
                    onChange={(e) => setConfigCodeCol1(e.target.value)}
                    className="w-full bg-muted/20 border border-border/60 rounded px-2.5 py-1.5 text-xs text-foreground font-medium"
                  >
                    {displayColumnsList.map((c) => (
                      <option key={c.letter} value={c.letter}>
                        Cột {c.letter} — {c.header}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Code Column 2 */}
                <div className="p-3 bg-background border border-border/60 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs text-foreground">
                        3. Cột Mã ảnh chọn (2) — Phụ
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Cột chứa danh sách mã ảnh khách chọn phụ (ảnh phóng, ảnh cổng... mặc định: Cột J)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={configCodeCol2Permission}
                        onChange={(e) => {
                          const val = e.target.value as FieldPermission;
                          setConfigCodeCol2Permission(val);
                          if (val === "READ_ONLY" && configCodeCol2 === "NONE") {
                            setConfigCodeCol2("J");
                          }
                        }}
                        className="bg-muted/40 border border-border/60 rounded px-2 py-0.5 text-[11px] font-medium text-foreground cursor-pointer focus:outline-none focus:border-primary"
                      >
                        <option value="READ_ONLY">Đọc / Sao chép (READ_ONLY)</option>
                        <option value="IGNORE">Không dùng / Bỏ qua (IGNORE)</option>
                      </select>

                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                          configCodeCol2Permission === "READ_ONLY" && configCodeCol2 !== "NONE"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-muted/60 text-muted-foreground border-border/50"
                        }`}
                      >
                        {configCodeCol2Permission === "READ_ONLY" && configCodeCol2 !== "NONE"
                          ? "Đọc / Sao chép"
                          : "Bỏ qua"}
                      </span>
                    </div>
                  </div>

                  <select
                    value={configCodeCol2}
                    onChange={(e) => {
                      const val = e.target.value;
                      setConfigCodeCol2(val);
                      if (val === "NONE") {
                        setConfigCodeCol2Permission("IGNORE");
                      } else {
                        setConfigCodeCol2Permission("READ_ONLY");
                      }
                    }}
                    className="w-full bg-muted/20 border border-border/60 rounded px-2.5 py-1.5 text-xs text-foreground font-medium"
                  >
                    <option value="NONE">[ Không sử dụng / Bỏ qua ]</option>
                    {displayColumnsList.map((c) => (
                      <option key={c.letter} value={c.letter}>
                        Cột {c.letter} — {c.header}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Status Column */}
                <div className="p-3 bg-background border border-border/60 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-xs text-foreground">
                        4. Cột Trạng thái lọc ảnh
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Cột ghi nhận trạng thái sau khi lấy mã (mặc định: Cột G Trạng Thái 1)
                      </div>
                    </div>

                    <select
                      value={configStatusPermission}
                      onChange={(e) => setConfigStatusPermission(e.target.value as FieldPermission)}
                      className="bg-muted/40 border border-border/60 rounded px-2 py-0.5 text-[11px] font-medium"
                    >
                      <option value="READ_WRITE">Đọc & Ghi (READ_WRITE)</option>
                      <option value="READ_ONLY">Chỉ đọc (READ_ONLY)</option>
                    </select>
                  </div>

                  <select
                    value={configStatusCol}
                    onChange={(e) => setConfigStatusCol(e.target.value)}
                    className="w-full bg-muted/20 border border-border/60 rounded px-2.5 py-1.5 text-xs text-foreground font-medium"
                  >
                    <option value="NONE">[ Không sử dụng ]</option>
                    {displayColumnsList.map((c) => (
                      <option key={c.letter} value={c.letter}>
                        Cột {c.letter} — {c.header}
                      </option>
                    ))}
                  </select>

                  {configStatusPermission === "READ_WRITE" && configStatusCol !== "NONE" && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">
                          Nội dung ghi trạng thái:
                        </label>
                        <input
                          type="text"
                          value={configStatusValue}
                          onChange={(e) => setConfigStatusValue(e.target.value)}
                          placeholder="Ví dụ: Đã lọc"
                          className="w-full bg-background border border-border/60 rounded px-2 py-1 text-xs text-foreground"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">
                          Chính sách ghi ô:
                        </label>
                        <select
                          value={configStatusWritePolicy}
                          onChange={(e) => setConfigStatusWritePolicy(e.target.value as WritePolicy)}
                          className="w-full bg-background border border-border/60 rounded px-2 py-1 text-xs text-foreground"
                        >
                          <option value="SET_IF_EMPTY">Chỉ ghi nếu ô trống</option>
                          <option value="ALWAYS_REPLACE">Ghi đè luôn</option>
                          <option value="ASK_BEFORE_OVERWRITE">Hỏi trước khi ghi</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Row Scope */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 border border-border/50 rounded-lg">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">
                      Dòng tiêu đề (Header row):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={configHeaderRow}
                      onChange={(e) => setConfigHeaderRow(parseInt(e.target.value) || 4)}
                      className="w-full bg-background border border-border/60 rounded px-2.5 py-1 text-xs text-foreground"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-1">
                      Bắt đầu từ dòng dữ liệu:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={configStartRow}
                      onChange={(e) => setConfigStartRow(parseInt(e.target.value) || 5)}
                      className="w-full bg-background border border-border/60 rounded px-2.5 py-1 text-xs text-foreground"
                    />
                  </div>
                </div>
              </div>

              {/* Save Success Banner */}
              {configSavedSuccess && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-2 text-xs font-semibold animate-fade-in">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span>Đã lưu cấu hình cột cho Tab "{configTabTitle}" thành công! Áp dụng ngay lập tức cho các lần truy xuất.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer text-xs"
          >
            Đóng
          </button>

          {modalTab === "extract" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalTab("config")}
                className="px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted/40 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Settings2 size={13} />
                <span>Cấu hình cột Tab</span>
              </button>

              <button
                type="button"
                onClick={handleApplyCodes}
                disabled={!formattedCodePreview || totalCodesCount === 0 || isUpdatingStatus}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                  formattedCodePreview && totalCodesCount > 0 && !isUpdatingStatus
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-98"
                    : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                }`}
              >
                {isUpdatingStatus ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                <span>Sao chép & Đẩy vào ô mã lọc ({totalCodesCount} mã)</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalTab("extract")}
                className="px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted/40 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Quay lại truy xuất</span>
                <ArrowRight size={13} />
              </button>

              <button
                type="button"
                onClick={handleSaveTabConfig}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <Save size={14} />
                <span>Lưu cấu hình Tab "{configTabTitle}"</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
