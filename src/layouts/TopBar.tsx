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
  LogOut as ArrowLeftIcon // Alias LogOut to use it as exit, or just import ArrowLeft
} from "lucide-react";
import { ArrowLeft } from "lucide-react";
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
    <div className="flex items-center justify-between pl-4 pr-6 py-4">
      {/* Left: Logo + Brand + Back Button */}
      <div className="flex items-center gap-2">
        {activeModule !== "launcher" && (
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer mr-2"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setLastClickPos({ 
                x: rect.left + rect.width / 2, 
                y: rect.top + rect.height / 2 
              });
              setActiveModule("launcher");
            }}
            title="Thoát ra Launcher"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        
        <div 
          className={`flex items-center gap-3 ${activeModule === "launcher" ? 'ml-4' : ''} cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setLastClickPos({ 
              x: rect.left + rect.width / 2, 
              y: rect.top + rect.height / 2 
            });
            setActiveModule("launcher");
          }}
        >
          <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain drop-shadow-lg" />
          <h1 className="text-base font-extrabold tracking-widest text-foreground drop-shadow-md uppercase">
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
              ? "bg-black/10 dark:bg-white/10 text-foreground shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
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
            className="text-xs py-1.5 px-3 bg-black/5 dark:bg-white/5 border border-border/50 text-foreground hover:bg-black/10 dark:hover:bg-white/10 transition-colors shadow-sm font-semibold flex items-center gap-1.5 rounded-lg"
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-black/10 dark:bg-white/10 border border-border/50 flex items-center justify-center shadow-sm">
              <User size={14} className="text-foreground" />
            </div>
            <span className="text-xs font-medium text-foreground/90 max-w-[100px] truncate">
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
            className={`flex items-center justify-center w-8 h-8 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer ${
              activeModule === "system" ? "bg-black/20 dark:bg-white/20 text-foreground shadow-inner" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Menu size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
