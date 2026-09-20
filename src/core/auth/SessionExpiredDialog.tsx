import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { logout } from "@/core/services/authApi";
import { useTranslation } from "@/core/lib/i18n";
import { useSessionTimeout } from "@/core/hooks/useSessionTimeout";
import { AlertTriangle, Clock, LogIn, MonitorX, ShieldCheck, Sparkles, WifiOff, XCircle } from "lucide-react";

interface SessionExpiredDialogProps {
  readonly reason: "device" | "subscription" | "offline" | "error" | "suspended" | "timeout";
  readonly errorMessage?: string;
}

/**
 * Full-screen dialog shown when the user's session is invalid or timeout reached.
 * Features a high-end Glassmorphic UI for session timeout auto-logout.
 */
export function SessionExpiredDialog({
  reason,
  errorMessage,
}: SessionExpiredDialogProps) {
  const authLogout = useAuthStore((s) => s.logout);
  const session = useAuthStore((s) => s.session);
  const setSessionExpiredByOtherDevice = useAuthStore((s) => s.setSessionExpiredByOtherDevice);
  const setSubscriptionExpired = useAuthStore((s) => s.setSubscriptionExpired);
  const setAccountSuspended = useAuthStore((s) => s.setAccountSuspended);
  const setOfflineGracePeriodExpired = useAuthStore((s) => s.setOfflineGracePeriodExpired);
  const setSessionTimeoutExpired = useAuthStore((s) => s.setSessionTimeoutExpired);
  const { totalDurationMinutes } = useSessionTimeout();
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (reason === 'suspended' || reason === 'subscription') {
      const timer = setInterval(() => {
        setCountdown((prev: number) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleLoginAgain();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [reason]);

  const handleLoginAgain = async () => {
    try {
      await logout(session?.accessToken);
    } catch {
      // Best effort
    }
    authLogout();
    setSessionExpiredByOtherDevice(false);
    setSubscriptionExpired(false);
    setOfflineGracePeriodExpired(false);
    setAccountSuspended(false);
    setSessionTimeoutExpired(false);
    try {
      sessionStorage.removeItem("session_started_at");
    } catch {}
  };

  const handleChangePassword = async () => {
    await handleLoginAgain();
    window.location.hash = "forgot-password";
  };

  // Dedicated Ultra-Premium Glassmorphism view for Session Timeout
  if (reason === "timeout") {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center bg-[#0d0f14] overflow-hidden p-4 select-none">
        {/* Ambient background glow effects */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-amber-500/10 to-orange-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Card Container */}
        <div className="relative z-10 w-full max-w-md rounded-3xl p-8 sm:p-10 border border-amber-500/30 bg-[#151821]/90 backdrop-blur-2xl shadow-[0_20px_70px_-15px_rgba(245,158,11,0.25)] text-center space-y-7 animate-scale-in">
          {/* Glowing Circular Clock Icon Badge */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.35)]">
                <Clock size={42} className="animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md">
                <ShieldCheck size={14} />
              </div>
            </div>
          </div>

          {/* Header Info */}
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-extrabold uppercase tracking-widest">
              <Sparkles size={12} />
              Bảo vệ phiên làm việc
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Hết Thời Gian Phiên
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed px-1">
              Phiên làm việc đã kết thúc sau <span className="font-bold text-amber-400">{totalDurationMinutes || 10} phút</span> làm việc liên tục. Hệ thống đã tự động lưu trạng thái và bảo vệ tài khoản an toàn.
            </p>
          </div>

          {/* Session Overview Mini Grid */}
          <div className="grid grid-cols-2 gap-2.5 py-1">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-border/50 text-left">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Thời lượng phiên
              </span>
              <span className="text-sm font-mono font-black text-foreground mt-0.5 block">
                {totalDurationMinutes || 10} phút
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-border/50 text-left">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Trạng thái phiên
              </span>
              <span className="text-sm font-bold text-emerald-400 mt-0.5 block flex items-center gap-1">
                <ShieldCheck size={14} /> Đã làm mới
              </span>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="space-y-3 pt-1">
            <button
              onClick={handleLoginAgain}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:via-orange-400 hover:to-amber-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <LogIn size={18} />
              Đăng nhập lại ngay
            </button>
            <p className="text-[11px] text-muted-foreground/80">
              Thông tin đăng nhập đã được ghi nhớ sẵn để bạn tiếp tục phiên mới.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Standard dialog for other reasons
  const config = {
    device: {
      icon: <MonitorX size={40} className="text-warning" />,
      title: t("session_expired_device_title"),
      description: t("session_expired_device_desc"),
    },
    subscription: {
      icon: <XCircle size={40} className="text-destructive" />,
      title: t("subscription_expired_title"),
      description: t("subscription_expired_desc"),
    },
    offline: {
      icon: <WifiOff size={40} className="text-info" />,
      title: t("offline_expired_title"),
      description: t("offline_expired_desc"),
    },
    error: {
      icon: <AlertTriangle size={40} className="text-warning" />,
      title: "Lỗi khởi tạo",
      description: errorMessage || "Đã xảy ra lỗi không mong muốn.",
    },
    suspended: {
      icon: <XCircle size={40} className="text-destructive" />,
      title: "Tài khoản bị khoá",
      description: "Tài khoản của bạn đã bị khoá.",
    },
  }[reason as "device" | "subscription" | "offline" | "error" | "suspended"];

  const renderButtons = () => {
    if (reason === "device") {
      return (
        <div className="flex gap-2 w-full">
          <button
            onClick={handleChangePassword}
            className="btn-outline flex-1 py-3 text-sm font-bold"
          >
            Đổi mật khẩu
          </button>
          <button
            onClick={handleLoginAgain}
            className="btn-primary flex-1 py-3 text-sm font-bold"
          >
            Để sau
          </button>
        </div>
      );
    }
    
    if (reason === "suspended" || reason === "subscription") {
      return (
        <div className="text-sm font-bold text-muted-foreground w-full py-3 text-center">
          Tự động rời đi sau {countdown}s...
        </div>
      );
    }

    return (
      <button
        onClick={handleLoginAgain}
        className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2"
      >
        <LogIn size={16} />
        {t("login_again")}
      </button>
    );
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background p-4">
      <div className="panel w-full max-w-sm p-8 space-y-6 text-center animate-fade-in">
        <div className="flex justify-center">{config.icon}</div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">{config.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {config.description}
          </p>
        </div>
        {renderButtons()}
      </div>
    </div>
  );
}
