import React, { useState } from "react";
import {
  Sliders,
  Cloud,
  CheckCircle2,
  AlertTriangle,
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

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [sheetUrl, setSheetUrl] = useState(
    lastSheetUrl ||
      (activeProfile?.spreadsheetId
        ? `https://docs.google.com/spreadsheets/d/${activeProfile.spreadsheetId}/edit`
        : "https://docs.google.com/spreadsheets/d/1mQQ7FeFvy93kked5T_ob7wiiRa8XhX9lC54i6M_J0ak/edit")
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

  // Fallback to full 19 columns if activeProfile mappings are incomplete
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

  // State for adding custom column
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColLetter, setNewColLetter] = useState("");
  const [newColHeader, setNewColHeader] = useState("");
  const [newColSemantic, setNewColSemantic] = useState<SemanticField>("NOTES");
  const [newColPermission, setNewColPermission] = useState<FieldPermission>("READ_ONLY");

  const handleAddColumn = () => {
    const letter = newColLetter.trim().toUpperCase();
    const header = newColHeader.trim();
    if (!letter || !header) {
      alert("Vui lòng nhập Chữ cái cột (ví dụ: T) và Tiêu đề cột");
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
      writePolicy: newColPermission === "READ_WRITE" ? "SET_IF_EMPTY" : "SET_IF_EMPTY",
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
    if (confirm("Khôi phục đầy đủ 19 cột chuẩn Studio (A - S)? Các cột tùy chỉnh thêm sẽ được đặt lại.")) {
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

  const handleSurveyTab = async (targetTab: SheetTabInfo) => {
    setIsAnalyzing(true);
    try {
      const spreadsheetId = sheetDiscoveryService.parseSpreadsheetId(sheetUrl);
      setLastSheetUrl(sheetUrl);
      const analysis = await sheetDiscoveryService.analyzeTabSchema(
        spreadsheetId,
        targetTab,
        40,
        false // Never mock
      );

      setAnalysisResult(analysis);
      setSelectedTab(targetTab);

      // Check if this tab already has saved config
      const existingConfig = tabConfigs[targetTab.title];
      if (existingConfig) {
        setSelectedHeaderRow(existingConfig.headerRow);
        setFieldMappings(existingConfig.fieldMappings);
        setStartRow(existingConfig.rowScope.startRow);
      } else {
        setSelectedHeaderRow(analysis.detectedHeaderRow);
        // Transfer / clone existing mapping intents or generate smart mappings
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
        alert("Phiên làm việc Google đã hết hạn hoặc chưa kết nối. Vui lòng bấm nút 'Kết nối Google' để đăng nhập lại.");
      } else {
        alert(msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeSheet = async () => {
    if (googleConnection.status !== "CONNECTED" && !googleCredentialManager.isConnected()) {
      alert("Vui lòng bấm nút 'Kết nối Google' để đăng nhập tài khoản trước khi khảo sát bảng tính.");
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
        alert("Phiên làm việc Google đã hết hạn hoặc chưa kết nối. Vui lòng bấm nút 'Kết nối Google' để đăng nhập lại.");
      } else {
        alert(msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSwitchTabInWizard = async (tab: SheetTabInfo) => {
    // 1. Save current tab in memory before switching
    if (selectedTab) {
      const fingerprint = schemaMappingService.generateSchemaFingerprint(
        fieldMappings.map((m) => ({ index: m.columnIndex, headerName: m.columnHeader }))
      );
      const currentConfig: TabConfiguration = {
        sheetId: selectedTab.sheetId,
        tabTitle: selectedTab.title,
        headerRow: selectedHeaderRow,
        fieldMappings,
        rowScope: { startRow, ignoreEmptyRows: true },
        schemaFingerprint: fingerprint,
        updatedAt: new Date().toISOString(),
      };
      setTabConfigs((prev) => ({ ...prev, [selectedTab.title]: currentConfig }));
    }

    // 2. Survey target tab
    await handleSurveyTab(tab);
  };

  const handleSaveProfile = () => {
    const spreadsheetId = sheetDiscoveryService.parseSpreadsheetId(sheetUrl);
    setLastSheetUrl(sheetUrl);

    const targetTabTitle = selectedTab?.title || analysisResult?.tab.title || activeProfile?.selectedTabTitle || "Edit 9/2026";
    const targetTabId = selectedTab?.sheetId ?? analysisResult?.tab.sheetId ?? activeProfile?.selectedTabId ?? 0;

    const fingerprint = schemaMappingService.generateSchemaFingerprint(
      fieldMappings.map((m) => ({ index: m.columnIndex, headerName: m.columnHeader }))
    );

    const currentTabConfig: TabConfiguration = {
      sheetId: targetTabId,
      tabTitle: targetTabTitle,
      headerRow: selectedHeaderRow,
      fieldMappings,
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
      displayName: activeProfile?.displayName || "Studio Ops",
      googleAccountEmail: googleConnection.accountEmail,
      spreadsheetId,
      spreadsheetTitle: analysisResult?.tab.title || activeProfile?.spreadsheetTitle || "Link edit",
      selectedTabTitle: targetTabTitle,
      selectedTabId: targetTabId,
      headerRow: selectedHeaderRow,
      fieldMappings,
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
        localRootPath: "/Users/vuongdev/Library/CloudStorage/GoogleDrive-ougn.it2@gmail.com/My Drive",
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

    saveProfile(newProfile);
    alert(`Đã lưu cấu hình Workspace và cấu hình cho tab "${targetTabTitle}" thành công! Dữ liệu đã được lưu bền vững.`);
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-6 gap-6 text-foreground custom-scrollbar">
      {/* Wizard Progress Stepper - Fully Clickable */}
      <div className="flex items-center justify-between p-3.5 bg-card/60 border border-border/80 rounded-2xl shrink-0 w-full min-w-0 overflow-x-auto gap-3 backdrop-blur-md shadow-sm">
        {[
          { step: 1, label: "Kết nối & URL Sheet" },
          { step: 2, label: "Khảo sát Header & Cột" },
          { step: 3, label: "Phân quyền & Khớp trường" },
          { step: 4, label: "Giá trị Dropdown & Phạm vi" },
        ].map((s) => (
          <button
            key={s.step}
            type="button"
            onClick={() => setWizardStep(s.step as any)}
            className={`flex items-center gap-2.5 transition-all cursor-pointer bg-transparent border-0 p-1 text-left rounded-xl hover:bg-muted/40 ${
              wizardStep === s.step
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                wizardStep === s.step
                  ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s.step}
            </div>
            <span className="text-xs font-semibold whitespace-nowrap">{s.label}</span>
          </button>
        ))}
      </div>

      {/* STEP 1: Connect Google & Sheet URL */}
      {wizardStep === 1 && (
        <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full py-2">
          {/* Google Connection Box */}
          <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
                  <Cloud size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-foreground">
                    1. Tài khoản Google Studio
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {googleConnection.status === "CONNECTED"
                      ? `Đã kết nối: ${googleConnection.accountEmail || "Tài khoản Google"}`
                      : "Chỉ cần kết nối 1 lần duy nhất để đối soát Sheet và lấy link Drive."}
                  </p>
                </div>
              </div>

              {googleConnection.status === "CONNECTED" ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-400 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-1">
                    <Check size={12} /> Đang kết nối
                  </span>
                  <button
                    onClick={handleDisconnectGoogle}
                    className="px-3 py-1.5 bg-destructive/15 hover:bg-destructive/25 text-destructive rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut size={13} />
                    <span>Đổi tài khoản</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Cloud size={14} />
                  <span>{isConnectingGoogle ? "Đang mở trình duyệt..." : "Kết nối Google"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Sheet URL Input */}
          <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-3 shadow-sm">
            <h3 className="font-extrabold text-sm text-foreground">
              2. Liên kết Google Sheet Studio
            </h3>
            <p className="text-xs text-muted-foreground">
              Đường link bảng tính Google Sheets đối soát (được tự động lưu lại cho các lần sau):
            </p>
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => {
                const val = e.target.value;
                setSheetUrl(val);
                setLastSheetUrl(val);
              }}
              placeholder="https://docs.google.com/spreadsheets/d/1mQQ7FeFvy93kked5T_ob7wiiRa8XhX9lC54i6M_J0ak/edit..."
              className="px-3.5 py-2.5 bg-background border border-border rounded-xl text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
            />

            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground">
                Tự động nhớ link gần nhất khi mở lại app.
              </span>
              <button
                onClick={handleAnalyzeSheet}
                disabled={isAnalyzing || !sheetUrl.trim()}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-md hover:opacity-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Search size={14} />
                <span>{isAnalyzing ? "Đang khảo sát cấu trúc..." : "Khảo sát Cấu trúc Bảng tính"}</span>
              </button>
            </div>

            {/* Discovered Tabs List */}
            {availableTabs.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground">
                    Các trang tính (Tabs) trong bảng ({availableTabs.length}):
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Bấm vào tab để khảo sát cấu trúc riêng
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {availableTabs.map((t) => {
                    const isConfigured = !!tabConfigs[t.title];
                    const isCurrent = selectedTab?.sheetId === t.sheetId;
                    return (
                      <button
                        key={t.sheetId}
                        onClick={() => handleSurveyTab(t)}
                        disabled={isAnalyzing}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all text-left cursor-pointer ${
                          isCurrent
                            ? "bg-primary/10 border-primary/40 text-primary shadow-sm"
                            : "bg-background/80 hover:bg-muted/40 border-border text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Table size={14} className="text-primary shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isConfigured && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                              Đã lưu
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
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

          <div className="flex items-center justify-end pt-2">
            <button
              onClick={() => setWizardStep(2)}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:opacity-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Tiếp tục: Khảo sát Header & Cột</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Header Confirmation & Column Profiles */}
      {wizardStep === 2 && (
        <div className="flex flex-col gap-5 w-full min-w-0 max-w-full">
          {availableTabs.length > 0 && (
            <SheetTabManager
              availableTabs={availableTabs}
              selectedTab={selectedTab}
              tabConfigs={tabConfigs}
              isAnalyzing={isAnalyzing}
              onSelectTab={handleSwitchTabInWizard}
              subtitle="Chọn hoặc chuyển đổi giữa các trang tính để khảo sát tiêu đề và số cột tương ứng."
            />
          )}

          {analysisResult ? (
            <AnalysisReportCard
              analysis={analysisResult}
              selectedHeaderRow={selectedHeaderRow}
              onConfirmHeader={(row) => setSelectedHeaderRow(row)}
            />
          ) : (
            /* Direct Profile View when entering Step 2 directly */
            <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-foreground">
                    Cấu hình Dòng Tiêu đề (Header Row)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Đang sử dụng cấu hình đã lưu cho tab <b className="text-emerald-400">{activeProfile?.selectedTabTitle || "Edit 9/2026"}</b>. Bạn có thể thay đổi số dòng hoặc bấm khảo sát trực tiếp từ Google Sheet.
                  </p>
                </div>
                <button
                  onClick={handleAnalyzeSheet}
                  disabled={isAnalyzing || !sheetUrl.trim()}
                  className="px-3.5 py-2 bg-muted/60 hover:bg-muted text-foreground border border-border text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCw size={13} className={isAnalyzing ? "animate-spin" : ""} />
                  <span>{isAnalyzing ? "Đang đồng bộ..." : "Khảo sát lại từ Sheet"}</span>
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-background/60 border border-border rounded-xl">
                <span className="text-xs font-bold text-foreground">Dòng tiêu đề hiện tại:</span>
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
                  className="w-20 px-2.5 py-1.5 bg-card border border-border rounded-lg text-foreground font-bold text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                />
                <span className="text-xs text-muted-foreground">
                  (Dòng chứa tên cột: Ngày, Giờ, Tên khách, Tên file, Tên Edit, Link Edit...)
                </span>
              </div>

              {/* Column list overview from existing mappings */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold text-muted-foreground">
                  Các cột đã cấu hình ({fieldMappings.length} cột):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {fieldMappings.map((m) => (
                    <div
                      key={m.columnIndex}
                      className="p-2.5 rounded-xl bg-background/50 border border-border flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 text-[11px]">
                          {m.columnLetter}
                        </span>
                        <span className="font-medium text-foreground truncate" title={m.columnHeader}>
                          {m.columnHeader}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          m.permission === "READ_WRITE"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-muted text-muted-foreground"
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

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setWizardStep(1)}
              className="px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Quay lại</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveProfile}
                className="px-4 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save size={13} />
                <span>Lưu cấu hình</span>
              </button>
              <button
                onClick={() => setWizardStep(3)}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:opacity-95 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Tiếp tục: Phân quyền & Khớp trường</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Field Mapping & Permissions */}
      {wizardStep === 3 && (
        <div className="flex flex-col gap-5 w-full min-w-0 max-w-full pb-10">
          {availableTabs.length > 0 && (
            <SheetTabManager
              availableTabs={availableTabs}
              selectedTab={selectedTab}
              tabConfigs={tabConfigs}
              isAnalyzing={isAnalyzing}
              onSelectTab={handleSwitchTabInWizard}
              subtitle="Cấu hình ánh xạ cột riêng biệt cho từng trang tính. Tab khác nhau có thứ tự cột khác nhau."
            />
          )}

          {/* Step 3 Header & Action Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                <span>Cấu hình Phân quyền & Khớp trường ngữ nghĩa</span>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold">
                  {fieldMappings.length} cột
                </span>
                {selectedTab && (
                  <span className="text-xs text-muted-foreground font-normal">
                    (Tab: {selectedTab.title})
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chỉ định trường ngữ nghĩa cho từng cột trên tab này. Các cột công thức (IMPORTRANGE / Formula) được bảo vệ READ_ONLY an toàn.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsAddingColumn(!isAddingColumn)}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>Thêm cột mapping</span>
              </button>

              <button
                type="button"
                onClick={handleResetToStandard19}
                className="px-3 py-1.5 bg-muted/60 hover:bg-muted text-foreground border border-border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Khôi phục đầy đủ 19 cột chuẩn Studio từ A đến S"
              >
                <RefreshCw size={12} />
                <span>Chuẩn 19 cột Studio</span>
              </button>

              <button
                type="button"
                onClick={handleAnalyzeSheet}
                disabled={isAnalyzing || !sheetUrl.trim()}
                className="px-3 py-1.5 bg-muted/60 hover:bg-muted text-foreground border border-border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <RotateCw size={12} className={isAnalyzing ? "animate-spin" : ""} />
                <span>{isAnalyzing ? "Đang dò..." : "Khảo sát từ Sheet"}</span>
              </button>
            </div>
          </div>

          {/* Form thêm cột mới */}
          {isAddingColumn && (
            <div className="p-4 bg-card border border-primary/30 rounded-2xl flex flex-col gap-3 shadow-md animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                  <Plus size={14} className="text-primary" />
                  <span>Thêm cột mapping tùy chỉnh vào bảng</span>
                </h4>
                <button
                  onClick={() => setIsAddingColumn(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-foreground">Chữ cái cột (A, B, C...):</label>
                  <input
                    type="text"
                    placeholder="T"
                    value={newColLetter}
                    onChange={(e) => setNewColLetter(e.target.value.toUpperCase())}
                    className="px-3 py-2 bg-background border border-border rounded-xl font-mono text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="font-bold text-foreground">Tiêu đề cột trên Sheet:</label>
                  <input
                    type="text"
                    placeholder="Ghi chú thêm, Mã phụ..."
                    value={newColHeader}
                    onChange={(e) => setNewColHeader(e.target.value)}
                    className="px-3 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-foreground">Trường ngữ nghĩa:</label>
                  <select
                    value={newColSemantic}
                    onChange={(e) => setNewColSemantic(e.target.value as SemanticField)}
                    className="px-2.5 py-2 bg-background border border-border rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
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

              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsAddingColumn(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-sm hover:opacity-95"
                >
                  Xác nhận thêm cột
                </button>
              </div>
            </div>
          )}

          {/* Mapping Table */}
          <div className="w-full min-w-0 max-w-full bg-background/60 border border-border rounded-2xl overflow-x-auto shadow-inner">
            <table className="w-full min-w-[760px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                  <th className="py-2.5 px-4 w-12 text-center">Cột</th>
                  <th className="py-2.5 px-4">Tiêu đề trên Sheet</th>
                  <th className="py-2.5 px-4">Phân loại dữ liệu</th>
                  <th className="py-2.5 px-4">Trường Ngữ nghĩa (Semantic)</th>
                  <th className="py-2.5 px-4">Quyền hạn ghi</th>
                  <th className="py-2.5 px-4">Chính sách ghi đè</th>
                  <th className="py-2.5 px-3 w-12 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {fieldMappings.map((m, idx) => {
                  const isCoreField =
                    m.semanticField === "CUSTOMER_NAME" ||
                    m.semanticField === "JOB_FOLDER_NAME" ||
                    m.semanticField === "EDITOR" ||
                    m.semanticField === "DELIVERY_LINK";

                  return (
                    <tr key={`${m.columnIndex}-${idx}`} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-extrabold text-primary text-center">
                        {m.columnLetter}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-foreground">
                        {m.columnHeader}
                      </td>
                      <td className="py-2.5 px-4">
                        {m.isFormulaDerived ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
                            Công thức (Bảo vệ)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
                            Dữ liệu thường
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          value={m.semanticField}
                          onChange={(e) => {
                            const val = e.target.value as SemanticField;
                            const updated = [...fieldMappings];
                            updated[idx] = { ...m, semanticField: val };
                            setFieldMappings(updated);
                          }}
                          className="bg-muted/40 border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary font-medium text-foreground"
                        >
                          <option value="NOTES">-- Bỏ qua / Ghi chú --</option>
                          <option value="CUSTOMER_NAME">Tên khách hàng (CUSTOMER_NAME)</option>
                          <option value="JOB_FOLDER_NAME">Tên file / Job Folder (JOB_FOLDER_NAME)</option>
                          <option value="SHOOT_DATE">Ngày chụp (SHOOT_DATE)</option>
                          <option value="SHOOT_TIME">Giờ chụp (SHOOT_TIME)</option>
                          <option value="EDITOR">Tên Editor (EDITOR)</option>
                          <option value="DELIVERY_LINK">Link Drive Trả ảnh (DELIVERY_LINK)</option>
                          <option value="PHOTO_PICK_STATUS">Trạng thái lọc ảnh (PHOTO_PICK_STATUS)</option>
                          <option value="EDIT_COMPLETED_AT">Thời gian hoàn thành (EDIT_COMPLETED_AT)</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-4">
                        <select
                          disabled={m.isFormulaDerived}
                          value={m.permission}
                          onChange={(e) => {
                            const val = e.target.value as FieldPermission;
                            const updated = [...fieldMappings];
                            updated[idx] = { ...m, permission: val };
                            setFieldMappings(updated);
                          }}
                          className={`border rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary ${
                            m.permission === "READ_WRITE"
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-muted/40 text-muted-foreground border-border"
                          }`}
                        >
                          <option value="READ_ONLY">Chỉ đọc (READ_ONLY)</option>
                          <option value="READ_WRITE">Cho phép ghi (READ_WRITE)</option>
                          <option value="IGNORE">Bỏ qua (IGNORE)</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-4">
                        {m.permission === "READ_WRITE" ? (
                          <select
                            value={m.writePolicy}
                            onChange={(e) => {
                              const val = e.target.value as WritePolicy;
                              const updated = [...fieldMappings];
                              updated[idx] = { ...m, writePolicy: val };
                              setFieldMappings(updated);
                            }}
                            className="bg-muted/40 border border-border rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                          >
                            <option value="SET_IF_EMPTY">Chỉ ghi nếu ô trống (SET_IF_EMPTY)</option>
                            <option value="ASK_BEFORE_OVERWRITE">Hỏi trước khi ghi đè (ASK_BEFORE_OVERWRITE)</option>
                            <option value="ALWAYS_REPLACE">Luôn ghi đè (ALWAYS_REPLACE)</option>
                            <option value="APPEND">Nối tiếp dòng mới (APPEND)</option>
                          </select>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {!isCoreField && (
                          <button
                            type="button"
                            onClick={() => handleRemoveColumn(m.columnIndex)}
                            title="Xóa cột này khỏi danh sách mapping"
                            className="p-1 hover:bg-destructive/15 text-muted-foreground hover:text-destructive rounded-lg transition-colors cursor-pointer"
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

          {/* Card: Thiết lập Giá trị Điền tự động & Phạm vi dữ liệu (NỘI DUNG BÊN DƯỚI BẢNG) */}
          <div className="p-5 rounded-2xl bg-card border border-border flex flex-col gap-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Settings2 size={16} />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-foreground">
                    Cấu hình Giá trị Điền Tự Động & Phạm vi dữ liệu
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Thiết lập tên Editor và trạng thái ghi đè khi thực thi cập nhật hàng loạt lên Google Sheets.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck size={12} />
                <span>Bảo vệ an toàn 2 lớp</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Editor Name */}
              <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-background/50 border border-border">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <User size={13} className="text-primary" />
                  <span>Tên Editor của bạn:</span>
                </label>
                <input
                  type="text"
                  value={currentUserEditor}
                  onChange={(e) => setCurrentUserEditor(e.target.value)}
                  placeholder="Vương"
                  className="px-3 py-2 bg-card border border-border rounded-lg text-foreground font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                />
                <span className="text-[10px] text-muted-foreground">
                  Khớp với dropdown Tên Edit trên Sheet (Vương, Hân, Ngân...)
                </span>
              </div>

              {/* Pick Completed Status */}
              <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-background/50 border border-border">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <span>Trạng thái lọc hoàn tất:</span>
                </label>
                <input
                  type="text"
                  value={pickCompletedStatus}
                  onChange={(e) => setPickCompletedStatus(e.target.value)}
                  placeholder="Đã lọc"
                  className="px-3 py-2 bg-card border border-border rounded-lg text-foreground font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                />
                <span className="text-[10px] text-muted-foreground">
                  Giá trị đánh dấu sau khi lọc (Đã lọc, Chưa lọc, Đã lọc 2...)
                </span>
              </div>

              {/* Start Row */}
              <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-background/50 border border-border">
                <label className="font-bold text-foreground flex items-center gap-1.5">
                  <Layers size={13} className="text-purple-400" />
                  <span>Dòng bắt đầu chứa dữ liệu khách:</span>
                </label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={startRow}
                  onChange={(e) => setStartRow(parseInt(e.target.value) || 4)}
                  className="px-3 py-2 bg-card border border-border rounded-lg text-foreground font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
                />
                <span className="text-[10px] text-muted-foreground">
                  Chỉ đọc và ghi từ dòng này trở xuống (Mặc định: Dòng 4)
                </span>
              </div>
            </div>

            {/* Security Guarantee Notice */}
            <div className="p-3 bg-muted/30 border border-border/80 rounded-xl flex items-center gap-2.5 text-[11px] text-muted-foreground">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
              <span>
                <b>Nguyên tắc bảo vệ dữ liệu:</b> Cột công thức (A, B, H, S...) được khóa <b>READ_ONLY</b> tuyệt đối. Hệ thống chỉ ghi vào 2 cột: <b>N (Tên Edit)</b> và <b>O (Link Edit)</b>.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setWizardStep(2)}
              className="px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Quay lại: Bước 2</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveProfile}
                className="px-4 py-2 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Save size={13} />
                <span>Lưu cấu hình</span>
              </button>
              <button
                onClick={() => setWizardStep(4)}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:opacity-95 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Tiếp tục: Bước 4 (Tổng quan)</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Dropdown Values & Row Scope Overview */}
      {wizardStep === 4 && (
        <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full py-2 pb-10">
          <div className="p-6 rounded-2xl bg-card border border-border flex flex-col gap-5 shadow-sm">
            <div>
              <h3 className="font-extrabold text-sm text-foreground">
                Tổng quan Cấu hình Workspace & Giá trị tự động
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Xem lại các thông số tự động điền trước khi bắt đầu sử dụng chức năng Thực thi Batch.
              </p>
            </div>

            {/* Current Editor Value */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <User size={13} className="text-primary" />
                <span>Tên Editor của bạn (Giá trị sẽ điền vào cột Tên Edit):</span>
              </label>
              <input
                type="text"
                value={currentUserEditor}
                onChange={(e) => setCurrentUserEditor(e.target.value)}
                placeholder="Vương"
                className="px-3.5 py-2 bg-background border border-border rounded-xl text-foreground text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
              />
              <span className="text-[11px] text-muted-foreground">
                Khớp đúng với danh sách dropdown trên Sheet (ví dụ: Vương, Hân, Ngân...).
              </span>
            </div>

            {/* Pick Completed Status */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>Trạng thái lọc ảnh (Giá trị sẽ điền vào cột Trạng Thái Lọc):</span>
              </label>
              <input
                type="text"
                value={pickCompletedStatus}
                onChange={(e) => setPickCompletedStatus(e.target.value)}
                placeholder="Đã lọc"
                className="px-3.5 py-2 bg-background border border-border rounded-xl text-foreground text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
              />
              <span className="text-[11px] text-muted-foreground">
                Giá trị trạng thái sau khi hoàn tất lọc ảnh (ví dụ: Đã lọc, Đã lọc xong).
              </span>
            </div>

            {/* Start Row Scope */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <Layers size={13} className="text-purple-400" />
                <span>Dòng bắt đầu chứa dữ liệu khách hàng (Row Scope):</span>
              </label>
              <input
                type="number"
                value={startRow}
                onChange={(e) => setStartRow(parseInt(e.target.value) || 4)}
                min={2}
                className="px-3.5 py-2 bg-background border border-border rounded-xl text-foreground text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary shadow-inner w-32"
              />
              <span className="text-[11px] text-muted-foreground">
                Hệ thống chỉ được phép đọc và ghi từ dòng này trở xuống. Tuyệt đối không chạm vào dòng tiêu đề hoặc tóm tắt phía trên.
              </span>
            </div>

            {/* Workspace Summary Box */}
            <div className="p-4 bg-muted/30 border border-border/80 rounded-xl flex flex-col gap-2 text-xs">
              <span className="font-bold text-foreground">Tóm tắt cấu hình:</span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Số cột đã ánh xạ: </span>
                  <b className="text-primary">{fieldMappings.length} cột</b>
                </div>
                <div>
                  <span className="text-muted-foreground">Cột cho phép ghi: </span>
                  <b className="text-emerald-400">Tên Edit (N), Link Edit (O)</b>
                </div>
                <div>
                  <span className="text-muted-foreground">Dòng tiêu đề: </span>
                  <b className="text-foreground">Dòng {selectedHeaderRow}</b>
                </div>
                <div>
                  <span className="text-muted-foreground">Dòng dữ liệu bắt đầu: </span>
                  <b className="text-foreground">Dòng {startRow}</b>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setWizardStep(3)}
              className="px-4 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Quay lại: Bước 3</span>
            </button>
            <button
              onClick={handleSaveProfile}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold shadow-md hover:opacity-95 flex items-center gap-2 cursor-pointer"
            >
              <Save size={14} />
              <span>Lưu Workspace & Bắt đầu sử dụng</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
