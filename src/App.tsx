import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { UpdateDialog } from "@/components/updater";
import { checkForUpdates, UpdateCheckResult, downloadAndInstallUpdate, installAndRestart } from "@/updater";

function App() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const autoCheck = useSettingsStore((s) => s.settings.auto_check_updates);
  const autoDownload = useSettingsStore((s) => s.settings.auto_download_updates);
  
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [theme]);

  // Initial update check
  useEffect(() => {
    if (!autoCheck) return;

    const performCheck = async () => {
      try {
        const result = await checkForUpdates();
        if (result.hasUpdate && result.rawUpdate) {
          // If auto download is on, we do it in background
          if (autoDownload) {
            console.log("Auto downloading update...");
            await downloadAndInstallUpdate(result.rawUpdate, () => {});
            // We could show a notification here to restart, but for now we just 
            // show the dialog indicating it's ready.
            setUpdateResult(result); 
          } else {
            // Show dialog for manual update confirmation
            setUpdateResult(result);
          }
        }
      } catch (err) {
        console.error("Auto check for updates failed:", err);
      }
    };

    // Small delay to let the app finish rendering before checking
    const timer = setTimeout(performCheck, 3000);
    return () => clearTimeout(timer);
  }, [autoCheck, autoDownload]);

  return (
    <>
      <AppLayout />
      {updateResult && (
        <UpdateDialog 
          updateResult={updateResult} 
          onClose={() => setUpdateResult(null)} 
          onSkip={() => setUpdateResult(null)} // Later can save skipped version in store
        />
      )}
    </>
  );
}

export default App;

