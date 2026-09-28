import React, { useEffect } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { checkAppAccess } from "@/core/services/appEntitlementPolicy";
import { googleCredentialManager } from "@/modules/contact-the-sheet/services/googleCredentialBridge";
import { LeftPanel } from "./components/LeftPanel";
import { CenterPanel } from "./components/CenterPanel";
import { RightPanel } from "./components/RightPanel";
import { BottomBar } from "./components/BottomBar";
import { SettingsPage } from "./pages/PhotoPickerSettings";
import { HistoryPage } from "./pages/HistoryPage";
import { MatchProgressPopup } from "./components/MatchProgressPopup";
import { RemoveCompletedCustomerDialog } from "./components/RemoveCompletedCustomerDialog";

export function PhotoPickerModule() {
  const activeTab = useAppStore((s) => s.activeTab);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    const pickerAccess = checkAppAccess(session, "photo-picker");
    if (!pickerAccess.hasAccess && googleCredentialManager.isConnected()) {
      googleCredentialManager.disconnectGoogle();
    }
  }, [session]);

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

          {/* Remove Completed Customer Dialog */}
          <RemoveCompletedCustomerDialog />
        </>
      )}
    </div>
  );
}
