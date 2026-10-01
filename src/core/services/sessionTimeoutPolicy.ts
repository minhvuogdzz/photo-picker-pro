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

/** Vietnam Timezone Offset: UTC+7 in milliseconds */
export const VN_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Computes the epoch timestamp (ms) of the next 00:00:00 (midnight) in Vietnam time (UTC+7).
 */
export function getNextVnMidnightTimestamp(nowMs: number = Date.now()): number {
  const vnNow = new Date(nowMs + VN_TIMEZONE_OFFSET_MS);
  const nextMidUtc = Date.UTC(
    vnNow.getUTCFullYear(),
    vnNow.getUTCMonth(),
    vnNow.getUTCDate() + 1,
    0, 0, 0, 0
  );
  return nextMidUtc - VN_TIMEZONE_OFFSET_MS;
}

/**
 * Computes the epoch timestamp (ms) of the start of the current day (00:00:00) in Vietnam time (UTC+7).
 */
export function getVnStartOfDayTimestamp(nowMs: number = Date.now()): number {
  const vnNow = new Date(nowMs + VN_TIMEZONE_OFFSET_MS);
  const startOfDayUtc = Date.UTC(
    vnNow.getUTCFullYear(),
    vnNow.getUTCMonth(),
    vnNow.getUTCDate(),
    0, 0, 0, 0
  );
  return startOfDayUtc - VN_TIMEZONE_OFFSET_MS;
}

/**
 * Checks whether a given timestamp was created on a previous day in Vietnam time (before today's 0h00 VN).
 */
export function isTimestampBeforeTodayVnMidnight(timestampMs: number, nowMs: number = Date.now()): boolean {
  return timestampMs < getVnStartOfDayTimestamp(nowMs);
}

/**
 * Computes remaining seconds from now until the next 00:00:00 (midnight) in Vietnam time.
 */
export function computeSecondsUntilVnMidnight(nowMs: number = Date.now()): number {
  const nextMidnight = getNextVnMidnightTimestamp(nowMs);
  return Math.max(0, Math.floor((nextMidnight - nowMs) / 1000));
}

/**
 * Formats seconds into "HH:mm:ss" or "mm:ss" string.
 */
export function formatHoursMinutesSeconds(totalSeconds: number): string {
  const safeSecs = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSecs / 3600);
  const mins = Math.floor((safeSecs % 3600) / 60);
  const secs = safeSecs % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
