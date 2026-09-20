import React from "react";
import { useSessionTimeout } from "@/core/hooks/useSessionTimeout";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { logout } from "@/core/services/authApi";
import { AlertTriangle, Clock, LogIn, X } from "lucide-react";

/**
 * Modal shown when 30 seconds or less remain in the active working session.
 * Gives the user immediate notice to save work or renew their session.
 */
export function SessionExpiringWarningModal() {
  const { remainingSeconds, isWarning30s, hasDismissed30sWarning, dismiss30sWarning } = useSessionTimeout();
  const session = useAuthStore((s) => s.session);
  const authLogout = useAuthStore((s) => s.logout);
  const setSessionTimeoutExpired = useAuthStore((s) => s.setSessionTimeoutExpired);

  if (!isWarning30s || hasDismissed30sWarning || !session) {
    return null;
  }

  const handleLogoutAndRenew = async () => {
    try {
      sessionStorage.removeItem("session_started_at");
    } catch {}
    try {
      await logout(session?.accessToken);
    } catch {}
    authLogout();
    setSessionTimeoutExpired(true);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-md panel p-6 md:p-8 space-y-6 text-center border-2 border-amber-500/60 shadow-[0_0_50px_-10px_rgba(245,158,11,0.35)] rounded-2xl bg-[#14161b] animate-scale-in">
        {/* Close / Dismiss button */}
        <button
          onClick={dismiss30sWarning}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          title="Đóng thông báo"
        >
          <X size={18} />
        </button>

        {/* Warning Icon with pulsating ring */}
        <div className="relative flex justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.3)] animate-pulse">
            <AlertTriangle size={32} />
          </div>
        </div>

        {/* Header & Big Countdown */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Clock size={12} />
            Cảnh báo phiên làm việc
          </div>
          <h2 className="text-xl font-extrabold text-foreground">
            Phiên sắp hết hạn trong
          </h2>
          <div className="text-4xl font-mono font-black text-amber-400 drop-shadow-sm tracking-tight pt-1">
            {remainingSeconds.toString().padStart(2, "0")}<span className="text-lg font-sans font-medium text-amber-400/80 ml-1">giây</span>
          </div>
        </div>

        {/* Message */}
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed px-2">
          Phiên làm việc của bạn sắp chạm giới hạn thời gian. Hệ thống sẽ tự động đăng xuất khi hết giờ để làm mới phiên. Vui lòng lưu các thao tác dang dở!
        </p>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={dismiss30sWarning}
            className="btn-outline flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl border-border/80 hover:bg-white/10 transition-colors"
          >
            Đã hiểu ({remainingSeconds}s)
          </button>
          <button
            onClick={handleLogoutAndRenew}
            className="flex-1 py-3 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn size={15} />
            Làm mới phiên ngay
          </button>
        </div>
      </div>
    </div>
  );
}
