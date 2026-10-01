import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { LauncherPage } from "@/core/pages/LauncherPage";
import { SystemModule } from "@/modules/system/SystemModule";
import { WelcomeScreen } from "@/core/components/WelcomeScreen";
import { TopBar } from "./TopBar";
import { useState } from "react";
import { AlertCircle, Key } from "lucide-react";
import { EcosystemSidebar } from "./EcosystemSidebar";
import PhotoPickerModule from "@/modules/photo-picker";
import MvdConvertApp from "@/modules/mvd-convert/MvdConvertApp";
import ResourcesApp from "@/modules/resources/ResourcesApp";
import ContactTheSheetApp from "@/modules/contact-the-sheet";
import PhotoCounterApp from "@/modules/photo-counter";
import { DonateModal } from "@/core/components/DonateModal";
import { AnnouncementPopup } from "@/core/components/AnnouncementPopup";
import { LicenseManager } from "@/core/license/LicenseManager";

export function AppLayout() {
  const activeTab = useAppStore((s) => s.activeTab);
  const activeModule = useAppStore((s) => s.activeModule);
  const hasSeenWelcome = useAppStore((s) => s.hasSeenWelcome);
  const subscriptionExpired = useAuthStore((s) => s.subscriptionExpired);
  const lastClickPos = useAppStore((s) => s.lastClickPos);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const originStyle = lastClickPos 
    ? { transformOrigin: `${lastClickPos.x}px ${lastClickPos.y}px` }
    : { transformOrigin: 'center center' };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground p-2 gap-2 relative select-none">
      
      {!hasSeenWelcome && <WelcomeScreen />}
      <DonateModal />
      <AnnouncementPopup />

      {showLicenseModal && (
        <LicenseManager
          onClose={() => setShowLicenseModal(false)}
          variant="modal"
          initialMode="packages"
        />
      )}
      
      {/* TopBar Glass Wrapper */}
      <div className="rounded-xl shrink-0 relative z-50 bg-card/90 backdrop-blur-md border border-border shadow-sm overflow-visible">
        <TopBar />
      </div>

      {/* Pages Container */}
      <div className="flex-1 relative flex flex-col min-h-0 z-10">
        {subscriptionExpired && activeTab !== "settings" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md rounded-2xl border border-destructive/30 pointer-events-auto p-6 text-center select-none animate-fade-in shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-destructive/15 border border-destructive/30 flex items-center justify-center text-destructive mb-3.5 shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-foreground mb-1">Gói dịch vụ đã hết hạn</h2>
            <p className="text-xs text-muted-foreground max-w-sm mb-4 leading-relaxed">
              Các tính năng xử lý ảnh tạm thời bị vô hiệu hoá. Bạn có thể gia hạn gói ngay hoặc nhập mã License Key để tiếp tục sử dụng.
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowLicenseModal(true)}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Key size={14} />
                Gia Hạn / Kích Hoạt Key Ngay
              </button>
            </div>
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
