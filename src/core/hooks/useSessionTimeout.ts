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
  computeSecondsUntilVnMidnight,
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
  computeSecondsUntilVnMidnight,
};

interface SessionTimerState {
  remainingSeconds: number;
  formattedTime: string;
  totalDurationMinutes: number;
  isExpiringSoon: boolean;
  isWarning30s: boolean;
  hasDismissed30sWarning: boolean;
  isUnlimited: boolean;
  isMidnightLogout: boolean;
  setIsMidnightLogout: (isMidnight: boolean) => void;
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
  isMidnightLogout: false,
  setIsMidnightLogout: (isMidnightLogout) => set({ isMidnightLogout }),
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
      isMidnightLogout: false,
    }),
}));

/**
 * Global listener hook that enforces the session duration limit and daily midnight reset.
 * Mounted once inside AuthGuard to ensure the timer runs continuously.
 * Premium accounts have unlimited session duration during the day,
 * BUT are automatically logged out at 00:00:00 Vietnam time (GMT+7) every day.
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
        isMidnightLogout: false,
      });
      return;
    }

    // ACTIVE & TRIAL PAID ACCOUNTS: Unlimited session duration during the day,
    // but MUST automatically log out at 00:00:00 VN time (GMT+7).
    if (isUnlimited) {
      useSessionTimerStore.setState({
        totalDurationMinutes: 0,
        isUnlimited: true,
        isMidnightLogout: false,
      });

      try {
        sessionStorage.removeItem(SESSION_START_KEY);
      } catch {}

      const checkMidnight = () => {
        const secondsUntilMidnight = computeSecondsUntilVnMidnight();

        if (secondsUntilMidnight <= 0) {
          // 0h00 Vietnam time reached!
          useSessionTimerStore.setState({
            isMidnightLogout: true,
            remainingSeconds: 0,
            formattedTime: "00:00",
            isExpiringSoon: false,
            isWarning30s: false,
          });

          void logout(sessionTokenRef.current).catch(() => {});
          authLogout();
          setSessionTimeoutExpired(true);
          return;
        }

        if (secondsUntilMidnight <= 30) {
          useSessionTimerStore.setState({
            remainingSeconds: secondsUntilMidnight,
            formattedTime: formatSessionRemaining(secondsUntilMidnight),
            isExpiringSoon: true,
            isWarning30s: true,
          });
        } else {
          useSessionTimerStore.setState({
            remainingSeconds: Infinity,
            formattedTime: "Không giới hạn",
            isExpiringSoon: false,
            isWarning30s: false,
          });
        }
      };

      checkMidnight();
      const interval = setInterval(checkMidnight, 1000);
      return () => clearInterval(interval);
    }

    // STANDARD / FREE ACCOUNTS: Enforce session countdown (e.g. 10 mins) AND midnight limit
    useSessionTimerStore.setState({ isUnlimited: false, isMidnightLogout: false });

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
      const standardLeft = computeRemainingSeconds(startedAt, maxDurationMs);
      const secondsUntilMidnight = computeSecondsUntilVnMidnight();
      const left = Math.min(standardLeft, secondsUntilMidnight);
      const isMidnight = secondsUntilMidnight <= standardLeft && secondsUntilMidnight <= 0;

      setRemainingSeconds(left);

      if (left <= 0) {
        // Session duration or midnight reached -> trigger logout and show expiration modal
        try {
          sessionStorage.removeItem(SESSION_START_KEY);
        } catch {}

        useSessionTimerStore.setState({ isMidnightLogout: isMidnight });
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
