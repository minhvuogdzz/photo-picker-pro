import test from "node:test";
import assert from "node:assert";
import {
  checkPremiumFeatureAccess,
  APP_UPDATE_RELEASE_TIMESTAMP,
  TRIAL_END_TIMESTAMP,
} from "../../src/core/services/premiumFeaturePolicy.ts";
import type { AuthSession } from "../../src/core/types/auth.ts";

function createMockSession(status: string, isPremium: boolean = false, lastSyncAt?: string): AuthSession {
  return {
    accessToken: "tok_test",
    refreshToken: "ref_test",
    userId: "user_123",
    email: "user@mvd.vn",
    name: "MVD Test User",
    deviceId: "dev_mac",
    lastSyncAt: lastSyncAt || new Date().toISOString(),
    subscription: {
      status: status as any,
      plan: "PROFESSIONAL",
      isPremium,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 1000).toISOString(),
      daysRemaining: 30,
    },
  };
}

test("Premium Policy: No session returns NO_SESSION and hasAccess = false", () => {
  const result = checkPremiumFeatureAccess(null);
  assert.strictEqual(result.hasAccess, false);
  assert.strictEqual(result.reason, "NO_SESSION");
});

test("Premium Policy: Account with isPremium = true always has full access to photo_counter and all features", () => {
  const session = createMockSession("ACTIVE", true);
  const resultCounter = checkPremiumFeatureAccess(session, "photo_counter");
  assert.strictEqual(resultCounter.hasAccess, true);
  assert.strictEqual(resultCounter.isPremium, true);
  assert.strictEqual(resultCounter.isTrial, false);
  assert.strictEqual(resultCounter.reason, "PREMIUM_UNLOCKED");

  const resultExtract = checkPremiumFeatureAccess(session, "sheet_extract");
  assert.strictEqual(resultExtract.hasAccess, true);
  assert.strictEqual(resultExtract.isPremium, true);

  const resultMulti = checkPremiumFeatureAccess(session, "multi_client");
  assert.strictEqual(resultMulti.hasAccess, true);
  assert.strictEqual(resultMulti.isPremium, true);
});

test("Premium Policy (CRITICAL): App Thống Kê (photo_counter) strictly blocks standard ACTIVE user without isPremium", () => {
  const session = createMockSession("ACTIVE", false);
  // Day 1 after update release (when Photo Picker features would have trial)
  const day1 = APP_UPDATE_RELEASE_TIMESTAMP + 1 * 24 * 60 * 60 * 1000;
  const result = checkPremiumFeatureAccess(session, "photo_counter", day1);

  assert.strictEqual(result.hasAccess, false);
  assert.strictEqual(result.isPremium, false);
  assert.strictEqual(result.isTrial, false);
  assert.strictEqual(result.reason, "NOT_LICENSED");
});

test("Premium Policy (CRITICAL): App Thống Kê (photo_counter) strictly blocks standard LIFETIME user without isPremium", () => {
  const session = createMockSession("LIFETIME", false);
  const day1 = APP_UPDATE_RELEASE_TIMESTAMP + 1 * 24 * 60 * 60 * 1000;
  const result = checkPremiumFeatureAccess(session, "photo_counter", day1);

  assert.strictEqual(result.hasAccess, false);
  assert.strictEqual(result.isPremium, false);
  assert.strictEqual(result.reason, "NOT_LICENSED");
});

test("Premium Policy: App Thống Kê (photo_counter) blocks base TRIAL account", () => {
  const trialSession = createMockSession("TRIAL", false);
  const result = checkPremiumFeatureAccess(trialSession, "photo_counter");
  assert.strictEqual(result.hasAccess, false);
});

test("Premium Policy: Photo Picker (multi_client) gets 7-day trial for paid ACTIVE license", () => {
  const session = createMockSession("ACTIVE", false);
  const day1 = APP_UPDATE_RELEASE_TIMESTAMP + 1 * 24 * 60 * 60 * 1000;
  const result = checkPremiumFeatureAccess(session, "multi_client", day1);

  assert.strictEqual(result.hasAccess, true);
  assert.strictEqual(result.isTrial, true);
  assert.strictEqual(result.isPremium, false);
  assert.strictEqual(result.reason, "TRIAL_ACTIVE");
  assert.strictEqual(result.daysRemaining, 6);
});

test("Premium Policy: Photo Picker (sheet_extract) gets 7-day trial for paid LIFETIME license", () => {
  const session = createMockSession("LIFETIME", false);
  const day1 = APP_UPDATE_RELEASE_TIMESTAMP + 1 * 24 * 60 * 60 * 1000;
  const result = checkPremiumFeatureAccess(session, "sheet_extract", day1);

  assert.strictEqual(result.hasAccess, true);
  assert.strictEqual(result.isTrial, true);
  assert.strictEqual(result.isPremium, false);
  assert.strictEqual(result.reason, "TRIAL_ACTIVE");
});

test("Premium Policy: Photo Picker features expired after 7 days for paid user without isPremium", () => {
  const session = createMockSession("ACTIVE", false);
  const day8 = TRIAL_END_TIMESTAMP + 1000;
  const resultExtract = checkPremiumFeatureAccess(session, "sheet_extract", day8);
  assert.strictEqual(resultExtract.hasAccess, false);
  assert.strictEqual(resultExtract.reason, "TRIAL_EXPIRED");

  const resultMulti = checkPremiumFeatureAccess(session, "multi_client", day8);
  assert.strictEqual(resultMulti.hasAccess, false);
  assert.strictEqual(resultMulti.reason, "TRIAL_EXPIRED");

  const resultConfig = checkPremiumFeatureAccess(session, "sheet_config", day8);
  assert.strictEqual(resultConfig.hasAccess, false);
  assert.strictEqual(resultConfig.reason, "TRIAL_EXPIRED");
});

test("Premium Policy: Base app TRIAL account is NOT eligible for 7-day VIP Premium trial on sheet_extract or multi_client", () => {
  const trialSession = createMockSession("TRIAL", false);
  const day2 = APP_UPDATE_RELEASE_TIMESTAMP + 2 * 24 * 60 * 60 * 1000;

  const resultMulti = checkPremiumFeatureAccess(trialSession, "multi_client", day2);
  assert.strictEqual(resultMulti.hasAccess, false);
  assert.strictEqual(resultMulti.reason, "NOT_LICENSED");

  const resultExtract = checkPremiumFeatureAccess(trialSession, "sheet_extract", day2);
  assert.strictEqual(resultExtract.hasAccess, false);
  assert.strictEqual(resultExtract.reason, "NOT_LICENSED");
});

test("Premium Policy: EXPIRED or INACTIVE account is immediately locked across all features", () => {
  const expiredSession = createMockSession("EXPIRED", false);
  assert.strictEqual(checkPremiumFeatureAccess(expiredSession, "photo_counter").hasAccess, false);
  assert.strictEqual(checkPremiumFeatureAccess(expiredSession, "sheet_extract").hasAccess, false);
  assert.strictEqual(checkPremiumFeatureAccess(expiredSession, "sheet_config").hasAccess, false);
  assert.strictEqual(checkPremiumFeatureAccess(expiredSession, "multi_client").hasAccess, false);
});
