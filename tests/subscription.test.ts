import test from "node:test";
import assert from "node:assert";
import {
  getNextSubscriptionCheckDelay,
  SUBSCRIPTION_CHECK_INTERVAL,
  canSessionWorkOfflineSync,
} from "../src/core/services/subscriptionPolicy.ts";
import type { SessionPolicyData } from "../src/core/services/subscriptionPolicy.ts";

function createMockSession(status: string, expiresAt?: string | null, lastSyncAt?: string | null): SessionPolicyData {
  return {
    subscription: {
      status,
      expiresAt: expiresAt ?? null,
    },
    lastSyncAt: lastSyncAt ?? new Date().toISOString(),
  };
}

test("Subscription Delay: ACTIVE with > 4 hours remaining returns 4-hour check interval", () => {
  const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  const session = createMockSession("ACTIVE", futureExpiry);

  const delay = getNextSubscriptionCheckDelay(session);
  assert.strictEqual(delay, SUBSCRIPTION_CHECK_INTERVAL);
  assert.strictEqual(delay, 4 * 60 * 60 * 1000);
});

test("Subscription Delay: ACTIVE with < 4 hours remaining returns exact time to expiry", () => {
  const halfHourMs = 30 * 60 * 1000;
  const futureExpiry = new Date(Date.now() + halfHourMs).toISOString(); // 30 minutes
  const session = createMockSession("ACTIVE", futureExpiry);

  const delay = getNextSubscriptionCheckDelay(session);
  assert.notStrictEqual(delay, null);
  // Delay should be approximately 30m + 1s buffer (between 29m and 31m)
  assert.ok(delay! > 25 * 60 * 1000 && delay! <= 31 * 60 * 1000);
});

test("Subscription Delay: ACTIVE already expired validates immediately ONCE (0ms) then stops (null)", () => {
  const pastExpiry = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
  const session = createMockSession("ACTIVE", pastExpiry);

  // First time when expiry detected: validate immediately once
  const firstDelay = getNextSubscriptionCheckDelay(session, 0, false);
  assert.strictEqual(firstDelay, 0, "First check after expiry should be 0 to validate immediately");

  // After server has returned EXPIRED (or after 1 validation run): STOP loop!
  const secondDelay = getNextSubscriptionCheckDelay(session, 0, true);
  assert.strictEqual(secondDelay, null, "Subsequent check after validation must be null to stop the loop");
});

test("Subscription Delay: TRIAL already expired validates once then stops", () => {
  const pastExpiry = new Date(Date.now() - 10000).toISOString();
  const session = createMockSession("TRIAL", pastExpiry);

  const firstDelay = getNextSubscriptionCheckDelay(session, 0, false);
  assert.strictEqual(firstDelay, 0);

  const secondDelay = getNextSubscriptionCheckDelay(session, 0, true);
  assert.strictEqual(secondDelay, null);
});

test("Subscription Delay: EXPIRED status returns null (no timers)", () => {
  const session = createMockSession("EXPIRED", new Date(Date.now() - 10000).toISOString());
  const delay = getNextSubscriptionCheckDelay(session);
  assert.strictEqual(delay, null, "EXPIRED session must never schedule a timer");
});

test("Subscription Delay: SUSPENDED status returns null (no timers)", () => {
  const session = createMockSession("SUSPENDED", new Date(Date.now() + 100000).toISOString());
  const delay = getNextSubscriptionCheckDelay(session);
  assert.strictEqual(delay, null, "SUSPENDED session must never schedule a timer");
});

test("Subscription Delay: LIFETIME status returns null (does not expire)", () => {
  const session = createMockSession("LIFETIME", null);
  const delay = getNextSubscriptionCheckDelay(session);
  assert.strictEqual(delay, null, "LIFETIME session must never schedule an expiry timer");
});

test("Subscription Delay: Network validation failure uses exponential backoff and NEVER 0", () => {
  const pastExpiry = new Date(Date.now() - 5000).toISOString();
  const session = createMockSession("ACTIVE", pastExpiry);

  // When request fails once (failureCount = 1), backoff 5 minutes
  const backoff1 = getNextSubscriptionCheckDelay(session, 1, false);
  assert.strictEqual(backoff1, 5 * 60 * 1000, "1st failure must back off 5 minutes, never 0");

  // When request fails twice (failureCount = 2), backoff 15 minutes
  const backoff2 = getNextSubscriptionCheckDelay(session, 2, false);
  assert.strictEqual(backoff2, 15 * 60 * 1000, "2nd failure must back off 15 minutes");

  // When request fails 3+ times, backoff 30 minutes
  const backoff3 = getNextSubscriptionCheckDelay(session, 3, false);
  assert.strictEqual(backoff3, 30 * 60 * 1000, "3rd failure must back off 30 minutes");
});

test("Subscription Loop Simulation: No infinite request loop occurs when expired", () => {
  let session = createMockSession("ACTIVE", new Date(Date.now() - 1000).toISOString());
  let requestCount = 0;
  let hasValidatedExpiry = false;

  // Simulate scheduler loop
  for (let cycle = 0; cycle < 10; cycle++) {
    const delay = getNextSubscriptionCheckDelay(session, 0, hasValidatedExpiry);
    if (delay === null) {
      // Loop successfully terminated!
      break;
    }

    if (delay === 0) {
      requestCount++;
      // Server responds with EXPIRED
      session = createMockSession("EXPIRED", session.subscription.expiresAt);
      hasValidatedExpiry = true;
    }
  }

  assert.strictEqual(requestCount, 1, "Validation request must run exactly ONCE upon expiration, then stop");
});

test("Offline Licensing: ACTIVE with valid future expiry & sync within 7 days is permitted", () => {
  const futureExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const recentSync = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
  const session = createMockSession("ACTIVE", futureExpiry, recentSync);

  assert.strictEqual(canSessionWorkOfflineSync(session), true);
});

test("Offline Licensing: ACTIVE with expired expiry date is NOT permitted offline", () => {
  const pastExpiry = new Date(Date.now() - 1000).toISOString(); // 1s ago
  const recentSync = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const session = createMockSession("ACTIVE", pastExpiry, recentSync);

  assert.strictEqual(canSessionWorkOfflineSync(session), false, "Expired expiry date must reject offline bypass");
});

test("Offline Licensing: ACTIVE with sync older than 7 days is NOT permitted offline", () => {
  const futureExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const oldSync = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(); // 8 days ago
  const session = createMockSession("ACTIVE", futureExpiry, oldSync);

  assert.strictEqual(canSessionWorkOfflineSync(session), false, "Sync older than 7 days must reject offline bypass");
});

test("Offline Licensing: LIFETIME with recent sync is permitted offline without expiry date", () => {
  const recentSync = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const session = createMockSession("LIFETIME", null, recentSync);

  assert.strictEqual(canSessionWorkOfflineSync(session), true);
});

test("Offline Licensing: EXPIRED, SUSPENDED, or CANCELLED sessions are NOT permitted offline", () => {
  const recentSync = new Date(Date.now() - 1000).toISOString();
  assert.strictEqual(canSessionWorkOfflineSync(createMockSession("EXPIRED", null, recentSync)), false);
  assert.strictEqual(canSessionWorkOfflineSync(createMockSession("SUSPENDED", null, recentSync)), false);
  assert.strictEqual(canSessionWorkOfflineSync(createMockSession("CANCELLED", null, recentSync)), false);
});
