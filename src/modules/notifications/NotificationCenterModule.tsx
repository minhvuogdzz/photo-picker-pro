import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Bell,
  Trash2,
  CheckCheck,
  AlertTriangle,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  Sliders,
  Settings,
  ExternalLink,
  Save,
  Check,
  Search,
} from "lucide-react";
import {
  useNotificationStore,
  type AppNotification,
} from "@/core/stores/useNotificationStore";
import { useNotificationConfigStore } from "@/core/stores/useNotificationConfigStore";
import {
  urgentCustomerScannerService,
  type UrgentScanResult,
} from "@/modules/photo-picker/services/urgentCustomerScannerService";
import { useContactSheetStore } from "@/modules/contact-the-sheet/stores/useContactSheetStore";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { sheetDiscoveryService } from "@/modules/contact-the-sheet/services/sheetDiscoveryService";
import {
  getVietnamTodayKey,
  formatDateKey,
} from "@/modules/photo-picker/services/filterStatusCheckService";

const STANDARD_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COMMON_STATUS_SUGGESTIONS = ["Chưa lọc", "Chờ lọc", "Đang xử lý", "Chưa sửa"];

export function NotificationCenterModule() {
  const config = useNotificationConfigStore();
  const activeTab = config.activeTab;
  const setActiveTab = config.setActiveTab;
  const configSubTab = config.configSubTab;
  const setConfigSubTab = config.setConfigSubTab;

  const selectedProfileId = config.profileId;
  const setSelectedProfileId = config.setProfileId;
  const selectedTabs = config.selectedTabs;
  const statusColumn = config.statusColumn;
  const setStatusColumn = config.setStatusColumn;
  const targetStatusValue = config.targetStatusValue;
  const setTargetStatusValue = config.setTargetStatusValue;
  const dueDateColumn = config.dueDateColumn;
  const setDueDateColumn = config.setDueDateColumn;
  const linkEditColumn = config.linkEditColumn;
  const setLinkEditColumn = config.setLinkEditColumn;

  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const clearAllNotifications = useNotificationStore((s) => s.clearAllNotifications);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Contact Sheet Profiles for Studio selection
  const profiles = useContactSheetStore((s) => s.profiles);
  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const googleConnection = useContactSheetStore((s) => s.googleConnection);

  // Settings
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  // Auto-sync profileId if empty or not in profiles
  useEffect(() => {
    if (!selectedProfileId && (activeProfile?.id || profiles[0]?.id)) {
      setSelectedProfileId(activeProfile?.id || profiles[0]?.id || "");
    }
  }, [selectedProfileId, activeProfile?.id, profiles, setSelectedProfileId]);

  const targetProfile = useMemo(() => {
    if (selectedProfileId) {
      const found = profiles.find((p) => p.id === selectedProfileId);
      if (found) return found;
    }
    return activeProfile || profiles[0] || null;
  }, [selectedProfileId, profiles, activeProfile]);

  const [remoteTabs, setRemoteTabs] = useState<string[]>([]);
  const [isLoadingTabs, setIsLoadingTabs] = useState(false);

  useEffect(() => {
    const sheetId = targetProfile?.spreadsheetId;
    if (!sheetId || sheetId.startsWith("mock") || targetProfile?.isMockSandbox) return;
    setIsLoadingTabs(true);
    sheetDiscoveryService
      .fetchSpreadsheetMetadata(sheetId, false)
      .then((meta) => {
        if (meta?.tabs?.length) {
          setRemoteTabs(meta.tabs.map((t) => t.title));
        }
      })
      .catch((err) => console.warn("[NotificationCenter] Could not load tabs:", err))
      .finally(() => setIsLoadingTabs(false));
  }, [targetProfile?.spreadsheetId]);

  const availableTabs = useMemo(() => {
    const configured = targetProfile?.tabConfigurations
      ? Object.keys(targetProfile.tabConfigurations)
      : [];
    const merged = Array.from(new Set([...remoteTabs, ...configured]));
    return merged.length > 0
      ? merged
      : ["Edit 9/2026", "Edit 10/2026", "Edit 11/2026", "Edit 12/2026"];
  }, [remoteTabs, targetProfile]);

  // When available tabs finish loading, auto-select first few if none selected
  useEffect(() => {
    if (availableTabs.length > 0 && selectedTabs.length === 0) {
      config.setSelectedTabs(availableTabs.slice(0, 4));
    }
  }, [availableTabs, selectedTabs.length, config]);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [liveScanResult, setLiveScanResult] = useState<UrgentScanResult | null>(null);

  const todayLabel = useMemo(() => formatDateKey(getVietnamTodayKey()), []);

  const toggleTab = (tab: string) => {
    config.toggleTab(tab);
  };

  const handleSelectAllTabs = () => config.selectAllTabs(availableTabs);
  const handleDeselectAllTabs = () => config.deselectAllTabs();

  const handleSaveConfig = async () => {
    const ok = await config.saveAll();
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleScanNow = async () => {
    // Save settings first before scanning
    handleSaveConfig();
    setIsScanning(true);
    setScanMessage(null);
    try {
      const res = await urgentCustomerScannerService.scanNow(true);
      setLiveScanResult(res);
      if (res.urgentCount > 0) {
        setScanMessage(
          `Đã quét xong: Phát hiện ${res.urgentCount} khách hàng tới hạn cần lọc gấp!`
        );
      } else {
        setScanMessage("Không có khách nào thỏa mãn đồng thời 3 điều kiện cần lọc gấp hôm nay.");
      }
    } catch (err) {
      setScanMessage("Lỗi khi quét Google Sheet: " + String(err));
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanMessage(null), 8000);
    }
  };

  const handleTestNotification = async () => {
    await urgentCustomerScannerService.sendTestNotification();
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full animate-fade-in bg-card/90 backdrop-blur-md rounded-xl overflow-hidden border border-border text-foreground">
      {/* Header with Navigation Tabs */}
      <div className="h-14 px-6 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-xs">
            <Bell size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground tracking-tight">
                Trung tâm thông báo
              </h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black shadow-xs animate-pulse">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              {activeTab === "history"
                ? "Lịch sử cảnh báo khách hàng tới hạn gấp và thông báo hệ điều hành"
                : "Cấu hình thông báo tự động và quét dữ liệu Google Sheet"}
            </p>
          </div>
        </div>

        {/* Tab switcher: ĐÚNG 3 TAB THEO YÊU CẦU NGƯỜI DÙNG */}
        <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border gap-1">
          {/* 1. Lịch sử thông báo */}
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "history"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Lịch sử thông báo"
          >
            <Bell size={13} className={unreadCount > 0 ? "text-amber-500" : ""} />
            <span className="hidden sm:inline">Lịch sử thông báo</span>
            {unreadCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-black">
                {unreadCount}
              </span>
            )}
          </button>

          {/* 2. Đọc tất cả */}
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              unreadCount > 0
                ? "text-emerald-600 dark:text-emerald-400 hover:bg-background/80"
                : "text-muted-foreground/40 cursor-not-allowed"
            }`}
            title="Đánh dấu tất cả thông báo đã đọc"
          >
            <CheckCheck size={14} className={unreadCount > 0 ? "text-emerald-500" : "text-muted-foreground/40"} />
            <span className="hidden md:inline">Đọc tất cả</span>
          </button>

          {/* 3. Cấu hình thông báo */}
          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "config"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Cấu hình thông báo"
          >
            <Sliders size={13} className="text-primary" />
            <span className="hidden sm:inline">Cấu hình thông báo</span>
          </button>
        </div>
      </div>

      {/* Save Success banner */}
      {saveSuccess && (
        <div className="px-6 py-2.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span>Đã lưu toàn bộ cấu hình thông báo thành công! Mọi thay đổi đã được ghi nhận vào hệ thống.</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(false)}
            className="text-[10px] underline hover:opacity-80 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Status banner */}
      {scanMessage && (
        <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center justify-between animate-fade-in">
          <span>{scanMessage}</span>
          <button
            type="button"
            onClick={() => setScanMessage(null)}
            className="text-[10px] underline hover:opacity-80"
          >
            Đóng
          </button>
        </div>
      )}

      {/* TAB 1: LỊCH SỬ THÔNG BÁO */}
      {activeTab === "history" && (
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {notifications.length === 0 ? (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border flex items-center justify-center text-muted-foreground">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Không có thông báo nào</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Chưa có cảnh báo khẩn cấp nào được ghi nhận. App sẽ tự động quét Google Sheet mỗi
                  5 phút và bắn thông báo khi có khách tới hạn cần lọc gấp.
                </p>
              </div>
              <button
                type="button"
                onClick={handleScanNow}
                disabled={isScanning}
                className="mt-2 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs active:scale-97"
              >
                <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
                <span>Quét kiểm tra ngay</span>
              </button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60 px-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Danh sách thông báo ({notifications.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Bạn có chắc muốn xóa toàn bộ lịch sử thông báo?")) {
                      clearAllNotifications();
                    }
                  }}
                  className="h-7 px-2.5 rounded-lg border border-destructive/30 hover:border-destructive bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-97"
                  title="Xóa toàn bộ lịch sử thông báo"
                >
                  <Trash2 size={12} />
                  <span>Xóa lịch sử</span>
                </button>
              </div>

              {notifications.map((notif) => {
                const isExpanded = expandedIds.has(notif.id);
                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.isRead) markAsRead(notif.id);
                    }}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden shadow-xs ${
                      !notif.isRead
                        ? "bg-amber-500/[0.04] border-amber-500/30 dark:border-amber-500/25"
                        : "bg-card border-border hover:border-foreground/20"
                    }`}
                  >
                    <div className="p-4 flex items-start gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          notif.type === "urgent"
                            ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                            : "bg-blue-500/15 text-blue-500 border border-blue-500/30"
                        }`}
                      >
                        {notif.type === "urgent" ? (
                          <AlertTriangle size={18} />
                        ) : (
                          <Bell size={18} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-foreground tracking-tight">
                              {notif.title}
                            </h3>
                            {!notif.isRead && (
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                              <Clock size={11} />
                              {new Date(notif.timestamp).toLocaleString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notif.id);
                              }}
                              className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors cursor-pointer"
                              title="Xóa thông báo này"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-foreground/90 mt-1 font-medium">{notif.body}</p>

                        {/* Customer count preview */}
                        {notif.customers && notif.customers.length > 0 && (
                          <div className="mt-2.5 pt-2.5 border-t border-border/60 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">
                              Bao gồm{" "}
                              <strong className="text-foreground">{notif.customers.length}</strong>{" "}
                              khách hàng trong danh sách
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(notif.id);
                              }}
                              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{isExpanded ? "Thu gọn" : "Xem chi tiết khách hàng"}</span>
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded customer list */}
                    {isExpanded && notif.customers && notif.customers.length > 0 && (
                      <div className="bg-muted/40 border-t border-border px-4 py-3">
                        <div className="space-y-1.5">
                          {notif.customers.map((c, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-background/80 border border-border/60"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 text-[10px] font-bold text-muted-foreground font-mono">
                                  #{idx + 1}
                                </span>
                                <span className="font-semibold text-foreground truncate">
                                  {c.customerName}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                                  Tab: {c.tabTitle} (Dòng {c.row})
                                </span>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {c.dueDate && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-medium flex items-center gap-1">
                                    <Calendar size={10} />
                                    Hạn: {c.dueDate}
                                  </span>
                                )}
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  {c.actualStatus}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CẤU HÌNH THÔNG BÁO (Bao gồm Quét Sheet & Cài đặt Hệ điều hành) */}
      {activeTab === "config" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sub-header inside Cấu hình thông báo */}
          <div className="px-6 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/10 shrink-0">
            {/* Sub-tabs: Quét Google Sheet & Hệ điều hành */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/60 border border-border">
              <button
                type="button"
                onClick={() => setConfigSubTab("sheet")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  configSubTab === "sheet"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileSpreadsheet size={13} className="text-emerald-500" />
                <span>Quét Google Sheet tới hạn</span>
              </button>

              <button
                type="button"
                onClick={() => setConfigSubTab("system")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  configSubTab === "system"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Bell size={13} className="text-primary" />
                <span>Thông báo hệ điều hành</span>
              </button>
            </div>

            {/* Các nút hành động Cấu hình: Quét Sheet ngay & Lưu cấu hình & Bắn thử (chỉ DEV) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleScanNow}
                disabled={isScanning}
                className="h-8 px-3 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-97"
                title="Quét kiểm tra toàn bộ Sheet ngay"
              >
                <RefreshCw
                  size={12}
                  className={isScanning ? "animate-spin text-amber-500" : "text-amber-500"}
                />
                <span className="hidden sm:inline">{isScanning ? "Đang quét..." : "Quét Sheet ngay"}</span>
              </button>

              {import.meta.env.DEV && (
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="h-8 px-3 rounded-lg border border-border hover:border-foreground/20 bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-97"
                  title="Gửi thông báo thử nghiệm hệ điều hành (Chỉ hiển thị khi Test / DEV, Release không có)"
                >
                  <Bell size={12} className="text-primary" />
                  <span className="hidden md:inline">Bắn thông báo thử</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveConfig}
                className="h-8 px-3.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-97"
              >
                {saveSuccess ? <Check size={13} /> : <Save size={13} />}
                <span>{saveSuccess ? "Đã lưu!" : "Lưu cấu hình"}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {configSubTab === "sheet" && (
              <div className="max-w-3xl mx-auto space-y-5">
            {/* 1. Chọn Hồ sơ Studio / Bảng tính Google Sheet */}
            <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-primary" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    1. Hồ sơ Bảng tính Studio
                  </h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                  {googleConnection?.accountEmail ? "Google Account: Đã liên kết" : "Chế độ bảng tính"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                    Chọn Hồ sơ Studio quét thông báo
                  </label>
                  <div className="relative">
                    <select
                      value={selectedProfileId}
                      onChange={(e) => {
                        setSelectedProfileId(e.target.value);
                      }}
                      className="w-full appearance-none px-3 py-1.5 text-xs font-semibold rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-primary cursor-pointer pr-8"
                    >
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.displayName || p.spreadsheetTitle || p.id}
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
                    Spreadsheet ID
                  </label>
                  <input
                    type="text"
                    disabled
                    value={targetProfile?.spreadsheetId || "Chưa cấu hình"}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-muted/50 border border-border text-muted-foreground"
                  />
                </div>
              </div>

              {/* Tabs selector */}
              <div className="pt-2 border-t border-border/70 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-muted-foreground font-medium">
                    Các Tab quét kiểm tra trên Sheet (Chọn một hoặc nhiều tab):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllTabs}
                      className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Chọn tất cả
                    </button>
                    <span className="text-muted-foreground text-xs">·</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllTabs}
                      className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-lg bg-muted/30 border border-border/70">
                  {isLoadingTabs ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                      <RefreshCw size={11} className="animate-spin text-primary" />
                      Đang tải danh sách Tab từ Google Sheet...
                    </span>
                  ) : availableTabs.map((tab) => {
                    const isChecked = selectedTabs.includes(tab);
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => toggleTab(tab)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                          isChecked
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                        }`}
                      >
                        {tab}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. Cấu hình 3 điều kiện quét tới hạn gấp */}
            <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-amber-500" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    2. Cấu hình 3 Điều kiện quét Khẩn cấp
                  </h3>
                </div>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Đồng thời xảy ra
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Điều kiện 1: Trạng thái */}
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/70">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground">
                      Điều kiện 1: Trạng thái
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">Cột M</span>
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">
                      Cột trạng thái trên Sheet
                    </label>
                    <div className="relative">
                      <select
                        value={statusColumn}
                        onChange={(e) => setStatusColumn(e.target.value)}
                        className="w-full appearance-none px-2.5 py-1 text-xs font-semibold rounded bg-background border border-border text-foreground focus:outline-none focus:border-primary cursor-pointer pr-6"
                      >
                        {STANDARD_LETTERS.map((col) => (
                          <option key={col} value={col}>
                            Cột {col} {col === "M" ? "(Mặc định)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={12}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">
                      Giá trị cần thông báo
                    </label>
                    <input
                      type="text"
                      value={targetStatusValue}
                      onChange={(e) => setTargetStatusValue(e.target.value)}
                      placeholder="Chưa lọc"
                      className="w-full px-2.5 py-1 text-xs font-semibold rounded bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Điều kiện 2: Hạn trả ảnh */}
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/70">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground">
                      Điều kiện 2: Hạn trả ảnh
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">Cột L</span>
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">
                      Cột ngày hẹn trả ảnh
                    </label>
                    <div className="relative">
                      <select
                        value={dueDateColumn}
                        onChange={(e) => setDueDateColumn(e.target.value)}
                        className="w-full appearance-none px-2.5 py-1 text-xs font-semibold rounded bg-background border border-border text-foreground focus:outline-none focus:border-primary cursor-pointer pr-6"
                      >
                        {STANDARD_LETTERS.map((col) => (
                          <option key={col} value={col}>
                            Cột {col} {col === "L" ? "(Mặc định)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={12}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
                    Hôm nay (GMT+7): <strong className="text-foreground font-mono">{todayLabel}</strong>
                    <p className="mt-0.5 text-[9px] text-zinc-500">
                      Tự động quét khách có ngày hẹn là hôm nay hoặc đã quá hạn trước đó.
                    </p>
                  </div>
                </div>

                {/* Điều kiện 3: Link edit (Cột O) */}
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/70">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground">
                      Điều kiện 3: Link Edit
                    </span>
                    <span className="text-[10px] text-amber-500 font-mono font-bold">Cột O</span>
                  </div>

                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">
                      Cột Link edit / Bàn giao
                    </label>
                    <div className="relative">
                      <select
                        value={linkEditColumn}
                        onChange={(e) => setLinkEditColumn(e.target.value)}
                        className="w-full appearance-none px-2.5 py-1 text-xs font-semibold rounded bg-background border border-amber-500/40 text-foreground focus:outline-none focus:border-primary cursor-pointer pr-6"
                      >
                        <option value="OFF">TẮT — Không kiểm tra</option>
                        {STANDARD_LETTERS.map((col) => (
                          <option key={col} value={col}>
                            Cột {col} {col === "O" ? "(Cột O - Mặc định)" : col === "N" ? "(Cột N)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={12}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
                    Logic: Ô này phải <strong>RỖNG</strong> (chưa có dữ liệu link bàn giao). Nếu đã có link $\implies$ tự động bỏ qua.
                  </div>
                </div>
              </div>

              {/* Tóm tắt logic 3 điều kiện */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 space-y-1">
                <p className="font-bold">⚡ Tóm tắt logic kích hoạt thông báo khẩn cấp:</p>
                <p className="leading-relaxed">
                  Một hàng khách hàng sẽ được báo khẩn cấp khi đồng thời: <strong>(1)</strong> Cột {statusColumn} là "{targetStatusValue}", <strong>(2)</strong> Ngày hẹn trả ở Cột {dueDateColumn} là {todayLabel} hoặc trước đó, và <strong>(3)</strong> Cột {linkEditColumn !== "OFF" ? linkEditColumn : "(đang tắt)"} đang rỗng (chưa có dữ liệu link edit bàn giao).
                </p>
              </div>
            </div>

            {/* 3. Tần suất & Cài đặt thông báo ngầm */}
            <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-emerald-500" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    3. Bật/Tắt Quét định kỳ 5 phút & Thông báo hệ điều hành
                  </h3>
                </div>
              </div>

              <label className="flex items-start justify-between gap-3 cursor-pointer group p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    Tự động quét định kỳ 5 phút/lần & Bắn thông báo ra macOS / Windows
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    App tự động kiểm tra toàn bộ bảng tính Google Sheet định kỳ mỗi 5 phút kể cả khi không mở cửa sổ (chạy ngầm trên Menu Bar / Tray). Khi có khách thỏa mãn 3 điều kiện trên, hệ thống sẽ phát chuông và hiển thị thông báo khẩn cấp.
                  </p>
                </div>
                <div
                  onClick={() => {
                    const nextVal = config.urgentScannerEnabled === false;
                    config.setUrgentScannerEnabled(nextVal);
                  }}
                  className={`shrink-0 w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    config.urgentScannerEnabled !== false ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${
                      config.urgentScannerEnabled !== false ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
              </label>
            </div>

            {/* 4. Xem trước kết quả trực tiếp (Live Preview) */}
            {liveScanResult && (
              <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Kết quả quét trực tiếp ({liveScanResult.urgentCount} khách hàng tới hạn)
                    </h3>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Đã quét {liveScanResult.scannedTabsCount} tab
                  </span>
                </div>

                {liveScanResult.urgentCount === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg text-center">
                    Không tìm thấy khách hàng nào thỏa mãn đồng thời 3 điều kiện trên (Trạng thái: {targetStatusValue}, Hạn trả $\le$ {todayLabel}, Link edit: Cột {linkEditColumn} rỗng).
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin">
                    {liveScanResult.customers.map((c, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/20"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-6 text-[10px] font-bold text-amber-500 font-mono">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-foreground truncate">
                            {c.customerName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                            {c.tabTitle} (Dòng {c.row})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-medium">
                            Hạn: {c.dueDate}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            {c.actualStatus}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                            Link edit: Rỗng
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

            {/* SUB-TAB 2: THÔNG BÁO HỆ ĐIỀU HÀNH */}
            {configSubTab === "system" && (
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="p-5 rounded-xl bg-card border border-border shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Bell size={16} className="text-primary" />
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Cài đặt Thông báo Hệ thống (macOS / Windows)
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Bật / tắt thông báo hệ điều hành */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/60">
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          Bật thông báo trên màn hình hệ điều hành
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Hiển thị biểu ngữ (Banner) thông báo và âm thanh chuông Glass khi có khách hàng tới hạn gấp.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.systemNotificationsEnabled}
                        onChange={(e) => {
                          const val = e.target.checked;
                          config.setSystemNotificationsEnabled(val);
                          if (val) {
                            invoke("request_os_notification_permission").catch(() => {});
                            urgentCustomerScannerService.ensurePermission().catch(() => {});
                          }
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                      />
                    </div>

                    {/* Bật / tắt quét ngầm định kỳ */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/60">
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          Tự động quét Google Sheet ngầm
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Quét tự động mỗi 5 phút ngay cả khi thu nhỏ xuống thanh Menu Bar (Tray).
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.urgentScannerEnabled}
                        onChange={(e) => config.setUrgentScannerEnabled(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                      />
                    </div>

                    {/* Quyền thông báo macOS */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/60">
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          Quyền Thông báo trong Cài đặt Hệ thống macOS
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Kiểm tra DH Studio Pro trong danh sách Cài đặt Thông báo của macOS.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          invoke("request_os_notification_permission").catch(() => {});
                          invoke("open_system_notification_settings").catch(() => {});
                        }}
                        className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-97"
                      >
                        <ExternalLink size={12} />
                        <span>Mở Cài đặt Mac</span>
                      </button>
                    </div>

                    {/* Nút lưu cài đặt hệ thống */}
                    <div className="pt-3 border-t border-border/60 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveConfig}
                        className="h-8 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-97"
                      >
                        {saveSuccess ? <Check size={13} /> : <Save size={13} />}
                        <span>{saveSuccess ? "Đã lưu cài đặt!" : "Lưu cài đặt thông báo"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
