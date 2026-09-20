import { create } from "zustand";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { logout } from "@/core/services/authApi";
import {
  DEFAULT_SESSION_DURATION_MINUTES,
  DEFAULT_SESSION_DURATION_MS,
  MAX_SESSION_DURATION_MS,
  SESSION_START_KEY,
  formatSessionRemaining,
  computeRemainingSeconds,
  isSessionExpiringSoon,
  isSessionWarning30s,
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
    }),
}));

/**
 * Global listener hook that enforces the session duration limit.
 * Mounted once inside AuthGuard to ensure the timer runs continuously.
 */
export function useSessionTimeoutListener() {
  const session = useAuthStore((s) => s.session);
  const authLogout = useAuthStore((s) => s.logout);
  const setSessionTimeoutExpired = useAuthStore((s) => s.setSessionTimeoutExpired);
  const setRemainingSeconds = useSessionTimerStore((s) => s.setRemainingSeconds);
  const setTotalDurationMinutes = useSessionTimerStore((s) => s.setTotalDurationMinutes);

  const sessionTokenRef = useRef(session?.accessToken);
  sessionTokenRef.current = session?.accessToken;

  useEffect(() => {
    if (!session) {
      setRemainingSeconds(0);
      useSessionTimerStore.setState({ hasDismissed30sWarning: false });
      return;
    }

    const durationMinutes = (typeof session.sessionDurationMinutes === "number" && session.sessionDurationMinutes > 0)
      ? session.sessionDurationMinutes
      : DEFAULT_SESSION_DURATION_MINUTES;

    setTotalDurationMinutes(durationMinutes);
    const maxDurationMs = durationMinutes * 60 * 1000;

    let startedAt = Date.now();
    try {
      const saved = sessionStorage.getItem(SESSION_START_KEY);
      if (saved && !isNaN(Number(saved))) {
        startedAt = Number(saved);
      } else {
        sessionStorage.setItem(SESSION_START_KEY, String(startedAt));
      }
    } catch {
      // Ignore storage errors
    }

    const checkTime = () => {
      const left = computeRemainingSeconds(startedAt, maxDurationMs);
      setRemainingSeconds(left);

      if (left <= 0) {
        // Session duration reached -> trigger logout and show expiration modal
        try {
          sessionStorage.removeItem(SESSION_START_KEY);
        } catch {}

        void logout(sessionTokenRef.current).catch(() => {});
        authLogout();
        setSessionTimeoutExpired(true);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [session?.userId, session?.sessionDurationMinutes, authLogout, setSessionTimeoutExpired, setRemainingSeconds, setTotalDurationMinutes]);
}

/**
 * Convenience hook for reading session timer state in UI components (e.g. TopBar).
 */
export function useSessionTimeout() {
  return useSessionTimerStore();
}
