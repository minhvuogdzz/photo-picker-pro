import { useAuthStore } from "@/core/stores/useAuthStore";
import { getUserPlanInfo } from "@/core/services/appEntitlementPolicy";
import { Sparkles, Clock, ShieldCheck, FileImage, Layers } from "lucide-react";

interface SubscriptionBadgeProps {
  onClick?: () => void;
}

/**
 * Compact badge displayed in TopBar showing subscription status.
 * Clearly differentiates between Full App, Photo Picker only, and Trial.
 */
export function SubscriptionBadge({ onClick }: SubscriptionBadgeProps) {
  const session = useAuthStore((s) => s.session);
  const isOffline = useAuthStore((s) => s.isOffline);

  if (!session) return null;

  const planInfo = getUserPlanInfo(session);

  const badgeClass = planInfo.isLifetime
    ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30"
    : planInfo.isFullApp && !planInfo.isTrial
      ? "bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25"
      : planInfo.isPhotoPickerOnly
        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
        : planInfo.isTrial
          ? "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
          : "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25";

  const icon = planInfo.isLifetime ? (
    <Sparkles size={11} className="shrink-0" />
  ) : planInfo.isFullApp && !planInfo.isTrial ? (
    <Layers size={11} className="shrink-0 text-blue-400" />
  ) : planInfo.isPhotoPickerOnly ? (
    <FileImage size={11} className="shrink-0 text-emerald-400" />
  ) : planInfo.isTrial ? (
    <Clock size={11} className="shrink-0 text-amber-400" />
  ) : (
    <ShieldCheck size={11} className="shrink-0" />
  );

  return (
    <div className="flex items-center gap-1.5">
      {isOffline && (
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          Offline
        </span>
      )}

      {/* Account Subscription Status Badge */}
      <button
        type="button"
        onClick={onClick}
        title={`${planInfo.planName} - Nhấn để xem quyền lợi chi tiết`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer select-none shadow-xs active:scale-95 ${badgeClass}`}
      >
        {icon}
        <span>{planInfo.badgeLabel}</span>
      </button>
    </div>
  );
}
