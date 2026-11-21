import { create } from "zustand";
import { trText } from "../lib/i18n.ts";

export type AvailabilityState =
  | "CHECKING"
  | "ONLINE"
  | "DEGRADED"
  | "LOCAL_OFFLINE"
  | "MAINTENANCE_CONFIRMED"
  | "BACKEND_UNAVAILABLE"
  | "RECOVERING";

export interface MaintenanceInfo {
  readonly maintenance: boolean;
  readonly title: string;
  readonly message: string;
  readonly estimatedRecovery?: string | null;
  readonly supportUrl?: string;
  readonly updatedAt?: string;
}

export function getDefaultMaintenanceInfo(): MaintenanceInfo {
  return {
    maintenance: true,
    title: trText("Phần mềm đang được bảo trì", "Software Under Maintenance"),
    message: trText(
      "Hệ thống đang được nâng cấp máy chủ để hoạt động ổn định và mượt mà hơn. Các tính năng trực tuyến sẽ sớm quay trở lại. Dữ liệu và tài khoản của bạn vẫn được bảo toàn.",
      "Our servers are undergoing maintenance to improve stability and performance. Online features will be back shortly. Your data and account remain safe."
    ),
    estimatedRecovery: null,
    supportUrl: "https://mvd.vn",
    updatedAt: new Date().toISOString(),
  };
}

export const DEFAULT_MAINTENANCE_INFO: MaintenanceInfo = getDefaultMaintenanceInfo();

interface AvailabilityStoreState {
  readonly state: AvailabilityState;
  readonly maintenanceInfo: MaintenanceInfo | null;
  readonly lastCheckedAt: number | null;
  readonly lastOnlineAt: number | null;
  readonly consecutiveFailures: number;
  readonly consecutiveSuccesses: number;
  readonly nextRetryCountdown: number; // in seconds
  readonly isManualChecking: boolean;
  readonly offlineBypass: boolean; // user chose "Tiếp tục ngoại tuyến"

  setState: (state: AvailabilityState) => void;
  setMaintenanceInfo: (info: MaintenanceInfo | null) => void;
  recordSuccess: () => void;
  recordFailure: (isMaintenance?: boolean, info?: MaintenanceInfo) => void;
  setNextRetryCountdown: (seconds: number) => void;
  setIsManualChecking: (isChecking: boolean) => void;
  setOfflineBypass: (bypass: boolean) => void;
  reset: () => void;
}

export const useAvailabilityStore = create<AvailabilityStoreState>((set) => ({
  state: "CHECKING",
  maintenanceInfo: null,
  lastCheckedAt: null,
  lastOnlineAt: null,
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  nextRetryCountdown: 0,
  isManualChecking: false,
  offlineBypass: false,

  setState: (state) => set({ state }),

  setMaintenanceInfo: (info) => set({ maintenanceInfo: info }),

  recordSuccess: () =>
    set((s) => ({
      state: "ONLINE",
      consecutiveFailures: 0,
      consecutiveSuccesses: s.consecutiveSuccesses + 1,
      lastCheckedAt: Date.now(),
      lastOnlineAt: Date.now(),
      nextRetryCountdown: 0,
      isManualChecking: false,
      offlineBypass: false, // Reset offline bypass when backend is fully back ONLINE
    })),

  recordFailure: (isMaintenance = false, info) =>
    set((s) => {
      const nextFailures = s.consecutiveFailures + 1;
      let nextState: AvailabilityState = s.state;

      if (isMaintenance) {
        nextState = "MAINTENANCE_CONFIRMED";
      } else if (nextFailures >= 3) {
        nextState = "BACKEND_UNAVAILABLE";
      } else {
        nextState = "DEGRADED";
      }

      return {
        state: nextState,
        maintenanceInfo: info || s.maintenanceInfo || getDefaultMaintenanceInfo(),
        consecutiveFailures: nextFailures,
        consecutiveSuccesses: 0,
        lastCheckedAt: Date.now(),
        isManualChecking: false,
        // If a new explicit maintenance event is declared, reset bypass
        offlineBypass: isMaintenance ? false : s.offlineBypass,
      };
    }),

  setNextRetryCountdown: (seconds) => set({ nextRetryCountdown: seconds }),

  setIsManualChecking: (isChecking) => set({ isManualChecking: isChecking }),

  setOfflineBypass: (bypass) => set({ offlineBypass: bypass }),

  reset: () =>
    set({
      state: "CHECKING",
      maintenanceInfo: null,
      lastCheckedAt: null,
      lastOnlineAt: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      nextRetryCountdown: 0,
      isManualChecking: false,
      offlineBypass: false,
    }),
}));
