import { useAuthStore } from "@/stores/useAuthStore";
import { logout } from "@/services/authApi";
import { useTranslation } from "@/lib/i18n";
import { AlertTriangle, LogIn, MonitorX, WifiOff, XCircle } from "lucide-react";

interface SessionExpiredDialogProps {
  readonly reason: "device" | "subscription" | "offline" | "error";
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
  const setOfflineGracePeriodExpired = useAuthStore((s) => s.setOfflineGracePeriodExpired);
  const { t } = useTranslation();

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
  }[reason];

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
        <button
          onClick={handleLoginAgain}
          className="btn-primary w-full py-3 text-sm font-bold"
        >
          <LogIn size={16} />
          {t("login_again")}
        </button>
      </div>
    </div>
  );
}
