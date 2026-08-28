import { useEffect, useState } from "react";
import { AppLayout } from "@/layouts/MainLayout";
import { AuthGuard } from "@/core/auth/AuthGuard";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { UpdateDialog } from "@/core/updater_ui";
import { checkForUpdates, UpdateCheckResult, downloadAndInstallUpdate } from "@/core/updater";
import { invoke } from "@tauri-apps/api/core";
import { validateSubscription, SUBSCRIPTION_CHECK_INTERVAL } from "@/core/services/authApi";
import { isOnline } from "@/core/services/apiClient";
import { socketService } from "@/core/services/socketService";
import type { AppSettings } from "@/core/types";

function AppContent() {
  const autoCheck = useSettingsStore((s) => s.settings.auto_check_updates);
  const autoDownload = useSettingsStore((s) => s.settings.auto_download_updates);

  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const setSubscriptionExpired = useAuthStore((s) => s.setSubscriptionExpired);
  const setOffline = useAuthStore((s) => s.setOffline);

  // Connect socket
  useEffect(() => {
    if (session) {
      socketService.connect(session);
    } else {
      socketService.disconnect();
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

  return (
    <AppLayout />
  );
}

function App() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const autoCheck = useSettingsStore((s) => s.settings.auto_check_updates);
  const autoDownload = useSettingsStore((s) => s.settings.auto_download_updates);
  
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

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
      <AuthGuard>
        <AppContent />
      </AuthGuard>
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

export default App;
