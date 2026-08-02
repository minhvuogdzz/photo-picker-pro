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
  /** Crack/invalid license warning message */
  readonly copyrightWarningMessage: string | null;
  /** Expiring soon warning message */
  readonly expiringSoonMessage: string | null;

  setSession: (session: AuthSession | null) => void;
  setLoading: (loading: boolean) => void;
  setOffline: (offline: boolean) => void;
  setSessionExpiredByOtherDevice: (expired: boolean) => void;
  setSubscriptionExpired: (expired: boolean) => void;
  setOfflineGracePeriodExpired: (expired: boolean) => void;
  setAccountSuspended: (suspended: boolean) => void;
  setCopyrightWarningMessage: (message: string | null) => void;
  setExpiringSoonMessage: (message: string | null) => void;
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
  copyrightWarningMessage: null,
  expiringSoonMessage: null,

  setSession: (session) =>
    set({
      session,
      sessionExpiredByOtherDevice: false,
      subscriptionExpired: false,
      offlineGracePeriodExpired: false,
      accountSuspended: false,
      copyrightWarningMessage: null,
      expiringSoonMessage: null,
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
  setCopyrightWarningMessage: (message) =>
    set({ copyrightWarningMessage: message }),
  setExpiringSoonMessage: (message) =>
    set({ expiringSoonMessage: message }),

  logout: () =>
    set({
      session: null,
      sessionExpiredByOtherDevice: false,
      subscriptionExpired: false,
      offlineGracePeriodExpired: false,
      accountSuspended: false,
      copyrightWarningMessage: null,
      expiringSoonMessage: null,
    }),
}));
