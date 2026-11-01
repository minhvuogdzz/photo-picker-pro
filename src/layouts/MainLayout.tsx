import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { LauncherPage } from "@/core/pages/LauncherPage";
import { SystemModule } from "@/modules/system/SystemModule";
import { NotificationCenterModule } from "@/modules/notifications/NotificationCenterModule";
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
    <div className="app-canvas h-screen w-screen flex flex-row overflow-hidden text-foreground select-none relative">
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
        {/* Top bar: transparent over the canvas, same height as the sidebar header */}
        <div className="h-14 shrink-0 z-30 pl-4 pr-5 flex items-center">
          <TopBar />
        </div>

        {/* Expired Subscription Blocker */}
        {subscriptionExpired && activeTab !== "settings" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-xl pointer-events-auto p-6 select-none animate-fade-in">
            <div className="liquid-glass liquid-glass-strong rounded-3xl px-8 py-7 max-w-md flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-4">
                <AlertCircle size={20} strokeWidth={1.75} />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground mb-1.5">Gói dịch vụ đã hết hạn</h2>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Các tính năng xử lý ảnh tạm thời bị vô hiệu hoá. Gia hạn gói hoặc nhập License Key để tiếp tục sử dụng.
              </p>
              <button
                type="button"
                onClick={() => setShowLicenseModal(true)}
                className="btn-base btn-primary px-5"
              >
                <Key size={14} strokeWidth={2} />
                Gia hạn hoặc kích hoạt Key
              </button>
            </div>
          </div>
        )}

        {/* Active module */}
        <main
          className={`flex-1 relative flex flex-col min-h-0 min-w-0 w-full overflow-hidden pl-4 pr-5 pb-4 pt-1 ${
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
            {activeModule === "notifications" && <NotificationCenterModule />}
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
