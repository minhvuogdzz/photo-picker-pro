import { useEffect, useCallback, useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  loadSession,
  validateSubscription,
  checkOfflinePeriod,
  isSubscriptionActive,
} from "@/services/authApi";
import { isOnline } from "@/services/apiClient";
import { LoginPage } from "@/pages/LoginPage";
import { SessionExpiredDialog } from "./SessionExpiredDialog";
import { Loader2 } from "lucide-react";

interface AuthGuardProps {
  readonly children: React.ReactNode;
}

/**
 * Wraps the entire app. Handles:
 * - Initial session loading from disk
 * - Online/offline subscription validation
 * - Rendering LoginPage when not authenticated
 * - Showing SessionExpiredDialog when kicked by another device
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const sessionExpiredByOtherDevice = useAuthStore((s) => s.sessionExpiredByOtherDevice);
  const subscriptionExpired = useAuthStore((s) => s.subscriptionExpired);
  const offlineGracePeriodExpired = useAuthStore((s) => s.offlineGracePeriodExpired);
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setOffline = useAuthStore((s) => s.setOffline);
  const setSubscriptionExpired = useAuthStore((s) => s.setSubscriptionExpired);
  const setOfflineGracePeriodExpired = useAuthStore((s) => s.setOfflineGracePeriodExpired);

  const [initError, setInitError] = useState<string | null>(null);

  /** Initial session load + validation on mount */
  const initializeAuth = useCallback(async () => {
    try {
      const savedSession = await loadSession();
      if (!savedSession) {
        setLoading(false);
        return;
      }

      const online = isOnline();
      setOffline(!online);

      if (online) {
        // Online: validate subscription with server
        try {
          const updated = await validateSubscription(savedSession);
          if (!isSubscriptionActive(updated.subscription.status)) {
            setSubscriptionExpired(true);
            setLoading(false);
            return;
          }
          setSession(updated);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message === "SESSION_EXPIRED") {
            setLoading(false);
            return;
          }
          // Server unreachable — fallback to offline mode
          setOffline(true);
          if (isSubscriptionActive(savedSession.subscription.status)) {
            setSession(savedSession);
          }
        }
      } else {
        // Offline: check 7-day grace period
        const offlineValid = await checkOfflinePeriod(savedSession.lastSyncAt);
        if (!offlineValid) {
          setOfflineGracePeriodExpired(true);
          setLoading(false);
          return;
        }
        if (isSubscriptionActive(savedSession.subscription.status)) {
          setSession(savedSession);
        } else {
          setSubscriptionExpired(true);
        }
      }
    } catch (err) {
      console.error("Auth init failed:", err);
      setInitError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [setSession, setLoading, setOffline, setSubscriptionExpired, setOfflineGracePeriodExpired]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const accountSuspended = useAuthStore((s) => s.accountSuspended);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Loader2 size={32} className="text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Session expired by another device
  if (sessionExpiredByOtherDevice) {
    return <SessionExpiredDialog reason="device" />;
  }

  // Account suspended
  if (accountSuspended) {
    return <SessionExpiredDialog reason="suspended" />;
  }

  // Subscription expired
  if (subscriptionExpired) {
    return <SessionExpiredDialog reason="subscription" />;
  }

  // Offline grace period expired
  if (offlineGracePeriodExpired) {
    return <SessionExpiredDialog reason="offline" />;
  }

  // Init error
  if (initError) {
    return <SessionExpiredDialog reason="error" errorMessage={initError} />;
  }

  // Not authenticated → show login
  if (!session) {
    return <LoginPage />;
  }

  // Authenticated → render app
  return <>{children}</>;
}
