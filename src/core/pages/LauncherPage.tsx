import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { modules } from "@/registry";
import {
  ArrowRight,
  LayoutGrid,
  Layers,
  ExternalLink,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { apiRequest } from "@/core/services/apiClient";
import { checkAppAccess } from "@/core/services/appEntitlementPolicy";
import { LicenseManager } from "@/core/license/LicenseManager";
import { SystemPerformanceDashboard } from "@/core/components/system-performance/SystemPerformanceDashboard";

const DEFAULT_COMPANY_URL = "https://mvdphotoshopacademy.com";
const LIFETIME_DAYS_THRESHOLD = 3650;

function formatRemainingDays(days: number | null | undefined): string {
  if (days == null || days > LIFETIME_DAYS_THRESHOLD) return "Vĩnh viễn";
  return `${days} ngày`;
}

export function LauncherPage() {
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const setLastClickPos = useAppStore((s) => s.setLastClickPos);
  const session = useAuthStore((s) => s.session);

  const [version, setVersion] = useState("3.0.0");
  const [companyUrl, setCompanyUrl] = useState("");
  const [showLicenseManager, setShowLicenseManager] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);

  // Fetch company website URL
  useEffect(() => {
    const cachedUrl = localStorage.getItem("mvd_company_url");
    if (cachedUrl) setCompanyUrl(cachedUrl);

    apiRequest<{ companyWebsiteUrl?: string }>("/config/public")
      .then((data) => {
        if (data?.companyWebsiteUrl) {
          setCompanyUrl(data.companyWebsiteUrl);
          localStorage.setItem("mvd_company_url", data.companyWebsiteUrl);
        }
      })
      .catch(() => {});
  }, []);

  const workflowApps = useMemo(
    () => modules.filter((m) => m.id !== "resources"),
    []
  );

  const handleLaunch = (modId: string, e: React.SyntheticEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setLastClickPos({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setActiveModule(modId);
  };

  const launchOnKey = (modId: string) => (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleLaunch(modId, e);
    }
  };

  const resourcesAccess = checkAppAccess(session, "resources");

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar text-foreground select-none p-2 sm:p-4">
      {/* Vertically centered inner container: balanced across all viewport sizes */}
      <div className="w-full max-w-7xl mx-auto my-auto flex flex-col gap-4 py-2 shrink-0">
        
        {/* ========================================================= */}
        {/* SECTION 1: ỨNG DỤNG LÀM VIỆC (ƯU TIÊN 1 - THẤY NGAY)     */}
        {/* ========================================================= */}
        <section className="flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <LayoutGrid size={13} className="text-primary" />
              <span>Ứng dụng làm việc</span>
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium">
              {workflowApps.length} công cụ studio sẵn sàng
            </span>
          </div>

          {/* 4 App Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {workflowApps.map((mod) => {
              const Icon = mod.icon;
              const modAccess = checkAppAccess(session, mod.id);

              return (
                <div
                  key={mod.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Mở ${mod.name}`}
                  onClick={(e) => handleLaunch(mod.id, e)}
                  onKeyDown={launchOnKey(mod.id)}
                  className="group bg-card rounded-2xl p-3.5 border border-border hover:border-primary/50 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[148px]"
                >
                  <div className="flex flex-col">
                    {/* Header: Icon + License Badge */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-200 shrink-0">
                        <Icon size={15} />
                      </div>

                      <div className="flex items-center gap-1">
                        {modAccess.hasAccess ? (
                          !modAccess.isTrial ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                              Đã mua · {formatRemainingDays(modAccess.daysRemaining)}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                              Dùng thử · {modAccess.daysRemaining ?? 0} ngày
                            </span>
                          )
                        ) : (
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                            Chưa kích hoạt
                          </span>
                        )}
                      </div>
                    </div>

                    {/* App Title */}
                    <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors tracking-tight">
                      {mod.name}
                    </h3>

                    {/* Description: full text, no ellipsis */}
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                      {mod.description}
                    </p>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] font-semibold text-primary">
                    <span className="text-muted-foreground font-normal text-[9px]">
                      {modAccess.hasAccess ? "Sẵn sàng" : "Cần kích hoạt"}
                    </span>
                    <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>{modAccess.hasAccess ? "Khởi chạy" : "Kích hoạt"}</span>
                      <ArrowRight size={11} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 2: KHO TÀI NGUYÊN CREATIVE                        */}
        {/* ========================================================= */}
        <section className="shrink-0">
          <div
            role="button"
            tabIndex={0}
            aria-label="Mở Kho Tài Nguyên Creative"
            onClick={(e) => handleLaunch("resources", e)}
            onKeyDown={launchOnKey("resources")}
            className="w-full bg-card rounded-3xl p-4 sm:p-5 border border-border hover:border-primary/50 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group relative overflow-hidden"
          >
            {/* Left: Icon + Title + Description + Tags */}
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-xs mt-0.5 sm:mt-0">
                <Layers size={20} />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors tracking-tight truncate">
                    Kho Tài Nguyên Creative
                  </h3>
                  <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60 shrink-0">
                    {resourcesAccess.hasAccess
                      ? !resourcesAccess.isTrial
                        ? `Đã mua · ${formatRemainingDays(resourcesAccess.daysRemaining)}`
                        : `Dùng thử · ${resourcesAccess.daysRemaining ?? 0} ngày`
                      : "Chưa kích hoạt"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Tuyển chọn đầy đủ Presets Lightroom, Actions Photoshop Retouch da chuyên sâu, Brushes vẽ tóc & LUTs màu ảnh cưới/studio độc quyền.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {["10.000+ Presets", "Actions Retouch Da", "LUTs Cinematic", "Brushes Studio", "RAW Profiles"].map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted/50 border border-border/40"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Action Button */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <div className="py-2.5 px-4 rounded-xl bg-primary/10 group-hover:bg-primary/20 border border-primary/25 text-primary font-bold text-xs transition-all flex items-center gap-2 shrink-0">
                <span>{resourcesAccess.hasAccess ? "Khám phá Kho Tài Nguyên" : "Kích hoạt gói ngay"}</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 3: SYSTEM PERFORMANCE (GIÁM SÁT HIỆU SUẤT)        */}
        {/* ========================================================= */}
        <section className="shrink-0">
          <SystemPerformanceDashboard />
        </section>

        {/* ========================================================= */}
        {/* FOOTER BAR                                                */}
        {/* ========================================================= */}
        <footer className="pt-2 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">DH Studio Pro</span>
            <span>·</span>
            <span>v{version}</span>
            <span>·</span>
            <span>© {new Date().getFullYear()} Devhouse Software</span>
          </div>

          <div className="flex items-center gap-3">
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
                  type="button"
                  onClick={handleOpenUrl}
                  className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                  title={`Mở trang web ${displayUrl}`}
                >
                  <span>{displayUrl}</span>
                  <ExternalLink size={10} />
                </button>
              );
            })()}
          </div>
        </footer>

      </div>

      {/* License Manager Modal */}
      {showLicenseManager && (
        <LicenseManager
          onClose={() => setShowLicenseManager(false)}
          variant="modal"
          initialMode="my_plan"
        />
      )}
    </div>
  );
}
