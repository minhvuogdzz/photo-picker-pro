import React, { useState } from "react";
import {
  HardDrive,
  X,
  Folder,
  Check,
  AlertCircle,
  Shield,
  UserCheck,
  Loader2,
  CheckCircle2,
  Link2,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useContactSheetStore } from "../stores/useContactSheetStore";
import { driveResolverService } from "../services/driveResolverService";
import { googleCredentialManager } from "../services/googleCredentialBridge";
import type { DriveConfig } from "../types";
import { useTranslation } from "@/core/lib/i18n";

interface Props {
  onClose: () => void;
}

export function DriveConfigModal({ onClose }: Props) {
  const { tr } = useTranslation();
  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const saveProfile = useContactSheetStore((s) => s.saveProfile);
  const lastDriveConfig = useContactSheetStore((s) => s.lastDriveConfig);
  const setLastDriveConfig = useContactSheetStore((s) => s.setLastDriveConfig);
  const googleConnection = useContactSheetStore((s) => s.googleConnection);

  const accountEmail =
    googleConnection.accountEmail ||
    googleCredentialManager.getAccountEmail() ||
    activeProfile?.googleAccountEmail ||
    "";

  const [localRoot, setLocalRoot] = useState(
    lastDriveConfig?.localRootPath ||
      activeProfile?.driveConfig?.localRootPath ||
      ""
  );
  const [remoteRootId, setRemoteRootId] = useState(
    lastDriveConfig?.remoteRootDriveId ||
      activeProfile?.driveConfig?.remoteRootDriveId ||
      "root"
  );
  const [sharingPolicy, setSharingPolicy] = useState(
    lastDriveConfig?.sharingPolicy ||
      activeProfile?.driveConfig?.sharingPolicy ||
      "KEEP_EXISTING"
  );
  const [requireOwnerMatch, setRequireOwnerMatch] = useState<boolean>(
    lastDriveConfig?.requireOwnerMatch ??
      activeProfile?.driveConfig?.requireOwnerMatch ??
      true
  );

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    folderName?: string;
    folderId?: string;
    childCount?: number;
    isOwnerMatched?: boolean;
    message?: string;
  } | null>(null);

  const shortcutTargetMatch = localRoot.match(/\.shortcut-targets-by-id\/([a-zA-Z0-9_-]+)/i);

  const handlePickLocalRoot = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: tr("Chọn thư mục gốc Google Drive Desktop (My Drive hoặc Shared Drive)", "Select Google Drive Desktop Root Folder (My Drive or Shared Drive)"),
      });
      if (selected && typeof selected === "string") {
        setLocalRoot(selected);
        setTestResult(null);
      }
    } catch (err) {
      console.error("Open folder dialog error:", err);
    }
  };

  const handleTestConnection = async () => {
    if (!localRoot.trim()) {
      setTestResult({
        success: false,
        message: tr("Vui lòng nhập hoặc chọn đường dẫn thư mục gốc Google Drive trên máy.", "Please enter or select your local Google Drive root folder path."),
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await driveResolverService.testResolveRootFolder(
        localRoot.trim(),
        remoteRootId.trim() || "root"
      );
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `${tr("Lỗi kiểm tra kết nối:", "Connection test error:")} ${err?.message || String(err)}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const updatedDriveConfig: DriveConfig = {
      localRootPath: localRoot.trim(),
      remoteRootDriveId: remoteRootId.trim() || "root",
      sharingPolicy,
      sharingAutomationEnabled: false,
      requireOwnerMatch,
    };

    setLastDriveConfig(updatedDriveConfig);

    if (activeProfile) {
      saveProfile({
        ...activeProfile,
        driveConfig: updatedDriveConfig,
        updatedAt: new Date().toISOString(),
      });
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-DriveConfigModal-1"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
    >
      <div className="bg-card border border-border/80 shadow-xl rounded-xl w-full max-w-lg overflow-hidden flex flex-col animate-scale-in max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between bg-muted/15 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-center text-foreground">
              <HardDrive size={14} />
            </div>
            <div>
              <h3 id="dlg-DriveConfigModal-1" className="font-semibold text-xs text-foreground">
                {tr("Cấu hình Google Drive Desktop", "Google Drive Desktop Config")}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {tr("Thiết lập thư mục gốc cục bộ để tự động ánh xạ link Drive", "Configure local root folder to auto-map Drive links")}
              </p>
            </div>
          </div>
          <button
            aria-label={tr("Đóng", "Close")}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto custom-scrollbar">
          {/* Local Root Path */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-foreground">
              {tr("Thư mục gốc Google Drive trên máy (Local Root)", "Local Google Drive Root Folder")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localRoot}
                onChange={(e) => {
                  setLocalRoot(e.target.value);
                  setTestResult(null);
                }}
                placeholder="/Users/username/Library/CloudStorage/GoogleDrive-user@studio.com/My Drive"
                className="flex-1 px-3 py-1.5 bg-background border border-border/70 rounded-lg text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handlePickLocalRoot}
                className="px-3 py-1.5 bg-muted/40 hover:bg-muted border border-border/60 text-foreground font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Folder size={13} />
                <span>{tr("Chọn thư mục", "Choose Folder")}</span>
              </button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {tr('Ví dụ: Thư mục "My Drive" hoặc thư mục làm việc trong Google Drive Desktop.', 'Example: "My Drive" or working directory inside Google Drive Desktop.')}
            </span>

            {shortcutTargetMatch && (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 flex items-center gap-2 text-foreground text-[11px]">
                <Link2 size={13} className="shrink-0 text-primary" />
                <span className="truncate">
                  {tr("Nhận diện lối tắt Google Drive: ID gốc", "Detected Google Drive shortcut: Target ID")} <span className="font-mono font-medium">{shortcutTargetMatch[1]}</span>
                </span>
              </div>
            )}
          </div>

          {/* Test Connection Button & Result */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !localRoot.trim()}
                className="px-3 py-1.5 bg-muted/40 hover:bg-muted border border-border/60 text-foreground font-medium rounded-lg text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <Loader2 size={12} className="animate-spin text-primary" /> : <HardDrive size={12} />}
                <span>{tr("Kiểm tra nhận diện thư mục Drive", "Test Drive Folder Detection")}</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg border text-[11px] flex items-start gap-2 ${
                  testResult.success
                    ? "bg-emerald-500/8 border-emerald-500/20 text-foreground"
                    : "bg-destructive/8 border-destructive/20 text-destructive"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col gap-0.5 min-w-0">
                  {testResult.success ? (
                    <>
                      <span className="font-medium">
                        {tr("Đã nhận diện:", "Detected:")} "{testResult.folderName}"
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate font-mono">
                        Drive Folder ID: {testResult.folderId}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {tr("Chứa", "Contains")} {testResult.childCount ?? 0} {tr("thư mục con", "subfolders")} ·{" "}
                        {testResult.isOwnerMatched
                          ? tr("Khớp chủ sở hữu tài khoản", "Matches account owner")
                          : tr("Thư mục dùng chung / chia sẻ", "Shared / external folder")}
                      </span>
                    </>
                  ) : (
                    <span>{testResult.message}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Remote Root ID */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-foreground">
              {tr("Remote Drive Folder ID (Tùy chọn)", "Remote Drive Folder ID (Optional)")}
            </label>
            <input
              type="text"
              value={remoteRootId}
              onChange={(e) => {
                setRemoteRootId(e.target.value);
                setTestResult(null);
              }}
              placeholder={tr("root (hoặc ID thư mục Drive tương ứng)", "root (or target Drive folder ID)")}
              className="px-3 py-1.5 bg-background border border-border/70 rounded-lg text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-[11px] text-muted-foreground">
              {tr('Mặc định để "root" nếu ánh xạ toàn bộ Drive cá nhân hoặc tự động dò từ đường dẫn cục bộ.', 'Leave as "root" to map your entire personal Drive or auto-detect from local path.')}
            </span>
          </div>

          {/* Owner Verification Option */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-foreground flex items-center gap-1.5">
              <UserCheck size={13} className="text-muted-foreground" />
              <span>{tr("Kiểm tra chủ sở hữu thư mục (Chống nhầm link ảnh gốc)", "Verify Folder Owner (Prevent Raw Photo Link Confusion)")}</span>
            </label>
            <div className="p-3 rounded-lg bg-background/60 border border-border/60 flex items-start gap-2.5">
              <input
                type="checkbox"
                id="require_owner_match"
                checked={requireOwnerMatch}
                onChange={(e) => setRequireOwnerMatch(e.target.checked)}
                className="mt-0.5 rounded text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="require_owner_match" className="flex flex-col gap-0.5 cursor-pointer">
                <span className="font-medium text-foreground">
                  {tr("Ưu tiên / giới hạn thư mục do chính tài khoản Google này tạo", "Prefer / restrict to folders created by this Google account")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {tr("Tài khoản hiện tại:", "Current account:")}{" "}
                  <span className="font-medium text-foreground">
                    {accountEmail || tr("Chưa kết nối Google", "Google Not Connected")}
                  </span>
                  {tr(". Tự động loại bỏ link ảnh gốc do tài khoản khác tải lên.", ". Automatically excludes original photo folders uploaded by other accounts.")}
                </span>
              </label>
            </div>
          </div>

          {/* Sharing Policy */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-foreground flex items-center gap-1.5">
              <Shield size={13} className="text-muted-foreground" />
              <span>{tr("Chính sách quyền truy cập Drive", "Drive Permission Policy")}</span>
            </label>
            <div className="p-3 rounded-lg bg-background/60 border border-border/60 flex flex-col gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="drive_sharing"
                  checked={sharingPolicy === "KEEP_EXISTING"}
                  onChange={() => setSharingPolicy("KEEP_EXISTING")}
                  className="text-primary focus:ring-primary"
                />
                <span className="font-medium text-foreground">
                  {tr("Giữ nguyên quyền hiện tại của thư mục (Mặc định)", "Keep current folder permissions (Default)")}
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground pl-5">
                {tr("Không thay đổi quyền chia sẻ của thư mục. Chỉ lấy đường dẫn Drive và điền vào bảng tính.", "Does not modify folder sharing permissions. Only resolves the Drive link to write to the sheet.")}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/60 flex items-center justify-end gap-2 bg-muted/15 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium cursor-pointer"
          >
            {tr("Hủy", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check size={13} />
            <span>{tr("Lưu cấu hình", "Save Config")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
