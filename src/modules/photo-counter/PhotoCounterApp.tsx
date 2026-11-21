import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useAppStore } from "@/core/stores/useAppStore";
import { checkAppAccess } from "@/core/services/appEntitlementPolicy";
import { AppLockGateScreen } from "@/core/components/AppLockGateScreen";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  UploadCloud,
  FolderOpen,
  Calendar,
  DollarSign,
  TrendingUp,
  Award,
  Layers,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
  FolderCheck,
  AlertCircle,
  ExternalLink,
  Trash2,
  FileSpreadsheet,
  Coins,
  ArrowUpRight,
  ArrowLeft,
  Info,
  Settings2,
  Filter,
  CheckCircle2,
  Sliders,
  CalendarDays,
  Target,
  X,
} from "lucide-react";
import {
  usePhotoCounterStore,
  computeFullSalary,
  getDayStats,
} from "./usePhotoCounterStore";
import type { PhotoType } from "./types";
import { SalaryAiPredictionAssistant } from "./components/SalaryAiPredictionAssistant";
import { ExportSpreadsheetModal } from "./components/ExportSpreadsheetModal";
import { useTranslation, getLocaleCode, localizeBackendMessage } from "@/core/lib/i18n";

export default function PhotoCounterApp() {
  const { tr, lang } = useTranslation();
  const locale = getLocaleCode(lang);
  const session = useAuthStore((s) => s.session);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);

  const appAccess = checkAppAccess(session, "photo-counter");

  const {
    monthPath,
    monthName,
    isScanning,
    scanResult,
    error,
    salaryConfig,
    options,
    excludedFolderPaths,
    folderTypeMap,
    setSalaryConfig,
    setOptions,
    toggleFolderExclusion,
    setFolderType,
    setDayAllFoldersType,
    removeDay,
    removeFolder,
    scanMonth,
    rescan,
    reset,
  } = usePhotoCounterStore();

  const [isHovering, setIsHovering] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "details">("overview");
  const [showFormulaHelper, setShowFormulaHelper] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "day" | "folder";
    path: string;
    name: string;
    photoCount: number;
  } | null>(null);

  // Detect duplicate day names in scanResult (e.g. duplicate day folders)
  const duplicateDayNames = useMemo(() => {
    if (!scanResult?.days) return new Set<string>();
    const counts = new Map<string, number>();
    for (const d of scanResult.days) {
      counts.set(d.day_name, (counts.get(d.day_name) || 0) + 1);
    }
    const dupes = new Set<string>();
    counts.forEach((cnt, name) => {
      if (cnt > 1) dupes.add(name);
    });
    return dupes;
  }, [scanResult]);

  // Tauri drag & drop listener
  useEffect(() => {
    let unlistenDragEnter: () => void;
    let unlistenDragDrop: () => void;

    async function setupListeners() {
      unlistenDragEnter = await listen("tauri://drag-enter", () => {
        setIsHovering(true);
      });

      unlistenDragDrop = await listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
        setIsHovering(false);
        if (event.payload.paths && event.payload.paths.length > 0) {
          scanMonth(event.payload.paths[0]);
        }
      });
    }

    setupListeners();

    return () => {
      if (unlistenDragEnter) unlistenDragEnter();
      if (unlistenDragDrop) unlistenDragDrop();
    };
  }, [scanMonth]);

  // Handle open directory dialog
  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: tr("Chọn thư mục Tháng đã chia ngày", "Select Monthly Folder (organized by day)"),
      });

      if (selected && typeof selected === "string") {
        scanMonth(selected);
      }
    } catch (err) {
      console.error("[PhotoCounter] Folder selection error:", err);
    }
  };

  // Full calculation results
  const calc = useMemo(() => {
    return computeFullSalary(
      scanResult,
      excludedFolderPaths,
      folderTypeMap,
      salaryConfig
    );
  }, [scanResult, excludedFolderPaths, folderTypeMap, salaryConfig]);

  // Format currency in VND
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format integer with separators
  const formatNum = (n: number) => n.toLocaleString(locale);

  // Toggle expand for a day
  const toggleDayExpanded = (dayKey: string) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayKey]: !prev[dayKey],
    }));
  };

  const expandAllDays = () => {
    if (!scanResult) return;
    const allExpanded: Record<string, boolean> = {};
    scanResult.days.forEach((d) => {
      allExpanded[d.day_path] = true;
    });
    setExpandedDays(allExpanded);
  };

  const collapseAllDays = () => {
    setExpandedDays({});
  };

  // Filtered days based on search input
  const filteredDays = useMemo(() => {
    if (!scanResult) return [];
    if (!searchFilter.trim()) return scanResult.days;

    const query = searchFilter.toLowerCase().trim();
    return scanResult.days.filter((day) => {
      if (day.day_name.toLowerCase().includes(query)) return true;
      return day.deepest_folders.some(
        (f) =>
          f.job_name.toLowerCase().includes(query) ||
          f.relative_path.toLowerCase().includes(query) ||
          f.folder_name.toLowerCase().includes(query)
      );
    });
  }, [scanResult, searchFilter]);

  // Copy formatted report for Zalo / Telegram / Accountant
  const handleCopyReport = async () => {
    let report = `📊 ${tr("BẢNG TỔNG HỢP LƯƠNG & SẢN LƯỢNG", "SALARY & OUTPUT SUMMARY REPORT")} - ${monthName ? monthName.toUpperCase() : tr("THỐNG KÊ THÁNG", "MONTHLY REPORT")}\n`;
    if (monthPath) report += `${tr("Thư mục:", "Folder:")} ${monthPath}\n`;
    report += `----------------------------------------\n`;
    report += `${tr("1. THÔNG SỐ CÔNG & KPI:", "1. WORKING DAYS & KPI:")}\n`;
    report += `• ${tr("Số ngày trong tháng:", "Days in month:")} ${salaryConfig.daysInMonth} ${tr("ngày", "days")}\n`;
    report += `• ${tr("Số ngày nghỉ:", "Days off:")} ${salaryConfig.daysOff} ${tr("ngày", "days")}\n`;
    report += `• ${tr("Ngày công thực tế (A):", "Actual working days (A):")} ${calc.actualWorkingDays} ${tr("ngày", "days")}\n`;
    report += `• ${tr("KPI 1 ngày:", "Daily KPI:")} ${formatNum(salaryConfig.dailyKpi)} ${tr("file", "files")}\n`;
    report += `• ${tr("KPI tháng", "Monthly KPI")} (A x ${salaryConfig.dailyKpi}): ${formatNum(calc.monthKpi)} ${tr("file", "files")}\n`;
    report += `----------------------------------------\n`;
    report += `${tr("2. SẢN LƯỢNG THỰC TẾ:", "2. ACTUAL OUTPUT:")}\n`;
    report += `• ${tr("Tổng file thực tế (T):", "Total weighted files (T):")} ${formatNum(calc.actualPhotos)} ${tr("file", "files")}\n`;
    if (calc.excessPhotos > 0) {
      report += `• ${tr("File vượt KPI:", "Excess files:")} +${formatNum(calc.excessPhotos)} ${tr("file", "files")} (${tr("Đơn giá:", "Rate:")} ${formatMoney(salaryConfig.unitPriceKpi)}/${tr("file", "file")})\n`;
    } else {
      report += `• ${tr("File vượt KPI:", "Excess files:")} 0 ${tr("file", "files")} (${tr("Chưa vượt KPI tháng", "Monthly KPI not exceeded")})\n`;
    }
    if (salaryConfig.vipSets > 0) {
      report += `• ${tr("Bộ VIP:", "VIP sets:")} ${salaryConfig.vipSets} ${tr("bộ", "sets")} x ${formatMoney(salaryConfig.vipPrice)}/${tr("bộ", "set")}\n`;
    }
    report += `----------------------------------------\n`;
    report += `${tr("3. CHI TIẾT CÁC KHOẢN LƯƠNG:", "3. EARNINGS BREAKDOWN:")}\n`;
    if (calc.isKpiAchieved) {
      report += `+ ${tr("Lương cơ bản (Đã đạt KPI):", "Base Salary (KPI Achieved):")} ${formatMoney(calc.appliedBaseSalary)}\n`;
      if (calc.excessSalary > 0) {
        report += `+ ${tr("Lương vượt KPI:", "Excess KPI Bonus:")} ${formatMoney(calc.excessSalary)} (${formatNum(calc.excessPhotos)} ${tr("file", "files")} x ${formatMoney(salaryConfig.unitPriceKpi)})\n`;
      }
    } else {
      report += `+ ${tr("Lương sản lượng (Chưa đạt KPI", "Piece-rate Pay (KPI target")} ${formatNum(calc.monthKpi)} ${tr("file):", "files not met):")} ${formatMoney(calc.appliedBaseSalary)} (${formatNum(calc.actualPhotos)} ${tr("file", "files")} x ${formatMoney(salaryConfig.unitPriceKpi)})\n`;
      report += `• ${tr("Lương cứng danh nghĩa:", "Nominal base salary:")} ${formatMoney(calc.baseSalary)} (${tr("Chưa đạt KPI nên không áp dụng", "Not applied until KPI met")})\n`;
      report += `• ${tr("Lương vượt KPI: 0 đ", "Excess KPI Bonus: 0 VND")}\n`;
    }
    if (calc.efficiencyBonus > 0) {
      report += `+ ${tr("Thưởng hiệu suất:", "Performance tier bonus:")} ${formatMoney(calc.efficiencyBonus)}\n`;
    }
    if (calc.vipBonus > 0) {
      report += `+ ${tr("Thưởng bộ VIP:", "VIP set bonus:")} ${formatMoney(calc.vipBonus)}\n`;
    }
    if (calc.allowance > 0) {
      report += `+ ${tr("Trợ cấp:", "Allowance:")} ${formatMoney(calc.allowance)}\n`;
    }
    if (calc.deduction > 0) {
      report += `- ${tr("Phụ thu khác:", "Deductions:")} ${formatMoney(calc.deduction)}\n`;
    }
    report += `========================================\n`;
    report += `👉 ${tr("TỔNG LƯƠNG THỰC LĨNH:", "TOTAL NET SALARY:")} ${formatMoney(calc.totalSalary)}\n`;

    if (scanResult && scanResult.days && scanResult.days.length > 0) {
      report += `----------------------------------------\n`;
      report += `${tr("CHI TIẾT THEO NGÀY:", "DAILY BREAKDOWN:")}\n`;
      scanResult.days.forEach((day) => {
        const stats = getDayStats(
          day,
          excludedFolderPaths,
          folderTypeMap,
          salaryConfig.type1Weight,
          salaryConfig.type2Weight
        );
        if (stats.rawCount > 0) {
          report += `- ${tr("Ngày", "Day")} ${day.day_name}: ${formatNum(stats.convertedCount)} ${tr("file quy đổi", "weighted files")} (${stats.rawCount} ${tr("ảnh gốc", "raw photos")}) [${day.job_count} ${tr("khách", "jobs")}]\n`;
        }
      });
    }

    try {
      await navigator.clipboard.writeText(report);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    } catch {
      alert(
        tr(
          "Không thể sao chép vào clipboard. Vui lòng cấp quyền clipboard.",
          "Could not copy to clipboard. Please grant clipboard permission.",
        ),
      );
    }
  };

  // Data payload for ExportSpreadsheetModal
  const exportData = useMemo(() => ({
    monthName,
    monthPath,
    salaryConfig,
    calc,
    scanResult,
    excludedFolderPaths,
    folderTypeMap,
  }), [monthName, monthPath, salaryConfig, calc, scanResult, excludedFolderPaths, folderTypeMap]);

  // Handle Làm mới dữ liệu button: rescans loaded directory from disk
  const handleRefreshData = async () => {
    if (!monthPath) {
      handleSelectFolder();
      return;
    }
    await rescan();
    setRefreshToast(
      tr(
        "Đã làm mới và cập nhật dữ liệu từ ổ đĩa thành công!",
        "Refreshed and updated folder data from disk successfully!",
      ),
    );
    setTimeout(() => setRefreshToast(null), 3000);
  };

  // Gatekeeper Screen if user has no access (trial expired and not purchased)
  if (!appAccess.hasAccess) {
    return (
      <AppLockGateScreen
        appId="photo-counter"
        appName={tr("Thống Kê & Tính Lương", "Photo Counter & Payroll")}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background text-foreground min-w-0">
      {/* 1. COMPACT HEADER BAR */}
      <div className="shrink-0 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-border bg-card/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5 min-w-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <Coins size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground tracking-tight">
                {tr("Thống kê", "Photo Counter & Payroll")}
              </h1>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {tr("Đối soát sản lượng ảnh theo ngày, tính toán KPI và tổng lương studio", "Reconcile daily photo output, calculate KPIs, and forecast studio payroll")}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshData}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-card hover:bg-muted border border-border text-foreground transition-colors cursor-pointer disabled:opacity-50"
            title={tr("Quét lại toàn bộ các thư mục và ngày đã nạp từ đĩa", "Rescan all loaded day folders from disk")}
          >
            <RefreshCw size={12} className={isScanning ? "animate-spin text-emerald-500" : "text-emerald-500"} />
            <span>{tr("Làm mới dữ liệu", "Refresh Data")}</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={!scanResult}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={tr("Xuất bảng tính đầy đủ công thức, ngày công và chi tiết sản lượng", "Export spreadsheet with full formulas, working days, and output details")}
          >
            <FileSpreadsheet size={13} />
            <span>{tr("Xuất sang trang tính", "Export Spreadsheet")}</span>
          </button>

          <button
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-card hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
            title={tr("Sao chép báo cáo Zalo nhanh", "Quick copy Zalo/Telegram summary report")}
          >
            {copiedSuccess ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            <span>{copiedSuccess ? tr("Đã sao chép!", "Copied!") : tr("Báo cáo Zalo", "Copy Summary")}</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN SCROLLABLE DASHBOARD */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* ERROR NOTIFICATION */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs animate-fade-in">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{tr("Lỗi quét thư mục:", "Folder scan error:")}</p>
                <p className="opacity-90">{localizeBackendMessage(error, lang)}</p>
              </div>
            </div>
          )}

          {/* FOLDER SELECTION / DROPZONE STRIP */}
          <div
            onClick={handleSelectFolder}
            className={`rounded-xl border transition-all cursor-pointer p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              !monthPath
                ? isHovering
                  ? "border-emerald-500 bg-emerald-500/10 shadow-md"
                  : "border-dashed border-border hover:border-emerald-500/50 bg-card/60 hover:bg-card"
                : "border-border bg-card shadow-2xs"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  monthPath
                    ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
              >
                {monthPath ? <FolderCheck size={18} /> : <UploadCloud size={18} />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground truncate">
                    {monthPath
                      ? `${tr("Thư mục tháng:", "Monthly folder:")} ${monthName}`
                      : tr("Kéo thả hoặc bấm để chọn thư mục Tháng", "Drag & drop or click to select Monthly Folder")}
                  </span>
                  {scanResult && (
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.2 rounded bg-muted border border-border shrink-0">
                      {scanResult.total_days} {tr("ngày", "days")}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                  {monthPath
                    ? monthPath
                    : tr("Chứa các ngày 22-9, 23-9... Tool tự động bóc tách thư mục sâu nhất để tính ảnh", "Contains day folders (e.g. 22-9, 23-9)... Deepest leaf folders are auto-detected for photo counting")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {monthPath && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRefreshData();
                    }}
                    disabled={isScanning}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-muted hover:bg-accent border border-border text-foreground transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title={tr("Quét lại thư mục này từ đĩa", "Rescan this folder from disk")}
                  >
                    <RefreshCw size={11} className={isScanning ? "animate-spin text-emerald-500" : "text-emerald-500"} />
                    <span>{tr("Làm mới", "Refresh")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      revealItemInDir(monthPath);
                    }}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-muted hover:bg-accent border border-border text-foreground transition-colors flex items-center gap-1"
                  >
                    <ExternalLink size={11} />
                    <span>Finder</span>
                  </button>
                </>
              )}
              <button
                type="button"
                className="px-3 py-1 text-[11px] font-semibold rounded-md bg-muted hover:bg-accent border border-border text-foreground transition-colors flex items-center gap-1.5"
              >
                <FolderOpen size={12} />
                <span>{monthPath ? tr("Đổi thư mục", "Change Folder") : tr("Chọn thư mục", "Select Folder")}</span>
              </button>
            </div>
          </div>

          {/* REFRESH NOTIFICATION TOAST */}
          {refreshToast && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs animate-fade-in shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
                <span className="font-medium">{refreshToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setRefreshToast(null)}
                className="text-muted-foreground hover:text-foreground text-xs px-1 cursor-pointer"
                aria-label={tr("Đóng", "Close")}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}

          {/* 3. SCIENTIFIC 2-COLUMN FINANCIAL DASHBOARD */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start min-w-0">
            {/* LEFT COLUMN: SALARY & KPI PARAMETERS (7 COLS) */}
            <div className="xl:col-span-7 space-y-3.5 min-w-0 xl:sticky xl:top-2 self-start xl:max-h-[calc(100vh-80px)] xl:overflow-y-auto custom-scrollbar pr-0.5">
              {/* SECTION A: THỜI GIAN & NGÀY CÔNG */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <CalendarDays size={14} className="text-primary" />
                    <span>{tr("Thời gian & Ngày công thực tế", "Schedule & Actual Working Days")}</span>
                  </div>
                  {/* Realtime indicator of Variable A */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold">
                    <span>A =</span>
                    <span>{calc.actualWorkingDays} {tr("công", "days")}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* Lựa chọn tháng 30 hoặc 31 ngày */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Số ngày trong tháng", "Days in month")}
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-muted p-0.5 rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => setSalaryConfig({ daysInMonth: 30 })}
                        className={`py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                          salaryConfig.daysInMonth === 30
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tr("30 Ngày", "30 Days")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSalaryConfig({ daysInMonth: 31 })}
                        className={`py-1 text-[11px] font-bold rounded transition-colors cursor-pointer ${
                          salaryConfig.daysInMonth === 31
                            ? "bg-card text-foreground shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tr("31 Ngày", "31 Days")}
                      </button>
                    </div>
                  </div>

                  {/* Số ngày nghỉ */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Số ngày nghỉ (ngày)", "Days off (days)")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={salaryConfig.daysInMonth}
                      value={salaryConfig.daysOff}
                      onChange={(e) =>
                        setSalaryConfig({ daysOff: Math.max(0, parseInt(e.target.value, 10) || 0) })
                      }
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Ngày công thực tế A */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Công thực tế (Biến A)", "Actual Working Days (A)")}
                    </label>
                    <div className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-muted/60 border border-border/80 text-foreground flex items-center justify-between">
                      <span>{calc.actualWorkingDays} {tr("ngày", "days")}</span>
                      <span className="text-[10px] text-muted-foreground">
                        ({salaryConfig.daysInMonth} - {salaryConfig.daysOff})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION B: LƯƠNG CỨNG, KPI & SẢN LƯỢNG THỰC TẾ */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Sliders size={14} className="text-primary" />
                    <span>{tr("Lương cứng & Định mức KPI", "Base Salary & KPI Quota")}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>{tr("KPI Tháng:", "Monthly KPI:")}</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatNum(calc.monthKpi)} {tr("file", "files")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* Lương cứng */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Lương cứng (VNĐ)", "Base Salary (VND)")}
                    </label>
                    <input
                      type="number"
                      step="500000"
                      value={salaryConfig.baseSalary}
                      onChange={(e) =>
                        setSalaryConfig({ baseSalary: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block truncate">
                      {formatMoney(salaryConfig.baseSalary)}
                    </span>
                  </div>

                  {/* KPI 1 ngày */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("KPI 1 ngày (file/ngày)", "Daily KPI (files/day)")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={salaryConfig.dailyKpi}
                      onChange={(e) =>
                        setSalaryConfig({ dailyKpi: Math.max(0, parseInt(e.target.value, 10) || 0) })
                      }
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      {tr("Tháng:", "Monthly:")} {formatNum(calc.monthKpi)} {tr("file", "files")}
                    </span>
                  </div>

                  {/* Sản lượng thực tế (T) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-muted-foreground font-medium">
                        {tr("Sản lượng thực tế (T)", "Actual Output (T)")}
                      </label>
                      {salaryConfig.manualPhotos !== null && (
                        <button
                          type="button"
                          onClick={() => setSalaryConfig({ manualPhotos: null })}
                          className="text-[10px] text-primary hover:underline"
                          title={tr("Khôi phục số ảnh đếm từ hệ thống", "Restore auto-counted photo total")}
                        >
                          {tr("Dùng đếm tự động", "Use auto count")}
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      value={calc.actualPhotos}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                        setSalaryConfig({ manualPhotos: isNaN(val as number) ? null : val });
                      }}
                      className={`w-full px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-background border text-foreground focus:outline-none focus:border-primary ${
                        salaryConfig.manualPhotos !== null ? "border-amber-500/60" : "border-border"
                      }`}
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block truncate">
                      {salaryConfig.manualPhotos !== null
                        ? tr("(Nhập tay)", "(Manual entry)")
                        : tr(`(Đếm từ thư mục: ${calc.rawScannedPhotos} ảnh)`, `(Scanned: ${calc.rawScannedPhotos} photos)`)}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION C: ĐƠN GIÁ VƯỢT KPI & BỘ VIP */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <DollarSign size={14} className="text-primary" />
                    <span>{tr("Đơn giá vượt KPI & Thưởng VIP", "Excess Rate & VIP Bonus")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-muted-foreground">{tr("Vượt:", "Excess:")}</span>
                    <span
                      className={`font-bold ${
                        calc.excessPhotos > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatNum(calc.excessPhotos)} {tr("file", "files")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* Đơn giá 1 file vượt KPI */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Đơn giá 1 file vượt (VNĐ)", "Excess File Rate (VND)")}
                    </label>
                    <input
                      type="number"
                      step="500"
                      value={salaryConfig.unitPriceKpi}
                      onChange={(e) =>
                        setSalaryConfig({ unitPriceKpi: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block truncate">
                      {tr("Chỉ tính khi vượt KPI", "Applied to excess files")}
                    </span>
                  </div>

                  {/* Số bộ VIP */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Số bộ VIP đã làm", "VIP Sets Completed")}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={salaryConfig.vipSets}
                      onChange={(e) =>
                        setSalaryConfig({ vipSets: Math.max(0, parseInt(e.target.value, 10) || 0) })
                      }
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      {tr("Thành tiền:", "Subtotal:")} {formatMoney(calc.vipBonus)}
                    </span>
                  </div>

                  {/* Đơn giá 1 bộ VIP */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Đơn giá 1 bộ VIP (VNĐ)", "VIP Set Rate (VND)")}
                    </label>
                    <input
                      type="number"
                      step="10000"
                      value={salaryConfig.vipPrice}
                      onChange={(e) =>
                        setSalaryConfig({ vipPrice: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      {formatMoney(salaryConfig.vipPrice)}/{tr("bộ", "set")}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION D: TRỢ CẤP, PHỤ THU & CÔNG THỨC HIỆU SUẤT */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <TrendingUp size={14} className="text-primary" />
                    <span>{tr("Trợ cấp, Phụ thu & Thưởng Hiệu suất", "Allowance, Deductions & Performance Bonus")}</span>
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    {tr("Hiệu suất:", "Perf. Bonus:")} +{formatMoney(calc.efficiencyBonus)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* Trợ cấp */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Trợ cấp / Thưởng khác (VNĐ)", "Allowance / Other Bonus (VND)")}
                    </label>
                    <input
                      type="number"
                      step="50000"
                      value={salaryConfig.allowance}
                      onChange={(e) =>
                        setSalaryConfig({ allowance: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      +{formatMoney(salaryConfig.allowance)}
                    </span>
                  </div>

                  {/* Phụ thu */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Phụ thu / Giảm trừ (VNĐ)", "Deductions / Advances (VND)")}
                    </label>
                    <input
                      type="number"
                      step="10000"
                      value={salaryConfig.deduction}
                      onChange={(e) =>
                        setSalaryConfig({ deduction: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      -{formatMoney(salaryConfig.deduction)}
                    </span>
                  </div>
                </div>

                {/* Custom Efficiency Formula */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                      <span>{tr("Công thức thưởng hiệu suất", "Performance Bonus Formula")}</span>
                      <button
                        type="button"
                        onClick={() => setShowFormulaHelper(!showFormulaHelper)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Info size={11} />
                      </button>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSalaryConfig({
                          efficiencyFormula: "Math.floor(T / 1000) * 500000",
                        })
                      }
                      className="text-[10px] text-primary hover:underline"
                    >
                      {tr("Mặc định (T // 1000 * 500k)", "Default (T // 1000 * 500k)")}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={salaryConfig.efficiencyFormula}
                    onChange={(e) => setSalaryConfig({ efficiencyFormula: e.target.value })}
                    className="w-full px-2.5 py-1 text-xs font-mono rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    placeholder="Math.floor(T / 1000) * 500000"
                  />

                  {showFormulaHelper && (
                    <div className="p-2 rounded bg-muted/60 text-[10px] text-muted-foreground space-y-1 mt-1 border border-border/60">
                      <p>
                        • <strong>{tr("Biến T", "Variable T")}</strong>: {tr("Tổng file thực tế (hiện tại:", "Total weighted files (current:")} {calc.actualPhotos})
                      </p>
                      <p>
                        • <strong>{tr("Biến A", "Variable A")}</strong>: {tr("Ngày công thực tế (hiện tại:", "Actual working days (current:")} {calc.actualWorkingDays})
                      </p>
                      <p>• {tr("Ví dụ chia lấy nguyên 700:", "Example floor division by 700:")} <code>Math.floor(T / 700) * 400000</code></p>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION E: QUY ĐỔI ẢNH LOẠI 1 & LOẠI 2 */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Layers size={14} className="text-primary" />
                    <span>{tr("Hệ số quy đổi Ảnh Loại 1 / Loại 2", "Type 1 / Type 2 Conversion Weights")}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    1 {tr("Loại 1", "Type 1")} = {(1 / (salaryConfig.type2Weight || 1)).toFixed(1)} {tr("Loại 2", "Type 2")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Hệ số Ảnh Loại 1", "Type 1 Photo Weight")}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={salaryConfig.type1Weight}
                      onChange={(e) =>
                        setSalaryConfig({ type1Weight: Math.max(0.1, parseFloat(e.target.value) || 1.0) })
                      }
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      {tr("Hệ số Ảnh Loại 2 (ví dụ 0.5)", "Type 2 Photo Weight (e.g. 0.5)")}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.05"
                      value={salaryConfig.type2Weight}
                      onChange={(e) =>
                        setSalaryConfig({ type2Weight: Math.max(0.05, parseFloat(e.target.value) || 0.5) })
                      }
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: FINANCIAL STATEMENT & METRICS (5 COLS) */}
            <div className="xl:col-span-5 space-y-3.5 min-w-0">
              {/* 1. HERO SALARY CARD */}
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-card via-card to-emerald-500/10 p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden">
                {/* Decorative background glow */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Coins size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                        {tr("Tổng thu nhập thực lĩnh", "Total Net Salary")}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {monthName || tr("Tháng này", "This Month")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {calc.isKpiAchieved ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-2xs">
                        <Target size={11} className="text-emerald-500" />
                        {tr("ĐẠT KPI", "KPI MET")}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-2xs">
                        <AlertCircle size={11} className="text-amber-500" />
                        {tr("Chưa đạt KPI", "KPI Not Met")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Big Net Salary Display */}
                <div className="relative z-10 py-1">
                  <div className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                    {formatMoney(calc.totalSalary)}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {tr("Đã bao gồm lương cơ bản/sản lượng, các khoản thưởng vượt và trừ khấu trừ", "Includes base/piece-rate pay, excess & tier bonuses, minus deductions")}
                  </p>
                </div>

                {/* KPI Visual Progress Bar */}
                <div className="relative z-10 space-y-1.5 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium text-[11px]">
                      {tr("Tiến độ hoàn thành KPI", "KPI Completion Progress")}
                    </span>
                    <span className="font-mono font-bold text-foreground text-[11px]">
                      {formatNum(calc.actualPhotos)} / {formatNum(calc.monthKpi)} {tr("ảnh", "photos")} ({Math.min(999, Math.round((calc.actualPhotos / (calc.monthKpi || 1)) * 100))}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/80 overflow-hidden border border-border/40 p-[1px]">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        calc.isKpiAchieved
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                          : "bg-gradient-to-r from-amber-500 to-amber-400"
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(2, Math.round((calc.actualPhotos / (calc.monthKpi || 1)) * 100)))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. KPI 4-GRID QUICK METRICS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-card border border-border shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp size={12} className="text-primary" />
                    <span className="text-[10px] font-semibold">{tr("Mục tiêu KPI", "KPI Target")}</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-foreground">
                    {formatNum(calc.monthKpi)}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    {tr("Định mức tháng", "Monthly quota")}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-semibold">{tr("Thực tế làm", "Completed")}</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatNum(calc.actualPhotos)}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    {tr("Ảnh quy đổi", "Weighted photos")}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowUpRight size={12} className={calc.excessPhotos > 0 ? "text-emerald-500" : "text-amber-500"} />
                    <span className="text-[10px] font-semibold">{tr("Chênh lệch", "Variance")}</span>
                  </div>
                  <div
                    className={`text-sm font-bold font-mono truncate ${
                      calc.excessPhotos > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : calc.isKpiAchieved
                        ? "text-foreground"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {calc.excessPhotos > 0
                      ? `+${formatNum(calc.excessPhotos)}`
                      : calc.isKpiAchieved
                      ? tr("Đạt chuẩn", "On Target")
                      : `-${formatNum(calc.monthKpi - calc.actualPhotos)}`}
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    {calc.excessPhotos > 0 ? tr("Vượt định mức", "Above quota") : calc.isKpiAchieved ? tr("Chuẩn KPI", "Exact KPI") : tr("Cần bổ sung", "Remaining")}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays size={12} className="text-sky-500" />
                    <span className="text-[10px] font-semibold">{tr("Ngày công", "Workdays")}</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-foreground">
                    {calc.actualWorkingDays} <span className="text-xs font-normal text-muted-foreground">/ {salaryConfig.daysInMonth} {tr("ngày", "days")}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground block">
                    {tr("Công thực tế", "Actual shifts")}
                  </span>
                </div>
              </div>

              {/* 3. ITEM-BY-ITEM INCOME BREAKDOWN */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/80">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">
                      {tr("Bảng kê chi tiết các khoản thu nhập", "Detailed Earnings Breakdown")}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {tr("Căn cứ tính toán", "Calculation Basis")}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs divide-y divide-border/50">
                  {/* 1. Lương cơ bản / sản lượng */}
                  <div className="flex items-start justify-between pt-2">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">
                        {calc.isKpiAchieved
                          ? tr("1. Lương cơ bản theo ngày công", "1. Base Salary by Working Days")
                          : tr("1. Lương sản lượng (Chưa đạt KPI)", "1. Piece-Rate Pay (KPI Not Met)")}
                      </span>
                      {calc.isKpiAchieved ? (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
                          {tr("Đạt KPI • Hưởng trọn lương cứng", "KPI Met • Full base salary")} {formatMoney(salaryConfig.baseSalary)} ({calc.actualWorkingDays} {tr("công thực tế)", "actual shifts)")}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-medium mt-0.5">
                          {formatNum(calc.actualPhotos)} {tr("file", "files")} x {formatMoney(salaryConfig.unitPriceKpi)} • {tr("Cần thêm", "Need")} {formatNum(calc.monthKpi - calc.actualPhotos)} {tr("file để nhận lương cứng", "more files to unlock base salary")} {formatMoney(calc.baseSalary)}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-foreground shrink-0 mt-0.5">
                      {formatMoney(calc.appliedBaseSalary)}
                    </span>
                  </div>

                  {/* 2. Lương vượt KPI */}
                  <div className="flex items-start justify-between pt-2.5">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">{tr("2. Thưởng vượt định mức KPI", "2. Excess KPI Bonus")}</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {calc.isKpiAchieved
                          ? calc.excessPhotos > 0
                            ? `${formatNum(calc.excessPhotos)} ${tr("file vượt", "excess files")} x ${formatMoney(salaryConfig.unitPriceKpi)}`
                            : tr("Đạt chuẩn KPI (chưa có file vượt)", "Exact KPI met (no excess files yet)")
                          : tr("Chưa đạt KPI (không áp dụng thưởng vượt)", "KPI not met (no excess bonus)")}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 mt-0.5 ${
                        calc.excessSalary > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {calc.excessSalary > 0 ? `+${formatMoney(calc.excessSalary)}` : tr("0 đ", "0 VND")}
                    </span>
                  </div>

                  {/* 3. Thưởng hiệu suất */}
                  <div className="flex items-start justify-between pt-2.5">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">{tr("3. Thưởng hiệu suất", "3. Performance Tier Bonus")}</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {tr("Cứ mỗi 1.000 file thưởng 500.000đ", "+500,000 VND per 1,000 files")} ({calc.efficiencyBonus > 0 ? `${tr("Đạt", "Reached")} ${formatNum(Math.floor(calc.actualPhotos / 1000) * 1000)} ${tr("file", "files")}` : tr("Chưa đủ mốc 1.000 file", "Below 1,000-file tier")})
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 mt-0.5 ${
                        calc.efficiencyBonus > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {calc.efficiencyBonus > 0 ? `+${formatMoney(calc.efficiencyBonus)}` : tr("0 đ", "0 VND")}
                    </span>
                  </div>

                  {/* 4. Thưởng VIP */}
                  <div className="flex items-start justify-between pt-2.5">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">{tr("4. Thưởng bộ sản phẩm VIP", "4. VIP Set Bonus")}</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {salaryConfig.vipSets} {tr("bộ", "sets")} x {formatMoney(salaryConfig.vipPrice)}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 mt-0.5 ${
                        calc.vipBonus > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {calc.vipBonus > 0 ? `+${formatMoney(calc.vipBonus)}` : tr("0 đ", "0 VND")}
                    </span>
                  </div>

                  {/* 5. Trợ cấp */}
                  <div className="flex items-start justify-between pt-2.5">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">{tr("5. Trợ cấp & phụ cấp", "5. Allowances & Perks")}</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {tr("Hỗ trợ xăng xe, ăn trưa và chuyên cần", "Fuel, lunch, and attendance allowance")}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      +{formatMoney(calc.allowance)}
                    </span>
                  </div>

                  {/* 6. Phụ thu / Khấu trừ */}
                  <div className="flex items-start justify-between pt-2.5">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">{tr("6. Khấu trừ & phụ thu", "6. Deductions & Advances")}</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {tr("Trừ tạm ứng hoặc vi phạm quy chế", "Salary advances or policy deductions")}
                      </span>
                    </div>
                    <span className={`font-mono font-bold shrink-0 mt-0.5 ${calc.deduction > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {calc.deduction > 0 ? `-${formatMoney(calc.deduction)}` : tr("0 đ", "0 VND")}
                    </span>
                  </div>
                </div>

                {/* Final Net Total Summary Bar */}
                <div className="pt-3 border-t border-border flex items-center justify-between bg-muted/30 -mx-4 -mb-4 p-3.5 rounded-b-xl">
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      {tr("Thực lĩnh cuối cùng", "Final Net Salary")}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {tr("Lương cứng/sản lượng + Thưởng - Khấu trừ", "Base/Piece Pay + Bonuses - Deductions")}
                    </span>
                  </div>
                  <span className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatMoney(calc.totalSalary)}
                  </span>
                </div>
              </div>

              {/* AI SALARY PREDICTION & COACH ASSISTANT */}
              <SalaryAiPredictionAssistant
                calc={calc}
                salaryConfig={salaryConfig}
                monthName={monthName}
              />
            </div>
          </div>

          {/* 4. DAILY BREAKDOWN & FOLDER DETAILS */}
          {scanResult && scanResult.days && (
            <div className="space-y-3 pt-2 min-w-0">
              {/* Daily Header Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    {tr("DANH SÁCH CHI TIẾT THEO NGÀY", "DAILY FOLDER BREAKDOWN")} ({filteredDays.length} {tr("ngày", "days")})
                  </span>
                  <span className="text-[10px] text-muted-foreground px-2 py-0.2 rounded bg-muted border border-border">
                    {calc.rawScannedPhotos} {tr("ảnh gốc", "raw photos")}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder={tr("Tìm theo ngày hoặc tên khách...", "Filter by day or customer...")}
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground/85 focus:outline-none focus:border-primary w-48"
                  />

                  <button
                    type="button"
                    onClick={expandAllDays}
                    className="px-2 py-1 text-[10px] font-semibold rounded bg-muted hover:bg-accent text-foreground border border-border"
                  >
                    {tr("Bung tất cả", "Expand All")}
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllDays}
                    className="px-2 py-1 text-[10px] font-semibold rounded bg-muted hover:bg-accent text-muted-foreground border border-border"
                  >
                    {tr("Thu gọn", "Collapse All")}
                  </button>
                </div>
              </div>

              {/* Duplicate Day Alert Banner if detected */}
              {duplicateDayNames.size > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1 space-y-1">
                    <div className="font-bold flex items-center gap-2">
                      <span>{tr(`Phát hiện ${duplicateDayNames.size} ngày có thư mục bị lặp trong tháng!`, `Detected ${duplicateDayNames.size} day(s) with duplicate folders!`)}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 font-mono font-semibold">
                        {Array.from(duplicateDayNames).map((n) => `${tr("Ngày", "Day")} ${n}`).join(", ")}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90">
                      {tr("Do thư mục tháng có nhiều thư mục cùng ngày (ví dụ copy lặp hoặc chia lẻ). Bạn có thể bấm vào biểu tượng thùng rác ở ngày hoặc thư mục thừa để loại bỏ ngay khỏi bảng tính.", "Multiple folders share the same day name in this month directory (e.g. duplicate copies or split folders). Use the trash icon on any extra day or subfolder to exclude it from payroll calculations.")}
                    </p>
                  </div>
                </div>
              )}

              {/* Day Cards List */}
              <div className="space-y-2">
                {filteredDays.map((day) => {
                  const isExpanded = !!expandedDays[day.day_path];
                  const isDuplicateDay = duplicateDayNames.has(day.day_name);
                  const stats = getDayStats(
                    day,
                    excludedFolderPaths,
                    folderTypeMap,
                    salaryConfig.type1Weight,
                    salaryConfig.type2Weight
                  );

                  return (
                    <div
                      key={day.day_path}
                      className={`rounded-xl border transition-all overflow-hidden shadow-2xs ${
                        isDuplicateDay
                          ? "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
                          : "border-border bg-card/90 hover:bg-card"
                      }`}
                    >
                      {/* Day Header Row */}
                      <div
                        onClick={() => toggleDayExpanded(day.day_path)}
                        className="p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 cursor-pointer select-none hover:bg-muted/40 transition-colors min-w-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-foreground">
                                {tr("Ngày", "Day")} {day.day_name}
                              </span>
                              {isDuplicateDay && (
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 flex items-center gap-1">
                                  <AlertCircle size={10} />
                                  {tr("Trùng lặp ngày", "Duplicate day")}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground px-1.5 py-0.2 rounded bg-muted border border-border">
                                {day.job_count} {tr("khách/job", "jobs")}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                ({day.deepest_folders.length} {tr("thư mục sâu nhất", "leaf folders")})
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right Quick Day Metrics */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Photo badges */}
                          <div className="flex items-center gap-1.5 text-xs font-mono">
                            {stats.type1Photos > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[10px] font-semibold">
                                {stats.type1Photos} L1
                              </span>
                            )}
                            {stats.type2Photos > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[10px] font-semibold">
                                {stats.type2Photos} L2
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded bg-muted border border-border font-bold text-foreground">
                              {stats.convertedCount} {tr("file quy đổi", "weighted files")}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              revealItemInDir(day.day_path);
                            }}
                            className="w-6 h-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                            title={tr("Mở thư mục ngày trong Finder", "Reveal day folder in Finder/Explorer")} aria-label={tr("Mở thư mục ngày trong Finder", "Reveal day folder in Finder/Explorer")}
                          >
                            <ExternalLink size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete({
                                type: "day",
                                path: day.day_path,
                                name: `${tr("Ngày", "Day")} ${day.day_name}`,
                                photoCount: stats.rawCount,
                              });
                            }}
                            className="h-6 px-2 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer border border-transparent hover:border-destructive/30"
                            title={tr("Xoá thư mục ngày này ra khỏi hệ thống thống kê", "Remove this day folder from statistics")}
                          >
                            <Trash2 size={12} />
                            <span>{tr("Xoá", "Remove")}</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded View: Leaf Folders with Type 1 / Type 2 Selector */}
                      {isExpanded && (
                        <div className="border-t border-border/70 bg-muted/20 p-3 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground px-1 mb-1">
                            <span>{tr(`CÁC THƯ MỤC SÂU NHẤT TRONG NGÀY ${day.day_name}:`, `LEAF FOLDERS IN DAY ${day.day_name}:`)}</span>
                            <div className="flex items-center gap-2">
                              <span>{tr("Gán nhanh cả ngày:", "Assign all in day:")}</span>
                              <button
                                type="button"
                                onClick={() => setDayAllFoldersType(day, "type1")}
                                className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25 text-[10px] font-semibold"
                              >
                                {tr("Tất cả Loại 1", "All Type 1")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDayAllFoldersType(day, "type2")}
                                className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 text-[10px] font-semibold"
                              >
                                {tr("Tất cả Loại 2", "All Type 2")}
                              </button>
                            </div>
                          </div>

                          {day.deepest_folders.map((folder, fIdx) => {
                            const isExcluded = !!excludedFolderPaths[folder.folder_path];
                            const currentType: PhotoType =
                              folderTypeMap[folder.folder_path] || "type1";

                            return (
                              <div
                                key={fIdx}
                                className={`p-2.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                  isExcluded
                                    ? "bg-muted/40 border-dashed border-border opacity-50"
                                    : "bg-card border-border shadow-2xs"
                                }`}
                              >
                                {/* Folder Details */}
                                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={!isExcluded}
                                    onChange={() => toggleFolderExclusion(folder.folder_path)}
                                    className="mt-0.5 sm:mt-0 w-3.5 h-3.5 rounded text-primary focus:ring-primary cursor-pointer"
                                    title={isExcluded ? tr("Click để tính lại", "Click to include") : tr("Click để loại trừ", "Click to exclude")}
                                  />

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-foreground">
                                        {folder.job_name}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">/</span>
                                      <span className="text-[11px] font-mono text-primary font-medium truncate max-w-[280px]">
                                        {folder.folder_name}
                                      </span>
                                    </div>
                                    <p
                                      className="text-[10px] text-muted-foreground truncate font-mono mt-0.5"
                                      title={folder.relative_path}
                                    >
                                      {folder.relative_path}
                                    </p>

                                    {/* Sample files */}
                                    {folder.sample_files && folder.sample_files.length > 0 && (
                                      <div className="flex items-center gap-1 flex-wrap mt-1">
                                        <span className="text-[10px] text-muted-foreground/85">
                                          {tr("Mẫu:", "Samples:")}
                                        </span>
                                        {folder.sample_files.slice(0, 3).map((fName, sIdx) => (
                                          <span
                                            key={sIdx}
                                            className="text-[10px] font-mono px-1 py-0.2 rounded bg-muted/80 text-muted-foreground border border-border/60"
                                          >
                                            {fName}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Folder Photo Type & Count */}
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  {/* Type 1 / Type 2 Selector */}
                                  <div className="flex items-center bg-muted rounded p-0.5 border border-border">
                                    <button
                                      type="button"
                                      onClick={() => setFolderType(folder.folder_path, "type1")}
                                      className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                                        currentType === "type1"
                                          ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      {tr("Loại 1", "Type 1")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setFolderType(folder.folder_path, "type2")}
                                      className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                                        currentType === "type2"
                                          ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      {tr("Loại 2", "Type 2")}
                                    </button>
                                  </div>

                                  <div className="text-right">
                                    <span
                                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                                        isExcluded
                                          ? "line-through text-muted-foreground bg-muted"
                                          : "text-foreground bg-muted border border-border"
                                      }`}
                                    >
                                      {folder.photo_count} {tr("ảnh", "photos")}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => revealItemInDir(folder.folder_path)}
                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    title={tr("Mở thư mục trong Finder", "Reveal folder in Finder/Explorer")} aria-label={tr("Mở thư mục trong Finder", "Reveal folder in Finder/Explorer")}
                                  >
                                    <ExternalLink size={12} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setConfirmDelete({
                                        type: "folder",
                                        path: folder.folder_path,
                                        name: `${folder.job_name} / ${folder.folder_name}`,
                                        photoCount: folder.photo_count,
                                      });
                                    }}
                                    className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                    title={tr("Xoá thư mục con này ra khỏi hệ thống thống kê", "Remove this subfolder from statistics")} aria-label={tr("Xoá thư mục con này ra khỏi hệ thống thống kê", "Remove this subfolder from statistics")}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. REMOVE FROM SYSTEM MODAL (100% IN-APP, NO DISK MODIFICATION) */}
      {confirmDelete && (
        <div role="dialog" aria-modal="true" aria-labelledby="dlg-PhotoCounterApp-1" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border shadow-2xl rounded-2xl max-w-md w-full p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 id="dlg-PhotoCounterApp-1" className="text-sm font-bold text-foreground">
                  {tr("Xoá khỏi hệ thống thống kê", "Remove from Statistics")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {tr("Loại bỏ thư mục bị trùng lặp hoặc thừa ra khỏi bảng tính", "Exclude duplicate or extra folder from payroll calculations")}
                </p>
              </div>
            </div>

            {/* Target Details */}
            <div className="p-3 rounded-xl bg-muted/60 border border-border/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">{tr("Mục xoá:", "Target:")}</span>
                <span className="font-bold text-foreground">{confirmDelete.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">{tr("Số lượng ảnh:", "Photo count:")}</span>
                <span className="font-mono font-bold text-primary">
                  {confirmDelete.photoCount} {tr("ảnh", "photos")}
                </span>
              </div>
              <div className="pt-1 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground block font-medium mb-0.5">
                  {tr("Đường dẫn:", "Path:")}
                </span>
                <p className="font-mono text-[10px] text-muted-foreground break-all bg-background/50 p-1.5 rounded border border-border/50 select-all">
                  {confirmDelete.path}
                </p>
              </div>
            </div>

            {/* Reassurance Banner */}
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>{tr("An toàn tuyệt đối:", "Completely safe:")}</strong>{" "}
                {tr(
                  "Thao tác này chỉ xóa thư mục ra khỏi bảng tính của app,",
                  "This only removes the folder from the app's report and",
                )}{" "}
                <strong>
                  {tr(
                    "không xóa hay can thiệp bất kỳ file/thư mục nào trên máy tính",
                    "does not delete or modify any files on disk",
                  )}
                </strong>
                .
              </span>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="py-2 px-3 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold border border-border transition-colors cursor-pointer"
              >
                {tr("Hủy bỏ", "Cancel")}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirmDelete.type === "day") {
                    removeDay(confirmDelete.path);
                  } else {
                    removeFolder(confirmDelete.path);
                  }
                  setConfirmDelete(null);
                }}
                className="py-2 px-3 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Trash2 size={14} />
                <span>{tr("Xác nhận xoá", "Confirm Remove")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. EXPORT SPREADSHEET MODAL */}
      <ExportSpreadsheetModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        data={exportData}
      />
    </div>
  );
}
