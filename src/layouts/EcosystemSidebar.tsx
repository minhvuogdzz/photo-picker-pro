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
  ChevronsUpDown,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Coffee,
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
  const { t, tr } = useTranslation();
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
    isActive: boolean;
    badge?: number;
    tooltip?: string;
    onClick: () => void;
  }

  const navSections: { title: string; items: NavItem[] }[] = [
    {
      title: tr("Tổng quan", "Overview"),
      items: [
        {
          id: "launcher",
          label: tr("Bảng điều khiển", "Dashboard"),
          icon: Home,
          isActive: activeModule === "launcher",
          onClick: () => handleNavigate("launcher"),
        },
        {
          id: "notifications",
          label: tr("Trung tâm thông báo", "Notifications"),
          icon: Bell,
          isActive: activeModule === "notifications",
          badge: unreadCount > 0 ? unreadCount : undefined,
          onClick: () => handleNavigate("notifications"),
        },
        {
          id: "photo-counter",
          label: tr("Thống kê", "Photo Analytics"),
          icon: BarChart3,
          isActive: activeModule === "photo-counter",
          onClick: () => handleNavigate("photo-counter"),
        },
      ],
    },
    {
      title: tr("Ứng dụng", "Apps"),
      items: [
        {
          id: "photo-picker",
          label: tr("Lọc ảnh Pro", "Photo Picker Pro"),
          icon: PhotoPickerIcon,
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
          isActive: activeModule === "contact-the-sheet",
          onClick: () => handleNavigate("contact-the-sheet"),
        },
        {
          id: "mvd-convert",
          label: t("convert_file"),
          icon: FileImage,
          isActive: activeModule === "mvd-convert",
          onClick: () => handleNavigate("mvd-convert"),
        },
        {
          id: "resources",
          label: tr("Kho Tài nguyên", "Resources Hub"),
          icon: Layers,
          isActive: activeModule === "resources",
          onClick: () => handleNavigate("resources"),
        },
      ],
    },
    {
      title: t("system"),
      items: [
        {
          id: "system",
          label: tr("Cài đặt & Bản quyền", "Settings & License"),
          icon: Settings2,
          isActive:
            activeModule === "system" ||
            (activeModule === "photo-picker" && activeTab === "settings"),
          onClick: () => handleNavigate("system"),
        },
      ],
    },
  ];

  const themeOptions = [
    { value: "light" as const, label: t("light"), icon: Sun, title: tr("Giao diện Sáng (Light)", "Light Theme") },
    { value: "dark" as const, label: t("dark"), icon: Moon, title: tr("Giao diện Tối (Dark)", "Dark Theme") },
    { value: "system" as const, label: "Auto", icon: Monitor, title: tr("Tự động theo hệ điều hành (Auto)", "Follow System Theme (Auto)") },
  ];

  const footerRowClass =
    "w-full h-8 px-2.5 rounded-[10px] flex items-center gap-2.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-colors cursor-pointer group";

  const iconButtonClass =
    "w-9 h-9 rounded-[10px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors cursor-pointer";

  return (
    <aside
      className={`shrink-0 h-full py-2 pl-2 select-none z-40 relative transition-[width] duration-300 ease-in-out ${
        isCollapsed ? "w-[80px]" : "w-[264px]"
      }`}
    >
      <div className="liquid-glass h-full rounded-[22px] flex flex-col justify-between text-foreground">
        {/* Header: brand + collapse toggle */}
        <div className="h-14 px-3.5 flex items-center justify-between shrink-0" data-tauri-drag-region>
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0" data-tauri-drag-region>
              <BrandLogo
                variant="icon"
                className="w-8 h-8 rounded-[10px] object-contain shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold tracking-tight text-foreground leading-tight truncate">
                  DH Studio Pro
                </span>
                <span className="text-[11px] text-muted-foreground leading-tight truncate">
                  Devhouse Software
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <BrandLogo
                variant="icon"
                className="w-8 h-8 rounded-[10px] object-contain"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors cursor-pointer shrink-0 ${
              isCollapsed ? "hidden" : ""
            }`}
            title={tr("Thu gọn thanh bên", "Collapse sidebar")}
            aria-label={tr("Thu gọn thanh bên", "Collapse sidebar")}
          >
            <PanelLeft size={16} strokeWidth={1.75} />
          </button>
        </div>

        {isCollapsed && (
          <div className="pb-1 flex justify-center">
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] transition-colors cursor-pointer"
              title={tr("Mở rộng thanh bên", "Expand sidebar")}
              aria-label={tr("Mở rộng thanh bên", "Expand sidebar")}
            >
              <ChevronRight size={15} strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2 custom-scrollbar flex flex-col gap-5">
          {navSections.map((section, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              {!isCollapsed ? (
                <h3 className="px-2.5 pb-1 text-[11px] font-medium text-muted-foreground/80 truncate select-none">
                  {section.title}
                </h3>
              ) : (
                idx > 0 && <div className="mx-3 mb-1.5 border-t border-border" />
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.isActive;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    title={isCollapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`w-full flex items-center gap-2.5 rounded-[10px] transition-colors duration-150 cursor-pointer text-left relative select-none border ${
                      isCollapsed ? "justify-center h-10" : "h-8 px-2.5"
                    } ${
                      active
                        ? "glass-pill text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]"
                    }`}
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.75}
                      className={`shrink-0 ${active ? "text-primary" : ""}`}
                    />

                    {!isCollapsed && (
                      <span className="text-[13px] truncate flex-1">
                        {item.label}
                      </span>
                    )}

                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold tabular-nums flex items-center justify-center ${
                          isCollapsed ? "absolute top-0.5 right-1.5 min-w-[16px] h-4 px-1 text-[9px]" : ""
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer: plan, theme, account */}
        <div className="p-2.5 shrink-0 flex flex-col gap-1.5 relative">
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
              <div className="px-1 pb-1">
                <SubscriptionBadge onClick={() => setShowLicenseManager(true)} />
              </div>

              <button
                type="button"
                onClick={() => setShowLicenseManager(true)}
                className={footerRowClass}
                title={tr("Xem quyền lợi và gói bản quyền", "View plan benefits & license")}
              >
                <Key size={15} strokeWidth={1.75} className="shrink-0" />
                <span className="truncate flex-1 text-left">{tr("Gói bản quyền & Key", "Plan & License Key")}</span>
                <ChevronRight size={13} strokeWidth={1.75} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setIsDonateModalOpen(true)}
                className={footerRowClass}
                title={tr("Ủng hộ tác giả một ly cafe", "Buy the author a coffee")}
              >
                <Coffee size={15} strokeWidth={1.75} className="shrink-0" />
                <span className="truncate flex-1 text-left">{tr("Ủng hộ tác giả", "Support Author")}</span>
                <ChevronRight size={13} strokeWidth={1.75} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
              </button>

              {/* Theme switcher */}
              <div
                role="radiogroup"
                aria-label={t("theme")}
                className="macos-segmented mt-1 grid grid-cols-3 p-0.5 rounded-[11px] text-[12px] gap-0.5"
              >
                {themeOptions.map((opt) => {
                  const ThemeIcon = opt.icon;
                  const selected = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => updateSetting("theme", opt.value)}
                      className={`h-7 rounded-[8px] flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        selected
                          ? "glass-pill text-foreground font-semibold"
                          : "border-transparent text-muted-foreground hover:text-foreground font-medium"
                      }`}
                      title={opt.title}
                    >
                      <ThemeIcon size={12.5} strokeWidth={1.75} className="shrink-0" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Account */}
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                aria-expanded={showUserMenu}
                className="mt-1 w-full flex items-center gap-2.5 p-1.5 pr-2 rounded-[12px] hover:bg-foreground/[0.05] transition-colors cursor-pointer text-left"
              >
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-primary">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={15} strokeWidth={1.75} />
                    )}
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-background"
                    title={tr("Sẵn sàng làm việc", "Ready")}
                  />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[12.5px] font-medium text-foreground truncate leading-tight">
                    {session?.name || t("user")}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                    {session?.email || tr("Chưa đăng nhập", "Not signed in")}
                  </span>
                </div>
                <ChevronsUpDown size={14} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
              </button>
            </>
          ) : (
            /* Collapsed footer */
            <div className="flex flex-col items-center gap-1 py-1">
              <button
                type="button"
                onClick={() => setShowLicenseManager(true)}
                className={iconButtonClass}
                title={tr("Quyền Lợi & Gói", "Plan & Benefits")}
                aria-label={tr("Quyền Lợi & Gói", "Plan & Benefits")}
              >
                <Key size={16} strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={() => setIsDonateModalOpen(true)}
                className={iconButtonClass}
                title={tr("Ủng hộ tác giả", "Support Author")}
                aria-label={tr("Ủng hộ tác giả", "Support Author")}
              >
                <Coffee size={16} strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
                  updateSetting("theme", next);
                }}
                className={iconButtonClass}
                title={tr(
                  `Giao diện: ${theme === "dark" ? "Tối" : theme === "light" ? "Sáng" : "Auto"} (Bấm để đổi)`,
                  `Theme: ${theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto"} (Click to switch)`
                )}
                aria-label={tr("Đổi giao diện", "Switch theme")}
              >
                {theme === "light" ? (
                  <Sun size={16} strokeWidth={1.75} />
                ) : theme === "dark" ? (
                  <Moon size={16} strokeWidth={1.75} />
                ) : (
                  <Monitor size={16} strokeWidth={1.75} />
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="relative mt-1 w-8 h-8 rounded-full bg-primary/10 overflow-visible flex items-center justify-center text-primary cursor-pointer"
                title={session?.name || tr("Tài khoản", "Account")}
                aria-label={tr("Tài khoản", "Account")}
              >
                <span className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={15} strokeWidth={1.75} />
                  )}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-background" />
              </button>
            </div>
          )}

          {/* User menu — works in both expanded and collapsed mode */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div
                className={`z-50 animate-slide-up liquid-glass liquid-glass-strong shadow-xl rounded-2xl p-1.5 ${
                  isCollapsed
                    ? "fixed left-[84px] bottom-3 w-64"
                    : "absolute left-2.5 right-2.5 bottom-[58px]"
                }`}
              >
                <div className="px-2.5 py-2.5 mb-1 flex items-center gap-2.5 border-b border-border">
                  <div
                    className="relative group/avt cursor-pointer shrink-0"
                    onClick={() => avatarInputRef.current?.click()}
                    title={tr("Bấm để đổi ảnh đại diện", "Click to change avatar")}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-primary">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={17} strokeWidth={1.75} />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/45 rounded-full opacity-0 group-hover/avt:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Camera size={12} strokeWidth={1.75} />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate text-foreground leading-tight">
                      {session?.name || t("user")}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                      @{session?.username || session?.email?.split("@")[0] || "guest"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    avatarInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 h-8 text-[12.5px] text-foreground hover:bg-foreground/[0.06] rounded-[9px] transition-colors cursor-pointer"
                >
                  <Camera size={14} strokeWidth={1.75} className="text-muted-foreground" />
                  {tr("Đổi ảnh đại diện", "Change Avatar")}
                </button>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="w-full flex items-center gap-2.5 px-2.5 h-8 text-[12.5px] text-foreground hover:bg-foreground/[0.06] rounded-[9px] transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} strokeWidth={1.75} className="text-muted-foreground" />
                    {tr("Gỡ ảnh đại diện", "Remove Avatar")}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowAccountModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 h-8 text-[12.5px] text-foreground hover:bg-foreground/[0.06] rounded-[9px] transition-colors cursor-pointer"
                >
                  <Shield size={14} strokeWidth={1.75} className="text-muted-foreground" />
                  {tr("Tài khoản & Bảo mật", "Account & Security")}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLicenseManager(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 h-8 text-[12.5px] text-foreground hover:bg-foreground/[0.06] rounded-[9px] transition-colors cursor-pointer"
                >
                  <Key size={14} strokeWidth={1.75} className="text-muted-foreground" />
                  {tr("Đổi Quyền Lợi / Key", "Manage Plan / License Key")}
                </button>

                <div className="my-1 mx-2 border-t border-border" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-2.5 h-8 text-[12.5px] text-destructive hover:bg-destructive/10 rounded-[9px] transition-colors cursor-pointer"
                >
                  <LogOut size={14} strokeWidth={1.75} />
                  {t("logout")}
                </button>
              </div>
            </>
          )}
        </div>
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
