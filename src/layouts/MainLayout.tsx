import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { HistoryPage } from "@/modules/photo-picker/pages/HistoryPage";
import { LauncherPage } from "@/core/pages/LauncherPage";
import { SystemModule } from "@/modules/system/SystemModule";
import { WelcomeScreen } from "@/core/components/WelcomeScreen";
import { TopBar } from "./TopBar";
import { AlertCircle } from "lucide-react";
import { EcosystemSidebar } from "./EcosystemSidebar";
import PhotoPickerModule from "@/modules/photo-picker";
import MvdConvertApp from "@/modules/mvd-convert/MvdConvertApp";
import PsPluginApp from "@/modules/ps-plugin/PsPluginApp";

export function AppLayout() {
  const activeTab = useAppStore((s) => s.activeTab);
  const activeModule = useAppStore((s) => s.activeModule);
  const hasSeenWelcome = useAppStore((s) => s.hasSeenWelcome);
  const subscriptionExpired = useAuthStore((s) => s.subscriptionExpired);
  const lastClickPos = useAppStore((s) => s.lastClickPos);

  const isLauncherOrWelcome = activeModule === "launcher" || !hasSeenWelcome;

  const originStyle = lastClickPos 
    ? { transformOrigin: `${lastClickPos.x}px ${lastClickPos.y}px` }
    : { transformOrigin: 'center center' };

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isLauncherOrWelcome ? 'multi-gradient-bg' : 'bg-background'} p-4 gap-4 relative`}>
      {isLauncherOrWelcome && <div className="absolute inset-0 bg-black/50 pointer-events-none" />}
      
      {!hasSeenWelcome && <WelcomeScreen />}
      
      {/* TopBar Wrapper */}
      <div className="rounded-3xl shrink-0 relative z-50 bg-white/5 backdrop-blur-3xl border border-white/10 shadow-2xl overflow-visible">
        <TopBar />
      </div>

      {/* Pages */}
      <div className="flex-1 relative flex flex-col min-h-0 z-10">
        {subscriptionExpired && activeTab !== "settings" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl border border-destructive/20 pointer-events-auto">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2">Gói dịch vụ đã hết hạn</h2>
            <p className="text-muted-foreground">Vui lòng vào phần Cài đặt để gia hạn hoặc đổi quyền lợi.</p>
          </div>
        )}

        <div className={`flex-1 flex flex-row min-h-0 w-full h-full gap-4 ${subscriptionExpired && activeTab !== "settings" ? "opacity-30 pointer-events-none" : ""}`}>
          
          {activeModule !== "launcher" && <EcosystemSidebar />}

          <div 
            key={activeModule} 
            className="flex-1 relative flex flex-col min-h-0 w-full animate-app-enter"
            style={originStyle}
          >
            {activeModule === "launcher" && <LauncherPage />}
            {activeModule === "system" && <SystemModule />}
            {activeModule === "photo-picker" && <PhotoPickerModule />}
            {activeModule === "mvd-convert" && <MvdConvertApp />}
            {activeModule === "ps-plugin" && <PsPluginApp />}
          </div>
        </div>
      </div>
    </div>
  );
}
