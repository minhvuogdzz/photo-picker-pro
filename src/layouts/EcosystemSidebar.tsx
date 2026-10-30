import { useState } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useTranslation } from "@/core/lib/i18n";
import { logout } from "@/core/services/authApi";
import { SubscriptionBadge } from "@/core/auth/SubscriptionBadge";
import { LicenseManager } from "@/core/license/LicenseManager";
import { AccountSecurityModal } from "@/core/components/AccountSecurityModal";
import { BrandLogo } from "@/core/components/BrandLogo";
import { CoffeeSteamIcon } from "@/core/components/CoffeeSteamIcon";
import {
  Sparkles,
  BarChart3,
  FileSpreadsheet,
  FileImage,
  Layers,
  Settings2,
  PanelLeft,
  Camera,
  Key,
  User,
  Shield,
  LogOut,
  ChevronRight,
} from "lucide-react";

export function EcosystemSidebar() {
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const isCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setIsCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const setIsDonateModalOpen = useAppStore((s) => s.setIsDonateModalOpen);
  const session = useAuthStore((s) => s.session);
  const authLogout = useAuthStore((s) => s.logout);
  const { t } = useTranslation();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLicenseManager, setShowLicenseManager] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const handleNavigate = (modId: string, tab?: "home" | "history" | "settings") => {
    setActiveModule(modId);
    if (tab) {
      setActiveTab(tab);
    }
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    try {
      await logout(session?.accessToken);
    } catch {
      // Best effort
    }
    authLogout();
  };

  const navSections = [
    {
      title: "Tổng quan",
      items: [
        {
          id: "launcher",
          label: "Bảng điều khiển",
          icon: Sparkles,
          iconColor: "text-blue-500 dark:text-blue-400",
          isActive: activeModule === "launcher",
          onClick: () => handleNavigate("launcher"),
        },
        {
          id: "photo-counter",
          label: "Thống kê",
          icon: BarChart3,
          iconColor: "text-cyan-500 dark:text-cyan-400",
          isActive: activeModule === "photo-counter",
          onClick: () => handleNavigate("photo-counter"),
        },
      ],
    },
    {
      title: "Ứng dụng",
      items: [
        {
          id: "photo-picker",
          label: "Lọc ảnh Pro",
          icon: Camera,
          iconColor: "text-violet-500 dark:text-violet-400",
          isActive:
            activeModule === "photo-picker" &&
            activeTab !== "history" &&
            activeTab !== "settings",
          onClick: () => handleNavigate("photo-picker", "home"),
        },
        {
          id: "contact-the-sheet",
          label: "Contact Sheet",
          icon: FileSpreadsheet,
          iconColor: "text-emerald-500 dark:text-emerald-400",
          isActive: activeModule === "contact-the-sheet",
          onClick: () => handleNavigate("contact-the-sheet"),
        },
        {
          id: "mvd-convert",
          label: "MVD Convert",
          icon: FileImage,
          iconColor: "text-pink-500 dark:text-pink-400",
          isActive: activeModule === "mvd-convert",
          onClick: () => handleNavigate("mvd-convert"),
        },
        {
          id: "resources",
          label: "Kho Tài nguyên",
          icon: Layers,
          iconColor: "text-amber-500 dark:text-amber-400",
          isActive: activeModule === "resources",
          onClick: () => handleNavigate("resources"),
        },
      ],
    },
    {
      title: "Hệ thống",
      items: [
        {
          id: "system",
          label: "Cài đặt & Bản quyền",
          icon: Settings2,
          iconColor: "text-indigo-500 dark:text-indigo-400",
          isActive:
            activeModule === "system" ||
            (activeModule === "photo-picker" && activeTab === "settings"),
          onClick: () => handleNavigate("system"),
        },
      ],
    },
  ];

  return (
    <aside
      className={`shrink-0 h-full flex flex-col justify-between transition-all duration-300 ease-in-out border-r border-border select-none z-40 ${
        isCollapsed ? "w-[68px]" : "w-[260px]"
      } bg-[#eef1f6] dark:bg-[#16171a] text-foreground relative`}
    >
      {/* Top Header: Brand Logo + App Name + Sidebar Toggle Button */}
      <div className="h-14 px-4 flex items-center justify-between shrink-0 border-b border-border/40">
        {!isCollapsed ? (
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo
              variant="icon"
              className="w-8 h-8 rounded-xl object-contain shadow-xs shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-bold tracking-tight text-foreground uppercase leading-tight truncate">
                DH Studio Pro
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wider leading-none truncate mt-0.5">
                DevHouse Software
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <BrandLogo
              variant="icon"
              className="w-8 h-8 rounded-xl object-contain shadow-xs"
            />
          </div>
        )}

        {/* Sidebar Collapse Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-border shrink-0 ${
            isCollapsed ? "hidden" : ""
          }`}
          title="Thu gọn thanh bên"
          aria-label="Thu gọn thanh bên"
        >
          <PanelLeft size={16} />
        </button>
      </div>

      {/* Button to expand when collapsed */}
      {isCollapsed && (
        <div className="py-1 px-2 flex justify-center">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Mở rộng thanh bên"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Nav List with Groups */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 custom-scrollbar flex flex-col gap-4">
        {navSections.map((section, idx) => (
          <div key={idx} className="flex flex-col gap-1">
            {!isCollapsed && (
              <h3 className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75 truncate select-none">
                {section.title}
              </h3>
            )}

            <div className="flex flex-col gap-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.isActive;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl transition-all duration-150 cursor-pointer text-left relative select-none ${
                      isCollapsed ? "justify-center p-2.5" : "px-3 py-2"
                    } ${
                      active
                        ? "bg-[#007aff] text-white shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 font-medium"
                    }`}
                  >
                    <Icon
                      size={17}
                      className={`shrink-0 transition-transform ${
                        active ? "text-white" : item.iconColor
                      }`}
                    />

                    {!isCollapsed && (
                      <span className="text-[13px] truncate tracking-normal">
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================= */}
      {/* Sidebar Footer: USER PROFILE, LICENSE & STATUS HUB        */}
      {/* ========================================================= */}
      <div className="p-3.5 border-t border-border/50 shrink-0 flex flex-col gap-2.5 bg-black/[0.02] dark:bg-white/[0.02]">
        {!isCollapsed ? (
          <>
            {/* Row 1: Subscription Badge & Action Buttons */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <SubscriptionBadge onClick={() => setShowLicenseManager(true)} />

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowLicenseManager(true)}
                  className="h-7 px-2.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-foreground flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer border border-border/40"
                  title="Xem quyền lợi và gói bản quyền"
                >
                  <Key size={12} className="text-amber-500" />
                  <span>Key</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDonateModalOpen(true)}
                  className="h-7 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer"
                  title="Ủng hộ tác giả một ly cafe"
                >
                  <CoffeeSteamIcon size={12} />
                  <span>Donate</span>
                </button>
              </div>
            </div>

            {/* Row 2: User Profile Card with Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center justify-between gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-border/40 hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-[11px] shrink-0">
                    {session?.name ? session.name.charAt(0).toUpperCase() : <User size={13} />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-bold text-foreground truncate leading-tight">
                      {session?.name || "Người dùng"}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                      {session?.email || "Chưa đăng nhập"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" title="Đang trực tuyến" />
                </div>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute left-0 bottom-full mb-2 w-60 p-2 z-50 animate-slide-up shadow-xl bg-card border border-border rounded-2xl">
                    <div className="px-3 py-2.5 border-b border-border/60 mb-1">
                      <p className="text-[13px] font-semibold truncate text-foreground">
                        {session?.name || "Người dùng"}
                      </p>
                      <p className="text-[11px] font-mono text-primary truncate">
                        @{session?.username || session?.email?.split("@")[0] || "guest"}
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
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                    >
                      <Shield size={14} className="text-primary" />
                      Tài khoản & Bảo mật
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowLicenseManager(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                    >
                      <Key size={14} className="text-amber-500" />
                      Đổi Quyền Lợi / Key
                    </button>

                    <div className="my-1 border-t border-border/40" />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer"
                    >
                      <LogOut size={14} />
                      {t("logout")}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Row 3: Status Ready */}
            <div className="flex items-center gap-2 px-1 pt-1">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                Sẵn sàng làm việc
              </span>
            </div>
          </>
        ) : (
          /* Collapsed Mode Footer Icons */
          <div className="flex flex-col items-center gap-2.5 py-1">
            <button
              type="button"
              onClick={() => setShowLicenseManager(true)}
              className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-amber-500 transition-colors"
              title="Quyền Lợi & Gói"
            >
              <Key size={14} />
            </button>

            <button
              type="button"
              onClick={() => setIsDonateModalOpen(true)}
              className="w-8 h-8 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-colors"
              title="Donate Cafe"
            >
              <CoffeeSteamIcon size={14} />
            </button>

            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-bold text-[12px] transition-transform hover:scale-105"
              title={session?.name || "Tài khoản"}
            >
              {session?.name ? session.name.charAt(0).toUpperCase() : <User size={14} />}
            </button>

            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1" title="Sẵn sàng làm việc" />
          </div>
        )}
      </div>

      {/* Modals */}
      {showLicenseManager && (
        <LicenseManager
          onClose={() => setShowLicenseManager(false)}
          variant="modal"
          initialMode="my_plan"
        />
      )}

      <AccountSecurityModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
      />
    </aside>
  );
}
