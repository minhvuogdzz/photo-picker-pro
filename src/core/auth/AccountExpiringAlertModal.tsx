import { useState } from "react";
import {
  AlertTriangle,
  Clock,
  Key,
  Send,
  X,
  Sparkles,
  Crown,
  CheckCircle2,
  Calendar,
  ExternalLink,
} from "lucide-react";
import type { ExpiringNoticeInfo } from "../services/accountExpirationService";

interface AccountExpiringAlertModalProps {
  readonly info: ExpiringNoticeInfo;
  readonly isOpen: boolean;
  readonly onDismiss: () => void;
  readonly onOpenLicenseManager: (mode: "activate" | "request", isVip: boolean) => void;
}

export function AccountExpiringAlertModal({
  info,
  isOpen,
  onDismiss,
  onOpenLicenseManager,
}: AccountExpiringAlertModalProps) {
  const [isDismissing, setIsDismissing] = useState(false);

  if (!isOpen) return null;

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss();
      setIsDismissing(false);
    }, 150);
  };

  const handleActivate = () => {
    onDismiss();
    onOpenLicenseManager("activate", info.isVip);
  };

  const handleRequest = () => {
    onDismiss();
    onOpenLicenseManager("request", info.isVip);
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

  const formattedDate = formatExpiryDate(info.expiresAt);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-gradient-to-tr from-amber-500/15 to-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div
        className={`relative z-10 w-full max-w-lg rounded-3xl p-6 sm:p-8 border border-amber-500/40 bg-[#13161f]/95 backdrop-blur-2xl shadow-[0_20px_70px_-15px_rgba(245,158,11,0.3)] text-center space-y-5 animate-scale-in transition-opacity ${
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
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.35)] animate-pulse">
              {info.isVip ? <Crown size={32} /> : <AlertTriangle size={32} />}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md font-black text-[10px]">
              !
            </div>
          </div>
        </div>

        {/* Tier Badge & Headline */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-extrabold uppercase tracking-wider">
            {info.isVip ? <Sparkles size={12} /> : <Clock size={12} />}
            {info.badgeLabel}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            {info.title}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed px-1">
            {info.message}
          </p>
        </div>

        {/* Countdown & Expiration Time Box */}
        <div className="grid grid-cols-2 gap-2.5 py-1 text-left">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
              Thời gian còn lại
            </span>
            <span className="text-lg font-mono font-black text-amber-300 mt-0.5 block">
              {info.daysRemaining === 0 ? "Hết hạn hôm nay" : `Còn ${info.daysRemaining} ngày`}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.03] border border-border/50">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block flex items-center gap-1">
              <Calendar size={11} /> Hạn kết thúc
            </span>
            <span className="text-xs sm:text-sm font-mono font-bold text-foreground mt-0.5 block truncate">
              {formattedDate || "Sắp hết hạn"}
            </span>
          </div>
        </div>

        {/* Affected Features Summary */}
        {info.affectedFeatures.length > 0 && (
          <div className="p-3 rounded-2xl bg-black/30 border border-white/5 text-left space-y-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Các tính năng duy trì:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {info.affectedFeatures.map((feat, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-white/80">
                  <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Button 1: Activate key directly */}
            <button
              type="button"
              onClick={handleActivate}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:via-orange-400 hover:to-amber-500 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Key size={15} />
              Kích hoạt Key bản quyền
            </button>

            {/* Button 2: Request key / renew */}
            <button
              type="button"
              onClick={handleRequest}
              className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/30 text-white font-bold text-xs sm:text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send size={15} />
              Yêu cầu cấp Key / Gia hạn
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
