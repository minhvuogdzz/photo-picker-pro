import { useState, useEffect, useRef } from "react";
import { useAvailabilityStore } from "@/core/stores/useAvailabilityStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { availabilityService } from "@/core/services/availabilityService";
import { canSessionWorkOffline } from "@/core/services/authApi";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Server,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface MaintenanceScreenProps {
  readonly onContinueOffline?: () => void;
}

export function MaintenanceScreen({ onContinueOffline }: MaintenanceScreenProps) {
  const state = useAvailabilityStore((s) => s.state);
  const info = useAvailabilityStore((s) => s.maintenanceInfo);
  const nextRetryCountdown = useAvailabilityStore((s) => s.nextRetryCountdown);
  const isManualChecking = useAvailabilityStore((s) => s.isManualChecking);
  const setOfflineBypass = useAvailabilityStore((s) => s.setOfflineBypass);
  const session = useAuthStore((s) => s.session);

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [canWorkOffline, setCanWorkOffline] = useState<boolean>(false);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Rigorously verify offline licensing: active status, future expiry, and 7-day grace period
  useEffect(() => {
    let isMounted = true;
    canSessionWorkOffline(session).then((permitted) => {
      if (isMounted) {
        setCanWorkOffline(permitted);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [session]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const handleRetry = async () => {
    setFeedbackMessage(null);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);

    const triggered = await availabilityService.manualRetry();
    if (!triggered) {
      setFeedbackMessage("Vui lòng đợi vài giây trước khi thử lại...");
      feedbackTimerRef.current = setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  const handleContinueOffline = () => {
    setOfflineBypass(true);
    if (onContinueOffline) {
      onContinueOffline();
    }
  };

  const handleOpenSupport = async () => {
    const url = info?.supportUrl || "https://mvd.vn";
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  const title = info?.title || "Phần mềm đang được bảo trì";
  const message =
    info?.message ||
    "Hệ thống đang được nâng cấp máy chủ để hoạt động ổn định và mượt mà hơn. Các tính năng trực tuyến sẽ sớm quay trở lại. Dữ liệu và tài khoản của bạn vẫn được bảo toàn.";

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl text-white select-none animate-fade-in p-6">
      {/* Subtle radial ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      {/* Main card panel */}
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-2xl text-center space-y-6 animate-scale-in">
        {/* Brand & Status Icon */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          {/* Pulsing halo */}
          <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping opacity-75" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 border border-white/20">
            <Server className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Header content */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Thông báo hệ thống</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
            {message}
          </p>
        </div>

        {/* Assurances badge container */}
        <div className="grid grid-cols-2 gap-3 py-1 text-left">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.04] border border-white/5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-slate-200 block">
                Dữ liệu an toàn
              </span>
              <span className="text-slate-400">Không cần đăng nhập lại</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.04] border border-white/5">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-slate-200 block">
                Bản quyền lưu giữ
              </span>
              <span className="text-slate-400">Tự động kết nối lại</span>
            </div>
          </div>
        </div>

        {/* Dynamic status & countdown indicator */}
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>
              {isManualChecking
                ? "Đang kiểm tra máy chủ..."
                : "Tự động kiểm tra lại kết nối..."}
            </span>
          </div>
          {nextRetryCountdown > 0 && !isManualChecking && (
            <div className="flex items-center gap-1 font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{nextRetryCountdown}s</span>
            </div>
          )}
        </div>

        {feedbackMessage && (
          <p className="text-xs text-amber-400 animate-fade-in">
            {feedbackMessage}
          </p>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={handleRetry}
            disabled={isManualChecking}
            className="w-full h-11 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`w-4 h-4 ${isManualChecking ? "animate-spin" : ""}`}
            />
            <span>{isManualChecking ? "Đang kết nối..." : "Thử lại ngay"}</span>
          </button>

          {canWorkOffline && (
            <button
              onClick={handleContinueOffline}
              className="w-full h-11 px-4 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Tiếp tục làm việc ngoại tuyến</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          )}

          <button
            onClick={handleOpenSupport}
            className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Liên hệ hỗ trợ kỹ thuật</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
