import { create } from "zustand";
import type { AuthSession } from "@/types/auth";

interface AuthState {
  /** Current authenticated session, null if not logged in */
  readonly session: AuthSession | null;
  /** Whether the initial session load is in progress */
  readonly isLoading: boolean;
  /** Whether the device is offline */
  readonly isOffline: boolean;
  /** Whether this session was invalidated by another device */
  readonly sessionExpiredByOtherDevice: boolean;
  /** Whether subscription has expired */
  readonly subscriptionExpired: boolean;
  /** Whether offline grace period (7 days) has expired */
  readonly offlineGracePeriodExpired: boolean;
  /** Whether account was suspended by admin */
  readonly accountSuspended: boolean;

  setSession: (session: AuthSession | null) => void;
  setLoading: (loading: boolean) => void;
  setOffline: (offline: boolean) => void;
  setSessionExpiredByOtherDevice: (expired: boolean) => void;
  setSubscriptionExpired: (expired: boolean) => void;
  setOfflineGracePeriodExpired: (expired: boolean) => void;
  setAccountSuspended: (suspended: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true,
  isOffline: false,
  sessionExpiredByOtherDevice: false,
  subscriptionExpired: false,
  offlineGracePeriodExpired: false,
  accountSuspended: false,

  setSession: (session) =>
    set({
      session,
      sessionExpiredByOtherDevice: false,
      subscriptionExpired: false,
      offlineGracePeriodExpired: false,
      accountSuspended: false,
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setOffline: (offline) => set({ isOffline: offline }),
  setSessionExpiredByOtherDevice: (expired) =>
    set({ sessionExpiredByOtherDevice: expired }),
  setSubscriptionExpired: (expired) =>
    set({ subscriptionExpired: expired }),
  setOfflineGracePeriodExpired: (expired) =>
    set({ offlineGracePeriodExpired: expired }),
  setAccountSuspended: (suspended) =>
    set({ accountSuspended: suspended }),

  logout: () =>
    set({
      session: null,
      sessionExpiredByOtherDevice: false,
      subscriptionExpired: false,
      offlineGracePeriodExpired: false,
      accountSuspended: false,
    }),
}));
