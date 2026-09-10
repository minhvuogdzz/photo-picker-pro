import React, { useState } from "react";
import { HardDrive, X, Folder, Check, AlertCircle, Shield } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useContactSheetStore } from "../stores/useContactSheetStore";

interface Props {
  onClose: () => void;
}

export function DriveConfigModal({ onClose }: Props) {
  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const saveProfile = useContactSheetStore((s) => s.saveProfile);
  const lastDriveConfig = useContactSheetStore((s) => s.lastDriveConfig);
  const setLastDriveConfig = useContactSheetStore((s) => s.setLastDriveConfig);

  const [localRoot, setLocalRoot] = useState(
    lastDriveConfig?.localRootPath ||
      activeProfile?.driveConfig?.localRootPath ||
      "/Users/vuongdev/Library/CloudStorage/GoogleDrive-ougn.it2@gmail.com/My Drive"
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

  const handlePickLocalRoot = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Chọn thư mục gốc Google Drive Desktop (My Drive hoặc Shared Drive)",
      });
      if (selected && typeof selected === "string") {
        setLocalRoot(selected);
      }
    } catch (err) {
      console.error("Open folder dialog error:", err);
    }
  };

  const handleSave = () => {
    const updatedDriveConfig = {
      localRootPath: localRoot.trim(),
      remoteRootDriveId: remoteRootId.trim() || "root",
      sharingPolicy,
      sharingAutomationEnabled: false,
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
      <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
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
        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* Local Root Path */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-foreground flex items-center justify-between">
              <span>Thư mục gốc Google Drive trên máy (Local Root):</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localRoot}
                onChange={(e) => setLocalRoot(e.target.value)}
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
              Ví dụ: Thư mục "My Drive" hoặc "Drive dùng chung" trong ứng dụng Google Drive Desktop.
            </span>
          </div>

          {/* Remote Root ID */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-foreground">
              Remote Drive Folder ID (Tùy chọn):
            </label>
            <input
              type="text"
              value={remoteRootId}
              onChange={(e) => setRemoteRootId(e.target.value)}
              placeholder="root (hoặc ID thư mục Drive tương ứng)"
              className="px-3 py-2 bg-background border border-border rounded-xl text-foreground font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-[11px] text-muted-foreground">
              Mặc định để "root" nếu ánh xạ toàn bộ Drive cá nhân.
            </span>
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
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-muted/20">
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
