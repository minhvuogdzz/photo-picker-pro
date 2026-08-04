import { useEffect, useCallback, useState } from "react";
import { useAuthStore } from "@/core/stores/useAuthStore";
import {
  loadSession,
  validateSubscription,
  checkOfflinePeriod,
  isSubscriptionActive,
} from "@/core/services/authApi";
import { isOnline } from "@/core/services/apiClient";
import { LoginPage } from "@/core/pages/LoginPage";
import { SessionExpiredDialog } from "./SessionExpiredDialog";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { useAppStore } from "@/core/stores/useAppStore";
import { exit } from '@tauri-apps/plugin-process';

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
  const copyrightWarningMessage = useAuthStore((s) => s.copyrightWarningMessage);
  const expiringSoonMessage = useAuthStore((s) => s.expiringSoonMessage);
  const setExpiringSoonMessage = useAuthStore((s) => s.setExpiringSoonMessage);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

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

  // Subscription expired (Do not block entirely, AppLayout handles UI disabling)
  // if (subscriptionExpired) {
  //   return <SessionExpiredDialog reason="subscription" />;
  // }

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
  return (
    <>
      {children}
      
      {/* Copyright/Crack Warning Dialog (Blocking) */}
      {!!copyrightWarningMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="panel w-full max-w-sm p-8 space-y-6 text-center animate-scale-in">
            <div className="flex justify-center">
              <AlertTriangle size={40} className="text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">Cảnh báo bản quyền</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {copyrightWarningMessage}
              </p>
            </div>
            <div className="flex gap-2 w-full pt-2">
              <button
                onClick={() => window.open('https://mvd-photoshop.com/terms', '_blank')}
                className="btn-outline flex-1 py-3 text-sm font-bold"
              >
                Tìm hiểu thêm
              </button>
              <button
                onClick={async () => {
                  try {
                    await exit(0);
                  } catch {
                    window.close();
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl flex-1 py-3 text-sm font-bold transition-colors"
              >
                Thoát (Quit)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expiring Soon Warning Dialog (Dismissable) */}
      {!!expiringSoonMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="panel w-full max-w-sm p-8 space-y-6 text-center animate-scale-in">
            <div className="flex justify-center">
              <Info size={40} className="text-warning" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">Thông báo gia hạn</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {expiringSoonMessage}
              </p>
            </div>
            <div className="flex gap-2 w-full pt-2">
              <button
                onClick={() => setExpiringSoonMessage(null)}
                className="btn-outline flex-1 py-3 text-sm font-bold"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setExpiringSoonMessage(null);
                  setActiveTab('settings');
                }}
                className="btn-primary flex-1 py-3 text-sm font-bold"
              >
                Đổi quyền lợi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
