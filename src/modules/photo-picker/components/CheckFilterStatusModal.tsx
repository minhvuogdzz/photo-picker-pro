import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Filter,
  Trash2,
  Search,
  RefreshCw,
  Sliders,
  ChevronDown,
  Folder,
  Users,
  Check,
  Info,
  CalendarClock,
  Bell,
  Loader2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/core/stores/useAppStore";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { useContactSheetStore } from "@/modules/contact-the-sheet/stores/useContactSheetStore";
import { urgentCustomerScannerService } from "@/modules/photo-picker/services/urgentCustomerScannerService";
import { sheetDiscoveryService } from "@/modules/contact-the-sheet/services/sheetDiscoveryService";
import type { SheetRowRecord } from "@/modules/contact-the-sheet/services/jobMatchingService";
import { getFolderName } from "@/core/lib/utils";
import {
  checkFolder,
  formatDateKey,
  getVietnamTodayKey,
  type FilterCheckConditions,
  type FolderCheckResult,
  type TabRows,
} from "@/modules/photo-picker/services/filterStatusCheckService";

interface CheckFilterStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STANDARD_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
  "U", "V", "W", "X", "Y", "Z",
];

const COMMON_STATUS_SUGGESTIONS = ["Chưa lọc", "Chờ lọc", "Pending", "Đang lọc", "Chưa chụp"];
const DEFAULT_TABS = ["Edit 9/2026", "Edit 8/2026", "Edit 10/2026", "DS Khách"];

