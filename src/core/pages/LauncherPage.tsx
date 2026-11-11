import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { modules } from "@/registry";
import {
  ArrowRight,
  ArrowUpRight,
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

  const [version, setVersion] = useState("3.3.0");
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

  const firstName = session?.name?.trim().split(/\s+/).pop() || "";
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const todayLabel = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" });
  const readyCount = workflowApps.filter((m) => checkAppAccess(session, m.id).hasAccess).length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar text-foreground select-none px-1">
      <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 pt-3 pb-4 shrink-0">

        {/* Greeting */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
          <div className="min-w-0">
            <p className="text-[12px] text-muted-foreground first-letter:uppercase">{todayLabel}</p>
            <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-foreground mt-0.5 truncate">
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h2>
          </div>
          <p className="text-[12.5px] text-muted-foreground shrink-0">
            {readyCount}/{workflowApps.length} ứng dụng sẵn sàng
          </p>
        </header>

        {/* Workflow apps */}
        <section className="flex flex-col gap-2.5 shrink-0">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
              <LayoutGrid size={14} strokeWidth={1.75} className="text-muted-foreground" />
              <span>Ứng dụng làm việc</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {workflowApps.map((mod) => {
              const Icon = mod.icon;
              const modAccess = checkAppAccess(session, mod.id);
              const statusLabel = modAccess.hasAccess
                ? !modAccess.isTrial
                  ? `Đã mua · ${formatRemainingDays(modAccess.daysRemaining)}`
                  : `Dùng thử · ${modAccess.daysRemaining ?? 0} ngày`
                : "Chưa kích hoạt";
              const statusDot = modAccess.hasAccess
                ? !modAccess.isTrial
                  ? "bg-success"
                  : "bg-warning"
                : "bg-muted-foreground/40";

              return (
                <div
                  key={mod.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Mở ${mod.name}`}
                  onClick={(e) => handleLaunch(mod.id, e)}
                  onKeyDown={launchOnKey(mod.id)}
                  className="group bg-card rounded-[20px] p-4 border border-border shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 cursor-pointer flex flex-col gap-4 min-h-[172px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-[12px] brand-gradient flex items-center justify-center text-white shadow-sm shrink-0">
                      <Icon size={18} strokeWidth={1.75} />
                    </div>
                    <ArrowUpRight
                      size={16}
                      strokeWidth={1.75}
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>

                  <div className="flex flex-col flex-1">
                    <h3 className="text-[14px] font-semibold text-foreground tracking-tight">
                      {mod.name}
                    </h3>
                    <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">
                      {mod.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                      <span className="truncate">{statusLabel}</span>
                    </span>
                    <span className="font-medium text-primary shrink-0">
                      {modAccess.hasAccess ? "Mở" : "Kích hoạt"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Creative resources */}
        <section className="shrink-0">
          <div
            role="button"
            tabIndex={0}
            aria-label="Mở Kho Tài Nguyên Creative"
            onClick={(e) => handleLaunch("resources", e)}
            onKeyDown={launchOnKey("resources")}
            className="w-full bg-card rounded-[22px] p-5 border border-border shadow-sm hover:shadow-lg transition-shadow duration-200 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 group"
          >
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-11 h-11 rounded-[13px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Layers size={20} strokeWidth={1.75} />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
                    Kho Tài Nguyên Creative
                  </h3>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        resourcesAccess.hasAccess
                          ? !resourcesAccess.isTrial
                            ? "bg-success"
                            : "bg-warning"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                    {resourcesAccess.hasAccess
                      ? !resourcesAccess.isTrial
                        ? `Đã mua · ${formatRemainingDays(resourcesAccess.daysRemaining)}`
                        : `Dùng thử · ${resourcesAccess.daysRemaining ?? 0} ngày`
                      : "Chưa kích hoạt"}
                  </span>
                </div>
                <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-1 max-w-2xl">
                  Presets Lightroom, Actions Photoshop retouch da chuyên sâu, Brushes vẽ tóc và LUTs màu ảnh cưới, studio độc quyền.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  {["10.000+ Presets", "Actions Retouch Da", "LUTs Cinematic", "Brushes Studio", "RAW Profiles"].map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] text-muted-foreground px-2.5 h-6 inline-flex items-center rounded-full bg-foreground/[0.05]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="btn-base btn-primary shrink-0 self-end sm:self-center rounded-full px-5">
              <span>{resourcesAccess.hasAccess ? "Khám phá" : "Kích hoạt gói"}</span>
              <ArrowRight size={14} strokeWidth={2} className="group-hover:translate-x-0.5 transition-transform" />
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
        <footer className="pt-3 px-1 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground/80">DH Studio Pro</span>
            <span>v{version}</span>
            <span className="text-muted-foreground/50">·</span>
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
                  <ExternalLink size={11} strokeWidth={1.75} />
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
