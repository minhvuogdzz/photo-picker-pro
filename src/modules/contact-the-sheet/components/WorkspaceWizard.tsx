import React, { useState, useEffect } from "react";
import {
  Cloud,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Save,
  Search,
  Table,
  Check,
  RotateCw,
  LogOut,
  Plus,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Layers,
  Settings2,
  User,
  X,
  RotateCcw,
} from "lucide-react";
import {
  useContactSheetStore,
  STANDARD_19_STUDIO_MAPPINGS,
} from "../stores/useContactSheetStore";
import { googleCredentialManager } from "../services/googleCredentialBridge";
import { sheetDiscoveryService } from "../services/sheetDiscoveryService";
import { schemaMappingService } from "../services/schemaMappingService";
import { AnalysisReportCard } from "./AnalysisReportCard";
import { SheetTabManager } from "./SheetTabManager";
import { useTranslation } from "@/core/lib/i18n";
import type {
  TabAnalysisResult,
  FieldMapping,
  FieldPermission,
  WritePolicy,
  SemanticField,
  WorkspaceProfile,
  SheetTabInfo,
  TabConfiguration,
} from "../types";

export function WorkspaceWizard() {
  const { tr } = useTranslation();
  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const saveProfile = useContactSheetStore((s) => s.saveProfile);
  const googleConnection = useContactSheetStore((s) => s.googleConnection);
  const lastSheetUrl = useContactSheetStore((s) => s.lastSheetUrl);
  const setLastSheetUrl = useContactSheetStore((s) => s.setLastSheetUrl);
  const setTabConfigurations = useContactSheetStore((s) => s.setTabConfigurations);
  const previousTabConfigurationsSnapshot = useContactSheetStore(
    (s) => s.previousTabConfigurationsSnapshot
  );
  const setPreviousTabConfigurationsSnapshot = useContactSheetStore(
    (s) => s.setPreviousTabConfigurationsSnapshot
  );
  const undoApplyAllTabs = useContactSheetStore((s) => s.undoApplyAllTabs);

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [sheetUrl, setSheetUrl] = useState(
    lastSheetUrl ||
      (activeProfile?.spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${activeProfile.spreadsheetId}/edit`
        : "")
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [availableTabs, setAvailableTabs] = useState<SheetTabInfo[]>([]);
  const [selectedTab, setSelectedTab] = useState<SheetTabInfo | null>(null);
  const [tabConfigs, setTabConfigs] = useState<Record<string, TabConfiguration>>(
    activeProfile?.tabConfigurations || {}
  );
  const [analysisResult, setAnalysisResult] = useState<TabAnalysisResult | null>(null);
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(activeProfile?.headerRow || 3);

  useEffect(() => {
    if (activeProfile?.tabConfigurations) {
      setTabConfigs(activeProfile.tabConfigurations);
    }
  }, [activeProfile?.tabConfigurations]);

  const initialMappings =
    activeProfile?.fieldMappings && activeProfile.fieldMappings.length >= 10
      ? activeProfile.fieldMappings
      : STANDARD_19_STUDIO_MAPPINGS;

  const editorValue =
    activeProfile?.valueMappings?.find((v) => v.semanticRole === "EDITOR_CURRENT_USER")?.sheetValue ||
    "Vương";
  const pickValue =
    activeProfile?.valueMappings?.find((v) => v.semanticRole === "PHOTO_PICK_STATUS_COMPLETED")?.sheetValue ||
    "Đã lọc";

  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(initialMappings);
  const [currentUserEditor, setCurrentUserEditor] = useState(editorValue);
  const [pickCompletedStatus, setPickCompletedStatus] = useState(pickValue);
  const [startRow, setStartRow] = useState(activeProfile?.rowScope?.startRow || 4);

  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColLetter, setNewColLetter] = useState("");
  const [newColHeader, setNewColHeader] = useState("");
  const [newColSemantic, setNewColSemantic] = useState<SemanticField>("NOTES");
  const [newColPermission, setNewColPermission] = useState<FieldPermission>("READ_ONLY");

  const handleAddColumn = () => {
    const letter = newColLetter.trim().toUpperCase();
    const header = newColHeader.trim();
    if (!letter || !header) {
      alert(tr("Vui lòng nhập chữ cái cột (ví dụ: T) và tiêu đề cột", "Please enter column letter (e.g., T) and column header"));
      return;
    }
    let colIdx = 0;
    for (let i = 0; i < letter.length; i++) {
      colIdx = colIdx * 26 + (letter.charCodeAt(i) - 64);
    }
    colIdx = colIdx - 1;

    const newMapping: FieldMapping = {
      columnLetter: letter,
      columnIndex: colIdx,
      columnHeader: header,
      semanticField: newColSemantic,
      permission: newColPermission,
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    };

    setFieldMappings([...fieldMappings, newMapping]);
    setIsAddingColumn(false);
    setNewColLetter("");
    setNewColHeader("");
    setNewColSemantic("NOTES");
    setNewColPermission("READ_ONLY");
  };

  const handleRemoveColumn = (indexToRemove: number) => {
    setFieldMappings(fieldMappings.filter((m) => m.columnIndex !== indexToRemove));
  };

  const handleResetToStandard19 = () => {
    if (confirm(tr("Khôi phục đầy đủ 19 cột chuẩn Studio (A - S)?", "Reset to standard 19 Studio columns (A - S)?"))) {
      setFieldMappings(STANDARD_19_STUDIO_MAPPINGS);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      await googleCredentialManager.connectGoogle();
      if (activeProfile) {
        saveProfile({ ...activeProfile, isMockSandbox: false });
      }
    } catch (err) {
      console.error("Connect Google error:", err);
      alert(`${tr("Lỗi kết nối Google:", "Google connection error:")} ${err}`);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    await googleCredentialManager.disconnectGoogle();
  };

  const buildTabConfigForTab = (tabTitle: string, sheetId: number): TabConfiguration => {
    const fingerprint = schemaMappingService.generateSchemaFingerprint(
      fieldMappings.map((m) => ({ index: m.columnIndex, headerName: m.columnHeader }))
    );
    return {
      sheetId,
      tabTitle,
      headerRow: selectedHeaderRow,
      fieldMappings: [...fieldMappings],
      rowScope: { startRow, ignoreEmptyRows: true },
      schemaFingerprint: fingerprint,
      updatedAt: new Date().toISOString(),
    };
  };

  const handleSurveyTab = async (targetTab: SheetTabInfo) => {
    setIsAnalyzing(true);
    try {
      const spreadsheetId = sheetDiscoveryService.parseSpreadsheetId(sheetUrl);
      setLastSheetUrl(sheetUrl);
      const analysis = await sheetDiscoveryService.analyzeTabSchema(
        spreadsheetId,
        targetTab,
        40,
        false
      );

      setAnalysisResult(analysis);
      setSelectedTab(targetTab);

      const existingConfig = tabConfigs[targetTab.title];
      if (existingConfig) {
        setSelectedHeaderRow(existingConfig.headerRow);
        setFieldMappings(existingConfig.fieldMappings);
        setStartRow(existingConfig.rowScope.startRow);
      } else {
        setSelectedHeaderRow(analysis.detectedHeaderRow);
        const base = fieldMappings.length > 0 ? fieldMappings : activeProfile?.fieldMappings || [];
        const newMappings = sheetDiscoveryService.autoDetectOrCloneMappings(analysis.columns, base);
        setFieldMappings(newMappings);
        setStartRow(analysis.detectedHeaderRow + 1);
      }
      setWizardStep(2);
    } catch (err: any) {
      console.error("Survey tab error:", err);
      const msg = err?.message || String(err);
      if (msg.includes("GOOGLE_REFRESH_TOKEN_NOT_FOUND") || msg.includes("GOOGLE_NOT_CONNECTED")) {
        alert(tr("Phiên làm việc Google đã hết hạn hoặc chưa kết nối. Vui lòng bấm 'Kết nối Google' để đăng nhập lại.", "Google session expired or not connected. Click 'Connect Google' to sign in again."));
      } else {
        alert(msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeSheet = async () => {
    if (googleConnection.status !== "CONNECTED" && !googleCredentialManager.isConnected()) {
      alert(tr("Vui lòng bấm 'Kết nối Google' trước khi khảo sát bảng tính.", "Please click 'Connect Google' before inspecting the spreadsheet."));
      return;
    }

    setIsAnalyzing(true);
    try {
      const spreadsheetId = sheetDiscoveryService.parseSpreadsheetId(sheetUrl);
      setLastSheetUrl(sheetUrl);
      const metadata = await sheetDiscoveryService.fetchSpreadsheetMetadata(spreadsheetId, false);
      setAvailableTabs(metadata.tabs);

      const targetTab =
        (selectedTab && metadata.tabs.find((t) => t.sheetId === selectedTab.sheetId)) ||
        metadata.tabs.find((t) => t.title === activeProfile?.selectedTabTitle) ||
        metadata.tabs[0];

      await handleSurveyTab(targetTab);
    } catch (err: any) {
      console.error("Analyze sheet error:", err);
      const msg = err?.message || String(err);
      if (msg.includes("GOOGLE_REFRESH_TOKEN_NOT_FOUND") || msg.includes("GOOGLE_NOT_CONNECTED")) {
        alert(tr("Phiên làm việc Google đã hết hạn hoặc chưa kết nối. Vui lòng bấm 'Kết nối Google' để đăng nhập lại.", "Google session expired or not connected. Click 'Connect Google' to sign in again."));
      } else {
        alert(msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSwitchTabInWizard = async (tab: SheetTabInfo) => {
    await handleSurveyTab(tab);
  };

  const handleCopyCurrentConfigToAllTabs = () => {
    if (availableTabs.length <= 1) return;
    const confirmCopy = window.confirm(
      tr(
        `Áp dụng cấu hình cột và phạm vi hàng từ tab "${selectedTab?.title || "hiện tại"}" cho toàn bộ ${availableTabs.length} tab trong bảng tính?\n(Bạn có thể bấm "Hoàn tác" bất cứ lúc nào nếu muốn hủy)`,
        `Apply column config & row range from "${selectedTab?.title || "current"}" to all ${availableTabs.length} tabs?\n(You can click "Undo" anytime to revert)`
      )
    );
    if (!confirmCopy) return;

    // Save snapshot before applying to all tabs so user can undo
    const currentSnapshot =
      Object.keys(tabConfigs).length > 0
        ? { ...tabConfigs }
        : selectedTab
        ? { [selectedTab.title]: buildTabConfigForTab(selectedTab.title, selectedTab.sheetId) }
        : {};
    setPreviousTabConfigurationsSnapshot(currentSnapshot);

    const newConfigs: Record<string, TabConfiguration> = {};
    for (const tab of availableTabs) {
      newConfigs[tab.title] = buildTabConfigForTab(tab.title, tab.sheetId);
    }
    setTabConfigs(newConfigs);
    setTabConfigurations(newConfigs);
  };

  const handleUndoCopyAllTabs = () => {
    const restored = undoApplyAllTabs();
    // If selectedTab is set and restored is empty or doesn't match, ensure selectedTab is preserved
    if (selectedTab && Object.keys(restored).length <= 1) {
      const singleConfig = {
        [selectedTab.title]:
          restored[selectedTab.title] || buildTabConfigForTab(selectedTab.title, selectedTab.sheetId),
      };
      setTabConfigs(singleConfig);
      setTabConfigurations(singleConfig);
    } else {
      setTabConfigs(restored);
    }
  };

  const handleToggleTabConfig = (tab: SheetTabInfo) => {
    const isCurrentlyConfigured = !!tabConfigs[tab.title];
    const nextConfigs = { ...tabConfigs };

    if (isCurrentlyConfigured) {
      if (Object.keys(nextConfigs).length <= 1) {
        alert(tr("Cần giữ lại ít nhất 1 tab được áp dụng cấu hình.", "At least 1 configured tab must remain enabled."));
        return;
      }
      delete nextConfigs[tab.title];
    } else {
      nextConfigs[tab.title] = buildTabConfigForTab(tab.title, tab.sheetId);
    }

    setTabConfigs(nextConfigs);
    setTabConfigurations(nextConfigs);
  };

  const handleSaveProfile = () => {
    const spreadsheetId = sheetDiscoveryService.parseSpreadsheetId(sheetUrl);
    setLastSheetUrl(sheetUrl);

    const targetTabTitle =
      selectedTab?.title ||
      analysisResult?.tab.title ||
      activeProfile?.selectedTabTitle ||
      "Edit 9/2026";
    const targetTabId =
      selectedTab?.sheetId ??
      analysisResult?.tab.sheetId ??
      activeProfile?.selectedTabId ??
      0;

    const fingerprint = schemaMappingService.generateSchemaFingerprint(
      fieldMappings.map((m) => ({ index: m.columnIndex, headerName: m.columnHeader }))
    );

    const effectiveFieldMappings = fieldMappings.map((m) => {
      if (
        m.semanticField === "PHOTO_PICK_STATUS" &&
        pickCompletedStatus.trim() &&
        m.permission !== "IGNORE"
      ) {
        return {
          ...m,
          permission: "READ_WRITE" as const,
          writePolicy: "ALWAYS_REPLACE" as const,
        };
      }
      return m;
    });

    const currentTabConfig: TabConfiguration = {
      sheetId: targetTabId,
      tabTitle: targetTabTitle,
      headerRow: selectedHeaderRow,
      fieldMappings: effectiveFieldMappings,
      rowScope: { startRow, ignoreEmptyRows: true },
      schemaFingerprint: fingerprint,
      updatedAt: new Date().toISOString(),
    };

    const updatedTabConfigs: Record<string, TabConfiguration> = {
      ...tabConfigs,
      [targetTabTitle]: currentTabConfig,
    };

    const newProfile: WorkspaceProfile = {
      id: activeProfile?.id || `ws_${Date.now().toString(36)}`,
      displayName: activeProfile?.displayName || "Studio Workspace",
      googleAccountEmail: googleConnection.accountEmail,
      spreadsheetId,
      spreadsheetTitle: analysisResult?.tab.title || activeProfile?.spreadsheetTitle || "Link edit",
      selectedTabTitle: targetTabTitle,
      selectedTabId: targetTabId,
      headerRow: selectedHeaderRow,
      fieldMappings: effectiveFieldMappings,
      valueMappings: [
        {
          semanticRole: "EDITOR_CURRENT_USER",
          sheetValue: currentUserEditor,
        },
        {
          semanticRole: "PHOTO_PICK_STATUS_COMPLETED",
          sheetValue: pickCompletedStatus,
        },
      ],
      rowScope: {
        startRow,
        ignoreEmptyRows: true,
      },
      driveConfig: activeProfile?.driveConfig || {
        localRootPath: "",
        remoteRootDriveId: "root",
        sharingPolicy: "KEEP_EXISTING",
        sharingAutomationEnabled: false,
      },
      isMockSandbox: false,
      schemaFingerprint: fingerprint,
      healthStatus: "HEALTHY",
      tabConfigurations: updatedTabConfigs,
      createdAt: activeProfile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTabConfigs(updatedTabConfigs);
    saveProfile(newProfile);
    alert(
      tr(
        `Đã lưu cấu hình cho tab "${targetTabTitle}" (${Object.keys(updatedTabConfigs).length} tab hiển thị ở Thực thi Batch).`,
        `Saved config for "${targetTabTitle}" (${Object.keys(updatedTabConfigs).length} tab(s) shown in Batch Runner).`
      )
    );
  };

  const configuredTabCount = Object.keys(tabConfigs).length;

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-5 gap-5 text-foreground custom-scrollbar">
      {/* Clean Wizard Stepper Bar */}
      <div className="flex flex-wrap items-center justify-between p-2.5 bg-card border border-border rounded-2xl shrink-0 w-full min-w-0 gap-2 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
          {[
            { step: 1, label: tr("Kết nối & Bảng tính", "Connect & Spreadsheet") },
            { step: 2, label: tr("Khảo sát Tiêu đề & Tab", "Inspect Header & Tabs") },
            { step: 3, label: tr("Phân quyền & Ánh xạ cột", "Permissions & Columns") },
            { step: 4, label: tr("Giá trị tự động & Lưu", "Auto Values & Save") },
          ].map((s) => {
            const active = wizardStep === s.step;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setWizardStep(s.step as any)}
                className={`flex items-center gap-2 h-8 px-3 rounded-xl text-[12px] transition-colors cursor-pointer border ${
                  active
                    ? "glass-pill text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-foreground/[0.06] text-muted-foreground"
                  }`}
                >
                  {s.step}
                </span>
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Undo & Save in Stepper Header */}
        <div className="flex items-center gap-2 shrink-0">
          {configuredTabCount > 1 && (
            <button
              type="button"
              onClick={handleUndoCopyAllTabs}
              className="h-8 px-3 rounded-xl bg-foreground/[0.04] hover:bg-foreground/[0.08] border border-border text-foreground text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title={tr("Hoàn tác việc áp dụng cho tất cả các tab — chỉ giữ lại tab đang làm việc", "Undo apply-all — keep current working tab only")}
            >
              <RotateCcw size={12.5} strokeWidth={1.75} />
              <span>{tr(`Hoàn tác áp dụng tất cả (${configuredTabCount} tab)`, `Undo Apply All (${configuredTabCount} tabs)`)}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveProfile}
            className="btn-base btn-primary h-8 px-3.5 rounded-xl text-[11.5px]"
          >
            <Save size={13} strokeWidth={1.75} />
            <span>{tr("Lưu cấu hình", "Save Config")}</span>
          </button>
        </div>
      </div>

      {/* STEP 1: Connect Google & Sheet URL */}
      {wizardStep === 1 && (
        <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full py-1">
          {/* Google Connection Card */}
          <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-foreground/[0.05] border border-border flex items-center justify-center text-foreground">
                  <Cloud size={17} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-semibold text-[13.5px] text-foreground">
                    {tr("1. Tài khoản Google Studio", "1. Studio Google Account")}
                  </h3>
                  <p className="text-[11.5px] text-muted-foreground">
                    {googleConnection.status === "CONNECTED"
                      ? `${tr("Đã kết nối:", "Connected:")} ${googleConnection.accountEmail || tr("Tài khoản Google", "Google Account")}`
                      : tr("Kết nối tài khoản Google để đối soát Sheet và lấy link Drive.", "Connect your Google account to sync Sheets and resolve Drive links.")}
                  </p>
                </div>
              </div>

              {googleConnection.status === "CONNECTED" ? (
                <div className="flex items-center gap-2">
                  <span className="h-7 px-2.5 rounded-full bg-foreground/[0.04] border border-border text-[11.5px] text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    <span>{tr("Đang kết nối", "Connected")}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="h-7 px-2.5 bg-foreground/[0.04] hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border rounded-lg text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut size={12.5} strokeWidth={1.75} />
                    <span>{tr("Đổi tài khoản", "Switch Account")}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="btn-base btn-primary h-8 px-4 rounded-xl text-[12px]"
                >
                  <Cloud size={14} strokeWidth={1.75} />
                  <span>{isConnectingGoogle ? tr("Đang mở trình duyệt...", "Opening browser...") : tr("Kết nối Google", "Connect Google")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Sheet URL Input */}
          <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-xs">
            <div>
              <h3 className="font-semibold text-[13.5px] text-foreground">
                {tr("2. Liên kết Google Sheet Studio", "2. Link Studio Google Sheet")}
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                {tr("Dán đường link bảng tính Google Sheets cần đối soát:", "Paste the Google Sheets URL to sync:")}
              </p>
            </div>

            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => {
                const val = e.target.value;
                setSheetUrl(val);
                setLastSheetUrl(val);
              }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="h-9 px-3.5 bg-background border border-border rounded-xl text-foreground font-mono text-[12px] focus:outline-none focus:border-primary"
            />

            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-muted-foreground">
                {tr("Tự động lưu đường dẫn bảng tính cho lần mở tiếp theo.", "Spreadsheet link is saved automatically for future launches.")}
              </span>
              <button
                type="button"
                onClick={handleAnalyzeSheet}
                disabled={isAnalyzing || !sheetUrl.trim()}
                className="btn-base btn-primary h-8 px-4 rounded-xl text-[12px]"
              >
                <Search size={13.5} strokeWidth={1.75} />
                <span>{isAnalyzing ? tr("Đang khảo sát...", "Inspecting...") : tr("Khảo sát bảng tính", "Inspect Spreadsheet")}</span>
              </button>
            </div>

            {/* Discovered Tabs List */}
            {availableTabs.length > 0 && (
              <div className="mt-2 pt-3 border-t border-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[12px] text-foreground">
                    {tr(`Các trang tính trong bảng (${availableTabs.length} tab):`, `Tabs in spreadsheet (${availableTabs.length}):`)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {tr("Đã áp dụng Batch:", "Applied to Batch:")} {configuredTabCount || 1} tab
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {availableTabs.map((t) => {
                    const isConfigured = !!tabConfigs[t.title];
                    const isCurrent = selectedTab?.sheetId === t.sheetId;
                    return (
                      <button
                        type="button"
                        key={t.sheetId}
                        onClick={() => handleSurveyTab(t)}
                        disabled={isAnalyzing}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl border text-[12px] font-medium transition-colors text-left cursor-pointer ${
                          isCurrent
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-background/60 hover:bg-foreground/[0.04] border-border text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Table size={13.5} className="text-muted-foreground shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isConfigured && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" title={tr("Đã áp dụng vào Thực thi Batch", "Applied to Batch Runner")} />
                          )}
                          <span className="text-[10.5px] text-muted-foreground tabular-nums">
                            {t.columnCount} {tr("cột", "cols")}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setWizardStep(2)}
              className="btn-base btn-secondary h-8 px-4 rounded-xl text-[12px]"
            >
              <span>{tr("Tiếp tục: Khảo sát Tiêu đề & Tab", "Next: Inspect Header & Tabs")}</span>
              <ArrowRight size={13.5} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Header Confirmation & Column Profiles */}
      {wizardStep === 2 && (
        <div className="flex flex-col gap-4 w-full min-w-0 max-w-full">
          {availableTabs.length > 0 && (
            <SheetTabManager
              availableTabs={availableTabs}
              selectedTab={selectedTab}
              tabConfigs={tabConfigs}
              isAnalyzing={isAnalyzing}
              onSelectTab={handleSwitchTabInWizard}
              onCopyConfigToAllTabs={handleCopyCurrentConfigToAllTabs}
              onUndoCopyAllTabs={handleUndoCopyAllTabs}
              onToggleTabConfig={handleToggleTabConfig}
              canUndoCopyAll={Boolean(previousTabConfigurationsSnapshot) || configuredTabCount > 1}
              subtitle={tr("Chọn tab cần áp dụng cấu hình. Chỉ những tab được áp dụng tại đây mới hiển thị ở phần Thực thi Batch.", "Pick tabs to configure. Only tabs enabled here will appear in Batch Runner.")}
            />
          )}

          {/* If user has > 1 configured tabs from previous session even before analyzing sheet */}
          {availableTabs.length === 0 && configuredTabCount > 1 && (
            <div className="p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[12.5px] font-semibold text-foreground">
                  {tr(`Đang áp dụng cấu hình cho ${configuredTabCount} tab trong Thực thi Batch`, `Applying config to ${configuredTabCount} tabs in Batch Runner`)}
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  {tr('Nếu bạn lỡ tay ấn "Áp dụng cho tất cả Tab", bấm nút bên cạnh để hoàn tác và chỉ giữ lại tab chính', 'If you accidentally clicked "Apply to All Tabs", click Undo to keep only the primary tab')} ({activeProfile?.selectedTabTitle}).
                </span>
              </div>
              <button
                type="button"
                onClick={handleUndoCopyAllTabs}
                className="h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/25 text-primary text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} strokeWidth={1.75} />
                <span>{tr(`Hoàn tác (${configuredTabCount} → 1 tab)`, `Undo (${configuredTabCount} → 1 tab)`)}</span>
              </button>
            </div>
          )}

          {analysisResult ? (
            <AnalysisReportCard
              analysis={analysisResult}
              selectedHeaderRow={selectedHeaderRow}
              onConfirmHeader={(row) => setSelectedHeaderRow(row)}
            />
          ) : (
            <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-4 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold text-[13.5px] text-foreground">
                    {tr("Cấu hình Dòng Tiêu đề (Header Row)", "Header Row Configuration")}
                  </h3>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    {tr("Tab đang chọn:", "Selected tab:")} <span className="text-foreground font-medium">{activeProfile?.selectedTabTitle || "Edit 9/2026"}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyzeSheet}
                  disabled={isAnalyzing || !sheetUrl.trim()}
                  className="h-8 px-3 bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground border border-border text-[11.5px] font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCw size={12.5} className={isAnalyzing ? "animate-spin" : ""} />
                  <span>{isAnalyzing ? tr("Đang đồng bộ...", "Syncing...") : tr("Khảo sát các tab từ Sheet", "Inspect Sheet Tabs")}</span>
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-background/50 border border-border rounded-xl">
                <span className="text-[12px] font-medium text-foreground">{tr("Dòng tiêu đề hiện tại:", "Current header row:")}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={selectedHeaderRow}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setSelectedHeaderRow(val);
                    setStartRow(val + 1);
                  }}
                  className="w-20 h-8 px-2.5 bg-card border border-border rounded-lg text-foreground font-medium text-[12px] focus:outline-none focus:border-primary"
                />
                <span className="text-[11.5px] text-muted-foreground">
                  {tr("(Dòng chứa tên cột: Ngày, Giờ, Tên khách, Tên file, Tên Edit, Link Edit...)", "(Row containing column titles: Date, Time, Customer, File Name, Editor, Edit Link...)")}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11.5px] font-medium text-muted-foreground">
                  {tr(`Các cột đã ánh xạ (${fieldMappings.length} cột):`, `Mapped columns (${fieldMappings.length} cols):`)}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {fieldMappings.map((m) => (
                    <div
                      key={m.columnIndex}
                      className="p-2.5 rounded-xl bg-background/50 border border-border flex items-center justify-between gap-2 text-[12px]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-semibold text-foreground px-1.5 py-0.5 rounded bg-foreground/[0.05] text-[11px]">
                          {m.columnLetter}
                        </span>
                        <span className="font-medium text-foreground truncate" title={m.columnHeader}>
                          {m.columnHeader}
                        </span>
                      </div>
                      <span
                        className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded ${
                          m.permission === "READ_WRITE"
                            ? "bg-primary/10 text-primary"
                            : "bg-foreground/[0.04] text-muted-foreground"
                        }`}
                      >
                        {m.permission === "READ_WRITE" ? tr("Ghi", "Write") : tr("Đọc", "Read")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setWizardStep(1)}
              className="h-8 px-3.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-[12px] font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={13.5} />
              <span>{tr("Quay lại", "Back")}</span>
            </button>
            <button
              type="button"
              onClick={() => setWizardStep(3)}
              className="btn-base btn-secondary h-8 px-4 rounded-xl text-[12px]"
            >
              <span>{tr("Tiếp tục: Phân quyền & Ánh xạ cột", "Next: Permissions & Column Mapping")}</span>
              <ArrowRight size={13.5} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Field Mapping & Permissions */}
      {wizardStep === 3 && (
        <div className="flex flex-col gap-4 w-full min-w-0 max-w-full pb-8">
          {availableTabs.length > 0 && (
            <SheetTabManager
              availableTabs={availableTabs}
              selectedTab={selectedTab}
              tabConfigs={tabConfigs}
              isAnalyzing={isAnalyzing}
              onSelectTab={handleSwitchTabInWizard}
              onCopyConfigToAllTabs={handleCopyCurrentConfigToAllTabs}
              onUndoCopyAllTabs={handleUndoCopyAllTabs}
              onToggleTabConfig={handleToggleTabConfig}
              canUndoCopyAll={Boolean(previousTabConfigurationsSnapshot) || configuredTabCount > 1}
              subtitle={tr("Cấu hình ánh xạ cột riêng cho từng trang tính hoặc chọn các tab cần áp dụng.", "Customize column mappings per worksheet or select tabs to apply.")}
            />
          )}

          {/* Step 3 Header & Action Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-[13.5px] text-foreground flex items-center gap-2">
                <span>{tr("Phân quyền & Khớp trường dữ liệu", "Permissions & Field Mapping")}</span>
                <span className="px-2 py-0.5 rounded-md bg-foreground/[0.05] text-muted-foreground text-[11px] font-medium">
                  {fieldMappings.length} {tr("cột", "cols")}
                </span>
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                {tr("Chỉ định ý nghĩa từng cột. Các cột công thức được khóa chỉ đọc tự động để bảo vệ bảng tính.", "Assign semantic role for each column. Formula columns are auto-locked READ_ONLY for safety.")}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsAddingColumn(!isAddingColumn)}
                className="h-8 px-3 bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground border border-border rounded-xl text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>{tr("Thêm cột", "Add Column")}</span>
              </button>

              <button
                type="button"
                onClick={handleResetToStandard19}
                className="h-8 px-3 bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground border border-border rounded-xl text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>{tr("Chuẩn 19 cột Studio", "Reset 19 Studio Columns")}</span>
              </button>
            </div>
          </div>

          {isAddingColumn && (
            <div className="p-4 bg-card border border-border rounded-2xl flex flex-col gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-[12.5px] font-semibold text-foreground">
                  {tr("Thêm cột tùy chỉnh", "Add Custom Column")}
                </h4>
                <button
                  type="button"
                  aria-label={tr("Đóng", "Close")}
                  onClick={() => setIsAddingColumn(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[12px]">
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-foreground">{tr("Chữ cái cột:", "Column letter:")}</label>
                  <input
                    type="text"
                    placeholder="T"
                    value={newColLetter}
                    onChange={(e) => setNewColLetter(e.target.value.toUpperCase())}
                    className="h-8 px-3 bg-background border border-border rounded-lg font-mono text-[12px] font-medium text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="font-medium text-foreground">{tr("Tiêu đề cột trên Sheet:", "Sheet column header:")}</label>
                  <input
                    type="text"
                    placeholder={tr("Ghi chú thêm...", "Extra notes...")}
                    value={newColHeader}
                    onChange={(e) => setNewColHeader(e.target.value)}
                    className="h-8 px-3 bg-background border border-border rounded-lg text-[12px] text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-medium text-foreground">{tr("Trường ngữ nghĩa:", "Semantic field:")}</label>
                  <select
                    value={newColSemantic}
                    onChange={(e) => setNewColSemantic(e.target.value as SemanticField)}
                    className="h-8 px-2.5 bg-background border border-border rounded-lg text-[12px] text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="NOTES">{tr("-- Bỏ qua / Ghi chú --", "-- Ignore / Notes --")}</option>
                    <option value="CUSTOMER_NAME">{tr("Tên khách hàng", "Customer Name")}</option>
                    <option value="JOB_FOLDER_NAME">{tr("Tên file / Job Folder", "File / Job Folder Name")}</option>
                    <option value="SHOOT_DATE">{tr("Ngày chụp", "Shoot Date")}</option>
                    <option value="SHOOT_TIME">{tr("Giờ chụp", "Shoot Time")}</option>
                    <option value="EDITOR">{tr("Tên Editor", "Editor Name")}</option>
                    <option value="DELIVERY_LINK">{tr("Link Drive Trả ảnh", "Delivery Drive Link")}</option>
                    <option value="PHOTO_PICK_STATUS">{tr("Trạng thái lọc ảnh", "Photo Pick Status")}</option>
                    <option value="EDIT_COMPLETED_AT">{tr("Thời gian hoàn thành", "Completion Time")}</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddingColumn(false)}
                  className="h-7 px-3 text-[11.5px] text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                >
                  {tr("Hủy", "Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="btn-base btn-primary h-7 px-3.5 rounded-lg text-[11.5px]"
                >
                  {tr("Thêm cột", "Add Column")}
                </button>
              </div>
            </div>
          )}

          {/* Mapping Table */}
          <div className="w-full min-w-0 max-w-full bg-card border border-border rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-border bg-foreground/[0.03] text-muted-foreground font-medium">
                  <th className="py-2.5 px-4 w-12 text-center font-medium">{tr("Cột", "Col")}</th>
                  <th className="py-2.5 px-4 font-medium">{tr("Tiêu đề trên Sheet", "Sheet Header")}</th>
                  <th className="py-2.5 px-4 font-medium">{tr("Loại ô", "Cell Type")}</th>
                  <th className="py-2.5 px-4 font-medium">{tr("Trường dữ liệu", "Data Field")}</th>
                  <th className="py-2.5 px-4 font-medium">{tr("Quyền hạn", "Permission")}</th>
                  <th className="py-2.5 px-4 font-medium">{tr("Chính sách ghi", "Write Policy")}</th>
                  <th className="py-2.5 px-3 w-12 text-center font-medium">{tr("Xóa", "Del")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fieldMappings.map((m, idx) => {
                  const isCoreField =
                    m.semanticField === "CUSTOMER_NAME" ||
                    m.semanticField === "JOB_FOLDER_NAME" ||
                    m.semanticField === "EDITOR" ||
                    m.semanticField === "DELIVERY_LINK";

                  return (
                    <tr key={`${m.columnIndex}-${idx}`} className="hover:bg-foreground/[0.02] transition-colors">
                      <td className="py-2 px-4 font-mono font-semibold text-foreground text-center">
                        {m.columnLetter}
                      </td>
                      <td className="py-2 px-4 font-medium text-foreground">
                        {m.columnHeader}
                      </td>
                      <td className="py-2 px-4">
                        {m.isFormulaDerived ? (
                          <span className="px-2 py-0.5 rounded-md bg-foreground/[0.05] text-muted-foreground text-[11px]">
                            {tr("Công thức", "Formula")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">
                            {tr("Thường", "Standard")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-4">
                        <select
                          value={m.semanticField}
                          onChange={(e) => {
                            const val = e.target.value as SemanticField;
                            const updated = [...fieldMappings];
                            updated[idx] = { ...m, semanticField: val };
                            setFieldMappings(updated);
                          }}
                          className="h-7 bg-background border border-border rounded-lg px-2 text-[11.5px] focus:outline-none focus:border-primary text-foreground"
                        >
                          <option value="NOTES">{tr("-- Bỏ qua / Ghi chú --", "-- Ignore / Notes --")}</option>
                          <option value="CUSTOMER_NAME">{tr("Tên khách hàng", "Customer Name")}</option>
                          <option value="JOB_FOLDER_NAME">{tr("Tên file / Job Folder", "File / Job Folder Name")}</option>
                          <option value="SHOOT_DATE">{tr("Ngày chụp", "Shoot Date")}</option>
                          <option value="SHOOT_TIME">{tr("Giờ chụp", "Shoot Time")}</option>
                          <option value="EDITOR">{tr("Tên Editor", "Editor Name")}</option>
                          <option value="DELIVERY_LINK">{tr("Link Drive Trả ảnh", "Delivery Drive Link")}</option>
                          <option value="PHOTO_PICK_STATUS">{tr("Trạng thái lọc ảnh", "Photo Pick Status")}</option>
                          <option value="EDIT_COMPLETED_AT">{tr("Thời gian hoàn thành", "Completion Time")}</option>
                        </select>
                      </td>
                      <td className="py-2 px-4">
                        <select
                          disabled={m.isFormulaDerived}
                          value={m.permission}
                          onChange={(e) => {
                            const val = e.target.value as FieldPermission;
                            const updated = [...fieldMappings];
                            updated[idx] = { ...m, permission: val };
                            setFieldMappings(updated);
                          }}
                          className={`h-7 border rounded-lg px-2 text-[11.5px] font-medium focus:outline-none focus:border-primary ${
                            m.permission === "READ_WRITE"
                              ? "bg-primary/10 text-primary border-primary/25"
                              : "bg-background text-muted-foreground border-border"
                          }`}
                        >
                          <option value="READ_ONLY">{tr("Chỉ đọc", "Read-only")}</option>
                          <option value="READ_WRITE">{tr("Cho phép ghi", "Read & Write")}</option>
                          <option value="IGNORE">{tr("Bỏ qua", "Ignore")}</option>
                        </select>
                      </td>
                      <td className="py-2 px-4">
                        {m.permission === "READ_WRITE" ? (
                          <select
                            value={m.writePolicy}
                            onChange={(e) => {
                              const val = e.target.value as WritePolicy;
                              const updated = [...fieldMappings];
                              updated[idx] = { ...m, writePolicy: val };
                              setFieldMappings(updated);
                            }}
                            className="h-7 bg-background border border-border rounded-lg px-2 text-[11.5px] focus:outline-none focus:border-primary text-foreground"
                          >
                            <option value="SET_IF_EMPTY">{tr("Chỉ ghi nếu ô trống", "Write if empty")}</option>
                            <option value="ASK_BEFORE_OVERWRITE">{tr("Hỏi trước khi ghi đè", "Ask before overwrite")}</option>
                            <option value="ALWAYS_REPLACE">{tr("Luôn ghi đè", "Always overwrite")}</option>
                            <option value="APPEND">{tr("Nối tiếp dòng mới", "Append on new line")}</option>
                          </select>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {!isCoreField && (
                          <button
                            type="button"
                            onClick={() => handleRemoveColumn(m.columnIndex)}
                            title={tr("Xóa cột này", "Remove column")}
                            aria-label={tr("Xóa cột này", "Remove column")}
                            className="w-7 h-7 inline-flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setWizardStep(2)}
              className="h-8 px-3.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-[12px] font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={13.5} />
              <span>{tr("Quay lại", "Back")}</span>
            </button>
            <button
              type="button"
              onClick={() => setWizardStep(4)}
              className="btn-base btn-secondary h-8 px-4 rounded-xl text-[12px]"
            >
              <span>{tr("Tiếp tục: Giá trị tự động & Lưu", "Next: Auto Values & Save")}</span>
              <ArrowRight size={13.5} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Dropdown Values & Row Scope Overview */}
      {wizardStep === 4 && (
        <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full py-1 pb-8">
          <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-4 shadow-xs">
            <div>
              <h3 className="font-semibold text-[13.5px] text-foreground">
                {tr("Giá trị điền tự động & Phạm vi dữ liệu", "Auto-Fill Values & Row Scope")}
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                {tr("Thiết lập giá trị mặc định khi cập nhật hàng loạt lên Google Sheets.", "Configure default values written during Google Sheets batch updates.")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
              <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-background/50 border border-border">
                <label className="font-medium text-foreground flex items-center gap-1.5">
                  <User size={13} className="text-muted-foreground" />
                  <span>{tr("Tên Editor", "Editor Name")}</span>
                </label>
                <input
                  type="text"
                  value={currentUserEditor}
                  onChange={(e) => setCurrentUserEditor(e.target.value)}
                  placeholder="Vương"
                  className="h-8 px-3 bg-card border border-border rounded-lg text-foreground font-medium text-[12px] focus:outline-none focus:border-primary"
                />
                <span className="text-[11px] text-muted-foreground">
                  {tr("Điền vào cột Tên Edit (N)", "Writes to Editor Name column (N)")}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-background/50 border border-border">
                <label className="font-medium text-foreground flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-muted-foreground" />
                  <span>{tr("Trạng thái lọc", "Pick Status")}</span>
                </label>
                <input
                  type="text"
                  value={pickCompletedStatus}
                  onChange={(e) => setPickCompletedStatus(e.target.value)}
                  placeholder="Đã lọc"
                  className="h-8 px-3 bg-card border border-border rounded-lg text-foreground font-medium text-[12px] focus:outline-none focus:border-primary"
                />
                <span className="text-[11px] text-muted-foreground">
                  {tr("Điền vào cột Trạng Thái Lọc (M)", "Writes to Filter Status column (M)")}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-background/50 border border-border">
                <label className="font-medium text-foreground flex items-center gap-1.5">
                  <Layers size={13} className="text-muted-foreground" />
                  <span>{tr("Dòng dữ liệu bắt đầu", "Data Start Row")}</span>
                </label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={startRow}
                  onChange={(e) => setStartRow(parseInt(e.target.value) || 4)}
                  className="h-8 px-3 bg-card border border-border rounded-lg text-foreground font-medium text-[12px] focus:outline-none focus:border-primary"
                />
                <span className="text-[11px] text-muted-foreground">
                  {tr("Chỉ đọc & ghi từ dòng này trở xuống", "Only read & write from this row downward")}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-foreground/[0.03] border border-border rounded-xl flex flex-col gap-2 text-[12px]">
              <span className="font-medium text-foreground">{tr("Tóm tắt cấu hình hiện tại:", "Current Configuration Summary:")}</span>
              <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                <div>
                  <span className="text-muted-foreground">{tr("Tab chính:", "Primary tab:")} </span>
                  <span className="font-medium text-foreground">
                    {selectedTab?.title || activeProfile?.selectedTabTitle || "Edit 9/2026"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{tr("Số tab hiển thị ở Batch:", "Tabs shown in Batch:")} </span>
                  <span className="font-medium text-foreground">{configuredTabCount || 1} {tr("tab", "tab(s)")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{tr("Dòng tiêu đề:", "Header row:")} </span>
                  <span className="font-medium text-foreground">{tr("Dòng", "Row")} {selectedHeaderRow}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{tr("Dòng bắt đầu dữ liệu:", "Data start row:")} </span>
                  <span className="font-medium text-foreground">{tr("Dòng", "Row")} {startRow}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setWizardStep(3)}
              className="h-8 px-3.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-[12px] font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={13.5} />
              <span>{tr("Quay lại", "Back")}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              className="btn-base btn-primary h-9 px-5 rounded-xl text-[12px]"
            >
              <Save size={14} strokeWidth={1.75} />
              <span>{tr("Lưu cấu hình Workspace", "Save Workspace Config")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
