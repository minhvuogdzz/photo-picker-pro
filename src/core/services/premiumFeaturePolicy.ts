import type { AuthSession } from "@/core/types/auth";
import { checkAppAccess } from "./appEntitlementPolicy.ts";

export type PremiumFeatureKey = "sheet_extract" | "sheet_config" | "multi_client" | "photo_counter";

export const PREMIUM_FEATURE_LABELS: Record<PremiumFeatureKey, string> = {
  sheet_extract: "Truy xuất trang tính",
  sheet_config: "Cấu hình Sheet",
  multi_client: "Lọc nhiều khách",
  photo_counter: "Thống kê & Tính lương",
};

/** Release date of update: 24/09/2026 00:00:00 GMT+7 */
export const APP_UPDATE_RELEASE_TIMESTAMP = 1790211600000;
/** Trial duration: 7 days in milliseconds */
export const SEVEN_DAYS_TRIAL_MS = 7 * 24 * 60 * 60 * 1000;
export const TRIAL_END_TIMESTAMP = APP_UPDATE_RELEASE_TIMESTAMP + SEVEN_DAYS_TRIAL_MS;

export interface FeatureAccessResult {
  readonly hasAccess: boolean;
  readonly isTrial: boolean;
  readonly isPremium: boolean;
  readonly daysRemaining: number;
  readonly reason:
    | "PREMIUM_UNLOCKED"
    | "TRIAL_ACTIVE"
    | "TRIAL_EXPIRED"
    | "NOT_LICENSED"
    | "NO_SESSION";
  readonly trialEndsAt?: string;
  readonly warning?: string;
}

/**
 * Evaluates feature access based on app entitlement and trial status.
 * All accounts in TRIAL have full access.
 * VIP/Premium concept is removed: `isPremium` is always false.
 */
export function checkPremiumFeatureAccess(
  session: AuthSession | null | undefined,
  featureKey?: PremiumFeatureKey
): FeatureAccessResult {
  if (!session) {
    return {
      hasAccess: false,
      isTrial: false,
      isPremium: false,
      daysRemaining: 0,
      reason: "NO_SESSION",
    };
  }

  const targetApp = featureKey === "photo_counter" ? "photo-counter" : "photo-picker";
  const appAccess = checkAppAccess(session, targetApp);

  return {
    hasAccess: appAccess.hasAccess,
    isTrial: appAccess.isTrial,
    isPremium: false, // VIP/Premium is completely removed
    daysRemaining: appAccess.daysRemaining ?? 0,
    reason: appAccess.hasAccess
      ? (appAccess.isTrial ? "TRIAL_ACTIVE" : "PREMIUM_UNLOCKED")
      : "NOT_LICENSED",
  };
}
