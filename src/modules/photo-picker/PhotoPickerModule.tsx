import { useAppStore } from "@/core/stores/useAppStore";
import { LeftPanel } from "./components/LeftPanel";
import { CenterPanel } from "./components/CenterPanel";
import { RightPanel } from "./components/RightPanel";
import { BottomBar } from "./components/BottomBar";
import { SettingsPage } from "./pages/PhotoPickerSettings";
import { HistoryPage } from "./pages/HistoryPage";
import { MatchProgressPopup } from "./components/MatchProgressPopup";

export function PhotoPickerModule() {
  const activeTab = useAppStore((s) => s.activeTab);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full gap-2">
      {activeTab === "settings" && (
        <div className="flex-1 overflow-hidden rounded-xl border border-border shadow-sm bg-card">
          <SettingsPage />
        </div>
      )}
      {activeTab === "history" && (
        <div className="flex-1 overflow-hidden rounded-xl border border-border shadow-sm bg-card">
          <HistoryPage />
        </div>
      )}
      
      {activeTab === "home" && (
        <>
          <div className="flex-1 flex gap-2 min-h-0">
            <LeftPanel />
            <CenterPanel />
            <RightPanel />
          </div>
          
          {/* BottomBar Wrapper */}
          <div className="rounded-xl overflow-hidden shadow-sm border border-border shrink-0">
            <BottomBar />
          </div>
          
          {/* Progress Popup Overlay */}
          <MatchProgressPopup />
        </>
      )}
    </div>
  );
}
