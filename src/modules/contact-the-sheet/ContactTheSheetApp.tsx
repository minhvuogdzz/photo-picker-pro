import React, { useState } from "react";
import {
  Play,
  Sliders,
  History,
  HardDrive,
} from "lucide-react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { checkAppAccess } from "@/core/services/appEntitlementPolicy";
import { AppLockGateScreen } from "@/core/components/AppLockGateScreen";
import { useContactSheetStore } from "./stores/useContactSheetStore";
import { BatchRunnerView } from "./components/BatchRunnerView";
import { WorkspaceWizard } from "./components/WorkspaceWizard";
import { DriveConfigModal } from "./components/DriveConfigModal";
import { AuditHistoryView } from "./components/AuditHistoryView";

type ActiveTab = "batch" | "workspace" | "drive" | "audit";

export default function ContactTheSheetApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("batch");
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  const session = useAuthStore((s) => s.session);

  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const profiles = useContactSheetStore((s) => s.profiles);
  const setActiveProfile = useContactSheetStore((s) => s.setActiveProfile);
  const googleConnection = useContactSheetStore((s) => s.googleConnection);

  const appAccess = checkAppAccess(session, "contact-the-sheet");

  if (!appAccess.hasAccess) {
    return <AppLockGateScreen appId="contact-the-sheet" appName="Contact the Sheet" />;
  }

  const configuredTabCount = activeProfile?.tabConfigurations
    ? Object.keys(activeProfile.tabConfigurations).length
    : 0;

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden liquid-glass rounded-[22px] text-foreground relative select-none">
      {/* Clean Unified Toolbar */}
      <div className="px-4 sm:px-5 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0 min-w-0">
        {/* Left: Segmented View Navigation */}
        <div
          role="tablist"
          aria-label="Điều hướng Contact Sheet"
          className="flex items-center gap-0.5 p-1 bg-foreground/[0.04] border border-border rounded-[12px] overflow-x-auto max-w-full custom-scrollbar shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "batch"}
            onClick={() => setActiveTab("batch")}
            className={`flex items-center gap-1.5 px-3 h-7 rounded-[9px] text-[12px] transition-colors cursor-pointer whitespace-nowrap border ${
              activeTab === "batch"
                ? "glass-pill text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Play size={13} strokeWidth={1.75} className={activeTab === "batch" ? "text-primary" : ""} />
            <span>Thực thi Batch</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "workspace"}
            onClick={() => setActiveTab("workspace")}
            className={`flex items-center gap-1.5 px-3 h-7 rounded-[9px] text-[12px] transition-colors cursor-pointer whitespace-nowrap border ${
              activeTab === "workspace"
                ? "glass-pill text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sliders size={13} strokeWidth={1.75} className={activeTab === "workspace" ? "text-primary" : ""} />
            <span>Cấu hình Sheet</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDriveModalOpen(true)}
            className="flex items-center gap-1.5 px-3 h-7 rounded-[9px] text-[12px] border border-transparent text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
          >
            <HardDrive size={13} strokeWidth={1.75} />
            <span>Google Drive</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "audit"}
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-3 h-7 rounded-[9px] text-[12px] transition-colors cursor-pointer whitespace-nowrap border ${
              activeTab === "audit"
                ? "glass-pill text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History size={13} strokeWidth={1.75} className={activeTab === "audit" ? "text-primary" : ""} />
            <span>Nhật ký</span>
          </button>
        </div>

        {/* Right: Context & Google Connection Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          {activeProfile && (
            <div className="hidden lg:flex items-center gap-1.5 text-[11.5px] text-muted-foreground truncate">
              <span>Tab chính:</span>
              <span className="font-medium text-foreground">
                {activeProfile.selectedTabTitle || "Edit 9/2026"}
              </span>
              {configuredTabCount > 1 && (
                <span className="text-muted-foreground/70">
                  ({configuredTabCount} tab đã áp dụng)
                </span>
              )}
            </div>
          )}

          {profiles.length > 1 && (
            <select
              value={activeProfile?.id}
              onChange={(e) => {
                const p = profiles.find((x) => x.id === e.target.value);
                if (p) setActiveProfile(p.id);
              }}
              className="h-7 px-2.5 rounded-lg bg-background/60 border border-border text-[11.5px] text-foreground cursor-pointer outline-none"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}

          {/* Minimalist Google Status Pill */}
          <div className="h-7 px-2.5 rounded-full bg-foreground/[0.04] border border-border flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                googleConnection.status === "CONNECTED"
                  ? "bg-success"
                  : googleConnection.status === "CONNECTING"
                  ? "bg-warning"
                  : "bg-muted-foreground/40"
              }`}
            />
            <span className="truncate max-w-[160px] text-foreground/85">
              {googleConnection.status === "CONNECTED"
                ? googleConnection.accountEmail || "Đã kết nối Google"
                : googleConnection.status === "CONNECTING"
                ? "Đang kết nối..."
                : "Chưa kết nối Google"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full max-w-full relative overflow-hidden">
        {activeTab === "batch" && <BatchRunnerView />}
        {activeTab === "workspace" && <WorkspaceWizard />}
        {activeTab === "audit" && <AuditHistoryView />}
      </div>

      {/* Google Drive Configuration Modal */}
      {isDriveModalOpen && (
        <DriveConfigModal onClose={() => setIsDriveModalOpen(false)} />
      )}
    </div>
  );
}
