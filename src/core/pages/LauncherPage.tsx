import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { modules } from "@/registry";
import {
  ArrowRight,
  Sparkles,
  LayoutGrid,
  Layers,
  HardDrive,
  Trash2,
  Cpu,
  RefreshCw,
  ExternalLink,
  Check,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { apiRequest } from "@/core/services/apiClient";
import { checkAppAccess } from "@/core/services/appEntitlementPolicy";
import { LicenseManager } from "@/core/license/LicenseManager";

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

  const [version, setVersion] = useState("2.9.4");
  const [companyUrl, setCompanyUrl] = useState("");
  const [showLicenseManager, setShowLicenseManager] = useState(false);

  // Smart scan state simulation with exact mathematical consistency
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

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

  const handleSmartScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScanComplete(!scanComplete);
    }, 1200);
  };

  const resourcesAccess = checkAppAccess(session, "resources");

  // Circular gauge math (radius 44, diameter 110, viewBox 110x110)
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  // If not scanned: 97% used (480,24 GB used, 14,14 GB free, 30,39 GB purgeable)
  // If scanned: 91% used (449,85 GB used, 44,53 GB free, 30,39 GB reclaimed)
  const percent = scanComplete ? 91 : 97;
  const strokeDashoffset = circumference - (circumference * percent) / 100;

  // Endpoint white dot on circular gauge (start at -90deg)
  const angle = (percent / 100) * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  const dotX = 55 + radius * Math.cos(rad);
  const dotY = 55 + radius * Math.sin(rad);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar text-foreground select-none p-2">
      <div className="w-full max-w-7xl mx-auto my-auto flex flex-col gap-4 md:gap-5 py-2">
        
        {/* ========================================================= */}
        {/* TOP SECTION: 2 HERO CARDS SIDE-BY-SIDE (TO NHẤT)          */}
        {/* 1. BẢNG THEO DÕI BỘ NHỚ & RAM | 2. KHO TÀI NGUYÊN CREATIVE */}
        {/* ========================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 shrink-0">
          
          {/* Card 1: Bảng theo dõi Bộ nhớ, RAM & Hệ thống (7/12) */}
          <div className="lg:col-span-7 bg-card rounded-3xl p-5 border border-border shadow-xs flex flex-col justify-between gap-4 relative overflow-hidden">
            {/* Top Bar: Title + Status + Action Button */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  BỘ NHỚ & RAM HỆ THỐNG
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  scanComplete
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                    : "bg-[#fff3e0] text-[#e65100] dark:bg-[#382210] dark:text-[#ff9800] border-[#ff9800]/25"
                }`}>
                  {scanComplete ? (
                    <>
                      <Check size={11} className="text-emerald-500" />
                      <span>Đã dọn 30,39 GB</span>
                    </>
                  ) : (
                    <>
                      <span>⚠️</span>
                      <span>Sắp hết dung lượng</span>
                    </>
                  )}
                </span>
              </div>

              {/* Action Button: Quét thông minh */}
              <button
                type="button"
                onClick={handleSmartScan}
                disabled={isScanning}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#8b5cf6] hover:from-[#1d4ed8] hover:to-[#7c3aed] text-white font-bold text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer active:scale-97 shrink-0 disabled:opacity-75"
              >
                {isScanning ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} className="text-amber-300" />
                )}
                <span>
                  {isScanning
                    ? "Đang quét dọn..."
                    : scanComplete
                    ? "Quét lại"
                    : "Quét thông minh"}
                </span>
              </button>
            </div>

            {/* Middle: Large Circular Gauge + Stat + Progress Bar */}
            <div className="flex items-center gap-5">
              {/* Circular Gauge Ring */}
              <div className="relative flex items-center justify-center shrink-0 w-[110px] h-[110px]">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 110 110">
                  <defs>
                    <linearGradient id="hudBigGaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="50%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>

                  {/* Track */}
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    className="stroke-[#e8edf5] dark:stroke-[#262831]"
                    strokeWidth="8.5"
                    fill="none"
                  />

                  {/* Progress Arc */}
                  <circle
                    cx="55"
                    cy="55"
                    r={radius}
                    stroke="url(#hudBigGaugeGradient)"
                    strokeWidth="8.5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    fill="none"
                    className="transition-all duration-1000 ease-out"
                  />

                  {/* Endpoint Marker Dot */}
                  <circle
                    cx={dotX}
                    cy={dotY}
                    r="3.5"
                    fill="#ffffff"
                    className="filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-[#ff7a00] leading-none">
                    {percent}%
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase leading-none mt-1">
                    {scanComplete ? "TỐI ƯU" : "ĐÃ DÙNG"}
                  </span>
                </div>
              </div>

              {/* Big Stat & Progress Bar */}
              <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl md:text-3xl font-black text-[#ff7a00] tracking-tight leading-none">
                    {scanComplete ? "44,53 GB" : "14,14 GB"}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    trống trên 494,38 GB
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#e8edf5] dark:bg-[#262831] h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#2563eb] to-[#8b5cf6] rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                  <span>🔵 Đã dùng <strong>{scanComplete ? "449,85 GB" : "480,24 GB"}</strong></span>
                  <span>🟢 Có thể giải phóng <strong>{scanComplete ? "0 GB" : "30,39 GB"}</strong></span>
                </div>
              </div>
            </div>

            {/* Bottom: 4 Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-border/50">
              <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-xl p-2.5 border border-border/50 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#007aff] flex items-center justify-center text-white shrink-0 shadow-xs">
                  <HardDrive size={14} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-foreground truncate leading-tight">
                    {scanComplete ? "44,53 GB" : "14,14 GB"}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                    Dung lượng trống
                  </span>
                </div>
              </div>

              <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-xl p-2.5 border border-border/50 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#f97316] flex items-center justify-center text-white shrink-0 shadow-xs">
                  <Trash2 size={14} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-foreground truncate leading-tight">
                    {scanComplete ? "0 MB" : "30,39 GB"}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                    {scanComplete ? "Đã dọn sạch" : "Rác có thể dọn"}
                  </span>
                </div>
              </div>

              <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-xl p-2.5 border border-border/50 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#8b5cf6] flex items-center justify-center text-white shrink-0 shadow-xs">
                  <LayoutGrid size={14} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-foreground truncate leading-tight">
                    5 Công cụ
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                    Đã cài & sẵn sàng
                  </span>
                </div>
              </div>

              <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-xl p-2.5 border border-border/50 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#10b981] flex items-center justify-center text-white shrink-0 shadow-xs">
                  <Cpu size={14} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-foreground truncate leading-tight">
                    {scanComplete ? "0 GB" : "30,39 GB"}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">
                    macOS quản lý
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Kho Tài Nguyên Creative (Spotlight To Nhất - 5/12) */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Mở Kho Tài Nguyên Creative"
            onClick={(e) => handleLaunch("resources", e)}
            onKeyDown={launchOnKey("resources")}
            className="lg:col-span-5 bg-card rounded-3xl p-5 border border-amber-500/35 hover:border-amber-500/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3.5 group relative overflow-hidden"
          >
            {/* Header: Icon + Badge */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/35 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Layers size={22} />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-base font-extrabold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors tracking-tight truncate">
                    Kho Tài Nguyên Creative
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    10.000+ tài nguyên studio tuyển chọn
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/35 shrink-0">
                {resourcesAccess.hasAccess
                  ? !resourcesAccess.isTrial
                    ? `Đã mua · ${formatRemainingDays(resourcesAccess.daysRemaining)}`
                    : `Dùng thử · ${resourcesAccess.daysRemaining ?? 0} ngày`
                  : "Chưa kích hoạt"}
              </span>
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              Tuyển chọn đầy đủ Presets Lightroom, Actions Photoshop Retouch da chuyên sâu, Brushes cao cấp & LUTs màu ảnh cưới/studio.
            </p>

            {/* Tags Grid */}
            <div className="flex flex-wrap gap-1.5">
              {["10.000+ Presets", "Actions Retouch Da", "LUTs Cinematic", "Brushes Studio", "RAW Profiles"].map(
                (tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] text-amber-800 dark:text-amber-300 font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25"
                  >
                    {tag}
                  </span>
                )
              )}
            </div>

            {/* Call to action Button */}
            <div className="w-full py-2.5 px-4 rounded-xl bg-amber-500/15 group-hover:bg-amber-500/25 border border-amber-500/35 text-amber-800 dark:text-amber-300 font-bold text-xs transition-all flex items-center justify-center gap-2">
              <span>{resourcesAccess.hasAccess ? "Khám phá Kho Tài Nguyên" : "Kích hoạt gói ngay"}</span>
              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

        </section>

        {/* ========================================================= */}
        {/* CENTER SECTION: ỨNG DỤNG LÀM VIỆC (4 APPS COMPACT BLOCKS) */}
        {/* ========================================================= */}
        <section className="flex flex-col gap-2.5 shrink-0">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <LayoutGrid size={13} className="text-primary" />
              <span>Ứng dụng làm việc</span>
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium">
              {workflowApps.length} ứng dụng studio sẵn sàng
            </span>
          </div>

          {/* 4 App Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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
                  className="group bg-card rounded-2xl p-4 border border-border hover:border-primary/50 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between h-[155px]"
                >
                  <div className="flex flex-col">
                    {/* Header: Icon + License Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform duration-200 shrink-0">
                        <Icon size={17} />
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
                    <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors tracking-tight mb-1 truncate">
                      {mod.name}
                    </h3>

                    {/* Description */}
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                      {mod.description}
                    </p>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-semibold text-primary">
                    <span className="text-muted-foreground font-normal text-[10px]">
                      {modAccess.hasAccess ? "Sẵn sàng" : "Cần kích hoạt"}
                    </span>
                    <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>{modAccess.hasAccess ? "Khởi chạy" : "Kích hoạt"}</span>
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
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
            <span>© {new Date().getFullYear()} DevHouse Software</span>
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
