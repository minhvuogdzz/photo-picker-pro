import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useTranslation } from "@/core/lib/i18n";
import { logout } from "@/core/services/authApi";
import { SubscriptionBadge } from "@/core/auth/SubscriptionBadge";
import {
  Camera,
  Settings,
  Clock,
  Info,
  LogOut,
  User,
  Key,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { LicenseManager } from "@/core/license/LicenseManager";
import type { MainTab } from "@/core/types";

export function TopBar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const setLastClickPos = useAppStore((s) => s.setLastClickPos);
  const session = useAuthStore((s) => s.session);
  const authLogout = useAuthStore((s) => s.logout);
  const { t } = useTranslation();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLicenseManager, setShowLicenseManager] = useState(false);
  const activeModule = useAppStore((s) => s.activeModule);

  let tabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [];

  if (activeModule === "photo-picker") {
    tabs = [
      { id: "home", label: t("home"), icon: <Camera size={18} /> },
      { id: "history", label: t("history"), icon: <Clock size={18} /> },
      { id: "settings", label: t("settings"), icon: <Settings size={18} /> },
    ];
  } else if (activeModule === "retouch") {
    tabs = [
      { id: "home", label: "Chỉnh sửa", icon: <Camera size={18} /> },
      { id: "settings", label: t("settings"), icon: <Settings size={18} /> },
    ];
  } else if (activeModule === "client-gallery") {
    tabs = [
      { id: "home", label: "Albums", icon: <Camera size={18} /> },
      { id: "settings", label: t("settings"), icon: <Settings size={18} /> },
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
    <div className="flex items-center justify-between pl-8 pr-6 py-4">
      {/* Left: Logo + Brand */}
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
        <div className="flex items-center !ml-4 gap-3">
          <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain drop-shadow-lg" />
          <h1 className="text-base font-extrabold tracking-widest text-white drop-shadow-md uppercase">
            MVD PHOTOSHOP ACADEMY
          </h1>
        </div>
      </div>

      {/* Center: Navigation Tabs */}
      <nav className="flex items-center gap-4 relative">
        {(activeModule !== "launcher" && activeModule !== "system") && tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`text-sm font-medium py-2 px-4 rounded-xl flex items-center gap-2 transition-all ${activeTab === tab.id
              ? "bg-white/10 text-white shadow-sm ring-1 ring-white/20"
              : "text-white/60 hover:text-white hover:bg-white/5"
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
            className="text-xs py-1.5 px-3 bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors shadow-sm font-semibold flex items-center gap-1.5 rounded-lg"
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shadow-sm">
              <User size={14} className="text-white" />
            </div>
            <span className="text-xs font-medium text-white/90 max-w-[100px] truncate">
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

        {/* System Menu (Hamburger) */}
        <div className="relative">
          <button
            onClick={() => setActiveModule("system")}
            className={`flex items-center justify-center w-8 h-8 rounded-xl hover:bg-white/10 transition-all cursor-pointer ${
              activeModule === "system" ? "bg-white/20 text-white shadow-inner" : "text-white/70 hover:text-white"
            }`}
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
