import { useAppStore } from "@/stores/useAppStore";
import { LeftPanel } from "./LeftPanel";
import { CenterPanel } from "./CenterPanel";
import { RightPanel } from "./RightPanel";
import { BottomBar } from "./BottomBar";
import { SettingsPage } from "@/pages/SettingsPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { AboutPage } from "@/pages/AboutPage";
import { TopBar } from "./TopBar";

export function AppLayout() {
  const activeTab = useAppStore((s) => s.activeTab);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background p-4 gap-4">
      {/* TopBar Wrapper */}
      <div className="rounded-2xl overflow-hidden shadow-lg border border-border/40 shrink-0">
        <TopBar />
      </div>

      {/* Pages */}
      {activeTab === "settings" && (
        <div className="flex-1 overflow-hidden rounded-2xl border border-border/40 shadow-sm bg-card">
          <SettingsPage />
        </div>
      )}
      {activeTab === "history" && (
        <div className="flex-1 overflow-hidden rounded-2xl border border-border/40 shadow-sm bg-card">
          <HistoryPage />
        </div>
      )}
      {activeTab === "about" && (
        <div className="flex-1 overflow-hidden rounded-2xl border border-border/40 shadow-sm bg-card">
          <AboutPage />
        </div>
      )}
      
      {activeTab === "home" && (
        <>
          <div className="flex-1 flex gap-4 min-h-0">
            <LeftPanel />
            <CenterPanel />
            <RightPanel />
          </div>
          
          {/* BottomBar Wrapper */}
          <div className="rounded-2xl overflow-hidden shadow-xl border border-border/40 shrink-0">
            <BottomBar />
          </div>
        </>
      )}
    </div>
  );
}
