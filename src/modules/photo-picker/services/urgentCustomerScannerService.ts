import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { useNotificationStore } from "@/core/stores/useNotificationStore";
import { useAuthStore } from "@/core/stores/useAuthStore";

function getUserGreetingPrefix(): string {
  try {
    const session = useAuthStore.getState().session;
    const name = session?.name || session?.username || "";
    if (name.trim()) {
      return `${name.trim()} ơii, `;
    }
  } catch {}
  return "";
}
import { useContactSheetStore } from "@/modules/contact-the-sheet/stores/useContactSheetStore";
import { sheetDiscoveryService } from "@/modules/contact-the-sheet/services/sheetDiscoveryService";
import type { SheetRowRecord } from "@/modules/contact-the-sheet/services/jobMatchingService";
import {
  evaluateRow,
  getVietnamTodayKey,
  formatDateKey,
  type FilterCheckConditions,
} from "./filterStatusCheckService";

export interface UrgentCustomerSummary {
  row: number;
  tabTitle: string;
  customerName: string;
  actualStatus: string;
  photoCode1: string;
  dueDate: string;
}

export interface UrgentScanResult {
  timestamp: number;
  todayKey: number;
  todayStr: string;
  urgentCount: number;
  customers: UrgentCustomerSummary[];
  scannedTabsCount: number;
}

type ScanListener = (result: UrgentScanResult) => void;

class UrgentCustomerScannerService {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private isScanning = false;
  private lastAlertCount: number | null = null;
  private lastAlertTime = 0;
  private listeners: Set<ScanListener> = new Set();
  private lastResult: UrgentScanResult | null = null;

