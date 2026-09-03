/**
 * Pure Subscription Scheduling & Offline Licensing Policy
 * Decoupled from Tauri IPC and DOM for 100% testability.
 */

export const SUBSCRIPTION_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

export const SUBSCRIPTION_ERROR_BACKOFF_STEPS = [
  5 * 60 * 1000,   // 5 minutes
  15 * 60 * 1000,  // 15 minutes
  30 * 60 * 1000,  // 30 minutes
];

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface SubscriptionPolicyData {
  readonly status: "ACTIVE" | "TRIAL" | "EXPIRED" | "LIFETIME" | "SUSPENDED" | "CANCELLED" | "INACTIVE" | string;
  readonly expiresAt?: string | null;
}

export interface SessionPolicyData {
  readonly subscription: SubscriptionPolicyData;
  readonly lastSyncAt?: string | null;
}

/**
 * Checks if subscription status is considered active
 */
export function isSubscriptionStatusActive(status?: string): boolean {
  return status === "ACTIVE" || status === "TRIAL" || status === "LIFETIME";
}

/**
 * Calculates the next delay (ms) until the next subscription check.
 * 
 * Rules:
 * 1. If session is null, or status is permanently inactive (EXPIRED, SUSPENDED, CANCELLED, INACTIVE),
 *    returns null -> NO timer should be scheduled!
 * 2. If status is LIFETIME, no expiry check is needed -> returns null.
 * 3. If there was a network/request failure (failureCount > 0), applies backoff (5m -> 15m -> 30m),
 *    NEVER returns 0!
 * 4. If status is ACTIVE or TRIAL:
 *    - If has expired (timeUntilExpiry <= 0):
 *      - If has NOT been validated as expired yet (hasValidatedExpiry === false):
 *        returns 0 to validate immediately ONCE.
 *      - If has ALREADY been validated as expired:
 *        returns null to stop the loop completely!
 *    - If expires within 4 hours: schedules at exact expiry (+ 1s buffer).
 *    - Otherwise: schedules at default 4-hour check interval.
 */
export function getNextSubscriptionCheckDelay(
  session: SessionPolicyData | null,
  failureCount: number = 0,
  hasValidatedExpiry: boolean = false
): number | null {
  if (!session) return null;

  const status = session.subscription?.status;

  // Inactive or locked statuses should never schedule checks
  if (["EXPIRED", "SUSPENDED", "CANCELLED", "INACTIVE"].includes(status)) {
    return null;
  }

  // LIFETIME licenses do not expire
  if (status === "LIFETIME") {
    return null;
  }

  // If previous validation failed due to network error, apply backoff
  if (failureCount > 0) {
    const step = Math.min(failureCount - 1, SUBSCRIPTION_ERROR_BACKOFF_STEPS.length - 1);
    return SUBSCRIPTION_ERROR_BACKOFF_STEPS[step];
  }

  // ACTIVE or TRIAL without expiry date
  if (!session.subscription?.expiresAt) {
    return SUBSCRIPTION_CHECK_INTERVAL;
  }

  const expiry = new Date(session.subscription.expiresAt).getTime();
  const now = Date.now();
  const timeUntilExpiry = expiry - now;

  // Subscription has expired
  if (timeUntilExpiry <= 0) {
    // If not yet validated against server, check immediately ONCE
    if (!hasValidatedExpiry) {
      return 0;
    }
    // Already validated once -> stop loop!
    return null;
  }

  // Expiring within 4 hours -> check right when it expires (+1s buffer)
  if (timeUntilExpiry < SUBSCRIPTION_CHECK_INTERVAL) {
    return Math.max(1000, timeUntilExpiry + 1000);
  }

  return SUBSCRIPTION_CHECK_INTERVAL;
}

/**
 * Pure validation logic for whether a session can work in offline mode.
 * Evaluates status, expiration date, and 7-day sync grace period.
 */
export function canSessionWorkOfflineSync(
  session: SessionPolicyData | null,
  isGracePeriodValidFn?: (lastSyncAt: string) => boolean
): boolean {
  if (!session) return false;

  const status = session.subscription?.status;
  if (!isSubscriptionStatusActive(status)) {
    return false;
  }

  // For ACTIVE and TRIAL, verify expiration date
  if (status !== "LIFETIME") {
    if (!session.subscription?.expiresAt) {
      return false;
    }
    const expiryTime = new Date(session.subscription.expiresAt).getTime();
    if (isNaN(expiryTime) || expiryTime <= Date.now()) {
      return false; // Expired!
    }
  }

  // Verify 7-day offline grace period
  if (!session.lastSyncAt) {
    return false;
  }

  if (isGracePeriodValidFn) {
    return isGracePeriodValidFn(session.lastSyncAt);
  }

  const diff = Date.now() - new Date(session.lastSyncAt).getTime();
  return diff >= 0 && diff < SEVEN_DAYS_MS;
}
