import { create } from "zustand";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { logout } from "@/core/services/authApi";
import { isUnlimitedSession } from "@/core/services/appEntitlementPolicy";
import {
  DEFAULT_SESSION_DURATION_MINUTES,
  DEFAULT_SESSION_DURATION_MS,
  MAX_SESSION_DURATION_MS,
  SESSION_START_KEY,
  formatSessionRemaining,
  computeRemainingSeconds,
  isSessionExpiringSoon,
  isSessionWarning30s,
  readSessionStart,
  writeSessionStart,
  clearSessionStart,
} from "../services/sessionTimeoutPolicy.ts";

export {
  DEFAULT_SESSION_DURATION_MINUTES,
  DEFAULT_SESSION_DURATION_MS,
  MAX_SESSION_DURATION_MS,
  SESSION_START_KEY,
  formatSessionRemaining,
  computeRemainingSeconds,
  isSessionExpiringSoon,
  isSessionWarning30s,
};

interface SessionTimerState {
  remainingSeconds: number;
  formattedTime: string;
  totalDurationMinutes: number;
  isExpiringSoon: boolean;
  isWarning30s: boolean;
  hasDismissed30sWarning: boolean;
  isUnlimited: boolean;
  dismiss30sWarning: () => void;
  setRemainingSeconds: (seconds: number) => void;
  setTotalDurationMinutes: (minutes: number) => void;
  resetTimer: (durationMinutes?: number) => void;
}

export const useSessionTimerStore = create<SessionTimerState>((set) => ({
  remainingSeconds: 600,
  formattedTime: "10:00",
  totalDurationMinutes: 10,
  isExpiringSoon: false,
  isWarning30s: false,
  hasDismissed30sWarning: false,
  isUnlimited: false,
  dismiss30sWarning: () => set({ hasDismissed30sWarning: true }),
  setRemainingSeconds: (remainingSeconds) =>
    set({
      remainingSeconds,
      formattedTime: formatSessionRemaining(remainingSeconds),
      isExpiringSoon: isSessionExpiringSoon(remainingSeconds),
      isWarning30s: isSessionWarning30s(remainingSeconds),
    }),
  setTotalDurationMinutes: (totalDurationMinutes) =>
    set({ totalDurationMinutes }),
  resetTimer: (durationMinutes = DEFAULT_SESSION_DURATION_MINUTES) =>
    set({
      remainingSeconds: durationMinutes * 60,
      formattedTime: formatSessionRemaining(durationMinutes * 60),
      totalDurationMinutes: durationMinutes,
      isExpiringSoon: false,
      isWarning30s: false,
      hasDismissed30sWarning: false,
      isUnlimited: false,
    }),
}));

/**
 * Global listener hook that enforces the session duration limit for free accounts.
 * Mounted once inside AuthGuard to ensure the timer runs continuously.
 * Paid accounts have an unlimited session and stay logged in until they log out or are kicked.
 */
export function useSessionTimeoutListener() {
  const session = useAuthStore((s) => s.session);
  const authLogout = useAuthStore((s) => s.logout);
  const setSessionTimeoutExpired = useAuthStore((s) => s.setSessionTimeoutExpired);
  const setRemainingSeconds = useSessionTimerStore((s) => s.setRemainingSeconds);
  const setTotalDurationMinutes = useSessionTimerStore((s) => s.setTotalDurationMinutes);

  const sessionTokenRef = useRef(session?.accessToken);
  sessionTokenRef.current = session?.accessToken;

  const isUnlimited = isUnlimitedSession(session);

  useEffect(() => {
    if (!session) {
      setRemainingSeconds(0);
      useSessionTimerStore.setState({
        hasDismissed30sWarning: false,
        isUnlimited: false,
      });
      return;
    }

    if (isUnlimited) {
      clearSessionStart();
      useSessionTimerStore.setState({
        totalDurationMinutes: 0,
        isUnlimited: true,
        remainingSeconds: Infinity,
        formattedTime: "Không giới hạn",
        isExpiringSoon: false,
        isWarning30s: false,
      });
      return;
    }

    // STANDARD / FREE ACCOUNTS: Enforce session countdown (e.g. 10 mins)
    useSessionTimerStore.setState({ isUnlimited: false });

    const durationMinutes = (typeof session.sessionDurationMinutes === "number" && session.sessionDurationMinutes > 0)
      ? session.sessionDurationMinutes
      : DEFAULT_SESSION_DURATION_MINUTES;

    setTotalDurationMinutes(durationMinutes);
    const maxDurationMs = durationMinutes * 60 * 1000;

    const userId = session.userId;
    let startedAt = readSessionStart(userId);
    if (startedAt === null) {
      startedAt = Date.now();
      writeSessionStart(userId, startedAt);
    }
    const sessionStartedAt = startedAt;

    const checkTime = () => {
      const left = computeRemainingSeconds(sessionStartedAt, maxDurationMs);
      setRemainingSeconds(left);

      if (left <= 0) {
        clearSessionStart();
        void logout(sessionTokenRef.current).catch(() => {});
        authLogout();
        setSessionTimeoutExpired(true);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [
    session?.userId,
    isUnlimited,
    session?.sessionDurationMinutes,
    authLogout,
    setSessionTimeoutExpired,
    setRemainingSeconds,
    setTotalDurationMinutes
  ]);
}

/**
 * Convenience hook for reading session timer state in UI components (e.g. TopBar).
 */
export function useSessionTimeout() {
  return useSessionTimerStore();
}
