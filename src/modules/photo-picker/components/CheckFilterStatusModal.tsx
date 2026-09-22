import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useContactSheetStore } from "@/modules/contact-the-sheet/stores/useContactSheetStore";
import { sheetDiscoveryService } from "@/modules/contact-the-sheet/services/sheetDiscoveryService";
import { sheetExtractorService } from "@/modules/contact-the-sheet/services/sheetExtractorService";
import type { SheetRowRecord } from "@/modules/contact-the-sheet/services/jobMatchingService";
import { getFolderName } from "@/core/lib/utils";

interface CheckFilterStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FolderCheckResult {
  folderPath: string;
  folderName: string;
  isKept: boolean;
  matchedRow?: number;
  actualStatus: string;
  reason: string;
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

  // Tab options
  const availableTabs = useMemo(() => {
    if (targetProfile?.tabConfigurations) {
      const configured = Object.keys(targetProfile.tabConfigurations);
      if (configured.length > 0) return configured;
    }
    return DEFAULT_TABS;
  }, [targetProfile]);

  // Config State
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    return (
      targetProfile?.selectedTabTitle ||
      (targetProfile?.tabConfigurations ? Object.keys(targetProfile.tabConfigurations)[0] : "") ||
      "Edit 9/2026"
    );
  });

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

  // Processing & Results State
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<FolderCheckResult[] | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<"all" | "kept" | "removed">("kept");
  const [searchPreview, setSearchPreview] = useState<string>("");

  // Init tab from profile when profile updates
  useEffect(() => {
    if (targetProfile) {
      const tab =
        targetProfile.selectedTabTitle ||
        (targetProfile.tabConfigurations ? Object.keys(targetProfile.tabConfigurations)[0] : "") ||
        "Edit 9/2026";
      if (tab) setSelectedTab(tab);
    }
  }, [targetProfile]);

  // Suggest status column from profile if not yet saved in localStorage
  useEffect(() => {
    if (targetProfile && !localStorage.getItem("mvd_check_status_column")) {
      const mappings =
        targetProfile.tabConfigurations?.[selectedTab]?.fieldMappings ||
        targetProfile.fieldMappings ||
        [];
      const statusMapping = mappings.find((m) => m.semanticField === "PHOTO_PICK_STATUS");
      if (statusMapping?.columnLetter && statusMapping.columnLetter !== "NONE") {
        setStatusColumn(statusMapping.columnLetter);
      }
    }
  }, [targetProfile, selectedTab]);

  const handleRunCheck = async () => {
    if (!targetProfile) {
      setErrorMessage("Chưa có hồ sơ Google Sheet nào được cấu hình. Vui lòng vào Cấu hình Sheet.");
      return;
    }

    if (inputFolders.length === 0) {
      setErrorMessage("Danh sách thư mục đầu vào đang trống! Vui lòng thêm thư mục khách trước khi kiểm tra.");
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
      } catch {}

      const isMock = Boolean(
        targetProfile.isMockSandbox || targetProfile.spreadsheetId?.startsWith("mock")
      );

      const tabTitle = selectedTab || targetProfile.selectedTabTitle || "Edit 9/2026";
      const startRow =
        targetProfile.tabConfigurations?.[tabTitle]?.rowScope?.startRow ||
        targetProfile.rowScope?.startRow ||
        4;

      setCheckProgress(`Đang tải các dòng trên Tab "${tabTitle}"...`);
      const rows: SheetRowRecord[] = await sheetDiscoveryService.fetchSheetRowsForMatching(
        targetProfile.spreadsheetId,
        tabTitle,
        startRow,
        undefined,
        isMock
      );

      setCheckProgress(`Đang đối soát ${inputFolders.length} thư mục khách với Sheet...`);

      const effectiveProfile = isMock ? { ...targetProfile, isMockSandbox: true } : targetProfile;
      const targetValNorm = targetStatusValue.trim().toLowerCase();
      const colLetter = statusColumn.toUpperCase().trim();

      const results: FolderCheckResult[] = [];

      for (let i = 0; i < inputFolders.length; i++) {
        const folderPath = inputFolders[i];
        const folderName = getFolderName(folderPath);

        const match = sheetExtractorService.extractCodesForFolder(
          folderName,
          folderPath,
          rows,
          effectiveProfile
        );

        if (match.matchedRow) {
          const matchedRowRecord = rows.find((r) => r.row === match.matchedRow);
          const actualVal = (matchedRowRecord?.values[colLetter] || "").trim();
          const actualValNorm = actualVal.toLowerCase();

          const isKept = actualValNorm === targetValNorm;

          results.push({
            folderPath,
            folderName,
            isKept,
            matchedRow: match.matchedRow,
            actualStatus: actualVal || "(Trống)",
            reason: isKept
              ? `Khớp trạng thái "${actualVal}" (Dòng ${match.matchedRow})`
              : `Trạng thái là "${actualVal || "Trống"}" (Dòng ${match.matchedRow}), khác "${targetStatusValue}"`,
          });
        } else {
          // No match on sheet
          results.push({
            folderPath,
            folderName,
            isKept: false,
            actualStatus: "Không tìm thấy trên Sheet",
            reason: "Tên thư mục không khớp với dòng nào trên bảng tính",
          });
        }
      }

      setCheckResults(results);

      // Automatically apply filtering to input queue:
      // Keep only folders with isKept = true
      const keptFolders = results.filter((r) => r.isKept).map((r) => r.folderPath);
      const keptBatchItems = batchCustomerFolders.filter((b) =>
        keptFolders.includes(b.folder_path)
      );

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
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-1">
                Tab làm việc (Trang tính)
              </label>
              <div className="relative">
                <select
                  value={selectedTab}
                  onChange={(e) => setSelectedTab(e.target.value)}
                  className="w-full appearance-none bg-background border border-border/70 rounded-lg px-3 py-1.5 text-xs text-foreground font-semibold focus:outline-none focus:border-primary pr-8 cursor-pointer"
                >
                  {availableTabs.map((t) => (
                    <option key={t} value={t}>
                      {t}
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
                  những khách có trạng thái là <strong>"{targetStatusValue}"</strong> trên Cột <strong>{statusColumn}</strong> sẽ được <strong>GIỮ LẠI</strong>, các khách đã lọc hoặc không khớp sẽ được <strong>TỰ ĐỘNG ĐÁ RA</strong> khỏi danh sách.
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
                        <span className="font-semibold text-foreground truncate text-[11px]">
                          {item.folderName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                            item.isKept
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {item.actualStatus}
                        </span>
                        {item.matchedRow && (
                          <span className="text-muted-foreground">Dòng {item.matchedRow}</span>
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
              <span>Cột {statusColumn} • Trạng thái giữ: "{targetStatusValue}"</span>
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
              disabled={isChecking || inputFolders.length === 0}
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
