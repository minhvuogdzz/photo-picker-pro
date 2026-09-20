import test from "node:test";
import assert from "node:assert";
import {
  DEFAULT_SESSION_DURATION_MINUTES,
  DEFAULT_SESSION_DURATION_MS,
  MAX_SESSION_DURATION_MS,
  SESSION_START_KEY,
  formatSessionRemaining,
  computeRemainingSeconds,
  isSessionExpiringSoon,
  isSessionWarning30s,
} from "../src/core/services/sessionTimeoutPolicy.ts";

test("Session Timeout Constant: Exactly 10 minutes default duration", () => {
  assert.strictEqual(DEFAULT_SESSION_DURATION_MINUTES, 10);
  assert.strictEqual(DEFAULT_SESSION_DURATION_MS, 10 * 60 * 1000);
  assert.strictEqual(MAX_SESSION_DURATION_MS, 600_000);
  assert.strictEqual(SESSION_START_KEY, "session_started_at");
});

test("Session Timeout Formatter: Formats seconds to mm:ss correctly", () => {
  assert.strictEqual(formatSessionRemaining(600), "10:00");
  assert.strictEqual(formatSessionRemaining(599), "09:59");
  assert.strictEqual(formatSessionRemaining(65), "01:05");
  assert.strictEqual(formatSessionRemaining(60), "01:00");
  assert.strictEqual(formatSessionRemaining(30), "00:30");
  assert.strictEqual(formatSessionRemaining(9), "00:09");
  assert.strictEqual(formatSessionRemaining(0), "00:00");
  assert.strictEqual(formatSessionRemaining(-10), "00:00");
});

test("Session Timeout Calculation: Correctly computes remaining seconds from start timestamp", () => {
  const now = 1_000_000_000;

  // Just started
  const leftInitial = computeRemainingSeconds(now, MAX_SESSION_DURATION_MS, now);
  assert.strictEqual(leftInitial, 600);

  // 3 minutes elapsed (180s elapsed -> 420s remaining)
  const left3m = computeRemainingSeconds(now - 180_000, MAX_SESSION_DURATION_MS, now);
  assert.strictEqual(left3m, 420);

  // 9 minutes and 30 seconds elapsed (570s elapsed -> 30s remaining)
  const left9m30s = computeRemainingSeconds(now - 570_000, MAX_SESSION_DURATION_MS, now);
  assert.strictEqual(left9m30s, 30);

  // Exactly 10 minutes elapsed -> 0s remaining
  const leftExact = computeRemainingSeconds(now - 600_000, MAX_SESSION_DURATION_MS, now);
  assert.strictEqual(leftExact, 0);

  // Past 10 minutes (12 minutes) -> capped at 0 (never negative)
  const leftPast = computeRemainingSeconds(now - 720_000, MAX_SESSION_DURATION_MS, now);
  assert.strictEqual(leftPast, 0);
});

test("Session Timeout Custom Duration: Supports custom admin durations (5m, 15m, 60m)", () => {
  const now = 1_000_000_000;

  // 5 minutes session duration (300_000ms)
  const duration5m = 5 * 60 * 1000;
  const left5mInitial = computeRemainingSeconds(now, duration5m, now);
  assert.strictEqual(left5mInitial, 300);

  // 15 minutes session duration (900_000ms)
  const duration15m = 15 * 60 * 1000;
  const left15mInitial = computeRemainingSeconds(now, duration15m, now);
  assert.strictEqual(left15mInitial, 900);

  // 60 minutes session duration (3_600_000ms)
  const duration60m = 60 * 60 * 1000;
  const left60mInitial = computeRemainingSeconds(now, duration60m, now);
  assert.strictEqual(left60mInitial, 3600);
});

test("Session Timeout Expiring Soon: Triggers warning only when <= 60 seconds and > 0", () => {
  assert.strictEqual(isSessionExpiringSoon(600), false);
  assert.strictEqual(isSessionExpiringSoon(300), false);
  assert.strictEqual(isSessionExpiringSoon(61), false);
  assert.strictEqual(isSessionExpiringSoon(60), true);
  assert.strictEqual(isSessionExpiringSoon(30), true);
  assert.strictEqual(isSessionExpiringSoon(1), true);
  assert.strictEqual(isSessionExpiringSoon(0), false);
  assert.strictEqual(isSessionExpiringSoon(-1), false);
});

test("Session Timeout 30s Warning: Triggers 30s emergency warning modal only when <= 30s and > 0", () => {
  assert.strictEqual(isSessionWarning30s(600), false);
  assert.strictEqual(isSessionWarning30s(60), false);
  assert.strictEqual(isSessionWarning30s(31), false);
  assert.strictEqual(isSessionWarning30s(30), true);
  assert.strictEqual(isSessionWarning30s(15), true);
  assert.strictEqual(isSessionWarning30s(1), true);
  assert.strictEqual(isSessionWarning30s(0), false);
  assert.strictEqual(isSessionWarning30s(-5), false);
});
