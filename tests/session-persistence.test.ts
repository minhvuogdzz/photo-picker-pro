import test from "node:test";
import assert from "node:assert";
import { mergeSession, toLocalSession } from "../src/core/services/sessionPersistence.ts";
import type { AuthSession } from "../src/core/types/auth.ts";

const paidSession: AuthSession = {
  accessToken: "old_access",
  refreshToken: "old_refresh",
  userId: "user_1",
  email: "user@example.com",
  name: "User",
  subscription: {
    status: "ACTIVE",
    plan: "STUDIO",
    isPremium: true,
    expiresAt: "2099-01-01T00:00:00.000Z",
    daysRemaining: 100,
    entitlements: [{ app: "ALL", expiresAt: "2099-01-01T00:00:00.000Z", isTrial: false }],
  },
  entitlements: [{ app: "ALL", expiresAt: "2099-01-01T00:00:00.000Z", isTrial: false }],
  deviceId: "dvf_abc_userexamplecom",
  lastSyncAt: "2026-10-01T00:00:00.000Z",
  sessionDurationMinutes: 0,
};

test("mergeSession: a refresh response keeps fields the endpoint omits", () => {
  // Shape of /auth/refresh: no isPremium, no top-level entitlements, no sessionDurationMinutes
  const merged = mergeSession(paidSession, {
    accessToken: "new_access",
    refreshToken: "new_refresh",
    subscription: {
      status: "ACTIVE",
      plan: "STUDIO",
      expiresAt: "2099-01-01T00:00:00.000Z",
      daysRemaining: 99,
      entitlements: [{ app: "ALL", expiresAt: "2099-01-01T00:00:00.000Z" }],
    },
  });

  assert.strictEqual(merged.accessToken, "new_access");
  assert.strictEqual(merged.refreshToken, "new_refresh");
  assert.strictEqual(merged.subscription.isPremium, true);
  assert.strictEqual(merged.subscription.daysRemaining, 99);
  assert.strictEqual(merged.sessionDurationMinutes, 0);
  assert.strictEqual(merged.entitlements?.length, 1);
});

test("mergeSession: keeps existing entitlements when the response has none", () => {
  const merged = mergeSession(paidSession, { accessToken: "new_access" });
  assert.deepStrictEqual(merged.entitlements, paidSession.entitlements);
  assert.deepStrictEqual(merged.subscription.entitlements, paidSession.subscription.entitlements);
});

test("toLocalSession: persists entitlements so offline launches keep the paid plan", () => {
  const local = toLocalSession(paidSession);
  assert.strictEqual(local.entitlements?.length, 1);
  assert.strictEqual(local.entitlements?.[0].app, "ALL");
  assert.strictEqual(local.is_premium, true);
  assert.strictEqual(local.device_id, "dvf_abc_userexamplecom");
});
