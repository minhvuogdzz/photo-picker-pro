import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { LauncherPage } from "@/core/pages/LauncherPage";
import { SystemModule } from "@/modules/system/SystemModule";
import { WelcomeScreen } from "@/core/components/WelcomeScreen";
import { TopBar } from "./TopBar";
import { AlertCircle } from "lucide-react";
import { EcosystemSidebar } from "./EcosystemSidebar";
import PhotoPickerModule from "@/modules/photo-picker";
import MvdConvertApp from "@/modules/mvd-convert/MvdConvertApp";
import ResourcesApp from "@/modules/resources/ResourcesApp";
import ContactTheSheetApp from "@/modules/contact-the-sheet";
import PhotoCounterApp from "@/modules/photo-counter";
import { DonateModal } from "@/core/components/DonateModal";

export function AppLayout() {
  const activeTab = useAppStore((s) => s.activeTab);
  const activeModule = useAppStore((s) => s.activeModule);
  const hasSeenWelcome = useAppStore((s) => s.hasSeenWelcome);
  const subscriptionExpired = useAuthStore((s) => s.subscriptionExpired);
  const lastClickPos = useAppStore((s) => s.lastClickPos);

  const originStyle = lastClickPos 
    ? { transformOrigin: `${lastClickPos.x}px ${lastClickPos.y}px` }
    : { transformOrigin: 'center center' };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground p-2 gap-2 relative select-none">
      
      {!hasSeenWelcome && <WelcomeScreen />}
      <DonateModal />
      
      {/* TopBar Glass Wrapper */}
      <div className="rounded-xl shrink-0 relative z-50 bg-card/90 backdrop-blur-md border border-border shadow-sm overflow-visible">
        <TopBar />
      </div>

      {/* Pages Container */}
      <div className="flex-1 relative flex flex-col min-h-0 z-10">
        {subscriptionExpired && activeTab !== "settings" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md rounded-xl border border-destructive/20 pointer-events-auto">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <h2 className="text-[13px] font-semibold mb-1">Gói dịch vụ đã hết hạn</h2>
            <p className="text-xs text-muted-foreground">Vui lòng vào phần Cài đặt để gia hạn hoặc đổi quyền lợi.</p>
          </div>
        )}

        <div className={`flex-1 flex flex-row min-h-0 min-w-0 w-full h-full gap-2 ${subscriptionExpired && activeTab !== "settings" ? "opacity-30 pointer-events-none" : ""}`}>
          
          {activeModule !== "launcher" && <EcosystemSidebar />}

          <div 
            key={activeModule} 
            className="flex-1 relative flex flex-col min-h-0 min-w-0 w-full overflow-hidden animate-app-enter"
            style={originStyle}
          >
            {activeModule === "launcher" && <LauncherPage />}
            {activeModule === "system" && <SystemModule />}
            {activeModule === "photo-picker" && <PhotoPickerModule />}
            {activeModule === "mvd-convert" && <MvdConvertApp />}
            {activeModule === "resources" && <ResourcesApp />}
            {activeModule === "contact-the-sheet" && <ContactTheSheetApp />}
            {activeModule === "photo-counter" && <PhotoCounterApp />}
          </div>
        </div>
      </div>
    </div>
  );
}
