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
  Sparkles,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useContactSheetStore } from "../stores/useContactSheetStore";
import { driveResolverService } from "../services/driveResolverService";
import { googleCredentialManager } from "../services/googleCredentialBridge";
import type { DriveConfig } from "../types";

interface Props {
  onClose: () => void;
}

export function DriveConfigModal({ onClose }: Props) {
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
        title: "Chọn thư mục gốc Google Drive Desktop (My Drive hoặc Shared Drive)",
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
        message: "Vui lòng nhập hoặc chọn đường dẫn thư mục gốc Google Drive trên máy.",
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
        message: `Lỗi kiểm tra kết nối: ${err?.message || String(err)}`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col animate-scale-in max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
              <HardDrive size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-foreground">
                Cấu hình Google Drive Desktop
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Thiết lập thư mục gốc cục bộ để tự động ánh xạ link Drive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 flex flex-col gap-4 text-xs overflow-y-auto custom-scrollbar">
          {/* Local Root Path */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-foreground flex items-center justify-between">
              <span>Thư mục gốc Google Drive trên máy (Local Root):</span>
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
                className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handlePickLocalRoot}
                className="px-3 py-2 bg-muted/50 hover:bg-muted border border-border text-foreground font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Folder size={14} />
                <span>Chọn thư mục</span>
              </button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Ví dụ: Thư mục "My Drive" hoặc "File hoàn thiện/Vương" trong ứng dụng Google Drive Desktop.
            </span>

            {/* Shortcut Target Detection Badge */}
            {shortcutTargetMatch && (
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2 text-primary text-[11px]">
                <Sparkles size={14} className="shrink-0" />
                <span className="truncate">
                  Nhận diện lối tắt Google Drive (.shortcut-targets-by-id): ID gốc <strong>{shortcutTargetMatch[1]}</strong>
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
                className="px-3 py-1.5 bg-muted/60 hover:bg-muted border border-border text-foreground font-medium rounded-lg text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isTesting ? <Loader2 size={13} className="animate-spin text-primary" /> : <HardDrive size={13} />}
                <span>Kiểm tra nhận diện thư mục Drive</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-[11px] flex items-start gap-2.5 ${
                  testResult.success
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 border-destructive/25 text-destructive"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                )}
                <div className="flex flex-col gap-0.5 min-w-0">
                  {testResult.success ? (
                    <>
                      <span className="font-bold">
                        Đã nhận diện thành công: "{testResult.folderName}"
                      </span>
                      <span className="text-[10px] opacity-90 truncate font-mono">
                        Drive Folder ID: {testResult.folderId}
                      </span>
                      <span className="text-[10px] opacity-90">
                        Chứa {testResult.childCount ?? 0} thư mục con •{" "}
                        {testResult.isOwnerMatched
                          ? "✓ Khớp chủ sở hữu tài khoản đăng nhập"
                          : "Thư mục dùng chung / chia sẻ"}
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
            <label className="font-bold text-foreground">
              Remote Drive Folder ID (Tùy chọn):
            </label>
            <input
              type="text"
              value={remoteRootId}
              onChange={(e) => {
                setRemoteRootId(e.target.value);
                setTestResult(null);
              }}
              placeholder="root (hoặc ID thư mục Drive tương ứng)"
              className="px-3 py-2 bg-background border border-border rounded-xl text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-[11px] text-muted-foreground">
              Mặc định để "root" nếu ánh xạ toàn bộ Drive cá nhân hoặc hệ thống sẽ tự động dò từ đường dẫn cục bộ.
            </span>
          </div>

          {/* Owner Verification Option */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-foreground flex items-center gap-1.5">
              <UserCheck size={13} className="text-primary" />
              <span>Kiểm tra chủ sở hữu thư mục (Chống nhầm link ảnh gốc):</span>
            </label>
            <div className="p-3 rounded-xl bg-background/80 border border-border flex items-start gap-2.5">
              <input
                type="checkbox"
                id="require_owner_match"
                checked={requireOwnerMatch}
                onChange={(e) => setRequireOwnerMatch(e.target.checked)}
                className="mt-0.5 rounded text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="require_owner_match" className="flex flex-col gap-0.5 cursor-pointer">
                <span className="font-semibold text-foreground">
                  Ưu tiên / Giới hạn thư mục do chính tài khoản Google này tạo
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Tài khoản hiện tại:{" "}
                  <strong className="text-foreground">
                    {accountEmail || "Chưa kết nối Google"}
                  </strong>
                  . Tự động loại bỏ link ảnh gốc do thợ hoặc khách tải lên từ tài khoản khác.
                </span>
              </label>
            </div>
          </div>

          {/* Sharing Policy */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-foreground flex items-center gap-1">
              <Shield size={13} className="text-primary" />
              <span>Chính sách quyền truy cập Drive (Sharing Policy):</span>
            </label>
            <div className="p-3 rounded-xl bg-background/80 border border-border flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="drive_sharing"
                  checked={sharingPolicy === "KEEP_EXISTING"}
                  onChange={() => setSharingPolicy("KEEP_EXISTING")}
                  className="text-primary focus:ring-primary"
                />
                <span className="font-semibold text-foreground">
                  Giữ nguyên quyền hiện tại của thư mục (Mặc định / An toàn nhất)
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground pl-5">
                Không tự ý thay đổi quyền chia sẻ của khách hàng. Chỉ lấy đường dẫn Drive và điền vào bảng tính.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-muted/20 shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-semibold cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>Lưu cấu hình</span>
          </button>
        </div>
      </div>
    </div>
  );
}
