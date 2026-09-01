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
} from "lucide-react";
import { useState } from "react";
import { LicenseManager } from "@/core/license/LicenseManager";
import { AccountSecurityModal } from "@/core/components/AccountSecurityModal";
import { SmartSearchBar } from "./SmartSearchBar";
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
  const [showAccountModal, setShowAccountModal] = useState(false);
  const activeModule = useAppStore((s) => s.activeModule);

  let tabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [];

  if (activeModule === "photo-picker") {
    tabs = [
      { id: "home", label: t("home"), icon: <Camera size={14} /> },
      { id: "history", label: t("history"), icon: <Clock size={14} /> },
      { id: "settings", label: t("settings"), icon: <Settings size={14} /> },
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
    <div className="flex items-center justify-between px-3.5 py-2">
      {/* Left: Logo + Full Brand Name + Back Button */}
      <div className="flex items-center gap-2">
        {activeModule !== "launcher" && (
          <button 
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all cursor-pointer mr-1 border border-border/40"
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
            <ArrowLeft size={15} />
          </button>
        )}
        
        <div 
          className={`flex items-center gap-2.5 ${activeModule === "launcher" ? 'ml-0.5' : ''} cursor-pointer hover:opacity-90 transition-opacity group`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setLastClickPos({ 
              x: rect.left + rect.width / 2, 
              y: rect.top + rect.height / 2 
            });
            setActiveModule("launcher");
          }}
        >
          <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain drop-shadow-sm transition-transform group-hover:scale-105" />
          <h1 className="text-xs font-extrabold tracking-wider text-foreground uppercase whitespace-nowrap">
            MVD PHOTOSHOP ACADEMY
          </h1>
        </div>
      </div>

      {/* Center: Smart Search Bar & Navigation Tabs */}
      <div className="flex items-center gap-3">
        {/* Smart Search Bar */}
        <SmartSearchBar />

        {/* Module Sub-tabs */}
        {(activeModule !== "launcher" && activeModule !== "system" && activeModule !== "resources") && tabs.length > 0 && (
          <nav className="flex items-center gap-1 p-0.5 bg-black/20 dark:bg-white/5 rounded-lg border border-border/40">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs font-medium py-1 px-2.5 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-white/15 text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Right: Subscription Badge + License + User Menu + System Hamburger */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowLicenseManager(!showLicenseManager)}
            className="text-[11px] py-1 px-2.5 bg-muted/60 hover:bg-muted active:scale-95 border border-border text-foreground transition-all shadow-sm font-semibold flex items-center gap-1.5 rounded-xl cursor-pointer"
          >
            <Key size={12} className="text-amber-500" />
            <span className="hidden md:inline">Đổi Quyền Lợi</span>
          </button>
          {showLicenseManager && (
            <LicenseManager
              onClose={() => setShowLicenseManager(false)}
              variant="dropdown"
            />
          )}
        </div>
        
        <SubscriptionBadge />

        {/* User Avatar / Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          >
            <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shadow-sm text-primary">
              <User size={12} />
            </div>
            <span className="text-xs font-medium text-foreground/90 max-w-[90px] truncate hidden sm:inline">
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
              <div className="absolute right-0 top-full mt-2 w-56 panel p-2 z-50 animate-slide-up shadow-xl border border-border/80 rounded-xl bg-[#16181d]">
                <div className="px-3 py-2 border-b border-border/50 mb-1">
                  <p className="text-xs font-semibold truncate text-foreground">{session?.name}</p>
                  <p className="text-[11px] font-mono text-primary font-bold truncate">
                    @{session?.username || session?.email.split("@")[0]}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {session?.email}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowAccountModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Shield size={14} className="text-primary" />
                  Tài khoản & Bảo mật
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLicenseManager(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <Key size={14} className="text-amber-500" />
                  Đổi Quyền Lợi / Key
                </button>

                <div className="my-1 border-t border-border/40" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut size={14} />
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

        {/* System Menu (Hamburger) */}
        <div className="relative">
          <button
            onClick={() => setActiveModule("system")}
            title="Cài đặt hệ thống"
            className={`flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 transition-all cursor-pointer ${
              activeModule === "system" ? "bg-white/20 text-foreground shadow-inner" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Menu size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
