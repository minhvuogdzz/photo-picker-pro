import { useState, useRef } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { useTranslation } from "@/core/lib/i18n";
import { logout } from "@/core/services/authApi";
import { SubscriptionBadge } from "@/core/auth/SubscriptionBadge";
import { LicenseManager } from "@/core/license/LicenseManager";
import { AccountSecurityModal } from "@/core/components/AccountSecurityModal";
import { BrandLogo } from "@/core/components/BrandLogo";
import { CoffeeSteamIcon } from "@/core/components/CoffeeSteamIcon";
import { useUserAvatar } from "@/core/hooks/useUserAvatar";
import {
  Home,
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
  Trash2,
  Sun,
  Moon,
  CircleDot,
  Bell,
} from "lucide-react";
import { PhotoPickerIcon } from "@/core/components/PhotoPickerIcon";
import { useNotificationStore } from "@/core/stores/useNotificationStore";

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
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const { t } = useTranslation();
  const unreadCount = useNotificationStore((s) => s.getUnreadCount());

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLicenseManager, setShowLicenseManager] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const { avatarUrl, updateAvatar, removeAvatar } = useUserAvatar();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await updateAvatar(file);
      } catch (err) {
        console.error("Failed to update avatar:", err);
      }
    }
    e.target.value = "";
  };

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

  interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    iconColor?: string;
    isActive: boolean;
    badge?: number;
    tooltip?: string;
    onClick: () => void;
  }

  const navSections: { title: string; items: NavItem[] }[] = [
    {
      title: "Tổng quan",
      items: [
        {
          id: "launcher",
          label: "Bảng điều khiển",
          icon: Home,
          iconColor: "text-blue-500 dark:text-blue-400",
          isActive: activeModule === "launcher",
          onClick: () => handleNavigate("launcher"),
        },
        {
          id: "notifications",
          label: "Trung tâm thông báo",
          icon: Bell,
          iconColor: "text-amber-500 dark:text-amber-400",
          isActive: activeModule === "notifications",
          badge: unreadCount > 0 ? unreadCount : undefined,
          onClick: () => handleNavigate("notifications"),
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
          icon: PhotoPickerIcon,
          iconColor: "text-blue-500 dark:text-blue-400",
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
          label: t("convert_file") || "Chuyển đổi file",
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
      className={`shrink-0 h-full flex flex-col justify-between transition-[width] duration-300 ease-in-out border-r border-border select-none z-40 ${
        isCollapsed ? "w-[68px]" : "w-[260px]"
      } bg-[#eef1f6] dark:bg-[#16171a] text-foreground relative`}
    >
      {/* Top Header: Brand Logo + App Name + Sidebar Toggle Button */}
      <div className="h-14 px-4 flex items-center justify-between shrink-0 border-b border-border/40" data-tauri-drag-region>
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
                Devhouse Software
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
                      <span className="text-[13px] truncate tracking-normal flex-1">
                        {item.label}
                      </span>
                    )}

                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          active
                            ? "bg-white text-[#007aff]"
                            : "bg-amber-500 text-black shadow-xs"
                        } ${isCollapsed ? "absolute top-1 right-1 text-[9px] px-1 py-0" : ""}`}
                      >
                        {item.badge}
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
      <div className="p-3 shrink-0 flex flex-col gap-2 relative">
        {/* Hidden Avatar File Input (shared for both expanded and collapsed modes) */}
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleAvatarFile}
        />

        {!isCollapsed ? (
          <>
            {/* Row 1: Subscription Status Badge */}
            <div className="w-full flex items-center justify-between">
              <SubscriptionBadge onClick={() => setShowLicenseManager(true)} />
            </div>

            {/* Row 2: Key & License Management */}
            <button
              type="button"
              onClick={() => setShowLicenseManager(true)}
              className="w-full h-8 px-2.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-foreground flex items-center justify-between text-[11px] font-semibold transition-all cursor-pointer border border-border/40 group active:scale-[0.99]"
              title="Xem quyền lợi và gói bản quyền"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Key size={13} className="text-amber-500 shrink-0" />
                <span className="truncate">Gói bản quyền & Key</span>
              </div>
              <ChevronRight size={12} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* Row 3: Donate Cafe */}
            <button
              type="button"
              onClick={() => setIsDonateModalOpen(true)}
              className="w-full h-8 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center justify-between text-[11px] font-semibold transition-all cursor-pointer group active:scale-[0.99]"
              title="Ủng hộ tác giả một ly cafe"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CoffeeSteamIcon size={13} className="shrink-0" />
                <span className="truncate">Ủng hộ tác giả (Donate)</span>
              </div>
              <ChevronRight size={12} className="text-amber-600/70 dark:text-amber-400/70 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>

            {/* Row 4: Theme Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-border/40 text-[11px] gap-1">
              <button
                type="button"
                onClick={() => updateSetting("theme", "light")}
                className={`flex-1 py-1 px-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-white dark:bg-[#2c2d33] text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Giao diện Sáng (Light)"
              >
                <Sun size={12} className="text-amber-500 shrink-0" />
                <span>Sáng</span>
              </button>
              <button
                type="button"
                onClick={() => updateSetting("theme", "dark")}
                className={`flex-1 py-1 px-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-white dark:bg-[#2c2d33] text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Giao diện Tối (Dark)"
              >
                <Moon size={12} className="text-blue-400 shrink-0" />
                <span>Tối</span>
              </button>
              <button
                type="button"
                onClick={() => updateSetting("theme", "system")}
                className={`flex-1 py-1 px-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  theme === "system"
                    ? "bg-white dark:bg-[#2c2d33] text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Tự động theo hệ điều hành (Auto)"
              >
                <CircleDot size={12} className="rotate-45 text-muted-foreground shrink-0" />
                <span>Auto</span>
              </button>
            </div>

            {/* Row 5: User Profile Card */}
            <div>
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center justify-between gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 border border-border/40 hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 overflow-hidden flex items-center justify-center text-primary font-bold text-[12px] shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={15} className="text-primary" />
                    )}
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
            </div>

            {/* Row 6: Status Ready */}
            <div className="flex items-center gap-2 px-1 pt-0.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                Sẵn sàng làm việc
              </span>
            </div>
          </>
        ) : (
          /* Collapsed Mode Footer Icons */
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              type="button"
              onClick={() => setShowLicenseManager(true)}
              className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-amber-500 transition-colors cursor-pointer"
              title="Quyền Lợi & Gói"
            >
              <Key size={14} />
            </button>

            <button
              type="button"
              onClick={() => setIsDonateModalOpen(true)}
              className="w-8 h-8 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-colors cursor-pointer"
              title="Donate Cafe"
            >
              <CoffeeSteamIcon size={14} />
            </button>

            {/* Theme Toggle in collapsed mode */}
            <button
              type="button"
              onClick={() => {
                const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
                updateSetting("theme", next);
              }}
              className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={`Giao diện: ${theme === "dark" ? "Tối" : theme === "light" ? "Sáng" : "Auto"} (Bấm để đổi)`}
            >
              {theme === "light" ? (
                <Sun size={14} className="text-amber-500" />
              ) : theme === "dark" ? (
                <Moon size={14} className="text-blue-400" />
              ) : (
                <CircleDot size={14} className="rotate-45" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 overflow-hidden flex items-center justify-center text-primary font-bold text-[12px] transition-transform hover:scale-105 cursor-pointer"
              title={session?.name || "Tài khoản"}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={14} className="text-primary" />
              )}
            </button>

            <span className="w-2 h-2 rounded-full bg-emerald-500 mt-0.5" title="Sẵn sàng làm việc" />
          </div>
        )}

        {/* User Dropdown Menu - Works in both expanded and collapsed mode */}
        {showUserMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowUserMenu(false)}
            />
            <div
              className={`z-50 animate-slide-up shadow-2xl bg-card border border-border rounded-2xl p-2 ${
                isCollapsed
                  ? "fixed left-[76px] bottom-3 w-64"
                  : "absolute left-3 right-3 bottom-[56px]"
              }`}
            >
              <div className="px-3 py-2.5 border-b border-border/60 mb-1 flex items-center gap-2.5">
                <div
                  className="relative group/avt cursor-pointer shrink-0"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Bấm để đổi ảnh đại diện"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 overflow-hidden flex items-center justify-center text-primary shadow-xs">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={17} className="text-primary" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/45 rounded-xl opacity-0 group-hover/avt:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera size={12} />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold truncate text-foreground leading-tight">
                    {session?.name || "Người dùng"}
                  </p>
                  <p className="text-[10px] font-mono text-primary truncate leading-tight mt-0.5">
                    @{session?.username || session?.email?.split("@")[0] || "guest"}
                  </p>
                  <p className="text-[9px] text-muted-foreground truncate leading-tight mt-0.5">
                    {session?.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  avatarInputRef.current?.click();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
              >
                <Camera size={13} className="text-primary" />
                Đổi ảnh đại diện
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  Gỡ ảnh đại diện (Về icon User)
                </button>
              )}

              <div className="my-1 border-t border-border/40" />

              <button
                type="button"
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
                type="button"
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
                type="button"
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
