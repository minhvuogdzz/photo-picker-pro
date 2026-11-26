import React, { useState } from "react";
import { Zap, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAppStore } from "@/core/stores/useAppStore";
import { autoFindService } from "../services/autoFindService";
import { useTranslation } from "@/core/lib/i18n";

export function AutoFindToggle() {
  const { tr } = useTranslation();
  const pickerMode = useAppStore((s) => s.pickerMode);
  const autoFindEnabled = useAppStore((s) => s.autoFindEnabled);
  const setAutoFindEnabled = useAppStore((s) => s.setAutoFindEnabled);
  const isAutoFinding = useAppStore((s) => s.isAutoFinding);
  const rawCodeInput = useAppStore((s) => s.rawCodeInput);
  const selectedInputFolders = useAppStore((s) => s.selectedInputFolders);
  const inputFolders = useAppStore((s) => s.inputFolders);

  const [notification, setNotification] = useState<{
    type: "success" | "warn";
    message: string;
  } | null>(null);

  // Auto Find is only available in multi-customer batch queue mode
  if (pickerMode !== "multi") return null;

  const handleToggle = async () => {
    const nextState = !autoFindEnabled;
    setAutoFindEnabled(nextState);

    if (nextState) {
      // If toggled ON, automatically extract codes for the first/active customer immediately
      const activeFolder = selectedInputFolders[0] || inputFolders[0];
      if (activeFolder) {
        const res = await autoFindService.fetchAndApplyCodesForCustomer(activeFolder);
        if (res.success) {
          setNotification({
            type: "success",
            message: tr(
              `Đã nạp ${res.codeCount} mã cho ${res.customerName || res.folderName}`,
              `Loaded ${res.codeCount} code(s) for ${res.customerName || res.folderName}`
            ),
          });
          setTimeout(() => setNotification(null), 3500);
        } else if (res.reason) {
          setNotification({
            type: "warn",
            message: res.reason,
          });
          setTimeout(() => setNotification(null), 4500);
        }
      }
    }
  };

  return (
    <div className="relative inline-flex items-center gap-2 select-none">
      {/* Auto Find Toggle Switch */}
      <button
        type="button"
        role="switch"
        aria-checked={autoFindEnabled}
        onClick={handleToggle}
        className={`inline-flex items-center gap-2 h-7 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 border border-border bg-foreground/[0.03] hover:bg-foreground/[0.07] ${
          autoFindEnabled ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
        title={tr(
          "Bật/Tắt Auto Find: Tự động nạp mã khách từ Google Sheet và chuyển khách tiếp theo khi lọc xong",
          "Toggle Auto Find: Automatically load customer codes from Google Sheet and advance after culling"
        )}
      >
        {isAutoFinding ? (
          <Loader2 size={13} className="text-muted-foreground animate-spin shrink-0" />
        ) : (
          <Zap
            size={13}
            strokeWidth={1.75}
            className={`transition-colors shrink-0 ${
              autoFindEnabled ? "text-primary" : "text-muted-foreground"
            }`}
          />
        )}
        <span className="tracking-tight">Auto Find</span>

        {/* Small Modern Switch Indicator */}
        <div
          className={`w-7 h-4 rounded-full transition-colors relative flex items-center shrink-0 ${
            autoFindEnabled ? "bg-primary" : "bg-foreground/20"
          }`}
        >
          <div
            className={`w-3 h-3 rounded-full bg-white shadow-xs transition-transform ${
              autoFindEnabled ? "translate-x-3.5" : "translate-x-0.5"
            }`}
          />
        </div>
      </button>

      {/* Floating Status Notification Pill */}
      {notification && (
        <div
          className={`absolute right-0 top-full mt-1.5 z-40 whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-medium shadow-md border animate-fade-in flex items-center gap-1.5 backdrop-blur-md ${
            notification.type === "success"
              ? "bg-card/95 text-success border-success/30"
              : "bg-card/95 text-warning border-warning/30"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={12} className="shrink-0 text-success" />
          ) : (
            <AlertCircle size={12} className="shrink-0 text-warning" />
          )}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
}
