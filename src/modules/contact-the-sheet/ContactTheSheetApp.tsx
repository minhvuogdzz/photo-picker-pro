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

type ActiveTab = "batch" | "workspace" | "drive" | "audit";

export default function ContactTheSheetApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("batch");
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

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
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#111216] rounded-2xl border border-white/10 p-8 text-center relative overflow-hidden animate-fade-in select-none text-foreground">
        {/* Glowing Radial Effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Back Button */}
        <button
          onClick={() => setActiveModule("launcher")}
          className="absolute top-5 left-5 w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer border border-white/10 transform-gpu"
          title="Quay lại Launcher"
        >
          <ArrowLeft size={15} />
        </button>

        {/* VIP Crown Box */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/20 via-teal-500/15 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-xl shadow-amber-500/10">
          <Crown size={32} className="fill-amber-400/30 animate-pulse" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold mb-3">
          <Sparkles size={13} />
          <span>ĐẶC QUYỀN VIP STUDIO OPS</span>
        </div>

        <h2 className="text-xl font-extrabold text-foreground mb-2.5 tracking-tight">
          Contact the Sheet Dành Riêng Cho Tài Khoản VIP Premium
        </h2>

        <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
          Tính năng tự động hóa đối soát Google Sheet & Google Drive, quét thư mục và cập nhật link trả ảnh hàng loạt chỉ mở khóa cho tài khoản được cấp quyền <strong>VIP Premium</strong>.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveModule("launcher")}
            className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-semibold text-muted-foreground hover:text-foreground border border-white/10 transition-all duration-150 cursor-pointer transform-gpu"
          >
            Quay lại Launcher
          </button>

          <button
            onClick={() => setShowLicenseModal(true)}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 active:scale-[0.98] text-black font-extrabold text-xs shadow-lg shadow-amber-500/25 transition-all duration-150 flex items-center gap-2 cursor-pointer transform-gpu"
          >
            <Crown size={14} className="fill-black" />
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
    <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden bg-card/40 backdrop-blur-2xl rounded-2xl border border-border text-foreground relative select-none">
      {/* Top Header & Navigation Bar */}
      <div className="px-5 py-3 border-b border-border/80 flex items-center justify-between gap-4 bg-card/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-sm">
            <FileSpreadsheet size={18} className="drop-shadow-sm" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm tracking-tight text-foreground">
                Contact the Sheet
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wider flex items-center gap-1">
                <Crown size={10} className="fill-amber-400/30" />
                <span>VIP Studio Ops</span>
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {activeProfile
                ? `Không gian: ${activeProfile.displayName} — Tab: ${activeProfile.selectedTabTitle || "Edit 9/2026"}`
                : "Chưa cấu hình Workspace"}
            </p>
          </div>
        </div>

        {/* Center: View Tabs */}
        <div className="flex items-center gap-1 p-1 bg-background/60 backdrop-blur-md border border-border/70 rounded-xl shadow-inner">
          <button
            onClick={() => setActiveTab("batch")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "batch"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Play size={13} />
            <span>Thực thi Batch</span>
          </button>
          <button
            onClick={() => setActiveTab("workspace")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "workspace"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Sliders size={13} />
            <span>Cấu hình Sheet</span>
          </button>
          <button
            onClick={() => setIsDriveModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all cursor-pointer"
          >
            <HardDrive size={13} />
            <span>Google Drive</span>
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "audit"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <History size={13} />
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
              className="px-2.5 py-1.5 rounded-xl bg-background/60 border border-border text-xs text-muted-foreground hover:text-foreground cursor-pointer outline-none"
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium shadow-sm transition-all ${
              googleConnection.status === "CONNECTED"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : googleConnection.status === "CONNECTING"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-muted/40 text-muted-foreground border-border"
            }`}
          >
            <Cloud size={14} className={googleConnection.status === "CONNECTED" ? "text-emerald-400" : ""} />
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
