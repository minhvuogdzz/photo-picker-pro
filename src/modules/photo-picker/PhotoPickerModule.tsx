import React, { useEffect } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { checkPremiumFeatureAccess } from "@/core/services/premiumFeaturePolicy";
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
  const pickerMode = useAppStore((s) => s.pickerMode);
  const setPickerMode = useAppStore((s) => s.setPickerMode);
  const session = useAuthStore((s) => s.session);

  // Proactive VIP Premium / 7-Day trial expiration enforcement:
  useEffect(() => {
    // 1. If 7-day trial has expired (or not licensed), immediately disconnect Google account on this device
    const sheetAccess = checkPremiumFeatureAccess(session, "sheet_extract");
    if (!sheetAccess.hasAccess && googleCredentialManager.isConnected()) {
      console.warn(
        `[PhotoPickerModule] VIP trial expired (reason: ${sheetAccess.reason}). Immediately disconnecting Google account on this device.`
      );
      googleCredentialManager.disconnectGoogle();
    }

    // 2. If 7-day trial has expired for multi_client, revert mode to single
    const multiAccess = checkPremiumFeatureAccess(session, "multi_client");
    if (!multiAccess.hasAccess && pickerMode === "multi") {
      setPickerMode("single");
    }
  }, [session, pickerMode, setPickerMode]);

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
