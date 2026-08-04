import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { logout } from "@/core/services/authApi";
import { useTranslation } from "@/core/lib/i18n";
import { AlertTriangle, LogIn, MonitorX, WifiOff, XCircle } from "lucide-react";

interface SessionExpiredDialogProps {
  readonly reason: "device" | "subscription" | "offline" | "error" | "suspended";
  readonly errorMessage?: string;
}

/**
 * Full-screen dialog shown when the user's session is invalid.
 * Covers cases: kicked by another device, subscription expired,
 * offline too long, or initialization error.
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
  };

  const handleChangePassword = async () => {
    await handleLoginAgain();
    // Use a hash router or set a state to open forgot password on login screen
    window.location.hash = "forgot-password";
  };

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
  }[reason];

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
        className="btn-primary w-full py-3 text-sm font-bold"
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
