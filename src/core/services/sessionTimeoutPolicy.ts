/**
 * Session Timeout Policy and Helper Functions
 * 
 * Enforces session duration limit (default 10 minutes, configurable by admin).
 */

export const DEFAULT_SESSION_DURATION_MINUTES = 10;
export const DEFAULT_SESSION_DURATION_MS = DEFAULT_SESSION_DURATION_MINUTES * 60 * 1000;
export const MAX_SESSION_DURATION_MS = DEFAULT_SESSION_DURATION_MS; // Alias for backward compatibility
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
  maxDurationMs: number = DEFAULT_SESSION_DURATION_MS,
  now: number = Date.now()
): number {
  const elapsed = now - startedAt;
  return Math.max(0, Math.ceil((maxDurationMs - elapsed) / 1000));
}

/** Determines if the session is expiring soon (<= 60 seconds remaining) */
export function isSessionExpiringSoon(remainingSeconds: number): boolean {
  return remainingSeconds > 0 && remainingSeconds <= 60;
}

/** Determines if the session reached the 30-second warning threshold */
export function isSessionWarning30s(remainingSeconds: number): boolean {
  return remainingSeconds > 0 && remainingSeconds <= 30;
}
