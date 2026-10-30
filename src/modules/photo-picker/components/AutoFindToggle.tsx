import React, { useState } from "react";
import { Zap, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAppStore } from "@/core/stores/useAppStore";
import { autoFindService } from "../services/autoFindService";

export function AutoFindToggle() {
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
            message: `Đã nạp ${res.codeCount} mã cho ${res.customerName || res.folderName}`,
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer shadow-2xs group ${
          autoFindEnabled
            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
            : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/70"
        }`}
        title="Bật/Tắt Auto Find: Tự động nạp mã khách từ Google Sheet và chuyển khách tiếp theo khi lọc xong"
      >
        {isAutoFinding ? (
          <Loader2 size={12} className="text-emerald-600 dark:text-emerald-400 animate-spin shrink-0" />
        ) : (
          <Zap
            size={12}
            className={`transition-transform shrink-0 ${
              autoFindEnabled
                ? "text-emerald-600 dark:text-emerald-400 fill-emerald-500/40 scale-110 animate-pulse"
                : "text-muted-foreground group-hover:scale-105"
            }`}
          />
        )}
        <span className="tracking-tight">Auto Find</span>

        {/* Small Modern Switch Indicator */}
        <div
          className={`w-5 h-2.5 rounded-full transition-colors relative flex items-center shrink-0 ${
            autoFindEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full bg-white shadow-xs transition-transform ${
              autoFindEnabled ? "translate-x-2.5" : "translate-x-0.5"
            }`}
          />
        </div>
      </button>

      {/* Floating Status Notification Pill */}
      {notification && (
        <div
          className={`absolute left-0 top-full mt-1.5 z-40 whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-medium shadow-md border animate-fade-in flex items-center gap-1.5 backdrop-blur-md ${
            notification.type === "success"
              ? "bg-card/95 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              : "bg-card/95 text-amber-600 dark:text-amber-400 border-amber-500/30"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 size={11} className="shrink-0 text-emerald-500" />
          ) : (
            <AlertCircle size={11} className="shrink-0 text-amber-500" />
          )}
          <span>{notification.message}</span>
        </div>
      )}
    </div>
  );
}
