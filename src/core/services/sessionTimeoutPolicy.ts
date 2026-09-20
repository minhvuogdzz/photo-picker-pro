/**
 * Session Timeout Policy and Helper Functions
 * 
 * Enforces a strict 10-minute maximum session duration.
 */

export const MAX_SESSION_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const SESSION_START_KEY = "session_started_at";

/** Formats remaining seconds to "mm:ss" string */
export function formatSessionRemaining(totalSeconds: number): string {
  const safeSecs = Math.max(0, totalSeconds);
  const mins = Math.floor(safeSecs / 60);
  const secs = safeSecs % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/** Computes remaining seconds from a given start timestamp */
export function computeRemainingSeconds(
  startedAt: number,
  maxDurationMs: number = MAX_SESSION_DURATION_MS,
  now: number = Date.now()
): number {
  const elapsed = now - startedAt;
  return Math.max(0, Math.ceil((maxDurationMs - elapsed) / 1000));
}

/** Determines if the session is expiring soon (<= 60 seconds remaining) */
export function isSessionExpiringSoon(remainingSeconds: number): boolean {
  return remainingSeconds > 0 && remainingSeconds <= 60;
}
