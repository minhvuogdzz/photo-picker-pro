import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Clock,
  Key,
  QrCode,
  X,
  Sparkles,
  Crown,
  CheckCircle2,
  Calendar,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import type { ExpiringNoticeInfo } from "../services/accountExpirationService";
import { getPricingPackages, PricingPackage } from "../services/paymentApi";

interface AccountExpiringAlertModalProps {
  readonly info: ExpiringNoticeInfo;
  readonly isOpen: boolean;
  readonly onDismiss: () => void;
  readonly onOpenLicenseManager: (mode: "packages" | "activate", targetApp?: string) => void;
}

export function AccountExpiringAlertModal({
  info,
  isOpen,
  onDismiss,
  onOpenLicenseManager,
}: AccountExpiringAlertModalProps) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [packages, setPackages] = useState<PricingPackage[]>([]);

  useEffect(() => {
    if (isOpen) {
      getPricingPackages().then((pkgs) => setPackages(pkgs)).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss();
      setIsDismissing(false);
    }, 150);
  };

  const handleRenewPackage = (targetApp: string = "ALL") => {
    onDismiss();
    onOpenLicenseManager("packages", targetApp);
  };

  const handleActivate = () => {
    onDismiss();
    onOpenLicenseManager("activate");
  };

  const formatExpiryDate = (isoStr?: string | null) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  };

  const formatVND = (amt: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amt);
  };

  const formattedDate = formatExpiryDate(info.expiresAt);

  // Take top highlighted packages from DB safely
  const safePackages = Array.isArray(packages) ? packages : [];
  const highlightedPackages = safePackages.filter((p) => p && (p.isPopular || p.badge)).slice(0, 3);
  const displayPackages = highlightedPackages.length > 0 ? highlightedPackages : safePackages.slice(0, 3);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-gradient-to-tr from-amber-500/15 via-blue-500/10 to-orange-500/10 rounded-full blur-[110px] pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div
        className={`relative z-10 w-full max-w-xl rounded-3xl p-6 sm:p-7 border border-amber-500/40 bg-[#13161f]/95 backdrop-blur-2xl shadow-[0_20px_70px_-15px_rgba(245,158,11,0.3)] text-center space-y-4 animate-scale-in transition-opacity ${
          isDismissing ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        {/* Close / Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          title="Đóng thông báo"
        >
          <X size={18} />
        </button>

        {/* Top Glowing Icon Badge */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.35)] animate-pulse">
              <AlertTriangle size={28} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md font-black text-[10px]">
              !
            </div>
          </div>
        </div>

        {/* Tier Badge & Headline */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-extrabold uppercase tracking-wider">
            <Clock size={12} />
            CẢNH BÁO SẮP HẾT HẠN (≤ 3 NGÀY)
          </div>
          <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
            Gói Sử Dụng Của Bạn Sắp Hết Hạn
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed px-1">
            Vui lòng lựa chọn gói gia hạn phù hợp dưới đây để không làm gián đoạn tiến độ công việc studio của bạn.
          </p>
        </div>

        {/* Countdown & Expiration Time Box */}
        <div className="grid grid-cols-2 gap-2.5 text-left">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
              Thời gian còn lại
            </span>
            <span className="text-base font-mono font-black text-amber-300 mt-0.5 block">
              {info.daysRemaining === 0 ? "Hết hạn hôm nay" : `Còn ${info.daysRemaining} ngày`}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.03] border border-border/50">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block flex items-center gap-1">
              <Calendar size={11} /> Mốc kết thúc
            </span>
            <span className="text-xs font-mono font-bold text-foreground mt-0.5 block truncate">
              {formattedDate || "Sắp hết hạn"}
            </span>
          </div>
        </div>

        {/* Dynamic Packages Showcase from Database */}
        <div className="space-y-2 text-left">
          <div className="text-[11px] font-bold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Các gói gia hạn đề xuất (Cấu hình bởi Admin):
            </span>
            <button
              type="button"
              onClick={() => handleRenewPackage("ALL")}
              className="text-[10px] text-primary hover:underline flex items-center gap-1"
            >
              Xem tất cả gói <ArrowRight size={10} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {displayPackages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => handleRenewPackage(pkg.targetApp)}
                className="p-3 rounded-xl border border-border/80 bg-white/[0.02] hover:bg-white/[0.06] hover:border-primary/50 text-left transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {pkg.name.replace(/Gói /i, "")}
                    </span>
                    {pkg.badge && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                        {pkg.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-black text-primary mt-1">
                    {formatVND(pkg.price)}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground mt-2 font-medium flex items-center gap-1">
                  <span>+{pkg.durationDays} ngày</span>
                  <ArrowRight size={10} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Button 1: QR Payment */}
            <button
              type="button"
              onClick={() => handleRenewPackage("ALL")}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-primary via-blue-600 to-indigo-600 hover:from-primary/90 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <QrCode size={15} />
              Gia Hạn Ngay Qua VietQR
            </button>

            {/* Button 2: Manual Key */}
            <button
              type="button"
              onClick={handleActivate}
              className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/30 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Key size={15} />
              Đã Có Mã Key
            </button>
          </div>

          {/* Dismiss & Hotline */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground px-1">
            <a
              href="https://zalo.me/0981989098"
              target="_blank"
              rel="noreferrer"
              className="hover:text-amber-400 flex items-center gap-1 transition-colors"
            >
              <span>Hỗ trợ Zalo: 0981.989.098</span>
              <ExternalLink size={10} />
            </a>

            <button
              type="button"
              onClick={handleDismiss}
              className="hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
            >
              Để sau (Tiếp tục dùng)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