export function CheckFilterStatusModal({ isOpen, onClose }: CheckFilterStatusModalProps) {
  const inputFolders = useAppStore((s) => s.inputFolders);
  const batchCustomerFolders = useAppStore((s) => s.batchCustomerFolders);

  const profiles = useContactSheetStore((s) => s.profiles);
  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const googleConnection = useContactSheetStore((s) => s.googleConnection);

  const targetProfile = useMemo(() => {
    return activeProfile || profiles[0] || null;
  }, [activeProfile, profiles]);

  // Real tab names of the linked spreadsheet (daily tabs like "9/10" are usually not saved in the profile)
  const [remoteTabs, setRemoteTabs] = useState<string[]>([]);

  useEffect(() => {
    const sheetId = targetProfile?.spreadsheetId;
    if (!isOpen || !sheetId || targetProfile?.isMockSandbox || sheetId.startsWith("mock")) return;
    let cancelled = false;
    sheetDiscoveryService
      .fetchSpreadsheetMetadata(sheetId, false)
      .then((meta) => {
        if (!cancelled && meta?.tabs?.length) setRemoteTabs(meta.tabs.map((t) => t.title));
      })
      .catch((err) => console.warn("[CheckFilterStatusModal] Could not load sheet tabs:", err));
    return () => {
      cancelled = true;
    };
  }, [isOpen, targetProfile?.spreadsheetId]);

  // Tab options: every real tab of the sheet, plus tabs saved in the profile
  const availableTabs = useMemo(() => {
    const configured = targetProfile?.tabConfigurations ? Object.keys(targetProfile.tabConfigurations) : [];
    const merged = Array.from(new Set([...remoteTabs, ...configured]));
    return merged.length > 0 ? merged : DEFAULT_TABS;
  }, [targetProfile, remoteTabs]);

  // Original queue before the first Check TT, so re-running never works on an already narrowed queue
  const queueRef = useRef<{ base: string[]; kept: string[]; batch: typeof batchCustomerFolders } | null>(null);

  const defaultTab =
    targetProfile?.selectedTabTitle ||
    (targetProfile?.tabConfigurations ? Object.keys(targetProfile.tabConfigurations)[0] : "") ||
    "Edit 9/2026";

  // Config State — multiple tabs can be checked at once
  const [selectedTabs, setSelectedTabs] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mvd_check_selected_tabs") || "[]");
      if (Array.isArray(saved) && saved.length > 0) return saved;
    } catch {}
    return [defaultTab];
  });

  // Only keep checked tabs that still exist in the profile
  const activeSelectedTabs = useMemo(
    () => availableTabs.filter((t) => selectedTabs.includes(t)),
    [availableTabs, selectedTabs]
  );

  const toggleTab = (tab: string) => {
    setSelectedTabs((prev) => (prev.includes(tab) ? prev.filter((t) => t !== tab) : [...prev, tab]));
  };

  const [statusColumn, setStatusColumn] = useState<string>(() => {
    try {
      return localStorage.getItem("mvd_check_status_column") || "M";
    } catch {
      return "M";
    }
  });

  const [targetStatusValue, setTargetStatusValue] = useState<string>(() => {
    try {
      return localStorage.getItem("mvd_check_status_value") || "Chưa lọc";
    } catch {
      return "Chưa lọc";
    }
  });

  // Photo Code columns — "OFF" means disabled
  const [photoCode1Column, setPhotoCode1Column] = useState<string>(() => {
    try {
      return localStorage.getItem("mvd_check_photo_code1_column") || "OFF";
    } catch {
      return "OFF";
    }
  });

  const [photoCode2Column, setPhotoCode2Column] = useState<string>(() => {
    try {
      return localStorage.getItem("mvd_check_photo_code2_column") || "OFF";
    } catch {
      return "OFF";
    }
  });

  // Due date scan ("Quét file tới hạn") — keep only rows whose "Hẹn trả ảnh" date is today (VN) or earlier
  const [dueDateEnabled, setDueDateEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("mvd_check_due_date_enabled") === "1";
    } catch {
      return false;
    }
  });

  const [dueDateColumn, setDueDateColumn] = useState<string>(() => {
    try {
      return localStorage.getItem("mvd_check_due_date_column") || "L";
    } catch {
      return "L";
    }
  });

  const [linkEditColumn, setLinkEditColumn] = useState<string>(() => {
    try {
      return localStorage.getItem("mvd_check_link_edit_column") || "O";
    } catch {
      return "O";
    }
  });

  const todayLabel = useMemo(() => formatDateKey(getVietnamTodayKey()), [isOpen]);

  // Urgent 5-minute sheet notification settings & state
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const [isScanningEntireSheet, setIsScanningEntireSheet] = useState(false);
  const [entireSheetScanResult, setEntireSheetScanResult] = useState<string | null>(null);
  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false);
  const [testNotifFeedback, setTestNotifFeedback] = useState<string | null>(null);

  // Auto-persist column configurations so the 5-minute background scanner always uses active settings
  useEffect(() => {
    try {
      localStorage.setItem("mvd_check_status_column", statusColumn);
      localStorage.setItem("mvd_check_status_value", targetStatusValue.trim());
      localStorage.setItem("mvd_check_photo_code1_column", photoCode1Column);
      localStorage.setItem("mvd_check_photo_code2_column", photoCode2Column);
      localStorage.setItem("mvd_check_due_date_enabled", dueDateEnabled ? "1" : "0");
      localStorage.setItem("mvd_check_due_date_column", dueDateColumn);
      localStorage.setItem("mvd_check_link_edit_column", linkEditColumn);
      localStorage.setItem("mvd_check_selected_tabs", JSON.stringify(activeSelectedTabs));
    } catch {}
  }, [
    statusColumn,
    targetStatusValue,
    photoCode1Column,
    photoCode2Column,
    dueDateEnabled,
    dueDateColumn,
    linkEditColumn,
    activeSelectedTabs,
  ]);

  const handleToggleUrgentNotify = (enable: boolean) => {
    updateSetting("urgent_scanner_enabled", enable);
    localStorage.setItem("mvd_check_urgent_notify_enabled", enable ? "1" : "0");
    invoke("save_settings", { settings: { ...settings, urgent_scanner_enabled: enable } }).catch(console.error);
    if (enable && !dueDateEnabled) {
      setDueDateEnabled(true);
    }
  };

  const handleScanEntireSheetNow = async () => {
    setIsScanningEntireSheet(true);
    setEntireSheetScanResult(null);
    try {
      const res = await urgentCustomerScannerService.scanNow(true);
      if (res.urgentCount > 0) {
        setEntireSheetScanResult(
          `Phát hiện ${res.urgentCount} khách hàng tới hạn cần lọc gấp hôm nay trên toàn bộ trang tính!`
        );
      } else {
        setEntireSheetScanResult(
          "Không có khách nào thỏa mãn đồng thời 3 điều kiện cần lọc gấp hôm nay."
        );
      }
    } catch (err) {
      setEntireSheetScanResult("Lỗi quét trang tính: " + String(err));
    } finally {
      setIsScanningEntireSheet(false);
      setTimeout(() => setEntireSheetScanResult(null), 8000);
    }
  };

  const handleSendTestNotificationModal = async () => {
    setIsSendingTestNotif(true);
    setTestNotifFeedback(null);
    try {
      await urgentCustomerScannerService.sendTestNotification();
      setTestNotifFeedback("Đã gửi thông báo & chuông báo thành công!");
    } catch (err) {
      setTestNotifFeedback("Lỗi: " + String(err));
    } finally {
      setIsSendingTestNotif(false);
      setTimeout(() => setTestNotifFeedback(null), 4000);
    }
  };

  // Processing & Results State
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<FolderCheckResult[] | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<"all" | "kept" | "removed">("kept");
  const [searchPreview, setSearchPreview] = useState<string>("");

  // Fall back to the profile's active tab when none of the saved tabs exist in this profile
  useEffect(() => {
    if (targetProfile && activeSelectedTabs.length === 0 && availableTabs.includes(defaultTab)) {
      setSelectedTabs([defaultTab]);
    }
  }, [targetProfile, availableTabs]);

  // Suggest status column from profile if not yet saved in localStorage
  useEffect(() => {
    if (targetProfile && !localStorage.getItem("mvd_check_status_column")) {
      const mappings =
        targetProfile.tabConfigurations?.[activeSelectedTabs[0]]?.fieldMappings ||
        targetProfile.fieldMappings ||
        [];
      const statusMapping = mappings.find((m) => m.semanticField === "PHOTO_PICK_STATUS");
      if (statusMapping?.columnLetter && statusMapping.columnLetter !== "NONE") {
        setStatusColumn(statusMapping.columnLetter);
      }
    }
  }, [targetProfile, activeSelectedTabs]);

  const handleRunCheck = async () => {
    if (!targetProfile) {
      setErrorMessage("Chưa có hồ sơ Google Sheet nào được cấu hình. Vui lòng vào Cấu hình Sheet.");
      return;
    }

    if (inputFolders.length === 0 && !queueRef.current) {
      setErrorMessage("Danh sách thư mục đầu vào đang trống! Vui lòng thêm thư mục khách trước khi kiểm tra.");
      return;
    }

    if (activeSelectedTabs.length === 0) {
      setErrorMessage("Vui lòng tích chọn ít nhất một Tab làm việc để đối soát.");
      return;
    }

    setIsChecking(true);
    setErrorMessage(null);
    setCheckResults(null);
    setCheckProgress("Đang kết nối tải dữ liệu trang tính...");

    try {
      // Save settings preference
      try {
        localStorage.setItem("mvd_check_status_column", statusColumn);
        localStorage.setItem("mvd_check_status_value", targetStatusValue.trim());
        localStorage.setItem("mvd_check_photo_code1_column", photoCode1Column);
        localStorage.setItem("mvd_check_photo_code2_column", photoCode2Column);
        localStorage.setItem("mvd_check_due_date_enabled", dueDateEnabled ? "1" : "0");
        localStorage.setItem("mvd_check_due_date_column", dueDateColumn);
        localStorage.setItem("mvd_check_selected_tabs", JSON.stringify(activeSelectedTabs));
      } catch {}

      const isMock = Boolean(
        targetProfile.isMockSandbox || targetProfile.spreadsheetId?.startsWith("mock")
      );

      // Load rows of every checked tab; a tab that fails to load is skipped unless all fail
      const tabRows: TabRows[] = [];
      const failedTabs: string[] = [];
      for (const tabTitle of activeSelectedTabs) {
        const startRow =
          targetProfile.tabConfigurations?.[tabTitle]?.rowScope?.startRow ||
          targetProfile.rowScope?.startRow ||
          4;

        setCheckProgress(`Đang tải các dòng trên Tab "${tabTitle}" (${tabRows.length + failedTabs.length + 1}/${activeSelectedTabs.length})...`);
        try {
          const rows: SheetRowRecord[] = await sheetDiscoveryService.fetchSheetRowsForMatching(
            targetProfile.spreadsheetId,
            tabTitle,
            startRow,
            undefined,
            isMock
          );
          tabRows.push({ tabTitle, rows });
        } catch (err) {
          console.warn(`[CheckFilterStatusModal] Could not load tab "${tabTitle}":`, err);
          failedTabs.push(tabTitle);
        }
      }

      if (tabRows.length === 0) {
        throw new Error(`Không tải được dữ liệu từ Tab: ${failedTabs.join(", ")}`);
      }

      setCheckProgress(`Đang đối soát ${inputFolders.length} thư mục khách với ${tabRows.length} Tab...`);

      const effectiveProfile = isMock ? { ...targetProfile, isMockSandbox: true } : targetProfile;
      const conditions: FilterCheckConditions = {
        statusColumn,
        targetStatusValue: targetStatusValue.trim(),
        photoCode1Column: photoCode1Column !== "OFF" ? photoCode1Column : null,
        photoCode2Column: photoCode2Column !== "OFF" ? photoCode2Column : null,
        dueDateColumn: dueDateEnabled ? dueDateColumn : null,
        linkEditColumn: dueDateEnabled && linkEditColumn !== "OFF" ? linkEditColumn : null,
        todayKey: getVietnamTodayKey(),
      };

      // Re-running continues from the original queue unless the user changed the queue since the last check
      const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
      const reuseQueue = Boolean(queueRef.current && sameSet(inputFolders, queueRef.current.kept));
      const sourceFolders = reuseQueue ? queueRef.current!.base : inputFolders;

      // Keep a folder if any of its rows on any checked tab passes all conditions
      const results: FolderCheckResult[] = sourceFolders.map((folderPath) =>
        checkFolder(folderPath, getFolderName(folderPath), tabRows, effectiveProfile, conditions)
      );

      // A tab that failed to load must not remove customers we could not look up
      if (failedTabs.length > 0) {
        for (const r of results) {
          if (!r.isKept && !r.matchedRow) {
            r.isKept = true;
            r.actualStatus = "Chưa kiểm tra được";
            r.reason = `Không tải được Tab ${failedTabs.join(", ")} nên giữ lại để bạn kiểm tra thủ công`;
          }
        }
      }

      if (failedTabs.length > 0) {
        setErrorMessage(`Bỏ qua Tab không tải được: ${failedTabs.join(", ")}. Kết quả chỉ tính trên các Tab còn lại.`);
      }

      setCheckResults(results);

      // Automatically apply filtering to input queue:
      // Keep only folders with isKept = true
      const keptChecked = results.filter((r) => r.isKept).map((r) => r.folderPath);
      // Folders dropped into the queue while the check was running were never checked: keep them
      const addedDuringCheck = useAppStore.getState().inputFolders.filter((f) => !sourceFolders.includes(f));
      const keptFolders = [...keptChecked, ...addedDuringCheck];
      // Customer metadata (day name...) also comes from the original queue, not the narrowed one
      const knownBatch = [...(reuseQueue ? queueRef.current!.batch : []), ...batchCustomerFolders];
      const allBatch = knownBatch.filter((b, i) => knownBatch.findIndex((x) => x.folder_path === b.folder_path) === i);
      queueRef.current = { base: [...sourceFolders, ...addedDuringCheck], kept: keptFolders, batch: allBatch };
      const keptBatchItems = allBatch.filter((b) => keptFolders.includes(b.folder_path));

      useAppStore.setState({
        inputFolders: keptFolders,
        batchCustomerFolders: keptBatchItems,
        selectedInputFolders: keptFolders.length > 0 ? [keptFolders[0]] : [],
      });
    } catch (err: any) {
      console.error("[CheckFilterStatusModal] Error:", err);
      setErrorMessage(
        err?.message || "Không thể kiểm tra trạng thái từ Google Sheet. Vui lòng kiểm tra kết nối mạng."
      );
    } finally {
      setIsChecking(false);
      setCheckProgress("");
    }
  };

  const keptCount = checkResults?.filter((r) => r.isKept).length ?? 0;
  const removedCount = checkResults?.filter((r) => !r.isKept).length ?? 0;

  const filteredResults = useMemo(() => {
    if (!checkResults) return [];
    if (activeResultTab === "kept") return checkResults.filter((r) => r.isKept);
    if (activeResultTab === "removed") return checkResults.filter((r) => !r.isKept);
    return checkResults;
  }, [checkResults, activeResultTab]);

  const filteredPreviewFolders = useMemo(() => {
    if (!searchPreview.trim()) return inputFolders;
    const q = searchPreview.toLowerCase().trim();
    return inputFolders.filter((f) => getFolderName(f).toLowerCase().includes(q));
  }, [inputFolders, searchPreview]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="bg-card text-foreground border border-border/80 shadow-2xl rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden h-[82vh] max-h-[720px] min-h-[480px] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-3.5 border-b border-border/80 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <Filter size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Check TT — Kiểm tra trạng thái Sheet</h3>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {inputFolders.length} khách trong hàng đợi
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tự động đối soát Google Sheet và giữ lại các khách hàng có trạng thái cần lọc
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
          {/* Top Bar: Sheet Account & Tab Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/30 border border-border/60 rounded-xl">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Tab làm việc (Trang tính) · {activeSelectedTabs.length}/{availableTabs.length}
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedTabs(activeSelectedTabs.length === availableTabs.length ? [] : [...availableTabs])
                  }
                  className="text-[10px] font-medium text-primary hover:underline cursor-pointer"
                >
                  {activeSelectedTabs.length === availableTabs.length ? "Bỏ chọn" : "Chọn tất cả"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                {availableTabs.map((t) => {
                  const checked = activeSelectedTabs.includes(t);
                  return (
                    <label
                      key={t}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                        checked
                          ? "bg-primary/10 border-primary/50 text-foreground"
                          : "bg-background border-border/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTab(t)}
                        className="w-3 h-3 accent-primary cursor-pointer"
                      />
                      {t}
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-1">
                Bảng tính liên kết
              </label>
              <div className="flex items-center justify-between py-1 px-1">
                <span className="truncate max-w-[200px] text-[11px] font-medium text-foreground">
                  {targetProfile?.displayName || targetProfile?.spreadsheetTitle || "Mặc định"}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                  {googleConnection?.accountEmail ? "Đã kết nối" : "Mặc định"}
                </span>
              </div>
            </div>
          </div>

          {/* Config Box: Column & Status Value */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <Sliders size={13} className="text-primary" />
                Cấu hình đối soát cột trạng thái
              </span>
              <span className="text-[10px] text-muted-foreground">
                Mặc định: Cột M ("Chưa lọc")
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Select Column */}
              <div>
                <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                  Cột trạng thái lọc trên Sheet
                </label>
                <div className="relative">
                  <select
                    value={statusColumn}
                    onChange={(e) => setStatusColumn(e.target.value)}
                    className="w-full appearance-none px-3 py-1.5 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary cursor-pointer pr-8"
                  >
                    {STANDARD_LETTERS.map((col) => (
                      <option key={col} value={col}>
                        Cột {col} {col === "M" ? "(Cột M - Trạng thái lọc)" : col === "G" ? "(Cột G - Trạng thái)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                </div>
              </div>

              {/* Input Value */}
              <div>
                <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                  Giá trị trạng thái cần GIỮ LẠI
                </label>
                <input
                  type="text"
                  value={targetStatusValue}
                  onChange={(e) => setTargetStatusValue(e.target.value)}
                  placeholder="Ví dụ: Chưa lọc"
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] text-muted-foreground mr-1">Gợi ý nhanh:</span>
              {COMMON_STATUS_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setTargetStatusValue(sug)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer ${
                    targetStatusValue === sug
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/80 hover:bg-muted border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Config Box: Photo Code Columns */}
          <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1.5">
                <FileSpreadsheet size={13} className="text-amber-500" />
                Kiểm tra cột mã ảnh chọn (Tùy chọn)
              </span>
              <span className="text-[10px] text-muted-foreground">
                Nếu ô trống → tự động đá ra
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Photo Code 1 Column */}
              <div>
                <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                  Cột mã ảnh chọn 1
                </label>
                <div className="relative">
                  <select
                    value={photoCode1Column}
                    onChange={(e) => setPhotoCode1Column(e.target.value)}
                    className={`w-full appearance-none px-3 py-1.5 text-xs font-semibold rounded-lg bg-background border text-foreground focus:outline-none focus:border-primary cursor-pointer pr-8 ${
                      photoCode1Column !== "OFF" ? "border-amber-500/40" : "border-border"
                    }`}
                  >
                    <option value="OFF">TẮT — Không kiểm tra</option>
                    {STANDARD_LETTERS.map((col) => (
                      <option key={col} value={col}>
                        Cột {col}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                </div>
              </div>

              {/* Photo Code 2 Column */}
              <div>
                <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                  Cột mã ảnh chọn 2
                </label>
                <div className="relative">
                  <select
                    value={photoCode2Column}
                    onChange={(e) => setPhotoCode2Column(e.target.value)}
                    className={`w-full appearance-none px-3 py-1.5 text-xs font-semibold rounded-lg bg-background border text-foreground focus:outline-none focus:border-primary cursor-pointer pr-8 ${
                      photoCode2Column !== "OFF" ? "border-amber-500/40" : "border-border"
                    }`}
                  >
                    <option value="OFF">TẮT — Không kiểm tra</option>
                    {STANDARD_LETTERS.map((col) => (
                      <option key={col} value={col}>
                        Cột {col}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {(photoCode1Column !== "OFF" || photoCode2Column !== "OFF") && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 leading-relaxed">
                <strong>Logic:</strong> Nếu ô mã ảnh chọn{photoCode1Column !== "OFF" && ` (Cột ${photoCode1Column})`}{photoCode2Column !== "OFF" && ` (Cột ${photoCode2Column})`} bị <strong>trống</strong>, khách đó sẽ bị <strong>tự động đá ra</strong> kể cả khi trạng thái là "{targetStatusValue}".
              </div>
            )}
          </div>

          {/* Config Box: Due Date Scan (Advanced, checkbox) */}
          <div
            className={`p-3.5 rounded-xl bg-card border shadow-xs space-y-3 transition-colors ${
              dueDateEnabled || settings.urgent_scanner_enabled !== false ? "border-violet-500/40" : "border-border"
            }`}
          >
            <label className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground cursor-pointer">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dueDateEnabled}
                  onChange={(e) => setDueDateEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 accent-violet-600 cursor-pointer"
                />
                <CalendarClock size={13} className="text-violet-500" />
                Quét file tới hạn (Nâng cao)
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Hôm nay (GMT+7): <strong className="font-mono text-foreground">{todayLabel}</strong>
              </span>
            </label>

            {(dueDateEnabled || settings.urgent_scanner_enabled !== false) && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      Cột "Hẹn trả ảnh" trên Sheet (dd/mm hoặc dd/mm/yyyy)
                    </label>
                    <div className="relative">
                      <select
                        value={dueDateColumn}
                        onChange={(e) => setDueDateColumn(e.target.value)}
                        className="w-full appearance-none px-3 py-1.5 text-xs font-semibold rounded-lg bg-background border border-violet-500/40 text-foreground focus:outline-none focus:border-primary cursor-pointer pr-8"
                      >
                        {STANDARD_LETTERS.map((col) => (
                          <option key={col} value={col}>
                            Cột {col} {col === "L" ? "(Cột L - Hẹn trả ảnh)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      Cột "Link edit / Bàn giao" (Kiểm tra ô rỗng)
                    </label>
                    <div className="relative">
                      <select
                        value={linkEditColumn}
                        onChange={(e) => setLinkEditColumn(e.target.value)}
                        className="w-full appearance-none px-3 py-1.5 text-xs font-semibold rounded-lg bg-background border border-amber-500/40 text-foreground focus:outline-none focus:border-primary cursor-pointer pr-8"
                      >
                        <option value="OFF">TẮT — Không kiểm tra link edit</option>
                        {STANDARD_LETTERS.map((col) => (
                          <option key={col} value={col}>
                            Cột {col} {col === "O" ? "(Cột O - Mặc định Link edit)" : col === "N" ? "(Cột N)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                    </div>
                  </div>
                </div>

                {dueDateEnabled && (
                  <div className="text-[10px] text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-lg px-2.5 py-1.5 leading-relaxed">
                    <strong>Logic lọc file đầu vào:</strong> Chỉ giữ khách trong hàng đợi khi đồng thời <strong>(1)</strong> ngày hẹn trả ở Cột {dueDateColumn} là{" "}
                    <strong>{todayLabel} hoặc trước đó</strong> và <strong>(2)</strong> Cột {statusColumn} là "{targetStatusValue}". Ô hẹn trả trống hoặc sai định dạng sẽ bị đá ra.
                  </div>
                )}

                {/* Tùy chọn gửi thông báo khẩn cấp (Quét toàn bộ Sheet mỗi 5 phút, không cần đầu vào) */}
                <div className="pt-2.5 border-t border-border/70 space-y-2.5">
                  <label className="flex items-start justify-between gap-3 cursor-pointer group">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={settings.urgent_scanner_enabled !== false}
                          onChange={(e) => handleToggleUrgentNotify(e.target.checked)}
                          className="w-3.5 h-3.5 accent-amber-500 cursor-pointer mt-0.5"
                        />
                        <Bell size={13} className="text-amber-500" />
                        <span className="text-xs font-bold text-foreground group-hover:text-amber-500 transition-colors">
                          Gửi thông báo khẩn cấp hệ điều hành (Quét toàn bộ Sheet 5 phút/lần)
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed pl-5">
                        Quét <strong>toàn bộ trang tính Google Sheet</strong> định kỳ 5 phút/lần (<strong>kể cả khi không có thư mục đầu vào</strong>). Tự động bắn thông báo khẩn cấp lên macOS / Windows khi có khách tới hạn.
                      </p>
                    </div>
                    <div
                      className={`shrink-0 w-8 h-4.5 rounded-full p-0.5 transition-colors ${
                        settings.urgent_scanner_enabled !== false ? "bg-amber-500" : "bg-muted-foreground/30"
                      }`}
                    >
                      <div
                        className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transform transition-transform ${
                          settings.urgent_scanner_enabled !== false ? "translate-x-3.5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </label>

                  {settings.urgent_scanner_enabled !== false && (
                    <div className="pl-5 space-y-2">
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2 leading-relaxed space-y-1">
                        <p className="font-bold">⚡ 3 điều kiện đồng thời xảy ra trên toàn bộ Sheet:</p>
                        <ul className="list-disc pl-3.5 space-y-0.5">
                          <li>
                            Trạng thái (<strong>Cột {statusColumn}</strong>): Bằng "<strong>{targetStatusValue}</strong>".
                          </li>
                          <li>
                            Hạn trả ảnh (<strong>Cột {dueDateColumn}</strong>): Tới ngày hạn (<strong>{todayLabel}</strong>) hoặc quá ngày hạn.
                          </li>
                          <li>
                            Phần Link edit: Đang <strong>rỗng</strong> (chưa có dữ liệu).
                          </li>
                        </ul>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleScanEntireSheetNow}
                          disabled={isScanningEntireSheet}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border hover:border-foreground/20 bg-muted/60 hover:bg-muted text-foreground text-[10px] font-semibold transition-all cursor-pointer shadow-xs active:scale-97"
                        >
                          {isScanningEntireSheet ? (
                            <Loader2 size={11} className="animate-spin text-amber-500" />
                          ) : (
                            <RefreshCw size={11} className="text-amber-500" />
                          )}
                          <span>Quét toàn bộ Sheet ngay</span>
                        </button>

                        {import.meta.env.DEV && (
                          <button
                            type="button"
                            onClick={handleSendTestNotificationModal}
                            disabled={isSendingTestNotif}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border hover:border-foreground/20 bg-muted/60 hover:bg-muted text-foreground text-[10px] font-semibold transition-all cursor-pointer shadow-xs active:scale-97"
                          >
                            {isSendingTestNotif ? (
                              <Loader2 size={11} className="animate-spin text-primary" />
                            ) : (
                              <Bell size={11} className="text-primary" />
                            )}
                            <span>Gửi thông báo thử nghiệm</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            useAppStore.getState().setActiveModule("notifications");
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-semibold transition-all cursor-pointer shadow-xs active:scale-97"
                        >
                          <Bell size={11} />
                          <span>Xem lịch sử thông báo</span>
                        </button>

                        {entireSheetScanResult && (
                          <span className="text-[10px] font-semibold text-amber-500 animate-fade-in w-full block">
                            {entireSheetScanResult}
                          </span>
                        )}

                        {testNotifFeedback && (
                          <span className="text-[10px] font-semibold text-emerald-500 animate-fade-in w-full block">
                            {testNotifFeedback}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2 animate-fade-in">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Lỗi kiểm tra:</p>
                <p className="opacity-90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Progress Banner */}
          {isChecking && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/25 text-primary text-xs flex items-center justify-center gap-2.5 animate-pulse">
              <RefreshCw size={16} className="animate-spin shrink-0" />
              <span className="font-semibold">{checkProgress}</span>
            </div>
          )}

          {/* STATE A: Pre-Check Folder Queue Preview (Before Running) */}
          {!checkResults && !isChecking && (
            <div className="space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Users size={13} className="text-primary" />
                  Danh sách khách trong hàng đợi ({inputFolders.length})
                </span>
                {inputFolders.length > 5 && (
                  <div className="relative">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchPreview}
                      onChange={(e) => setSearchPreview(e.target.value)}
                      placeholder="Tìm khách..."
                      className="pl-6 pr-2 py-0.5 text-[10px] rounded bg-background border border-border text-foreground focus:outline-none focus:border-primary w-28"
                    />
                  </div>
                )}
              </div>

              {inputFolders.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border/70 bg-muted/10 space-y-2">
                  <Folder size={24} className="mx-auto text-muted-foreground/40" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Chưa có thư mục khách nào trong hàng đợi
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 max-w-sm mx-auto">
                    Vui lòng kéo thư mục Tháng, Ngày hoặc nhiều thư mục khách vào ứng dụng trước khi thực hiện Check TT.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                  {filteredPreviewFolders.map((folder, idx) => {
                    const name = getFolderName(folder);
                    const meta = batchCustomerFolders.find((b) => b.folder_path === folder);

                    return (
                      <div
                        key={idx}
                        className="px-3 py-2 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/30 flex items-center justify-between text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder size={13} className="text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground truncate">{name}</span>
                        </div>
                        {meta?.day_name && (
                          <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60 shrink-0">
                            {meta.day_name}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Informative Tip */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 text-xs flex items-start gap-2.5">
                <Info size={15} className="shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Bấm nút <strong>"Kiểm tra & Lọc danh sách"</strong> bên dưới. Hệ thống sẽ kết nối với Google Sheet:
                  những khách có trạng thái là <strong>"{targetStatusValue}"</strong> trên Cột <strong>{statusColumn}</strong>{photoCode1Column !== "OFF" && <> và cột mã ảnh chọn 1 (<strong>{photoCode1Column}</strong>) có dữ liệu</>}{photoCode2Column !== "OFF" && <> và cột mã ảnh chọn 2 (<strong>{photoCode2Column}</strong>) có dữ liệu</>}{dueDateEnabled && <> và ngày hẹn trả ở Cột <strong>{dueDateColumn}</strong> từ <strong>{todayLabel}</strong> trở về trước</>} sẽ được <strong>GIỮ LẠI</strong>, các khách đã lọc, không khớp hoặc thiếu mã ảnh sẽ được <strong>TỰ ĐỘNG ĐÁ RA</strong> khỏi danh sách.
                </div>
              </div>
            </div>
          )}

          {/* STATE B: Results Summary & List (After Running) */}
          {checkResults && (
            <div className="space-y-3 animate-fade-in">
              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block font-medium">Tổng kiểm tra</span>
                  <span className="text-base font-extrabold text-foreground">{checkResults.length}</span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium">
                    Giữ lại ("{targetStatusValue}")
                  </span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    {keptCount}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <span className="text-[10px] text-rose-700 dark:text-rose-400 block font-medium">
                    Đã đá ra (Đã lọc / Khác)
                  </span>
                  <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                    {removedCount}
                  </span>
                </div>
              </div>

              {/* Tabs for Result List */}
              <div className="flex items-center justify-between border-b border-border pb-1">
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveResultTab("kept")}
                    className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors cursor-pointer ${
                      activeResultTab === "kept"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Giữ lại ({keptCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveResultTab("removed")}
                    className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-colors cursor-pointer ${
                      activeResultTab === "removed"
                        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Đã đá ra ({removedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveResultTab("all")}
                    className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors cursor-pointer ${
                      activeResultTab === "all"
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Tất cả ({checkResults.length})
                  </button>
                </div>
              </div>

              {/* Result Items Scroll */}
              <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                {filteredResults.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    Không có thư mục nào trong danh mục này.
                  </div>
                ) : (
                  filteredResults.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-colors ${
                        item.isKept
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-muted/30 border-border/60 opacity-80"
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2">
                        {item.isKept ? (
                          <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Trash2 size={13} className="text-rose-500 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="block font-semibold text-foreground truncate text-[11px]">
                            {item.folderName}
                          </span>
                          {!item.isKept && (
                            <span
                              className="block text-[10px] text-rose-600/90 dark:text-rose-400/90 truncate"
                              title={item.reason}
                            >
                              {item.reason}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[10px] flex-wrap justify-end">
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                            item.isKept
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {item.actualStatus}
                        </span>
                        {item.photoCode1Value !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              item.photoCode1Value
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                            }`}
                            title={`Cột ${photoCode1Column}: ${item.photoCode1Value || "(Trống)"}`}
                          >
                            {item.photoCode1Value || "Mã1: ∅"}
                          </span>
                        )}
                        {item.photoCode2Value !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              item.photoCode2Value
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                            }`}
                            title={`Cột ${photoCode2Column}: ${item.photoCode2Value || "(Trống)"}`}
                          >
                            {item.photoCode2Value || "Mã2: ∅"}
                          </span>
                        )}
                        {item.dueDateValue !== undefined && (
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono ${
                              item.isKept
                                ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            }`}
                            title={`Cột ${dueDateColumn} (Hẹn trả ảnh): ${item.dueDateValue || "(Trống)"}`}
                          >
                            {item.dueDateValue || "Hẹn: ∅"}
                          </span>
                        )}
                        {item.matchedRow && (
                          <span className="text-muted-foreground" title={item.reason}>
                            {item.tabTitle && activeSelectedTabs.length > 1 ? `${item.tabTitle} · ` : ""}Dòng {item.matchedRow}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-muted-foreground">
            {checkResults ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <Check size={13} />
                Đã cập nhật hàng đợi còn {keptCount} khách
              </span>
            ) : (
              <span>{activeSelectedTabs.length} Tab • Cột {statusColumn} • Trạng thái giữ: "{targetStatusValue}"{photoCode1Column !== "OFF" && ` • Mã1: ${photoCode1Column}`}{photoCode2Column !== "OFF" && ` • Mã2: ${photoCode2Column}`}{dueDateEnabled && ` • Tới hạn: ${dueDateColumn} ≤ ${todayLabel}`}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-card hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
            >
              {checkResults ? "Đóng & Bắt đầu lọc" : "Hủy"}
            </button>

            <button
              type="button"
              disabled={isChecking || (inputFolders.length === 0 && !queueRef.current) || activeSelectedTabs.length === 0}
              onClick={handleRunCheck}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {isChecking ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Filter size={13} />
              )}
              <span>{isChecking ? "Đang kiểm tra..." : "Kiểm tra & Lọc danh sách"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
