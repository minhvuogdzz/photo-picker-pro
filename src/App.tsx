import { useEffect, useRef } from "react";
import { AppLayout } from "@/layouts/MainLayout";
import { AuthGuard } from "@/core/auth/AuthGuard";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { UpdateDialog } from "@/core/updater_ui";
import { useUpdaterStore } from "@/core/stores/useUpdaterStore";
import { invoke } from "@tauri-apps/api/core";
import { validateSubscription, getNextSubscriptionCheckDelay } from "@/core/services/authApi";
import { isOnline } from "@/core/services/apiClient";
import { socketService } from "@/core/services/socketService";
import type { AppSettings } from "@/core/types";

function AppContent() {
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const setSubscriptionExpired = useAuthStore((s) => s.setSubscriptionExpired);
  const setOffline = useAuthStore((s) => s.setOffline);

  const sessionUserId = session?.userId;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Connect socket only when login user identity changes (not on every session object re-creation)
  useEffect(() => {
    if (sessionUserId && sessionRef.current) {
      socketService.connect(sessionRef.current);
    } else {
      socketService.disconnect();
    }
  }, [sessionUserId]);

  // Smart subscription validation: schedules next check at exact expiry moment or every 4 hours
  useEffect(() => {
    if (!sessionUserId) return;

    let timer: NodeJS.Timeout | null = null;
    let isMounted = true;
    let failureCount = 0;
    let hasValidatedExpiry = false;

    const scheduleNextCheck = () => {
      if (!isMounted) return;
      const currentSession = sessionRef.current;
      if (!currentSession) return;

      const delay = getNextSubscriptionCheckDelay(
        currentSession,
        failureCount,
        hasValidatedExpiry
      );

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      // If null, no periodic timer is needed (LIFETIME, or already confirmed EXPIRED/SUSPENDED)
      if (delay === null) {
        return;
      }

      timer = setTimeout(async () => {
        const success = await runValidation();
        if (success) {
          failureCount = 0;
        } else {
          failureCount += 1;
        }
        scheduleNextCheck();
      }, delay);
    };

    const runValidation = async (): Promise<boolean> => {
      const currentSession = sessionRef.current;
      if (!currentSession) return false;

      if (!isOnline()) {
        setOffline(true);
        return false;
      }
      setOffline(false);

      try {
        const updated = await validateSubscription(currentSession);
        if (isMounted) {
          setSession(updated);
          if (updated.subscription.status === "EXPIRED") {
            hasValidatedExpiry = true;
            setSubscriptionExpired(true);
          }
        }
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "SUBSCRIPTION_INVALID") {
          hasValidatedExpiry = true;
          setSubscriptionExpired(true);
          return true; // Confirmed invalid, stop loop
        } else if (message === "SESSION_EXPIRED") {
          useAuthStore.getState().setSessionExpiredByOtherDevice(true);
          return true; // Confirmed expired session, stop loop
        }
        // Network or server error -> failureCount increments and backoff applies
        return false;
      }
    };

    scheduleNextCheck();

    return () => {
      isMounted = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, [sessionUserId, setSession, setSubscriptionExpired, setOffline]);

  return (
    <AppLayout />
  );
}

function App() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const autoCheck = useSettingsStore((s) => s.settings.auto_check_updates);
  const checkUpdates = useUpdaterStore((s) => s.checkForUpdates);

  // Load settings on app start (globally)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await invoke<AppSettings>("load_settings");
        setSettings(loaded);
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSettings();
  }, [setSettings]);

  // Apply theme globally (even on LoginPage)
  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [theme]);

  // Startup update check with intelligent retry (cold start)
  useEffect(() => {
    if (!autoCheck) return;

    let retryCount = 0;
    const maxRetries = 2;
    let timer: NodeJS.Timeout;

    const runStartupCheck = async () => {
      try {
        const res = await checkUpdates({ isStartup: true });
        // If network wasn't ready yet (returned null/threw), retry after delay
        if (res === null && retryCount < maxRetries) {
          retryCount++;
          const delay = retryCount === 1 ? 15000 : 30000;
          timer = setTimeout(runStartupCheck, delay);
        }
      } catch {
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = retryCount === 1 ? 15000 : 30000;
          timer = setTimeout(runStartupCheck, delay);
        }
      }
    };

    // Delay 4s at launch to allow OS network connection to settle
    timer = setTimeout(runStartupCheck, 4000);
    return () => clearTimeout(timer);
  }, [autoCheck, checkUpdates]);

  // Periodic background check & Network Online Listener (in-session)
  useEffect(() => {
    if (!autoCheck) return;

    // Periodic check every 60 minutes
    const PERIODIC_CHECK_INTERVAL = 60 * 60 * 1000;
    const interval = setInterval(() => {
      checkUpdates({ isStartup: false });
    }, PERIODIC_CHECK_INTERVAL);

    // Re-check when internet connection is restored
    const handleOnline = () => {
      checkUpdates({ isStartup: false });
    };
    window.addEventListener("online", handleOnline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
    };
  }, [autoCheck, checkUpdates]);

  return (
    <>
      <AuthGuard>
        <AppContent />
      </AuthGuard>
      <UpdateDialog />
    </>
  );
}

export default App;
