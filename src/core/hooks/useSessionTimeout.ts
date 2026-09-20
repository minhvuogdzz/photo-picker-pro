import { create } from "zustand";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { logout } from "@/core/services/authApi";
import {
  MAX_SESSION_DURATION_MS,
  SESSION_START_KEY,
  formatSessionRemaining,
  computeRemainingSeconds,
  isSessionExpiringSoon,
} from "../services/sessionTimeoutPolicy.ts";

export {
  MAX_SESSION_DURATION_MS,
  SESSION_START_KEY,
  formatSessionRemaining,
  computeRemainingSeconds,
  isSessionExpiringSoon,
};

interface SessionTimerState {
  remainingSeconds: number;
  formattedTime: string;
  isExpiringSoon: boolean;
  setRemainingSeconds: (seconds: number) => void;
  resetTimer: () => void;
}

export const useSessionTimerStore = create<SessionTimerState>((set) => ({
  remainingSeconds: 600,
  formattedTime: "10:00",
  isExpiringSoon: false,
  setRemainingSeconds: (remainingSeconds) =>
    set({
      remainingSeconds,
      formattedTime: formatSessionRemaining(remainingSeconds),
      isExpiringSoon: isSessionExpiringSoon(remainingSeconds),
    }),
  resetTimer: () =>
    set({
      remainingSeconds: 600,
      formattedTime: "10:00",
      isExpiringSoon: false,
    }),
}));

/**
 * Global listener hook that enforces the 10-minute session duration.
 * Mounted once inside AuthGuard to ensure the timer runs continuously.
 */
export function useSessionTimeoutListener() {
  const session = useAuthStore((s) => s.session);
  const authLogout = useAuthStore((s) => s.logout);
  const setSessionTimeoutExpired = useAuthStore((s) => s.setSessionTimeoutExpired);
  const setRemainingSeconds = useSessionTimerStore((s) => s.setRemainingSeconds);

  const sessionTokenRef = useRef(session?.accessToken);
  sessionTokenRef.current = session?.accessToken;

  useEffect(() => {
    if (!session) {
      setRemainingSeconds(0);
      return;
    }

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
      const left = computeRemainingSeconds(startedAt);
      setRemainingSeconds(left);

      if (left <= 0) {
        // 10 minutes reached -> trigger logout and show expiration modal
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
  }, [session?.userId, authLogout, setSessionTimeoutExpired, setRemainingSeconds]);
}

/**
 * Convenience hook for reading session timer state in UI components (e.g. TopBar).
 */
export function useSessionTimeout() {
  return useSessionTimerStore();
}
