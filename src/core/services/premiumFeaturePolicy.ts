/**
 * VIP Premium Feature Policy & 7-Day Grace Trial Service
 * 
 * Rules:
 * 1. Accounts with `subscription.isPremium === true` have FULL UNRESTRICTED access.
 * 2. Accounts with active paid license (`status === 'ACTIVE' || status === 'LIFETIME'`)
 *    receive a 7-day free trial starting from the release date of this app update (2026-09-24T00:00:00+07:00).
 * 3. After 7 days, accounts that have not upgraded to Premium will be restricted (disabled with cursor-not-allowed).
 * 4. Accounts without active paid license (e.g., standard trial, expired, inactive) are immediately locked.
 * 5. Clock tampering / rollback protection using monotonic timestamp storage & server sync time.
 */

import type { AuthSession } from "@/core/types/auth";

export type PremiumFeatureKey = "sheet_extract" | "sheet_config" | "multi_client" | "photo_counter";

export const PREMIUM_FEATURE_LABELS: Record<PremiumFeatureKey, string> = {
  sheet_extract: "Truy xuất trang tính",
  sheet_config: "Cấu hình Sheet",
  multi_client: "Lọc nhiều khách",
  photo_counter: "Thống kê & Tính lương",
};

/** Release date of this update: 24/09/2026 00:00:00 GMT+7 */
export const APP_UPDATE_RELEASE_TIMESTAMP = 1790211600000; // 2026-09-24T00:00:00+07:00 in ms

/** Trial duration: 7 days in milliseconds */
export const SEVEN_DAYS_TRIAL_MS = 7 * 24 * 60 * 60 * 1000;

export const TRIAL_END_TIMESTAMP = APP_UPDATE_RELEASE_TIMESTAMP + SEVEN_DAYS_TRIAL_MS;

const MAX_KNOWN_TIME_KEY = "mvd_premium_policy_max_time";

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
 * Gets a tamper-resistant current timestamp.
 * Checks against server lastSyncAt and stored maximum seen timestamp.
 */
export function getSafeCurrentTime(session?: AuthSession | null, overrideNow?: number): number {
  if (typeof overrideNow === "number") {
    return overrideNow;
  }

  let now = Date.now();

  // Check against server lastSyncAt
  if (session?.lastSyncAt) {
    const serverTime = new Date(session.lastSyncAt).getTime();
    if (!isNaN(serverTime) && serverTime > now) {
      now = serverTime;
    }
  }

  // Check against local stored maximum known time (anti-rollback)
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(MAX_KNOWN_TIME_KEY);
      if (stored) {
        const storedMax = parseInt(stored, 10);
        if (!isNaN(storedMax) && storedMax > now) {
          now = storedMax;
        }
      }
      localStorage.setItem(MAX_KNOWN_TIME_KEY, String(now));
    }
  } catch {
    // Ignore localStorage errors in non-browser or sandbox environments
  }

  return now;
}

/**
 * Pure policy evaluation for VIP Premium features and 7-day trial.
 */
export function checkPremiumFeatureAccess(
  session: AuthSession | null | undefined,
  featureKey?: PremiumFeatureKey,
  overrideNow?: number
): FeatureAccessResult {
  // 1. No Session
  if (!session) {
    return {
      hasAccess: false,
      isTrial: false,
      isPremium: false,
      daysRemaining: 0,
      reason: "NO_SESSION",
    };
  }

  // 2. VIP Premium account: Full unrestricted access across all modules & features
  if (session.subscription?.isPremium === true) {
    return {
      hasAccess: true,
      isTrial: false,
      isPremium: true,
      daysRemaining: 999,
      reason: "PREMIUM_UNLOCKED",
    };
  }

  // 3. Standalone VIP Studio Ops Module: App Thống Kê & Tính Lương (photo_counter)
  // STRICTLY requires account granted VIP Premium (`session.subscription?.isPremium === true`).
  // The 7-day trial of Photo Picker does NOT apply to this module.
  if (featureKey === "photo_counter") {
    return {
      hasAccess: false,
      isTrial: false,
      isPremium: false,
      daysRemaining: 0,
      reason: "NOT_LICENSED",
    };
  }

  const status = session.subscription?.status;

  // 4. Paid license check for Photo Picker features: ACTIVE or LIFETIME (not standard TRIAL of the app)
  const isPaidLicense = status === "ACTIVE" || status === "LIFETIME";

  if (!isPaidLicense) {
    return {
      hasAccess: false,
      isTrial: false,
      isPremium: false,
      daysRemaining: 0,
      reason: "NOT_LICENSED",
    };
  }

  // 4. Calculate 7-day trial for paid license holders
  const currentTime = getSafeCurrentTime(session, overrideNow);
  const diff = TRIAL_END_TIMESTAMP - currentTime;

  if (diff > 0) {
    const daysRemaining = Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
    return {
      hasAccess: true,
      isTrial: true,
      isPremium: false,
      daysRemaining,
      reason: "TRIAL_ACTIVE",
      trialEndsAt: new Date(TRIAL_END_TIMESTAMP).toISOString(),
    };
  }

  // 5. 7-day trial expired: user must upgrade to VIP Premium
  return {
    hasAccess: false,
    isTrial: false,
    isPremium: false,
    daysRemaining: 0,
    reason: "TRIAL_EXPIRED",
  };
}
