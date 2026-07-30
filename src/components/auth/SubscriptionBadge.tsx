import { useAuthStore } from "@/stores/useAuthStore";
import { Crown, Sparkles, Clock } from "lucide-react";

/**
 * Compact badge displayed in TopBar showing subscription status.
 * Shows plan name, days remaining, and appropriate visual styling.
 */
export function SubscriptionBadge() {
  const session = useAuthStore((s) => s.session);
  const isOffline = useAuthStore((s) => s.isOffline);

  if (!session) return null;

  const { status, plan, daysRemaining } = session.subscription;

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
    <Crown size={11} />
  );

  const label = isLifetime
    ? "Lifetime"
    : isTrial
      ? `Trial · ${daysRemaining ?? 0}d`
      : `${plan} · ${daysRemaining ?? "∞"}d`;

  return (
    <div className="flex items-center gap-2">
      {isOffline && (
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          Offline
        </span>
      )}
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badgeClass}`}
      >
        {icon}
        {label}
      </span>
    </div>
  );
}
