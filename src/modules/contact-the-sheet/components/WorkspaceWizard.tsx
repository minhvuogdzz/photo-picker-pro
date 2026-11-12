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
      alert("Vui lòng nhập chữ cái cột (ví dụ: T) và tiêu đề cột");
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
    if (confirm("Khôi phục đầy đủ 19 cột chuẩn Studio (A - S)?")) {
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
      alert(`Lỗi kết nối Google: ${err}`);
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
        alert("Phiên làm việc Google đã hết hạn hoặc chưa kết nối. Vui lòng bấm 'Kết nối Google' để đăng nhập lại.");
      } else {
        alert(msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeSheet = async () => {
    if (googleConnection.status !== "CONNECTED" && !googleCredentialManager.isConnected()) {
      alert("Vui lòng bấm 'Kết nối Google' trước khi khảo sát bảng tính.");
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
        alert("Phiên làm việc Google đã hết hạn hoặc chưa kết nối. Vui lòng bấm 'Kết nối Google' để đăng nhập lại.");
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
      `Áp dụng cấu hình cột và phạm vi hàng từ tab "${selectedTab?.title || "hiện tại"}" cho toàn bộ ${availableTabs.length} tab trong bảng tính?\n(Bạn có thể bấm "Hoàn tác" bất cứ lúc nào nếu muốn hủy)`
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
        alert("Cần giữ lại ít nhất 1 tab được áp dụng cấu hình.");
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
    alert(`Đã lưu cấu hình cho tab "${targetTabTitle}" (${Object.keys(updatedTabConfigs).length} tab hiển thị ở Thực thi Batch).`);
  };

  const configuredTabCount = Object.keys(tabConfigs).length;

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-5 gap-5 text-foreground custom-scrollbar">
      {/* Clean Wizard Stepper Bar */}
      <div className="flex flex-wrap items-center justify-between p-2.5 bg-card border border-border rounded-2xl shrink-0 w-full min-w-0 gap-2 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
          {[
            { step: 1, label: "Kết nối & Bảng tính" },
            { step: 2, label: "Khảo sát Tiêu đề & Tab" },
            { step: 3, label: "Phân quyền & Ánh xạ cột" },
            { step: 4, label: "Giá trị tự động & Lưu" },
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
              title="Hoàn tác việc áp dụng cho tất cả các tab — chỉ giữ lại tab đang làm việc"
            >
              <RotateCcw size={12.5} strokeWidth={1.75} />
              <span>Hoàn tác áp dụng tất cả ({configuredTabCount} tab)</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveProfile}
            className="btn-base btn-primary h-8 px-3.5 rounded-xl text-[11.5px]"
          >
            <Save size={13} strokeWidth={1.75} />
            <span>Lưu cấu hình</span>
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
                    1. Tài khoản Google Studio
                  </h3>
                  <p className="text-[11.5px] text-muted-foreground">
                    {googleConnection.status === "CONNECTED"
                      ? `Đã kết nối: ${googleConnection.accountEmail || "Tài khoản Google"}`
                      : "Kết nối tài khoản Google để đối soát Sheet và lấy link Drive."}
                  </p>
                </div>
              </div>

              {googleConnection.status === "CONNECTED" ? (
                <div className="flex items-center gap-2">
                  <span className="h-7 px-2.5 rounded-full bg-foreground/[0.04] border border-border text-[11.5px] text-foreground flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    <span>Đang kết nối</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="h-7 px-2.5 bg-foreground/[0.04] hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border rounded-lg text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut size={12.5} strokeWidth={1.75} />
                    <span>Đổi tài khoản</span>
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
                  <span>{isConnectingGoogle ? "Đang mở trình duyệt..." : "Kết nối Google"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Sheet URL Input */}
          <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-xs">
            <div>
              <h3 className="font-semibold text-[13.5px] text-foreground">
                2. Liên kết Google Sheet Studio
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                Dán đường link bảng tính Google Sheets cần đối soát:
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
                Tự động lưu đường dẫn bảng tính cho lần mở tiếp theo.
              </span>
              <button
                type="button"
                onClick={handleAnalyzeSheet}
                disabled={isAnalyzing || !sheetUrl.trim()}
                className="btn-base btn-primary h-8 px-4 rounded-xl text-[12px]"
              >
                <Search size={13.5} strokeWidth={1.75} />
                <span>{isAnalyzing ? "Đang khảo sát..." : "Khảo sát bảng tính"}</span>
              </button>
            </div>

            {/* Discovered Tabs List */}
            {availableTabs.length > 0 && (
              <div className="mt-2 pt-3 border-t border-border flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[12px] text-foreground">
                    Các trang tính trong bảng ({availableTabs.length} tab):
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Đã áp dụng Batch: {configuredTabCount || 1} tab
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
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Đã áp dụng vào Thực thi Batch" />
                          )}
                          <span className="text-[10.5px] text-muted-foreground tabular-nums">
                            {t.columnCount} cột
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
              <span>Tiếp tục: Khảo sát Tiêu đề & Tab</span>
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
              subtitle="Chọn tab cần áp dụng cấu hình. Chỉ những tab được áp dụng tại đây mới hiển thị ở phần Thực thi Batch."
            />
          )}

          {/* If user has > 1 configured tabs from previous session even before analyzing sheet */}
          {availableTabs.length === 0 && configuredTabCount > 1 && (
            <div className="p-4 rounded-2xl bg-card border border-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[12.5px] font-semibold text-foreground">
                  Đang áp dụng cấu hình cho {configuredTabCount} tab trong Thực thi Batch
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  Nếu bạn lỡ tay ấn "Áp dụng cho tất cả Tab", bấm nút bên cạnh để hoàn tác và chỉ giữ lại tab chính ({activeProfile?.selectedTabTitle}).
                </span>
              </div>
              <button
                type="button"
                onClick={handleUndoCopyAllTabs}
                className="h-8 px-3 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/25 text-primary text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} strokeWidth={1.75} />
                <span>Hoàn tác ({configuredTabCount} → 1 tab)</span>
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
                    Cấu hình Dòng Tiêu đề (Header Row)
                  </h3>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    Tab đang chọn: <span className="text-foreground font-medium">{activeProfile?.selectedTabTitle || "Edit 9/2026"}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAnalyzeSheet}
                  disabled={isAnalyzing || !sheetUrl.trim()}
                  className="h-8 px-3 bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground border border-border text-[11.5px] font-medium rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCw size={12.5} className={isAnalyzing ? "animate-spin" : ""} />
                  <span>{isAnalyzing ? "Đang đồng bộ..." : "Khảo sát các tab từ Sheet"}</span>
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-background/50 border border-border rounded-xl">
                <span className="text-[12px] font-medium text-foreground">Dòng tiêu đề hiện tại:</span>
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
                  (Dòng chứa tên cột: Ngày, Giờ, Tên khách, Tên file, Tên Edit, Link Edit...)
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[11.5px] font-medium text-muted-foreground">
                  Các cột đã ánh xạ ({fieldMappings.length} cột):
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
                        {m.permission === "READ_WRITE" ? "Ghi" : "Đọc"}
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
              <span>Quay lại</span>
            </button>
            <button
              type="button"
              onClick={() => setWizardStep(3)}
              className="btn-base btn-secondary h-8 px-4 rounded-xl text-[12px]"
            >
              <span>Tiếp tục: Phân quyền & Ánh xạ cột</span>
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
              subtitle="Cấu hình ánh xạ cột riêng cho từng trang tính hoặc chọn các tab cần áp dụng."
            />
          )}

          {/* Step 3 Header & Action Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-[13.5px] text-foreground flex items-center gap-2">
                <span>Phân quyền & Khớp trường dữ liệu</span>
                <span className="px-2 py-0.5 rounded-md bg-foreground/[0.05] text-muted-foreground text-[11px] font-medium">
                  {fieldMappings.length} cột
                </span>
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                Chỉ định ý nghĩa từng cột. Các cột công thức được khóa chỉ đọc tự động để bảo vệ bảng tính.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsAddingColumn(!isAddingColumn)}
                className="h-8 px-3 bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground border border-border rounded-xl text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>Thêm cột</span>
              </button>

              <button
                type="button"
                onClick={handleResetToStandard19}
                className="h-8 px-3 bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground border border-border rounded-xl text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>Chuẩn 19 cột Studio</span>
              </button>
            </div>
          </div>

          {isAddingColumn && (
            <div className="p-4 bg-card border border-border rounded-2xl flex flex-col gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-[12.5px] font-semibold text-foreground">
                  Thêm cột tùy chỉnh
                </h4>
                <button
                  type="button"
                  aria-label="Đóng"
                  onClick={() => setIsAddingColumn(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[12px]">
                <div className="flex flex-col gap-1">
                  <label className="font-medium text-foreground">Chữ cái cột:</label>
                  <input
                    type="text"
                    placeholder="T"
                    value={newColLetter}
                    onChange={(e) => setNewColLetter(e.target.value.toUpperCase())}
                    className="h-8 px-3 bg-background border border-border rounded-lg font-mono text-[12px] font-medium text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="font-medium text-foreground">Tiêu đề cột trên Sheet:</label>
                  <input
                    type="text"
                    placeholder="Ghi chú thêm..."
                    value={newColHeader}
                    onChange={(e) => setNewColHeader(e.target.value)}
                    className="h-8 px-3 bg-background border border-border rounded-lg text-[12px] text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-medium text-foreground">Trường ngữ nghĩa:</label>
                  <select
                    value={newColSemantic}
                    onChange={(e) => setNewColSemantic(e.target.value as SemanticField)}
                    className="h-8 px-2.5 bg-background border border-border rounded-lg text-[12px] text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="NOTES">-- Bỏ qua / Ghi chú --</option>
                    <option value="CUSTOMER_NAME">Tên khách hàng</option>
                    <option value="JOB_FOLDER_NAME">Tên file / Job Folder</option>
                    <option value="SHOOT_DATE">Ngày chụp</option>
                    <option value="SHOOT_TIME">Giờ chụp</option>
                    <option value="EDITOR">Tên Editor</option>
                    <option value="DELIVERY_LINK">Link Drive Trả ảnh</option>
                    <option value="PHOTO_PICK_STATUS">Trạng thái lọc ảnh</option>
                    <option value="EDIT_COMPLETED_AT">Thời gian hoàn thành</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddingColumn(false)}
                  className="h-7 px-3 text-[11.5px] text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="btn-base btn-primary h-7 px-3.5 rounded-lg text-[11.5px]"
                >
                  Thêm cột
                </button>
              </div>
            </div>
          )}

          {/* Mapping Table */}
          <div className="w-full min-w-0 max-w-full bg-card border border-border rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-border bg-foreground/[0.03] text-muted-foreground font-medium">
                  <th className="py-2.5 px-4 w-12 text-center font-medium">Cột</th>
                  <th className="py-2.5 px-4 font-medium">Tiêu đề trên Sheet</th>
                  <th className="py-2.5 px-4 font-medium">Loại ô</th>
                  <th className="py-2.5 px-4 font-medium">Trường dữ liệu</th>
                  <th className="py-2.5 px-4 font-medium">Quyền hạn</th>
                  <th className="py-2.5 px-4 font-medium">Chính sách ghi</th>
                  <th className="py-2.5 px-3 w-12 text-center font-medium">Xóa</th>
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
                            Công thức
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">
                            Thường
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
                          <option value="NOTES">-- Bỏ qua / Ghi chú --</option>
                          <option value="CUSTOMER_NAME">Tên khách hàng</option>
                          <option value="JOB_FOLDER_NAME">Tên file / Job Folder</option>
                          <option value="SHOOT_DATE">Ngày chụp</option>
                          <option value="SHOOT_TIME">Giờ chụp</option>
                          <option value="EDITOR">Tên Editor</option>
                          <option value="DELIVERY_LINK">Link Drive Trả ảnh</option>
                          <option value="PHOTO_PICK_STATUS">Trạng thái lọc ảnh</option>
                          <option value="EDIT_COMPLETED_AT">Thời gian hoàn thành</option>
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
                          <option value="READ_ONLY">Chỉ đọc</option>
                          <option value="READ_WRITE">Cho phép ghi</option>
                          <option value="IGNORE">Bỏ qua</option>
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
                            <option value="SET_IF_EMPTY">Chỉ ghi nếu ô trống</option>
                            <option value="ASK_BEFORE_OVERWRITE">Hỏi trước khi ghi đè</option>
                            <option value="ALWAYS_REPLACE">Luôn ghi đè</option>
                            <option value="APPEND">Nối tiếp dòng mới</option>
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
                            title="Xóa cột này"
                            aria-label="Xóa cột này"
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
              <span>Quay lại</span>
            </button>
            <button
              type="button"
              onClick={() => setWizardStep(4)}
              className="btn-base btn-secondary h-8 px-4 rounded-xl text-[12px]"
            >
              <span>Tiếp tục: Giá trị tự động & Lưu</span>
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
                Giá trị điền tự động & Phạm vi dữ liệu
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                Thiết lập giá trị mặc định khi cập nhật hàng loạt lên Google Sheets.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
              <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-background/50 border border-border">
                <label className="font-medium text-foreground flex items-center gap-1.5">
                  <User size={13} className="text-muted-foreground" />
                  <span>Tên Editor</span>
                </label>
                <input
                  type="text"
                  value={currentUserEditor}
                  onChange={(e) => setCurrentUserEditor(e.target.value)}
                  placeholder="Vương"
                  className="h-8 px-3 bg-card border border-border rounded-lg text-foreground font-medium text-[12px] focus:outline-none focus:border-primary"
                />
                <span className="text-[11px] text-muted-foreground">
                  Điền vào cột Tên Edit (N)
                </span>
              </div>

              <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-background/50 border border-border">
                <label className="font-medium text-foreground flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-muted-foreground" />
                  <span>Trạng thái lọc</span>
                </label>
                <input
                  type="text"
                  value={pickCompletedStatus}
                  onChange={(e) => setPickCompletedStatus(e.target.value)}
                  placeholder="Đã lọc"
                  className="h-8 px-3 bg-card border border-border rounded-lg text-foreground font-medium text-[12px] focus:outline-none focus:border-primary"
                />
                <span className="text-[11px] text-muted-foreground">
                  Điền vào cột Trạng Thái Lọc (M)
                </span>
              </div>

              <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-background/50 border border-border">
                <label className="font-medium text-foreground flex items-center gap-1.5">
                  <Layers size={13} className="text-muted-foreground" />
                  <span>Dòng dữ liệu bắt đầu</span>
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
                  Chỉ đọc & ghi từ dòng này trở xuống
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-foreground/[0.03] border border-border rounded-xl flex flex-col gap-2 text-[12px]">
              <span className="font-medium text-foreground">Tóm tắt cấu hình hiện tại:</span>
              <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                <div>
                  <span className="text-muted-foreground">Tab chính: </span>
                  <span className="font-medium text-foreground">
                    {selectedTab?.title || activeProfile?.selectedTabTitle || "Edit 9/2026"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Số tab hiển thị ở Batch: </span>
                  <span className="font-medium text-foreground">{configuredTabCount || 1} tab</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Dòng tiêu đề: </span>
                  <span className="font-medium text-foreground">Dòng {selectedHeaderRow}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Dòng bắt đầu dữ liệu: </span>
                  <span className="font-medium text-foreground">Dòng {startRow}</span>
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
              <span>Quay lại</span>
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              className="btn-base btn-primary h-9 px-5 rounded-xl text-[12px]"
            >
              <Save size={14} strokeWidth={1.75} />
              <span>Lưu cấu hình Workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
