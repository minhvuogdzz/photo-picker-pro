import { useAuthStore } from "@/core/stores/useAuthStore";
import { Crown, Sparkles, Clock, ShieldCheck } from "lucide-react";

/**
 * Compact badge displayed in TopBar showing subscription status.
 * Shows plan name, days remaining, and Crown icon if user has Premium.
 */
export function SubscriptionBadge() {
  const session = useAuthStore((s) => s.session);
  const isOffline = useAuthStore((s) => s.isOffline);

  if (!session) return null;

  const { status, plan, isPremium, daysRemaining } = session.subscription;

  const isLifetime = status === "LIFETIME";
  const isTrial = status === "TRIAL";
  const isNearExpiry = daysRemaining !== null && daysRemaining <= 7;

  const badgeClass = isLifetime
    ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border-amber-500/30"
    : isTrial
      ? "bg-info/10 text-info border-info/30"
      : isNearExpiry
        ? "bg-warning/10 text-warning border-warning/30"
        : "bg-success/10 text-success border-success/30";

  const icon = isLifetime ? (
    <Sparkles size={11} />
  ) : isTrial ? (
    <Clock size={11} />
  ) : (
    <ShieldCheck size={11} />
  );

  const label = isLifetime
    ? "Lifetime"
    : isTrial
      ? `Trial · ${daysRemaining ?? 0}d`
      : `${plan} · ${daysRemaining ?? "∞"}d`;

  return (
    <div className="flex items-center gap-1.5">
      {isOffline && (
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          Offline
        </span>
      )}

      {/* Account Subscription Status Badge */}
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badgeClass}`}
      >
        {icon}
        {label}
      </span>

      {/* Crown Icon / Premium Badge for VIP Premium accounts */}
      {isPremium && (
        <span
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-500/25 via-yellow-400/25 to-amber-500/25 text-amber-300 border border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)] select-none"
          title="Tài khoản VIP Premium (Đã mở khóa Kho Tài Nguyên)"
        >
          <Crown size={12} className="text-amber-400 fill-amber-400/50" />
          <span>Premium</span>
        </span>
      )}
    </div>
  );
}
