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
  Crown,
} from "lucide-react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useAppStore } from "@/core/stores/useAppStore";
import { LicenseManager } from "@/core/license/LicenseManager";
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
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const handleGoToBatch = (paths?: string[]) => {
    if (paths && paths.length > 0) {
      setPendingBatchFolderPaths(paths);
    }
    setActiveTab("batch");
  };

  const session = useAuthStore((s) => s.session);
  const setActiveModule = useAppStore((s) => s.setActiveModule);

  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const profiles = useContactSheetStore((s) => s.profiles);
  const setActiveProfile = useContactSheetStore((s) => s.setActiveProfile);
  const googleConnection = useContactSheetStore((s) => s.googleConnection);

  const isPremium = session?.subscription?.isPremium === true;

  // VIP Premium Gatekeeper Screen
  if (!isPremium) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-card/90 backdrop-blur-md rounded-xl border border-border p-8 text-center relative overflow-hidden animate-fade-in select-none text-foreground">
        
        {/* Back Button */}
        <button
          onClick={() => setActiveModule("launcher")}
          className="absolute top-4 left-4 w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border"
          title="Quay lại Launcher"
        >
          <ArrowLeft size={14} />
        </button>

        {/* VIP Crown Box */}
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-3">
          <Crown size={22} />
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-semibold mb-2.5">
          <Sparkles size={11} />
          <span>ĐẶC QUYỀN VIP STUDIO OPS</span>
        </div>

        <h2 className="text-base font-semibold text-foreground mb-1.5 tracking-tight">
          Contact the Sheet Dành Riêng Cho Tài Khoản VIP Premium
        </h2>

        <p className="text-xs text-muted-foreground max-w-md mb-5 leading-relaxed">
          Tính năng tự động hóa đối soát Google Sheet & Google Drive, quét thư mục và cập nhật link trả ảnh hàng loạt chỉ mở khóa cho tài khoản được cấp quyền <strong>VIP Premium</strong>.
        </p>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveModule("launcher")}
            className="h-9 px-3.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground border border-border transition-colors cursor-pointer"
          >
            Quay lại Launcher
          </button>

          <button
            onClick={() => setShowLicenseModal(true)}
            className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Crown size={13} />
            <span>Đổi quyền lợi / Đăng ký Premium</span>
          </button>
        </div>

        {showLicenseModal && (
          <LicenseManager
            onClose={() => setShowLicenseModal(false)}
            initialMode="request"
            initialIsPremium={true}
            variant="modal"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden bg-card/90 backdrop-blur-md rounded-xl border border-border text-foreground relative select-none">
      {/* Top Header & Navigation Bar */}
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <FileSpreadsheet size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-xs tracking-tight text-foreground">
                Contact the Sheet
              </h1>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-wider flex items-center gap-1">
                <Crown size={9} />
                <span>VIP Studio Ops</span>
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {activeProfile
                ? `Không gian: ${activeProfile.displayName} — Tab: ${activeProfile.selectedTabTitle || "Edit 9/2026"}`
                : "Chưa cấu hình Workspace"}
            </p>
          </div>
        </div>

        {/* Center: View Tabs */}
        <div className="flex items-center gap-0.5 p-1 bg-muted/30 border border-border rounded-lg overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab("sync-folders")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "sync-folders"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <FolderSync size={12} />
            <span>Đồng bộ tên thư mục con</span>
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "batch"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Play size={12} />
            <span>Thực thi Batch</span>
          </button>
          <button
            onClick={() => setActiveTab("workspace")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === "workspace"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Sliders size={12} />
            <span>Cấu hình Sheet</span>
          </button>
          <button
            onClick={() => setIsDriveModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <HardDrive size={12} />
            <span>Google Drive</span>
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              activeTab === "audit"
                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
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
