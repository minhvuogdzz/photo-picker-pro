import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { LauncherPage } from "@/core/pages/LauncherPage";
import { SystemModule } from "@/modules/system/SystemModule";
import { WelcomeScreen } from "@/core/components/WelcomeScreen";
import { TopBar } from "./TopBar";
import { lazy, Suspense, useState } from "react";
import { AlertCircle, Key } from "lucide-react";
import { EcosystemSidebar } from "./EcosystemSidebar";
import { DonateModal } from "@/core/components/DonateModal";
import { AnnouncementPopup } from "@/core/components/AnnouncementPopup";
import { LicenseManager } from "@/core/license/LicenseManager";

const PhotoPickerModule = lazy(() => import("@/modules/photo-picker"));
const MvdConvertApp = lazy(() => import("@/modules/mvd-convert/MvdConvertApp"));
const ResourcesApp = lazy(() => import("@/modules/resources/ResourcesApp"));
const ContactTheSheetApp = lazy(() => import("@/modules/contact-the-sheet"));
const PhotoCounterApp = lazy(() => import("@/modules/photo-counter"));

export function AppLayout() {
  const activeTab = useAppStore((s) => s.activeTab);
  const activeModule = useAppStore((s) => s.activeModule);
  const hasSeenWelcome = useAppStore((s) => s.hasSeenWelcome);
  const subscriptionExpired = useAuthStore((s) => s.subscriptionExpired);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-row overflow-hidden bg-background text-foreground select-none relative">
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

      {/* Persistent Left macOS Sidebar */}
      <EcosystemSidebar />

      {/* Right Unified Window Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden relative">
        {/* Top macOS Bar - Exactly matching sidebar header height (h-14) for seamless border alignment */}
        <div className="h-14 shrink-0 z-30 px-4 flex items-center border-b border-border/40">
          <TopBar />
        </div>

        {/* Expired Subscription Blocker */}
        {subscriptionExpired && activeTab !== "settings" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/85 backdrop-blur-md pointer-events-auto p-6 text-center select-none animate-fade-in shadow-2xl">
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

        {/* Active Module Container with Symmetrical Left and Right Padding */}
        <main
          className={`flex-1 relative flex flex-col min-h-0 min-w-0 w-full overflow-hidden px-4 pb-3.5 pt-2 ${
            subscriptionExpired && activeTab !== "settings"
              ? "opacity-30 pointer-events-none"
              : ""
          }`}
        >
          <div
            key={activeModule}
            className="flex-1 w-full h-full flex flex-col min-h-0 min-w-0 animate-app-enter origin-center"
          >
            {activeModule === "launcher" && <LauncherPage />}
            {activeModule === "system" && <SystemModule />}
            <Suspense fallback={null}>
              {activeModule === "photo-picker" && <PhotoPickerModule />}
              {activeModule === "mvd-convert" && <MvdConvertApp />}
              {activeModule === "resources" && <ResourcesApp />}
              {activeModule === "contact-the-sheet" && <ContactTheSheetApp />}
              {activeModule === "photo-counter" && <PhotoCounterApp />}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
