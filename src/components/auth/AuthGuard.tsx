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
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/useAppStore";
import { exit } from '@tauri-apps/api/process';

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
      <Dialog open={!!copyrightWarningMessage} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" hideCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Cảnh báo bản quyền
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-foreground/80">{copyrightWarningMessage}</p>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => window.open('https://mvd-photoshop.com/terms', '_blank')}>
              Tìm hiểu thêm
            </Button>
            <Button variant="destructive" onClick={async () => {
              try {
                await exit(0);
              } catch {
                window.close();
              }
            }}>
              Thoát ứng dụng (Quit)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expiring Soon Warning Dialog (Dismissable) */}
      <Dialog open={!!expiringSoonMessage} onOpenChange={(open) => !open && setExpiringSoonMessage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <Info className="h-5 w-5" />
              Thông báo gia hạn
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-foreground/80">{expiringSoonMessage}</p>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setExpiringSoonMessage(null)}>
              Đóng
            </Button>
            <Button variant="default" onClick={() => {
              setExpiringSoonMessage(null);
              setActiveTab('settings');
            }}>
              Đổi quyền lợi (Nhập Key)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