  public subscribe(listener: ScanListener): () => void {
    this.listeners.add(listener);
    if (this.lastResult) {
      listener(this.lastResult);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLastResult(): UrgentScanResult | null {
    return this.lastResult;
  }

  /**
   * Initializes the periodic background scanner (5 minutes = 300,000 ms)
   */
  public startPeriodicScanner(intervalMs: number = 5 * 60 * 1000): void {
    if (this.timerId) return;

    // Run first scan after 10 seconds to allow initial state hydration
    setTimeout(() => {
      this.scanNow().catch((err) =>
        console.warn("[UrgentScanner] Initial background scan error:", err)
      );
    }, 10000);

    // Periodic 5-minute interval
    this.timerId = setInterval(() => {
      this.scanNow().catch((err) =>
        console.warn("[UrgentScanner] Background periodic scan error:", err)
      );
    }, intervalMs);
  }

  public stopPeriodicScanner(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Performs an immediate scan of the linked Google Sheet for urgent customers
   */
  public async scanNow(forceNotify: boolean = false): Promise<UrgentScanResult> {
    if (this.isScanning) {
      if (this.lastResult) return this.lastResult;
    }

    const settings = useSettingsStore.getState().settings;
    if (settings.urgent_scanner_enabled === false && !forceNotify) {
      return {
        timestamp: Date.now(),
        todayKey: getVietnamTodayKey(),
        todayStr: formatDateKey(getVietnamTodayKey()),
        urgentCount: 0,
        customers: [],
        scannedTabsCount: 0,
      };
    }

    this.isScanning = true;

    try {
      const contactState = useContactSheetStore.getState();
      const savedProfileId = localStorage.getItem("mvd_urgent_profile_id");
      const profile =
        (savedProfileId && contactState.profiles.find((p) => p.id === savedProfileId)) ||
        contactState.activeProfile ||
        contactState.profiles[0] ||
        null;

      if (!profile || !profile.spreadsheetId || profile.isMockSandbox) {
        // No active spreadsheet linked
        return {
          timestamp: Date.now(),
          todayKey: getVietnamTodayKey(),
          todayStr: formatDateKey(getVietnamTodayKey()),
          urgentCount: 0,
          customers: [],
          scannedTabsCount: 0,
        };
      }

      // Determine tabs to scan
      let selectedTabs: string[] = [];
      try {
        const saved = JSON.parse(localStorage.getItem("mvd_check_selected_tabs") || "[]");
        if (Array.isArray(saved) && saved.length > 0) {
          selectedTabs = saved;
        }
      } catch {}

      if (selectedTabs.length === 0) {
        selectedTabs = profile.tabConfigurations
          ? Object.keys(profile.tabConfigurations)
          : [];
      }

      if (selectedTabs.length === 0 && profile.selectedTabTitle) {
        selectedTabs = [profile.selectedTabTitle];
      }

      if (selectedTabs.length === 0) {
        // Fallback default tab
        selectedTabs = ["Edit 9/2026", "Edit 10/2026", "Edit 11/2026", "Edit 12/2026"];
      }

      // Read configured columns from localStorage or defaults
      const statusCol = localStorage.getItem("mvd_check_status_column") || "M";
      const targetStatus = localStorage.getItem("mvd_check_status_value") || "Chưa lọc";
      const dueCol = localStorage.getItem("mvd_check_due_date_column") || "L";
      // Mặc định cột link edit là cột O (hoặc theo cấu hình người dùng)
      const savedLinkCol = localStorage.getItem("mvd_check_link_edit_column") || "O";
      const effectiveLinkCol = savedLinkCol !== "OFF" ? savedLinkCol : null;

      const todayKey = getVietnamTodayKey();
      const todayStr = formatDateKey(todayKey);

      const urgentCustomers: UrgentCustomerSummary[] = [];

      for (const tabTitle of selectedTabs) {
        try {
          const startRow =
            profile.tabConfigurations?.[tabTitle]?.rowScope?.startRow ||
            profile.rowScope?.startRow ||
            4;

          const rows: SheetRowRecord[] = await sheetDiscoveryService.fetchSheetRowsForMatching(
            profile.spreadsheetId,
            tabTitle,
            startRow,
            undefined,
            false
          );

          // Find column holding customer/job folder name
          const mappings =
            profile.tabConfigurations?.[tabTitle]?.fieldMappings ||
            profile.fieldMappings ||
            [];
          const jobCol =
            mappings.find((m) => m.semanticField === "JOB_FOLDER_NAME" || m.semanticField === "CUSTOMER_NAME")?.columnLetter ||
            "B";

          // 3 điều kiện đồng thời: Trạng thái = Chưa lọc, Hạn trả <= hôm nay, Link edit = rỗng (Cột O)
          const conditions: FilterCheckConditions = {
            statusColumn: statusCol,
            targetStatusValue: targetStatus,
            photoCode1Column: null, // Không bắt buộc mã ảnh chọn đối với thông báo gấp
            photoCode2Column: null,
            dueDateColumn: dueCol,
            linkEditColumn: effectiveLinkCol,
            todayKey,
          };

          for (const row of rows) {
            const evalResult = evaluateRow(row, conditions);
            if (evalResult.isKept) {
              const custName = (row.values[jobCol] || "").trim() || `Khách dòng ${row.row}`;
              urgentCustomers.push({
                row: row.row,
                tabTitle,
                customerName: custName,
                actualStatus: evalResult.actualStatus,
                photoCode1: evalResult.photoCode1Value || "",
                dueDate: evalResult.dueDateValue || todayStr,
              });
            }
          }
        } catch (tabErr) {
          console.warn(`[UrgentScanner] Skip tab ${tabTitle} due to error:`, tabErr);
        }
      }

      const result: UrgentScanResult = {
        timestamp: Date.now(),
        todayKey,
        todayStr,
        urgentCount: urgentCustomers.length,
        customers: urgentCustomers,
        scannedTabsCount: selectedTabs.length,
      };

      this.lastResult = result;
      this.notifyListeners(result);

      // Handle alerts
      const shouldNotify =
        forceNotify ||
        (urgentCustomers.length > 0 &&
          (this.lastAlertCount !== urgentCustomers.length ||
            Date.now() - this.lastAlertTime > 15 * 60 * 1000)); // Repeat after 15m if still urgent

      if (shouldNotify && settings.system_notifications_enabled !== false) {
        this.lastAlertCount = urgentCustomers.length;
        this.lastAlertTime = Date.now();

        await this.dispatchUrgentAlerts(result, settings);
      }

      return result;
    } finally {
      this.isScanning = false;
    }
  }

  private notifyListeners(result: UrgentScanResult) {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch (e) {
        console.error("[UrgentScanner] Listener callback error:", e);
      }
    }
  }

  /**
   * Dispatches OS native notification + optional Zalo / Phone Webhook
   */
  public async dispatchUrgentAlerts(
    result: UrgentScanResult,
    settings = useSettingsStore.getState().settings
  ): Promise<void> {
    if (result.urgentCount === 0) return;

    // Header MUST be DH STUDIO PRO, content only states number of urgent customers with friendly user greeting
    const title = "DH STUDIO PRO";
    const prefix = getUserGreetingPrefix();
    const body = `${prefix}Khẩn cấp: Có ${result.urgentCount} khách tới hạn cần lọc gấp hôm nay!`;

    // 1. Send native OS notification (macOS / Windows)
    try {
      await invoke("send_os_notification", {
        title,
        body,
      });
      console.log("[UrgentScanner] Sent native OS notification:", title, body);
    } catch (osErr) {
      console.warn("[UrgentScanner] Failed to send OS notification:", osErr);
    }

    // 2. Save into app's Notification Center history store
    try {
      useNotificationStore.getState().addNotification({
        title,
        body,
        urgentCount: result.urgentCount,
        type: "urgent",
        customers: result.customers.map((c) => ({
          row: c.row,
          tabTitle: c.tabTitle,
          customerName: c.customerName,
          actualStatus: c.actualStatus,
          photoCode1: c.photoCode1,
          dueDate: c.dueDate,
        })),
      });
    } catch (historyErr) {
      console.warn("[UrgentScanner] Failed to save notification to store:", historyErr);
    }
  }

  /**
   * Ensures OS notification permission is granted
   */
  public async ensurePermission(): Promise<boolean> {
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      return granted;
    } catch {
      return false;
    }
  }

  /**
   * Test sending a sample OS notification & log into Notification Center
   */
  public async sendTestNotification(): Promise<void> {
    const title = "DH STUDIO PRO";
    const prefix = getUserGreetingPrefix();
    const body = `${prefix}Khẩn cấp: Có 5 khách tới hạn cần lọc gấp!`;

    // Save test alert to app Notification Center
    try {
      useNotificationStore.getState().addNotification({
        title,
        body,
        urgentCount: 5,
        type: "test",
        customers: [
          {
            row: 14,
            tabTitle: "Edit 10/2026",
            customerName: "Nguyễn Thu Hà - Váy cưới 1cc",
            actualStatus: "Chưa lọc",
            photoCode1: "IMG_0124",
            dueDate: "31/10/2026",
          },
          {
            row: 28,
            tabTitle: "Edit 10/2026",
            customerName: "Lê Minh Tuấn - Phóng sự",
            actualStatus: "Chưa lọc",
            photoCode1: "DSC_9821",
            dueDate: "31/10/2026",
          },
          {
            row: 42,
            tabTitle: "Edit 10/2026",
            customerName: "Phạm Thúy Vy - Baby studio",
            actualStatus: "Chưa lọc",
            photoCode1: "VY_0052",
            dueDate: "30/10/2026",
          },
          {
            row: 55,
            tabTitle: "Edit 11/2026",
            customerName: "Trần Bảo Anh - Gia đình 2cc",
            actualStatus: "Chưa lọc",
            photoCode1: "BA_0110",
            dueDate: "29/10/2026",
          },
          {
            row: 68,
            tabTitle: "Edit 11/2026",
            customerName: "Vũ Hoàng Long - Tiệc cưới",
            actualStatus: "Chưa lọc",
            photoCode1: "LONG_0332",
            dueDate: "31/10/2026",
          },
        ],
      });
    } catch {}

    // Request permission in background without blocking
    this.ensurePermission().catch(() => {});
    await invoke("send_os_notification", { title, body });
  }
}

export const urgentCustomerScannerService = new UrgentCustomerScannerService();
