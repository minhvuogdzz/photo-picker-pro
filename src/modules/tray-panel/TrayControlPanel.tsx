import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Cpu,
  Activity,
  AlertTriangle,
  Settings,
  Power,
  RefreshCw,
  FileSpreadsheet,
  FileImage,
  Bell,
  ChevronRight,
} from "lucide-react";
import { PhotoPickerIcon } from "@/core/components/PhotoPickerIcon";
import { systemPerformanceService } from "@/core/services/systemPerformanceService";
import type { SystemPerformanceReport } from "@/core/components/system-performance/types";
import {
  urgentCustomerScannerService,
  type UrgentScanResult,
} from "@/modules/photo-picker/services/urgentCustomerScannerService";
import { useNotificationStore } from "@/core/stores/useNotificationStore";
import type { AppSettings } from "@/core/types";

export function TrayControlPanel() {
  const [metrics, setMetrics] = useState<SystemPerformanceReport | null>(null);
  const [scanResult, setScanResult] = useState<UrgentScanResult | null>(
    urgentCustomerScannerService.getLastResult()
  );
  const [isScanning, setIsScanning] = useState(false);
  const unreadCount = useNotificationStore((s) => s.getUnreadCount());

  // Khởi tạo state theme ngay lập tức từ localStorage để tránh chớp màn hình khi popover vừa mở
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const savedAppTheme = localStorage.getItem("mvd_app_theme");
      if (savedAppTheme === "light") return false;
      if (savedAppTheme === "dark") return true;
      const savedMode = localStorage.getItem("mvd_theme_mode");
      if (savedMode === "light") return false;
      if (savedMode === "dark") return true;
    }
    return true;
  });

  // 1. Đồng bộ theme Light / Dark chính xác từ backend settings & localStorage
  const syncTheme = useCallback(async () => {
    const savedAppTheme = localStorage.getItem("mvd_app_theme");
    const savedMode = localStorage.getItem("mvd_theme_mode");

    if (savedAppTheme === "light" || savedMode === "light") {
      setIsDark(false);
      return false;
    }
    if (savedAppTheme === "dark" || savedMode === "dark") {
      setIsDark(true);
      return true;
    }
    if (savedMode === "system") {
      try {
        const sysDark = await invoke<boolean>("is_system_dark_mode");
        setIsDark(sysDark);
        return sysDark;
      } catch {
        const match = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setIsDark(match);
        return match;
      }
    }

    try {
      const s = await invoke<AppSettings>("load_settings");
      if (s?.theme === "light") {
        setIsDark(false);
        return false;
      }
      if (s?.theme === "dark") {
        setIsDark(true);
        return true;
      }
      if (s?.theme === "system") {
        try {
          const sysDark = await invoke<boolean>("is_system_dark_mode");
          setIsDark(sysDark);
          return sysDark;
        } catch {
          const match = window.matchMedia("(prefers-color-scheme: dark)").matches;
          setIsDark(match);
          return match;
        }
      }
    } catch {}

    const isSystemDark =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : true;
    setIsDark(isSystemDark);
    return isSystemDark;
  }, []);

  // Khởi tạo theme & thông báo ngay khi render
  useEffect(() => {
    syncTheme();
    useNotificationStore.getState().reloadFromStorage();
  }, [syncTheme]);

  // Áp dụng class .dark lên document.documentElement của cửa sổ tray-panel
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Lắng nghe sự kiện đổi theme từ App chính
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ theme: string; isDark: boolean }>("app-theme-changed", (event) => {
      if (typeof event.payload?.isDark === "boolean") {
        setIsDark(event.payload.isDark);
      } else {
        syncTheme();
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [syncTheme]);

  const [isOpen, setIsOpen] = useState(false);

  // 2. Lắng nghe sự kiện tray-panel-shown để đồng bộ dữ liệu mượt mà MỖI LẦN CLICK (KHÔNG UNMOUNT DOM / KHÔNG GIẬT)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("tray-panel-shown", () => {
      syncTheme();
      useNotificationStore.getState().reloadFromStorage();
      setScanResult(urgentCustomerScannerService.getLastResult());
      setIsOpen(true);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [syncTheme]);

  // Đảm bảo nền gốc cửa sổ và thẻ HTML trong suốt 100% để bo góc 4 góc hiển thị mượt mà không có viền đen
  useEffect(() => {
    document.documentElement.style.backgroundColor = "transparent";
    document.body.style.backgroundColor = "transparent";
    document.body.style.overflow = "hidden";
  }, []);

  // Tự động ẩn cửa sổ popover khi click ra ngoài (blur)
  useEffect(() => {
    const handleBlur = () => {
      setIsOpen(false);
      invoke("hide_tray_panel").catch(() => {});
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  // Đăng ký nhận chỉ số hiệu năng thời gian thực
  useEffect(() => {
    const unsubscribe = systemPerformanceService.subscribe((report) => {
      setMetrics(report);
    });
    return () => unsubscribe();
  }, []);

  // Đăng ký nhận kết quả quét khách hàng tới hạn
  useEffect(() => {
    const unsubscribe = urgentCustomerScannerService.subscribe((result) => {
      setScanResult(result);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModule = async (module: string) => {
    try {
      await invoke("show_main_window_from_tray", { targetModule: module });
    } catch {
      await invoke("show_main_window_from_tray", { targetModule: null });
    }
  };

  const handleExitApp = async () => {
    await invoke("exit_app_cleanly");
  };

  const handleManualScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const res = await urgentCustomerScannerService.scanNow(true);
      setScanResult(res);
    } finally {
      setIsScanning(false);
    }
  };

  // Chỉ số tài nguyên CỦA RIÊNG APP DH STUDIO PRO (theo yêu cầu người dùng)
  const appCpu = metrics?.app ? metrics.app.cpu_usage.toFixed(1) : "0.5";
  const appMemory = metrics?.app ? metrics.app.memory_formatted : "138.4 MB";
  const memoryPressureDesc = metrics?.memory_pressure.description || "Bình thường";
  const urgentCount = scanResult ? scanResult.urgentCount : 0;

  return (
    <div
      className={`w-full h-full flex flex-col p-1 pt-0.5 select-none font-sans overflow-hidden transition-all duration-200 ease-out ${
        isOpen
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 -translate-y-2 scale-[0.98]"
      }`}
    >
      {/* Thẻ chính với 4 góc bo tròn mềm mại rounded-[22px], hiệu ứng kính mờ macOS popover */}
      <div
        className={`flex-1 rounded-[22px] border shadow-2xl overflow-hidden flex flex-col ${
          isDark
            ? "bg-[#1c1c1f]/95 text-zinc-100 border-white/12 backdrop-blur-2xl shadow-black/40"
            : "bg-white/95 text-zinc-900 border-black/10 backdrop-blur-2xl shadow-black/15"
        }`}
      >
        {/* Header: Logo DH Studio Pro + Trạng thái chạy ngầm */}
        <div
          className={`px-3.5 py-2.5 flex items-center justify-between shrink-0 border-b ${
            isDark
              ? "bg-white/[0.03] border-white/5"
              : "bg-black/[0.02] border-black/5"
          }`}
        >
          <div className="flex items-center gap-2">
            <img
              src={isDark ? "/brand/dh_app_icon_dark_squircle.png" : "/brand/dh_app_icon_light_squircle.png"}
              alt="DH Studio Pro"
              className="w-5 h-5 rounded-md shadow-xs"
            />
            <span className="text-xs font-bold tracking-tight">DH Studio Pro</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
              isDark
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-emerald-500/15 text-emerald-700"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-semibold">Chạy ngầm</span>
          </div>
        </div>

        {/* Thân popover cuộn gọn gàng */}
        <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-3 scrollbar-thin">
          {/* MỤC 1: THÔNG BÁO KHẨN CẤP (Chỉ hiện khi thực sự có khách tới hạn cần lọc) */}
          {urgentCount > 0 && (
            <div className="space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isDark ? "text-amber-400" : "text-amber-600"
                  }`}
                >
                  Thông báo khẩn cấp
                </span>
                <button
                  type="button"
                  onClick={handleManualScan}
                  disabled={isScanning}
                  className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Quét lại Sheet"
                >
                  <RefreshCw size={10} className={isScanning ? "animate-spin" : ""} />
                  <span>{isScanning ? "Đang quét..." : "Quét lại"}</span>
                </button>
              </div>

              <div
                onClick={() => handleOpenModule("notifications")}
                className={`p-2.5 rounded-xl cursor-pointer transition-all active:scale-98 border ${
                  isDark
                    ? "bg-amber-500/15 hover:bg-amber-500/20 text-amber-200 border-amber-500/20"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                      isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-200 text-amber-800"
                    }`}
                  >
                    <AlertTriangle size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold leading-tight">
                        Khẩn cấp: Có {urgentCount} khách cần lọc gấp!
                      </h4>
                      <ChevronRight size={12} className="opacity-60" />
                    </div>
                    <p
                      className={`text-[10px] mt-0.5 line-clamp-1 ${
                        isDark ? "text-amber-200/80" : "text-amber-700"
                      }`}
                    >
                      Hạn trả hôm nay & đã quá hạn, link edit rỗng.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MỤC 2: TÀI NGUYÊN ỨNG DỤNG DH STUDIO PRO (CPU & RAM CỦA APP) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isDark ? "text-zinc-400" : "text-zinc-500"
                }`}
              >
                Tài nguyên DH Studio Pro
              </span>
              <span className={`text-[9px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                Hoạt động
              </span>
            </div>

            <div
              className={`p-3 rounded-xl space-y-2.5 border ${
                isDark
                  ? "bg-white/[0.04] border-white/5"
                  : "bg-black/[0.03] border-black/5"
              }`}
            >
              {/* CPU của ứng dụng */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-medium flex items-center gap-1.5">
                    <Cpu size={12} className="text-blue-500" />
                    <span>CPU ứng dụng</span>
                  </span>
                  <span className="font-bold text-blue-500 font-mono">{appCpu}%</span>
                </div>
                <div
                  className={`h-1.5 w-full rounded-full overflow-hidden ${
                    isDark ? "bg-zinc-800" : "bg-zinc-200"
                  }`}
                >
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(Math.max(parseFloat(appCpu) * 4, 6), 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* RAM của ứng dụng */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-medium flex items-center gap-1.5">
                    <Activity size={12} className="text-cyan-500" />
                    <span>RAM ứng dụng</span>
                  </span>
                  <span className="font-bold text-cyan-500 font-mono">{appMemory}</span>
                </div>
                <div
                  className={`h-1.5 w-full rounded-full overflow-hidden ${
                    isDark ? "bg-zinc-800" : "bg-zinc-200"
                  }`}
                >
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        Math.max(
                          ((metrics?.app.memory_bytes || 140 * 1024 * 1024) /
                            (1024 * 1024 * 1024)) *
                            100,
                          12
                        ),
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Thông số bổ trợ */}
              <div
                className={`pt-1 flex justify-between text-[10px] ${
                  isDark ? "text-zinc-400" : "text-zinc-500"
                }`}
              >
                <span>
                  Áp lực hệ thống:{" "}
                  <strong className={isDark ? "text-zinc-200" : "text-zinc-700"}>
                    {memoryPressureDesc}
                  </strong>
                </span>
                <span className="text-emerald-500 font-medium">Tối ưu & ổn định</span>
              </div>
            </div>
          </div>

          {/* MỤC 3: TRUY CẬP NHANH */}
          <div className="space-y-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-0.5 ${
                isDark ? "text-zinc-400" : "text-zinc-500"
              }`}
            >
              Truy cập nhanh
            </span>

            <div className="space-y-0.5">
              {/* Lọc ảnh Pro */}
              <button
                type="button"
                onClick={() => handleOpenModule("photo-picker")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer group ${
                  isDark ? "hover:bg-white/[0.08]" : "hover:bg-black/[0.05]"
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <PhotoPickerIcon size={16} className="text-blue-500 dark:text-blue-400" />
                  </div>
                  <span>Lọc ảnh Pro</span>
                </div>
                <ChevronRight
                  size={12}
                  className={`transition-transform group-hover:translate-x-0.5 ${
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  }`}
                />
              </button>

              {/* Contact the Sheet */}
              <button
                type="button"
                onClick={() => handleOpenModule("contact-sheet")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer group ${
                  isDark ? "hover:bg-white/[0.08]" : "hover:bg-black/[0.05]"
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <FileSpreadsheet size={14} className="text-emerald-500" />
                  </div>
                  <span>Contact the Sheet</span>
                </div>
                <ChevronRight
                  size={12}
                  className={`transition-transform group-hover:translate-x-0.5 ${
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  }`}
                />
              </button>

              {/* Chuyển đổi file */}
              <button
                type="button"
                onClick={() => handleOpenModule("mvd-convert")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer group ${
                  isDark ? "hover:bg-white/[0.08]" : "hover:bg-black/[0.05]"
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <FileImage size={14} className="text-pink-500" />
                  </div>
                  <span>Chuyển đổi file</span>
                </div>
                <ChevronRight
                  size={12}
                  className={`transition-transform group-hover:translate-x-0.5 ${
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  }`}
                />
              </button>

              {/* Trung tâm thông báo */}
              <button
                type="button"
                onClick={() => handleOpenModule("notifications")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer group ${
                  isDark ? "hover:bg-white/[0.08]" : "hover:bg-black/[0.05]"
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <Bell size={14} className="text-amber-500" />
                  </div>
                  <span>Trung tâm thông báo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500 text-black rounded-full">
                      {unreadCount}
                    </span>
                  )}
                  <ChevronRight
                    size={12}
                    className={`transition-transform group-hover:translate-x-0.5 ${
                      isDark ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* MỤC 4: 2 NÚT DƯỚI CÙNG (Cài đặt DH Studio Pro & Thoát) */}
        <div
          className={`p-2.5 grid grid-cols-2 gap-2 shrink-0 border-t ${
            isDark
              ? "bg-white/[0.02] border-white/5"
              : "bg-black/[0.02] border-black/5"
          }`}
        >
          <button
            type="button"
            onClick={() => handleOpenModule("system")}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-xs border ${
              isDark
                ? "bg-white/10 hover:bg-white/15 text-zinc-100 border-white/5"
                : "bg-black/5 hover:bg-black/10 text-zinc-800 border-black/5"
            }`}
          >
            <Settings size={13} />
            <span className="truncate">Cài đặt DH Studio Pro</span>
          </button>

          <button
            type="button"
            onClick={handleExitApp}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-xs border ${
              isDark
                ? "bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/20"
                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
            }`}
          >
            <Power size={13} />
            <span>Thoát</span>
          </button>
        </div>
      </div>
    </div>
  );
}
