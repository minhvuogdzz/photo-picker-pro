import React, { useState } from "react";
import {
  FileSpreadsheet,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sliders,
  FolderSync,
  History,
  HardDrive,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowLeft,
} from "lucide-react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useAppStore } from "@/core/stores/useAppStore";
import { checkAppAccess } from "@/core/services/appEntitlementPolicy";
import { AppLockGateScreen } from "@/core/components/AppLockGateScreen";
import { useContactSheetStore } from "./stores/useContactSheetStore";
import { BatchRunnerView } from "./components/BatchRunnerView";
import { WorkspaceWizard } from "./components/WorkspaceWizard";
import { DriveConfigModal } from "./components/DriveConfigModal";
import { AuditHistoryView } from "./components/AuditHistoryView";
import { FolderSyncView } from "./components/FolderSyncView";

type ActiveTab = "sync-folders" | "batch" | "workspace" | "drive" | "audit";

export default function ContactTheSheetApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("batch");
  const [pendingBatchFolderPaths, setPendingBatchFolderPaths] = useState<string[] | null>(null);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  const handleGoToBatch = (paths?: string[]) => {
    if (paths && paths.length > 0) {
      setPendingBatchFolderPaths(paths);
    }
    setActiveTab("batch");
  };

  const session = useAuthStore((s) => s.session);

  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const profiles = useContactSheetStore((s) => s.profiles);
  const setActiveProfile = useContactSheetStore((s) => s.setActiveProfile);
  const googleConnection = useContactSheetStore((s) => s.googleConnection);

  const appAccess = checkAppAccess(session, "contact-the-sheet");

  // Gatekeeper Screen if user has no access (trial expired and not purchased)
  if (!appAccess.hasAccess) {
    return <AppLockGateScreen appId="contact-the-sheet" appName="Contact the Sheet" />;
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden bg-card/90 backdrop-blur-md rounded-xl border border-border text-foreground relative select-none">
      {/* Top Header & Navigation Bar */}
      <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 shrink-0 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <FileSpreadsheet size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="font-semibold text-xs tracking-tight text-foreground truncate">
                Contact the Sheet
              </h1>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider shrink-0">
                Workflow
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
              {activeProfile
                ? `Không gian: ${activeProfile.displayName} — Tab: ${activeProfile.selectedTabTitle || "Edit 9/2026"}`
                : "Chưa cấu hình Workspace"}
            </p>
          </div>
        </div>

        {/* Center: View Tabs */}
        <div className="flex items-center gap-0.5 p-1 bg-muted/30 border border-border rounded-lg overflow-x-auto max-w-full custom-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab("sync-folders")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "sync-folders"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            title="Đồng bộ tên thư mục con"
          >
            <FolderSync size={12} />
            <span className="hidden xl:inline">Đồng bộ tên thư mục con</span>
            <span className="xl:hidden">Đồng bộ</span>
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "batch"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            title="Thực thi Batch"
          >
            <Play size={12} />
            <span className="hidden md:inline">Thực thi Batch</span>
            <span className="md:hidden">Batch</span>
          </button>
          <button
            onClick={() => setActiveTab("workspace")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "workspace"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            title="Cấu hình Sheet"
          >
            <Sliders size={12} />
            <span className="hidden md:inline">Cấu hình Sheet</span>
            <span className="md:hidden">Sheet</span>
          </button>
          <button
            onClick={() => setIsDriveModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer whitespace-nowrap"
            title="Google Drive"
          >
            <HardDrive size={12} />
            <span className="hidden md:inline">Google Drive</span>
            <span className="md:hidden">Drive</span>
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "audit"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            title="Nhật ký"
          >
            <History size={12} />
            <span>Nhật ký</span>
          </button>
        </div>

        {/* Right Status Actions */}
        <div className="flex items-center gap-2">
          {/* Active Workspace Selector */}
          {profiles.length > 1 && (
            <select
              value={activeProfile?.id}
              onChange={(e) => {
                const p = profiles.find((x) => x.id === e.target.value);
                if (p) setActiveProfile(p.id);
              }}
              className="px-2.5 py-1 rounded-lg bg-background/60 border border-border text-[11px] text-muted-foreground hover:text-foreground cursor-pointer outline-none"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}

          {/* Google Auth Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
              googleConnection.status === "CONNECTED"
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                : googleConnection.status === "CONNECTING"
                ? "bg-amber-500/10 text-amber-500 border-amber-500/25"
                : "bg-muted/40 text-muted-foreground border-border"
            }`}
          >
            <Cloud size={13} className={googleConnection.status === "CONNECTED" ? "text-emerald-500" : ""} />
            <span className="truncate max-w-[140px]">
              {googleConnection.status === "CONNECTED"
                ? googleConnection.accountEmail || "Google Connected"
                : googleConnection.status === "CONNECTING"
                ? "Đang kết nối..."
                : "Chưa kết nối Google"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full max-w-full relative overflow-hidden">
        {activeTab === "sync-folders" && (
          <FolderSyncView onGoToBatch={handleGoToBatch} />
        )}
        {activeTab === "batch" && (
          <BatchRunnerView
            initialFolderPaths={pendingBatchFolderPaths}
            onClearInitialPaths={() => setPendingBatchFolderPaths(null)}
          />
        )}
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
