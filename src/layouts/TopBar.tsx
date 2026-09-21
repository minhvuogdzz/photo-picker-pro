import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useTranslation } from "@/core/lib/i18n";
import { logout } from "@/core/services/authApi";
import { SubscriptionBadge } from "@/core/auth/SubscriptionBadge";
import {
  Camera,
  Settings,
  Clock,
  LogOut,
  User,
  Key,
  Menu,
  ArrowLeft,
  Shield,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useUpdaterStore } from "@/core/stores/useUpdaterStore";
import { LicenseManager } from "@/core/license/LicenseManager";
import { AccountSecurityModal } from "@/core/components/AccountSecurityModal";
import { SmartSearchBar } from "./SmartSearchBar";
import { useSessionTimeout } from "@/core/hooks/useSessionTimeout";
import type { MainTab } from "@/core/types";

export function TopBar() {
  const updateResult = useUpdaterStore((s) => s.updateResult);
  const openModal = useUpdaterStore((s) => s.openModal);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const setLastClickPos = useAppStore((s) => s.setLastClickPos);
  const session = useAuthStore((s) => s.session);
  const authLogout = useAuthStore((s) => s.logout);
  const { formattedTime, isExpiringSoon, isUnlimited } = useSessionTimeout();
  const { t } = useTranslation();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLicenseManager, setShowLicenseManager] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const activeModule = useAppStore((s) => s.activeModule);

  let tabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [];

  if (activeModule === "photo-picker") {
    tabs = [
      { id: "home", label: t("home"), icon: <Camera size={13} /> },
      { id: "history", label: t("history"), icon: <Clock size={13} /> },
      { id: "settings", label: t("settings"), icon: <Settings size={13} /> },
    ];
  }

  const handleLogout = async () => {
    setShowUserMenu(false);
    try {
      await logout(session?.accessToken);
    } catch {
      // Best effort
    }
    authLogout();
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      {/* Left: Logo + Brand + Back Button */}
      <div className="flex items-center gap-2">
        {activeModule !== "launcher" && (
          <button 
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer border border-transparent hover:border-border"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setLastClickPos({ 
                x: rect.left + rect.width / 2, 
                y: rect.top + rect.height / 2 
              });
              setActiveModule("launcher");
            }}
            title="Quay lại Launcher"
          >
            <ArrowLeft size={14} />
          </button>
        )}
        
        <div 
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setLastClickPos({ 
              x: rect.left + rect.width / 2, 
              y: rect.top + rect.height / 2 
            });
            setActiveModule("launcher");
          }}
        >
          <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
          <h1 className="text-[11px] font-semibold tracking-wide text-foreground uppercase whitespace-nowrap">
            MVD Photoshop Academy
          </h1>
        </div>

        {/* Update badge — flat subtle */}
        {updateResult?.hasUpdate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openModal();
            }}
            className="text-[10px] py-0.5 px-2 bg-primary/10 hover:bg-primary/15 text-primary font-medium flex items-center gap-1 rounded-md cursor-pointer border border-primary/20 transition-all"
            title={`Có bản cập nhật mới v${updateResult.version}`}
          >
            <RefreshCw size={10} className="shrink-0" />
            <span>v{updateResult.version}</span>
          </button>
        )}
      </div>

      {/* Center: Smart Search Bar & Navigation Tabs */}
      <div className="flex items-center gap-2">
        {/* Smart Search Bar — Only visible on Launcher page */}
        {activeModule === "launcher" && <SmartSearchBar />}

        {/* Module Sub-tabs */}
        {(activeModule !== "launcher" && activeModule !== "system" && activeModule !== "resources") && tabs.length > 0 && (
          <nav className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-lg border border-border/50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-[11px] font-medium py-1 px-2 rounded-md flex items-center gap-1 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Right: Subscription Badge + License + User Menu + System */}
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <button
            onClick={() => setShowLicenseManager(!showLicenseManager)}
            className="text-[10px] py-1 px-2 bg-muted/50 hover:bg-muted border border-border text-foreground transition-all font-medium flex items-center gap-1 rounded-lg cursor-pointer"
          >
            <Key size={11} className="text-amber-500/80" />
            <span className="hidden md:inline">Quyền Lợi</span>
          </button>
          {showLicenseManager && (
            <LicenseManager
              onClose={() => setShowLicenseManager(false)}
              variant="dropdown"
            />
          )}
        </div>
        
        <SubscriptionBadge />

        {/* Session Status / Countdown */}
        {session && (
          (isUnlimited || session.subscription?.isPremium || session.subscription?.status === "LIFETIME") ? (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 select-none shadow-xs"
              title="Tài khoản VIP Premium: Phiên làm việc không giới hạn thời gian"
            >
              <Sparkles size={11} className="text-amber-500 shrink-0" />
              <span className="hidden sm:inline">Phiên VIP:</span>
              <span className="font-semibold">Không giới hạn</span>
            </div>
          ) : (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono border transition-all select-none ${
                isExpiringSoon
                  ? "bg-destructive/10 text-destructive border-destructive/30 font-semibold animate-pulse"
                  : "bg-muted/30 text-muted-foreground border-border/40"
              }`}
              title="Thời gian còn lại của phiên làm việc"
            >
              <Clock size={10} className={isExpiringSoon ? "text-destructive shrink-0" : "text-muted-foreground shrink-0"} />
              <span>{formattedTime}</span>
            </div>
          )
        )}

        {/* User Avatar / Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-1 px-1.5 py-1 rounded-md hover:bg-muted transition-all cursor-pointer"
          >
            <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
              <User size={11} />
            </div>
            <span className="text-[11px] font-medium text-foreground/80 max-w-[80px] truncate hidden sm:inline">
              {session?.name || "User"}
            </span>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 w-52 panel p-1.5 z-50 animate-slide-up shadow-lg border border-border rounded-xl">
                <div className="px-2.5 py-2 border-b border-border/50 mb-1">
                  <p className="text-[11px] font-semibold truncate text-foreground">{session?.name}</p>
                  <p className="text-[10px] font-mono text-primary truncate">
                    @{session?.username || session?.email.split("@")[0]}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {session?.email}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowAccountModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                >
                  <Shield size={13} className="text-primary/70" />
                  Tài khoản & Bảo mật
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLicenseManager(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                >
                  <Key size={13} className="text-amber-500/70" />
                  Đổi Quyền Lợi / Key
                </button>

                <div className="my-1 border-t border-border/40" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-destructive hover:bg-destructive/8 rounded-md transition-colors cursor-pointer"
                >
                  <LogOut size={13} />
                  {t("logout")}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Account & Security Modal */}
        <AccountSecurityModal
          isOpen={showAccountModal}
          onClose={() => setShowAccountModal(false)}
        />

        {/* System Menu */}
        <div className="relative">
          <button
            onClick={() => setActiveModule("system")}
            title="Cài đặt hệ thống"
            className={`flex items-center justify-center w-6 h-6 rounded-md hover:bg-muted transition-all cursor-pointer ${
              activeModule === "system" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Menu size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
