import { useAppStore } from "@/stores/useAppStore";
import { useAuthStore } from "@/stores/useAuthStore";
import { useTranslation } from "@/lib/i18n";
import { logout } from "@/services/authApi";
import { SubscriptionBadge } from "@/components/auth/SubscriptionBadge";
import {
  Camera,
  Settings,
  Clock,
  Info,
  LogOut,
  User,
  Key,
} from "lucide-react";
import { useState } from "react";
import { LicenseManager } from "@/components/license/LicenseManager";
import type { MainTab } from "@/types";

export function TopBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const session = useAuthStore((s) => s.session);
  const authLogout = useAuthStore((s) => s.logout);
  const { t } = useTranslation();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLicenseManager, setShowLicenseManager] = useState(false);

  const tabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: t("home"), icon: <Camera size={18} /> },
    { id: "history", label: t("history"), icon: <Clock size={18} /> },
    { id: "settings", label: t("settings"), icon: <Settings size={18} /> },
    { id: "about", label: t("about"), icon: <Info size={18} /> },
  ];

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
    <div className="flex items-center justify-between pl-8 pr-6 py-5 glass-nav border-b border-white/10 rounded-2xl">
      {/* Left: Logo + Brand */}
      <div className="flex items-center gap-2">
        <div className="flex items-center !ml-4 gap-3">
          <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain drop-shadow-md" />
          <h1 className="text-base font-bold tracking-tight text-gradient">
            MVD PHOTOSHOP ACADEMY
          </h1>
        </div>
      </div>

      {/* Center: Navigation Tabs */}
      <nav className="flex items-center gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn-ghost text-sm font-medium py-2 px-4 rounded-xl flex items-center gap-2 transition-all ${activeTab === tab.id
              ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Right: Subscription Badge + User Menu */}
      <div className="flex items-center gap-3 !mr-4">
        <div className="relative">
          <button
            onClick={() => setShowLicenseManager(!showLicenseManager)}
            className="btn-outline text-xs py-1.5 px-3 bg-card border-primary/20 text-primary hover:bg-primary/10 transition-colors shadow-sm font-semibold flex items-center gap-1.5"
          >
            <Key size={14} />
            Đổi Quyền Lợi
          </button>
          {showLicenseManager && <LicenseManager onClose={() => setShowLicenseManager(false)} />}
        </div>
        <SubscriptionBadge />

        {/* User Avatar / Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-accent/50 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <User size={14} className="text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground/80 max-w-[100px] truncate">
              {session?.name || "User"}
            </span>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-52 panel p-2 z-50 animate-slide-up shadow-xl">
                {/* User Info */}
                <div className="px-3 py-2 border-b border-border/50 mb-1">
                  <p className="text-sm font-medium truncate">{session?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session?.email}
                  </p>
                </div>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut size={14} />
                  {t("logout")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

    </div>  );
}
