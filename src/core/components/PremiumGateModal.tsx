import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Crown, Sparkles, X, ShieldAlert, KeyRound } from "lucide-react";
import { LicenseManager } from "@/core/license/LicenseManager";
import { PREMIUM_FEATURE_LABELS, type PremiumFeatureKey } from "@/core/services/premiumFeaturePolicy";

interface PremiumGateModalProps {
  featureKey: PremiumFeatureKey;
  onClose: () => void;
  reason?: string;
}

export function PremiumGateModal({
  featureKey,
  onClose,
  reason = "TRIAL_EXPIRED",
}: PremiumGateModalProps) {
  const [showLicenseManager, setShowLicenseManager] = useState(false);

  const featureTitle = PREMIUM_FEATURE_LABELS[featureKey] || "Tính năng VIP";

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showLicenseManager) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showLicenseManager]);

  if (showLicenseManager) {
    return (
      <LicenseManager
        onClose={() => {
          setShowLicenseManager(false);
          onClose();
        }}
        initialMode="request"
        initialIsPremium={true}
        variant="modal"
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="w-full max-w-md bg-card border border-amber-500/30 rounded-3xl p-6 shadow-2xl relative z-10 animate-scale-in text-foreground">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 w-7 h-7 rounded-full bg-muted hover:bg-muted/80 active:scale-95 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
          title="Đóng"
        >
          <X size={14} />
        </button>

        {/* Crown Icon Box */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 mb-3.5 shadow-lg shadow-amber-500/10">
            <Crown size={28} className="animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold uppercase tracking-wider mb-2">
            <Sparkles size={11} />
            <span>ĐẶC QUYỀN VIP PREMIUM</span>
          </div>

          <h3 className="text-base font-bold text-foreground tracking-tight mb-2">
            Nâng Cấp VIP Premium Để Mở Khóa
          </h3>

          <div className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-3.5 text-left flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-foreground/90 space-y-0.5">
              <p className="font-semibold text-amber-600 dark:text-amber-400">
                Tính năng: {featureTitle}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {reason === "TRIAL_EXPIRED"
                  ? "Thời hạn dùng thử miễn phí 7 ngày cho tính năng này đã kết thúc. Vui lòng nâng cấp tài khoản lên VIP Premium để tiếp tục sử dụng."
                  : "Chức năng này được bảo vệ bản quyền và chỉ dành riêng cho tài khoản được cấp quyền VIP Premium."}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
            Để lại thông tin liên hệ ngay bên dưới để chúng tôi hỗ trợ cấp mã License VIP Premium hoặc mở khóa nâng cấp tài khoản cho bạn nhanh nhất.
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 w-full">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] text-xs font-semibold text-muted-foreground hover:text-foreground border border-border transition-all cursor-pointer"
            >
              Để sau
            </button>

            <button
              type="button"
              onClick={() => setShowLicenseManager(true)}
              className="flex-[1.5] h-10 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:brightness-110 active:scale-[0.98] text-black font-extrabold text-xs shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <KeyRound size={13} />
              <span>Liên hệ cấp Premium</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
