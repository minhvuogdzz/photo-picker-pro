import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { modules, AppModule } from "@/registry";
import {
  ArrowRight,
  Shield,
  ExternalLink,
  Crown,
  Sparkles,
  Zap,
  LayoutGrid,
  CheckCircle2,
  Layers,
  ChevronRight,
  Coffee,
} from "lucide-react";
import { CoffeeSteamIcon } from "@/core/components/CoffeeSteamIcon";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { apiRequest } from "@/core/services/apiClient";

const DEFAULT_COMPANY_URL = "https://mvdphotoshopacademy.com";

export function LauncherPage() {
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const setLastClickPos = useAppStore((s) => s.setLastClickPos);
  const setIsDonateModalOpen = useAppStore((s) => s.setIsDonateModalOpen);
  const session = useAuthStore((s) => s.session);

  const [version, setVersion] = useState("2.1.1");
  const [companyUrl, setCompanyUrl] = useState("");
  const [bannerConfig, setBannerConfig] = useState<{ badge?: string; title?: string; subtitle?: string }>({});

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);

  // Fetch company website URL & custom banner config from backend (admin-configurable)
  useEffect(() => {
    const cachedUrl = localStorage.getItem("mvd_company_url");
    if (cachedUrl) setCompanyUrl(cachedUrl);

    const cachedBanner = localStorage.getItem("mvd_launcher_banner");
    if (cachedBanner) {
      try {
        setBannerConfig(JSON.parse(cachedBanner));
      } catch {
        // Ignore JSON parse error
      }
    }

    apiRequest<{ companyWebsiteUrl?: string; launcherBanner?: { badge?: string; title?: string; subtitle?: string } }>("/config/public")
      .then((data) => {
        if (data?.companyWebsiteUrl) {
          setCompanyUrl(data.companyWebsiteUrl);
          localStorage.setItem("mvd_company_url", data.companyWebsiteUrl);
        }
        if (data?.launcherBanner) {
          setBannerConfig(data.launcherBanner);
          localStorage.setItem("mvd_launcher_banner", JSON.stringify(data.launcherBanner));
        }
      })
      .catch(() => {
        // Silently use cached or default
      });
  }, []);

  const workflowApps = useMemo(() => modules.filter((m) => m.id !== "resources"), []);

  const handleLaunch = (modId: string, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setLastClickPos({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setActiveModule(modId);
  };

  // Determine greeting based on local time
  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Chào buổi sáng", icon: "☀️" };
    if (hour < 18) return { text: "Chào buổi chiều", icon: "🌤️" };
    return { text: "Chào buổi tối", icon: "🌙" };
  }, []);

  const userName = session?.name || session?.email?.split("@")[0] || "Quý khách";
  const isPremium = session?.subscription?.isPremium === true;
  const isLifetime = session?.subscription?.status === "LIFETIME";

  // Compute banner values (admin custom with fallback)
  const displayTitle = useMemo(() => {
    if (bannerConfig.title?.trim()) {
      return bannerConfig.title.replace("{name}", userName);
    }
    return null;
  }, [bannerConfig.title, userName]);

  const displaySubtitle = bannerConfig.subtitle?.trim() || "Trung tâm điều phối ứng dụng tự động hoá studio. Chọn công cụ bên dưới để bắt đầu luồng làm việc.";
  const displayBadge = bannerConfig.badge?.trim();

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-y-auto overflow-x-hidden p-5 md:p-7 animate-fade-in custom-scrollbar text-foreground">
      
      {/* AMBIENT BACKGROUND GLOWS — clean in light mode, atmospheric in dark mode */}
      <div className="fixed top-[-10%] right-[-5%] w-[45%] h-[45%] bg-blue-500/8 rounded-full blur-[130px] pointer-events-none hidden dark:block" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-amber-500/6 rounded-full blur-[120px] pointer-events-none hidden dark:block" />
      <div className="fixed top-[40%] left-[20%] w-[35%] h-[35%] bg-violet-500/5 rounded-full blur-[140px] pointer-events-none hidden dark:block" />

      {/* HEADER: ADMIN-CONFIGURABLE BANNER & DEDICATED PREMIUM HUB */}
      <div className="w-full max-w-5xl mx-auto mb-5 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/80">
          <div>
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/70 border border-border text-[11px] font-medium text-foreground mb-2">
              <span className="text-amber-500 dark:text-amber-400">{greetingData.icon}</span>
              {displayBadge ? (
                <span className="font-semibold text-primary">{displayBadge}</span>
              ) : (
                <>
                  <span className="font-semibold text-primary">MVD Studio Suite</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Hệ thống sẵn sàng
                  </span>
                </>
              )}
            </div>

            {/* Greeting Headline */}
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground leading-snug">
              {displayTitle ? (
                displayTitle
              ) : (
                <>
                  {greetingData.text},{" "}
                  <span className="text-primary font-bold">
                    {userName}
                  </span>
                </>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              {displaySubtitle}
            </p>
          </div>

          {/* Right User & Dedicated Premium Hub */}
          <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-card border border-border shadow-xs hover:border-amber-500/40 transition-colors">
              <div className={`w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 ${
                isPremium 
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30" 
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}>
                {isPremium ? <Crown size={17} /> : <Shield size={17} />}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">
                    {isPremium ? "VIP Creative Hub" : "Standard Plan"}
                  </span>
                  {isPremium && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/35 uppercase">
                      {isLifetime ? "LIFETIME" : "PRO"}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground max-w-[150px] truncate">
                  {session?.email || "Studio Member"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURED SPOTLIGHT CARD — KHO TÀI NGUYÊN CREATIVE */}
      <div className="w-full max-w-5xl mx-auto mb-6 relative z-10">
        <div 
          onClick={(e) => handleLaunch("resources", e)}
          className="group cursor-pointer rounded-2xl p-6 md:py-6.5 md:px-7 bg-gradient-to-r from-amber-500/12 via-card to-amber-500/8 hover:from-amber-500/18 hover:to-amber-500/12 border border-amber-500/35 hover:border-amber-500/55 transition-all duration-200 shadow-xs hover:shadow-lg relative overflow-hidden"
        >
          {/* Subtle warm glow inside spotlight */}
          <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-amber-500/12 to-transparent pointer-events-none hidden dark:block" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            <div className="flex items-start sm:items-center gap-4.5">
              <div className="w-13 h-13 rounded-xl bg-amber-500/15 dark:bg-amber-500/25 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 group-hover:rotate-1 transition-all duration-200 shrink-0 shadow-xs">
                <Layers size={25} />
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors tracking-tight">
                    Kho Tài Nguyên Creative · VIP Vault
                  </h3>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35 flex items-center gap-1 shadow-xs">
                    <Sparkles size={11} />
                    <span>Đặc quyền VIP</span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  Tuyển chọn độc quyền hàng nghìn Presets Lightroom, Actions Photoshop Retouch da chuyên sâu, Brushes cao cấp & LUTs màu ảnh cưới/studio.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {["10.000+ Tài nguyên", "Presets Lightroom", "Actions Retouch Da", "Brushes & Textures", "LUTs Màu Cinematic"].map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] text-amber-800 dark:text-amber-300 font-medium px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-800 dark:text-amber-300 font-semibold text-xs transition-all shadow-xs shrink-0 self-end md:self-center group-hover:border-amber-500/50">
              <span>Mở kho tài nguyên</span>
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* ALL APPS GRID — 3 REMAINING WORKFLOW APPS IN A BALANCED ROW */}
      <div className="w-full max-w-5xl mx-auto mb-6 relative z-10">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <LayoutGrid size={13} className="text-primary" />
            <span>Công cụ làm việc</span>
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {workflowApps.length} ứng dụng sẵn sàng
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {workflowApps.map((mod) => {
            const Icon = mod.icon;
            const accent = mod.accentColor;

            return (
              <div
                key={mod.id}
                onClick={(e) => handleLaunch(mod.id, e)}
                className={`group cursor-pointer rounded-xl p-4.5 transition-all duration-200 relative overflow-hidden bg-card/85 hover:bg-card border border-border ${accent.border} flex flex-col justify-between shadow-sm hover:shadow-md`}
              >
                {/* Colored Corner Ambient Glow on hover */}
                <div
                  className={`absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl ${accent.bgGlow} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                />

                <div className="relative z-10">
                  {/* Card Header: Icon + Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className={`w-10 h-10 ${accent.iconBg} rounded-lg flex items-center justify-center border shadow-sm group-hover:scale-105 transition-transform duration-200`}
                    >
                      <Icon size={20} />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {mod.isPremium && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35 flex items-center gap-1 shadow-xs">
                          <Crown size={10} />
                          <span>VIP</span>
                        </span>
                      )}
                      {mod.badge && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${accent.badgeClass}`}>
                          {mod.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* App Title */}
                  <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1.5 tracking-tight">
                    {mod.name}
                  </h4>

                  {/* App Description */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                    {mod.description}
                  </p>

                  {/* Feature Tags */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {mod.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-muted/70 border border-border/70 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-2.5 border-t border-border/80 flex items-center justify-between relative z-10 text-xs">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {mod.isPremium && !isPremium ? "Đặc quyền VIP Studio" : "Tự động hóa Studio"}
                  </span>
                  
                  <div className={`flex items-center gap-1 ${accent.primary} text-xs font-semibold group-hover:translate-x-0.5 transition-transform`}>
                    <span>{mod.isPremium && !isPremium ? "Chi tiết VIP" : "Mở công cụ"}</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER — CLEAN & DYNAMIC COMPANY WEBSITE LINK */}
      <div className="w-full max-w-5xl mx-auto mt-auto pt-3 border-t border-border relative z-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground py-1.5">
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Shield size={12} className="text-primary/70" />
              <span className="font-mono">v{version}</span>
            </div>
            <span className="text-border">·</span>
            <span>© {new Date().getFullYear()} MVD Photoshop Academy</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDonateModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-amber-500/35 hover:border-amber-500/65 text-amber-700 dark:text-amber-300 shadow-xs hover:bg-amber-500/10 transition-all cursor-pointer group active:scale-97"
              title="Ủng hộ tác giả một ly cafe ☕"
            >
              <div className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <CoffeeSteamIcon size={13} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Donate Cafe
                </span>
                <span className="text-[10px] text-muted-foreground/80 font-normal hidden md:inline">
                  · Ủng hộ tác giả ☕
                </span>
              </div>
            </button>

            {(() => {
              const effectiveUrl = companyUrl || DEFAULT_COMPANY_URL;
              const displayUrl = effectiveUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
              const handleOpenUrl = async (e: React.MouseEvent) => {
                e.preventDefault();
                const fullUrl = effectiveUrl.startsWith("http") ? effectiveUrl : `https://${effectiveUrl}`;
                try {
                  await openUrl(fullUrl);
                } catch {
                  window.open(fullUrl, "_blank");
                }
              };

              return (
                <button
                  onClick={handleOpenUrl}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer group"
                  title={`Mở trang web ${displayUrl}`}
                >
                  <span className="group-hover:underline underline-offset-2">{displayUrl}</span>
                  <ExternalLink size={11} className="text-muted-foreground/70 group-hover:text-primary transition-colors" />
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
