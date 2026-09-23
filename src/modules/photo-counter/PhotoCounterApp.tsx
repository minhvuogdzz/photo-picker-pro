import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useAppStore } from "@/core/stores/useAppStore";
import { LicenseManager } from "@/core/license/LicenseManager";
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
  Crown,
  Sparkles,
  ArrowUpRight,
  ArrowLeft,
  Info,
  Settings2,
  Filter,
  CheckCircle2,
  Sliders,
  CalendarDays,
} from "lucide-react";
import {
  usePhotoCounterStore,
  computeFullSalary,
  getDayStats,
} from "./usePhotoCounterStore";
import type { PhotoType } from "./types";
import { SalaryAiPredictionAssistant } from "./components/SalaryAiPredictionAssistant";
import { ExportSpreadsheetModal } from "./components/ExportSpreadsheetModal";

export default function PhotoCounterApp() {
  const session = useAuthStore((s) => s.session);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);

  // Dedicated VIP Premium Permission Check:
  // Strictly restricted to accounts granted VIP Premium (`session?.subscription?.isPremium === true`).
  const isPremium = session?.subscription?.isPremium === true;

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
        title: "Chọn thư mục Tháng đã chia ngày",
      });

      if (selected && typeof selected === "string") {
        scanMonth(selected);
      }
    } catch (err) {
      console.error("Lỗi chọn thư mục:", err);
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
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format integer with separators
  const formatNum = (n: number) => n.toLocaleString("vi-VN");

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
    let report = `📊 BẢNG TỔNG HỢP LƯƠNG & SẢN LƯỢNG - ${monthName ? monthName.toUpperCase() : "THỐNG KÊ THÁNG"}\n`;
    if (monthPath) report += `Thư mục: ${monthPath}\n`;
    report += `----------------------------------------\n`;
    report += `1. THÔNG SỐ CÔNG & KPI:\n`;
    report += `• Số ngày trong tháng: ${salaryConfig.daysInMonth} ngày\n`;
    report += `• Số ngày nghỉ: ${salaryConfig.daysOff} ngày\n`;
    report += `• Ngày công thực tế (A): ${calc.actualWorkingDays} ngày\n`;
    report += `• KPI 1 ngày: ${formatNum(salaryConfig.dailyKpi)} file\n`;
    report += `• KPI tháng (A x ${salaryConfig.dailyKpi}): ${formatNum(calc.monthKpi)} file\n`;
    report += `----------------------------------------\n`;
    report += `2. SẢN LƯỢNG THỰC TẾ:\n`;
    report += `• Tổng file thực tế (T): ${formatNum(calc.actualPhotos)} file\n`;
    if (calc.excessPhotos > 0) {
      report += `• File vượt KPI: +${formatNum(calc.excessPhotos)} file (Đơn giá: ${formatMoney(salaryConfig.unitPriceKpi)}/file)\n`;
    } else {
      report += `• File vượt KPI: 0 file (Chưa vượt KPI tháng)\n`;
    }
    if (salaryConfig.vipSets > 0) {
      report += `• Bộ VIP: ${salaryConfig.vipSets} bộ x ${formatMoney(salaryConfig.vipPrice)}/bộ\n`;
    }
    report += `----------------------------------------\n`;
    report += `3. CHI TIẾT CÁC KHOẢN LƯƠNG:\n`;
    if (calc.isKpiAchieved) {
      report += `+ Lương cơ bản (Đã đạt KPI): ${formatMoney(calc.appliedBaseSalary)}\n`;
      if (calc.excessSalary > 0) {
        report += `+ Lương vượt KPI: ${formatMoney(calc.excessSalary)} (${formatNum(calc.excessPhotos)} file x ${formatMoney(salaryConfig.unitPriceKpi)})\n`;
      }
    } else {
      report += `+ Lương sản lượng (Chưa đạt KPI ${formatNum(calc.monthKpi)} file): ${formatMoney(calc.appliedBaseSalary)} (${formatNum(calc.actualPhotos)} file x ${formatMoney(salaryConfig.unitPriceKpi)})\n`;
      report += `• Lương cứng danh nghĩa: ${formatMoney(calc.baseSalary)} (Chưa đạt KPI nên không áp dụng)\n`;
      report += `• Lương vượt KPI: 0 đ\n`;
    }
    if (calc.efficiencyBonus > 0) {
      report += `+ Thưởng hiệu suất: ${formatMoney(calc.efficiencyBonus)}\n`;
    }
    if (calc.vipBonus > 0) {
      report += `+ Thưởng bộ VIP: ${formatMoney(calc.vipBonus)}\n`;
    }
    if (calc.allowance > 0) {
      report += `+ Trợ cấp: ${formatMoney(calc.allowance)}\n`;
    }
    if (calc.deduction > 0) {
      report += `- Phụ thu khác: ${formatMoney(calc.deduction)}\n`;
    }
    report += `========================================\n`;
    report += `👉 TỔNG LƯƠNG THỰC LĨNH: ${formatMoney(calc.totalSalary)}\n`;

    if (scanResult && scanResult.days && scanResult.days.length > 0) {
      report += `----------------------------------------\n`;
      report += `CHI TIẾT THEO NGÀY:\n`;
      scanResult.days.forEach((day) => {
        const stats = getDayStats(
          day,
          excludedFolderPaths,
          folderTypeMap,
          salaryConfig.type1Weight,
          salaryConfig.type2Weight
        );
        if (stats.rawCount > 0) {
          report += `- Ngày ${day.day_name}: ${formatNum(stats.convertedCount)} file quy đổi (${stats.rawCount} ảnh gốc) [${day.job_count} khách]\n`;
        }
      });
    }

    try {
      await navigator.clipboard.writeText(report);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    } catch {
      alert("Không thể sao chép vào clipboard. Vui lòng cấp quyền clipboard.");
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
    setRefreshToast("Đã làm mới và cập nhật dữ liệu từ ổ đĩa thành công!");
    setTimeout(() => setRefreshToast(null), 3000);
  };

  // VIP Premium Gatekeeper Screen
  if (!isPremium) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-card/90 backdrop-blur-md rounded-xl border border-border p-8 text-center relative overflow-hidden animate-fade-in select-none text-foreground">
        
        {/* Back Button */}
        <button
          onClick={() => setActiveModule("launcher")}
          className="absolute top-4 left-4 w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border"
          title="Quay lại Launcher"
        >
          <ArrowLeft size={14} />
        </button>

        {/* VIP Crown Box */}
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-3">
          <Crown size={22} />
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-semibold mb-2.5">
          <Sparkles size={11} />
          <span>ĐẶC QUYỀN VIP STUDIO OPS</span>
        </div>

        <h2 className="text-base font-semibold text-foreground mb-1.5 tracking-tight">
          Thống Kê & Tính Lương Dành Riêng Cho Tài Khoản VIP Premium
        </h2>

        <p className="text-xs text-muted-foreground max-w-md mb-5 leading-relaxed">
          Tính năng thống kê sản lượng ảnh, đối soát KPI và tính toán lương studio chỉ mở khóa cho tài khoản được cấp quyền <strong>VIP Premium</strong>.
        </p>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveModule("launcher")}
            className="h-9 px-3.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground border border-border transition-colors cursor-pointer"
          >
            Quay lại Launcher
          </button>

          <button
            onClick={() => setShowLicenseModal(true)}
            className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Crown size={13} />
            <span>Đổi quyền lợi / Đăng ký Premium</span>
          </button>
        </div>

        {showLicenseModal && (
          <LicenseManager
            onClose={() => setShowLicenseModal(false)}
            initialMode="request"
            initialIsPremium={true}
            variant="modal"
          />
        )}
      </div>
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
              <h1 className="text-sm font-bold text-foreground tracking-tight">Thống kê</h1>
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 uppercase">
                <Crown size={9} />
                <span>PREMIUM</span>
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Đối soát sản lượng ảnh theo ngày, tính toán KPI và tổng lương studio
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshData}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-card hover:bg-muted border border-border text-foreground transition-colors cursor-pointer disabled:opacity-50"
            title="Quét lại toàn bộ các thư mục và ngày đã nạp từ đĩa"
          >
            <RefreshCw size={12} className={isScanning ? "animate-spin text-emerald-500" : "text-emerald-500"} />
            <span>Làm mới dữ liệu</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={!scanResult}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Xuất bảng tính đầy đủ công thức, ngày công và chi tiết sản lượng"
          >
            <FileSpreadsheet size={13} />
            <span>Xuất sang trang tính</span>
          </button>

          <button
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-card hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
            title="Sao chép báo cáo Zalo nhanh"
          >
            {copiedSuccess ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            <span>{copiedSuccess ? "Đã sao chép!" : "Báo cáo Zalo"}</span>
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
                <p className="font-semibold">Lỗi quét thư mục:</p>
                <p className="opacity-90">{error}</p>
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
                    {monthPath ? `Thư mục tháng: ${monthName}` : "Kéo thả hoặc bấm để chọn thư mục Tháng"}
                  </span>
                  {scanResult && (
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.2 rounded bg-muted border border-border shrink-0">
                      {scanResult.total_days} ngày
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                  {monthPath
                    ? monthPath
                    : "Chứa các ngày 22-9, 23-9... Tool tự động bóc tách thư mục sâu nhất để tính ảnh"}
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
                    title="Quét lại thư mục này từ đĩa"
                  >
                    <RefreshCw size={11} className={isScanning ? "animate-spin text-emerald-500" : "text-emerald-500"} />
                    <span>Làm mới</span>
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
                <span>{monthPath ? "Đổi thư mục" : "Chọn thư mục"}</span>
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
              >
                ✕
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
                    <span>Thời gian & Ngày công thực tế</span>
                  </div>
                  {/* Realtime indicator of Variable A */}
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-bold">
                    <span>A =</span>
                    <span>{calc.actualWorkingDays} công</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* Lựa chọn tháng 30 hoặc 31 ngày */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      Số ngày trong tháng
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
                        30 Ngày
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
                        31 Ngày
                      </button>
                    </div>
                  </div>

                  {/* Số ngày nghỉ */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      Số ngày nghỉ (ngày)
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
                      Công thực tế (Biến A)
                    </label>
                    <div className="w-full px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-muted/60 border border-border/80 text-foreground flex items-center justify-between">
                      <span>{calc.actualWorkingDays} ngày</span>
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
                    <span>Lương cứng & Định mức KPI</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>KPI Tháng:</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatNum(calc.monthKpi)} file
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* Lương cứng */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      Lương cứng (VNĐ)
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
                      KPI 1 ngày (file/ngày)
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
                      Tháng: {formatNum(calc.monthKpi)} file
                    </span>
                  </div>

                  {/* Sản lượng thực tế (T) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-muted-foreground font-medium">
                        Sản lượng thực tế (T)
                      </label>
                      {salaryConfig.manualPhotos !== null && (
                        <button
                          type="button"
                          onClick={() => setSalaryConfig({ manualPhotos: null })}
                          className="text-[9px] text-primary hover:underline"
                          title="Khôi phục số ảnh đếm từ hệ thống"
                        >
                          Dùng đếm tự động
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
                        ? "(Nhập tay)"
                        : `(Đếm từ thư mục: ${calc.rawScannedPhotos} ảnh)`}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION C: ĐƠN GIÁ VƯỢT KPI & BỘ VIP */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <DollarSign size={14} className="text-primary" />
                    <span>Đơn giá vượt KPI & Thưởng VIP</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-muted-foreground">Vượt:</span>
                    <span
                      className={`font-bold ${
                        calc.excessPhotos > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatNum(calc.excessPhotos)} file
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {/* Đơn giá 1 file vượt KPI */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      Đơn giá 1 file vượt (VNĐ)
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
                      Chỉ tính khi vượt KPI
                    </span>
                  </div>

                  {/* Số bộ VIP */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      Số bộ VIP đã làm
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
                      Thành tiền: {formatMoney(calc.vipBonus)}
                    </span>
                  </div>

                  {/* Đơn giá 1 bộ VIP */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      Đơn giá 1 bộ VIP (VNĐ)
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
                      {formatMoney(salaryConfig.vipPrice)}/bộ
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION D: TRỢ CẤP, PHỤ THU & CÔNG THỨC HIỆU SUẤT */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <TrendingUp size={14} className="text-primary" />
                    <span>Trợ cấp, Phụ thu & Thưởng Hiệu suất</span>
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    Hiệu suất: +{formatMoney(calc.efficiencyBonus)}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* Trợ cấp */}
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      Trợ cấp / Thưởng khác (VNĐ)
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
                      Phụ thu / Giảm trừ (VNĐ)
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
                      <span>Công thức thưởng hiệu suất</span>
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
                      className="text-[9px] text-primary hover:underline"
                    >
                      Mặc định (T // 1000 * 500k)
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
                        • <strong>Biến T</strong>: Tổng file thực tế (hiện tại: {calc.actualPhotos})
                      </p>
                      <p>
                        • <strong>Biến A</strong>: Ngày công thực tế (hiện tại: {calc.actualWorkingDays})
                      </p>
                      <p>• Ví dụ chia lấy nguyên 700: <code>Math.floor(T / 700) * 400000</code></p>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION E: QUY ĐỔI ẢNH LOẠI 1 & LOẠI 2 */}
              <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Layers size={14} className="text-primary" />
                    <span>Hệ số quy đổi Ảnh Loại 1 / Loại 2</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    1 Loại 1 = {(1 / (salaryConfig.type2Weight || 1)).toFixed(1)} Loại 2
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                      Hệ số Ảnh Loại 1
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
                      Hệ số Ảnh Loại 2 (ví dụ 0.5)
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
                        TỔNG THU NHẬP THỰC LĨNH
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {monthName || "Tháng này"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {calc.isKpiAchieved ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-2xs">
                        <Sparkles size={11} className="text-emerald-500" />
                        ĐẠT KPI
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-2xs">
                        <AlertCircle size={11} className="text-amber-500" />
                        CHƯA ĐẠT KPI
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
                    Đã bao gồm lương cơ bản/sản lượng, các khoản thưởng vượt và trừ khấu trừ
                  </p>
                </div>

                {/* KPI Visual Progress Bar */}
                <div className="relative z-10 space-y-1.5 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium text-[11px]">
                      Tiến độ hoàn thành KPI
                    </span>
                    <span className="font-mono font-bold text-foreground text-[11px]">
                      {formatNum(calc.actualPhotos)} / {formatNum(calc.monthKpi)} ảnh ({Math.min(999, Math.round((calc.actualPhotos / (calc.monthKpi || 1)) * 100))}%)
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
                    <span className="text-[10px] font-semibold">Mục tiêu KPI</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-foreground">
                    {formatNum(calc.monthKpi)}
                  </div>
                  <span className="text-[9px] text-muted-foreground block">
                    Định mức tháng
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-semibold">Thực tế làm</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatNum(calc.actualPhotos)}
                  </div>
                  <span className="text-[9px] text-muted-foreground block">
                    Ảnh quy đổi
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowUpRight size={12} className={calc.excessPhotos > 0 ? "text-emerald-500" : "text-amber-500"} />
                    <span className="text-[10px] font-semibold">Chênh lệch</span>
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
                      ? "Đạt chuẩn"
                      : `-${formatNum(calc.monthKpi - calc.actualPhotos)}`}
                  </div>
                  <span className="text-[9px] text-muted-foreground block">
                    {calc.excessPhotos > 0 ? "Vượt định mức" : calc.isKpiAchieved ? "Chuẩn KPI" : "Cần bổ sung"}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border shadow-2xs space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays size={12} className="text-sky-500" />
                    <span className="text-[10px] font-semibold">Ngày công</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-foreground">
                    {calc.actualWorkingDays} <span className="text-xs font-normal text-muted-foreground">/ {salaryConfig.daysInMonth} ngày</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground block">
                    Công thực tế
                  </span>
                </div>
              </div>

              {/* 3. ITEM-BY-ITEM INCOME BREAKDOWN */}
              <div className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/80">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">
                      Bảng kê chi tiết các khoản thu nhập
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Căn cứ tính toán
                  </span>
                </div>

                <div className="space-y-2.5 text-xs divide-y divide-border/50">
                  {/* 1. Lương cơ bản / sản lượng */}
                  <div className="flex items-start justify-between pt-2">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">
                        {calc.isKpiAchieved
                          ? "1. Lương cơ bản theo ngày công"
                          : "1. Lương sản lượng (Chưa đạt KPI)"}
                      </span>
                      {calc.isKpiAchieved ? (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
                          Đạt KPI • Hưởng trọn lương cứng {formatMoney(salaryConfig.baseSalary)} ({calc.actualWorkingDays} công thực tế)
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-medium mt-0.5">
                          {formatNum(calc.actualPhotos)} file x {formatMoney(salaryConfig.unitPriceKpi)} • Cần thêm {formatNum(calc.monthKpi - calc.actualPhotos)} file để nhận lương cứng {formatMoney(calc.baseSalary)}
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
                      <span className="font-semibold text-foreground block">2. Thưởng vượt định mức KPI</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {calc.isKpiAchieved
                          ? calc.excessPhotos > 0
                            ? `${formatNum(calc.excessPhotos)} file vượt x ${formatMoney(salaryConfig.unitPriceKpi)}`
                            : "Đạt chuẩn KPI (chưa có file vượt)"
                          : "Chưa đạt KPI (không áp dụng thưởng vượt)"}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 mt-0.5 ${
                        calc.excessSalary > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {calc.excessSalary > 0 ? `+${formatMoney(calc.excessSalary)}` : "0 đ"}
                    </span>
                  </div>

                  {/* 3. Thưởng hiệu suất */}
                  <div className="flex items-start justify-between pt-2.5">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">3. Thưởng hiệu suất</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Cứ mỗi 1.000 file thưởng 500.000đ ({calc.efficiencyBonus > 0 ? `Đạt ${formatNum(Math.floor(calc.actualPhotos / 1000) * 1000)} file` : "Chưa đủ mốc 1.000 file"})
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 mt-0.5 ${
                        calc.efficiencyBonus > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {calc.efficiencyBonus > 0 ? `+${formatMoney(calc.efficiencyBonus)}` : "0 đ"}
                    </span>
                  </div>

                  {/* 4. Thưởng VIP */}
                  <div className="flex items-start justify-between pt-2.5">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">4. Thưởng bộ sản phẩm VIP</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {salaryConfig.vipSets} bộ x {formatMoney(salaryConfig.vipPrice)}
                      </span>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 mt-0.5 ${
                        calc.vipBonus > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {calc.vipBonus > 0 ? `+${formatMoney(calc.vipBonus)}` : "0 đ"}
                    </span>
                  </div>

                  {/* 5. Trợ cấp */}
                  <div className="flex items-start justify-between pt-2.5">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">5. Trợ cấp & phụ cấp</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Hỗ trợ xăng xe, ăn trưa và chuyên cần
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                      +{formatMoney(calc.allowance)}
                    </span>
                  </div>

                  {/* 6. Phụ thu / Khấu trừ */}
                  <div className="flex items-start justify-between pt-2.5">
                    <div className="pr-3 min-w-0">
                      <span className="font-semibold text-foreground block">6. Khấu trừ & phụ thu</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Trừ tạm ứng hoặc vi phạm quy chế
                      </span>
                    </div>
                    <span className={`font-mono font-bold shrink-0 mt-0.5 ${calc.deduction > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {calc.deduction > 0 ? `-${formatMoney(calc.deduction)}` : "0 đ"}
                    </span>
                  </div>
                </div>

                {/* Final Net Total Summary Bar */}
                <div className="pt-3 border-t border-border flex items-center justify-between bg-muted/30 -mx-4 -mb-4 p-3.5 rounded-b-xl">
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Thực lĩnh cuối cùng
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Lương cứng/sản lượng + Thưởng - Khấu trừ
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
                    DANH SÁCH CHI TIẾT THEO NGÀY ({filteredDays.length} ngày)
                  </span>
                  <span className="text-[10px] text-muted-foreground px-2 py-0.2 rounded bg-muted border border-border">
                    {calc.rawScannedPhotos} ảnh gốc
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Tìm theo ngày hoặc tên khách..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary w-48"
                  />

                  <button
                    type="button"
                    onClick={expandAllDays}
                    className="px-2 py-1 text-[10px] font-semibold rounded bg-muted hover:bg-accent text-foreground border border-border"
                  >
                    Bung tất cả
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllDays}
                    className="px-2 py-1 text-[10px] font-semibold rounded bg-muted hover:bg-accent text-muted-foreground border border-border"
                  >
                    Thu gọn
                  </button>
                </div>
              </div>

              {/* Duplicate Day Alert Banner if detected */}
              {duplicateDayNames.size > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="flex-1 space-y-1">
                    <div className="font-bold flex items-center gap-2">
                      <span>Phát hiện {duplicateDayNames.size} ngày có thư mục bị lặp trong tháng!</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 font-mono font-semibold">
                        {Array.from(duplicateDayNames).map((n) => `Ngày ${n}`).join(", ")}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-90">
                      Do thư mục tháng có nhiều thư mục cùng ngày (ví dụ copy lặp hoặc chia lẻ). Bạn có thể bấm vào biểu tượng thùng rác ở ngày hoặc thư mục thừa để loại bỏ ngay khỏi bảng tính.
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
                                Ngày {day.day_name}
                              </span>
                              {isDuplicateDay && (
                                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 flex items-center gap-1">
                                  <AlertCircle size={10} />
                                  Trùng lặp ngày
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground px-1.5 py-0.2 rounded bg-muted border border-border">
                                {day.job_count} khách/job
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                ({day.deepest_folders.length} thư mục sâu nhất)
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
                              {stats.convertedCount} file quy đổi
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              revealItemInDir(day.day_path);
                            }}
                            className="w-6 h-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                            title="Mở thư mục ngày trong Finder"
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
                                name: `Ngày ${day.day_name}`,
                                photoCount: stats.rawCount,
                              });
                            }}
                            className="h-6 px-2 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer border border-transparent hover:border-destructive/30"
                            title="Xoá thư mục ngày này ra khỏi hệ thống thống kê"
                          >
                            <Trash2 size={12} />
                            <span>Xoá</span>
                          </button>
                        </div>
                      </div>

                      {/* Expanded View: Leaf Folders with Type 1 / Type 2 Selector */}
                      {isExpanded && (
                        <div className="border-t border-border/70 bg-muted/20 p-3 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground px-1 mb-1">
                            <span>CÁC THƯ MỤC SÂU NHẤT TRONG NGÀY {day.day_name}:</span>
                            <div className="flex items-center gap-2">
                              <span>Gán nhanh cả ngày:</span>
                              <button
                                type="button"
                                onClick={() => setDayAllFoldersType(day, "type1")}
                                className="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25 text-[10px] font-semibold"
                              >
                                Tất cả Loại 1
                              </button>
                              <button
                                type="button"
                                onClick={() => setDayAllFoldersType(day, "type2")}
                                className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 text-[10px] font-semibold"
                              >
                                Tất cả Loại 2
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
                                    title={isExcluded ? "Click để tính lại" : "Click để loại trừ"}
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
                                        <span className="text-[9px] text-muted-foreground/70">
                                          Mẫu:
                                        </span>
                                        {folder.sample_files.slice(0, 3).map((fName, sIdx) => (
                                          <span
                                            key={sIdx}
                                            className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted/80 text-muted-foreground border border-border/60"
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
                                      Loại 1
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
                                      Loại 2
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
                                      {folder.photo_count} ảnh
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => revealItemInDir(folder.folder_path)}
                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    title="Mở thư mục trong Finder"
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
                                    title="Xoá thư mục con này ra khỏi hệ thống thống kê"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border shadow-2xl rounded-2xl max-w-md w-full p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Xoá khỏi hệ thống thống kê
                </h3>
                <p className="text-xs text-muted-foreground">
                  Loại bỏ thư mục bị trùng lặp hoặc thừa ra khỏi bảng tính
                </p>
              </div>
            </div>

            {/* Target Details */}
            <div className="p-3 rounded-xl bg-muted/60 border border-border/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Mục xoá:</span>
                <span className="font-bold text-foreground">{confirmDelete.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Số lượng ảnh:</span>
                <span className="font-mono font-bold text-primary">
                  {confirmDelete.photoCount} ảnh
                </span>
              </div>
              <div className="pt-1 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground block font-medium mb-0.5">
                  Đường dẫn:
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
                <strong>An toàn tuyệt đối:</strong> Thao tác này chỉ xóa thư mục ra khỏi bảng tính của app, <strong>không xóa hay can thiệp bất kỳ file/thư mục nào trên máy tính</strong>.
              </span>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="py-2 px-3 rounded-xl bg-muted hover:bg-accent text-foreground text-xs font-semibold border border-border transition-colors cursor-pointer"
              >
                Hủy bỏ
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
                <span>Xác nhận xoá</span>
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
