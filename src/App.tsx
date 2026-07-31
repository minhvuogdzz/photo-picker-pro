import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { UpdateDialog } from "@/components/updater";
import { checkForUpdates, UpdateCheckResult, downloadAndInstallUpdate } from "@/updater";
import { invoke } from "@tauri-apps/api/core";
import { validateSubscription, SUBSCRIPTION_CHECK_INTERVAL } from "@/services/authApi";
import { isOnline } from "@/services/apiClient";
import type { AppSettings } from "@/types";

function AppContent() {
  const autoCheck = useSettingsStore((s) => s.settings.auto_check_updates);
  const autoDownload = useSettingsStore((s) => s.settings.auto_download_updates);

  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const setSubscriptionExpired = useAuthStore((s) => s.setSubscriptionExpired);
  const setOffline = useAuthStore((s) => s.setOffline);

  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

  // Connect socket
  useEffect(() => {
    if (session) {
      import('@/services/socketService').then(({ socketService }) => {
        socketService.connect(session);
      });
    } else {
      import('@/services/socketService').then(({ socketService }) => {
        socketService.disconnect();
      });
    }
  }, [session]);

  // Periodic subscription validation (every 4 hours)
  useEffect(() => {
    if (!session) return;

    const validate = async () => {
      if (!isOnline()) {
        setOffline(true);
        return;
      }
      setOffline(false);

      try {
        const updated = await validateSubscription(session);
        setSession(updated);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "SESSION_EXPIRED") {
          setSubscriptionExpired(true);
        }
        // Other errors: silently continue (offline mode)
      }
    };

    const interval = setInterval(validate, SUBSCRIPTION_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [session, setSession, setSubscriptionExpired, setOffline]);

  // Auto update check
  useEffect(() => {
    if (!autoCheck) return;

    const performCheck = async () => {
      try {
        const result = await checkForUpdates();
        if (result.hasUpdate && result.rawUpdate) {
          setUpdateResult(result);
        }
      } catch (err) {
        console.error("Auto check for updates failed:", err);
      }
    };

    const timer = setTimeout(performCheck, 3000);
    return () => clearTimeout(timer);
  }, [autoCheck, autoDownload]);

  return (
    <>
      <AppLayout />
      {updateResult && (
        <UpdateDialog
          updateResult={updateResult}
          autoStartDownload={autoDownload}
          onClose={() => setUpdateResult(null)}
          onSkip={() => setUpdateResult(null)}
        />
      )}
    </>
  );
}

function App() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const setSettings = useSettingsStore((s) => s.setSettings);

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

  return (
    <AuthGuard>
      <AppContent />
    </AuthGuard>
  );
}

export default App;
