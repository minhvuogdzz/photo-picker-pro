import { useAppStore } from "@/stores/useAppStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { LeftPanel } from "./LeftPanel";
import { CenterPanel } from "./CenterPanel";
import { RightPanel } from "./RightPanel";
import { BottomBar } from "./BottomBar";
import { SettingsPage } from "@/pages/SettingsPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { AboutPage } from "@/pages/AboutPage";
import { TopBar } from "./TopBar";
import { AlertCircle } from "lucide-react";

export function AppLayout() {
  const activeTab = useAppStore((s) => s.activeTab);
  const subscriptionExpired = useAuthStore((s) => s.subscriptionExpired);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background p-4 gap-4">
      {/* TopBar Wrapper */}
      <div className="rounded-2xl shadow-lg border border-border/40 shrink-0 relative z-50">
        <TopBar />
      </div>

      {/* Pages */}
      <div className="flex-1 relative flex flex-col min-h-0">
        {subscriptionExpired && activeTab !== "settings" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl border border-destructive/20 pointer-events-auto">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2">Gói dịch vụ đã hết hạn</h2>
            <p className="text-muted-foreground">Vui lòng vào phần Cài đặt để gia hạn hoặc đổi quyền lợi.</p>
          </div>
        )}

        <div className={`flex-1 flex flex-col min-h-0 w-full h-full gap-4 ${subscriptionExpired && activeTab !== "settings" ? "opacity-30 pointer-events-none" : ""}`}>
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
      </div>
    </div>
  );
}
