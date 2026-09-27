import test from "node:test";
import assert from "node:assert/strict";
import {
  checkAccountExpiringNotice,
  calculateDaysRemaining,
} from "../src/core/services/accountExpirationService.ts";
import type { AuthSession } from "../src/core/types/auth.ts";
import { APP_UPDATE_RELEASE_TIMESTAMP } from "../src/core/services/premiumFeaturePolicy.ts";

function createMockSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    accessToken: "mock_access_token",
    refreshToken: "mock_refresh_token",
    userId: "user_test_123",
    email: "customer@example.com",
    name: "Nguyễn Văn A",
    deviceId: "device_mac_001",
    lastSyncAt: new Date().toISOString(),
    subscription: {
      status: "TRIAL",
      plan: "STARTER",
      isPremium: false,
      expiresAt: null,
      daysRemaining: null,
    },
    ...overrides,
  };
}

test("calculateDaysRemaining computes days accurately", () => {
  const baseTime = new Date("2026-09-27T12:00:00Z").getTime();
  
  // 2 days in future
  const future2Days = new Date("2026-09-29T12:00:00Z").toISOString();
  assert.equal(calculateDaysRemaining(future2Days, baseTime), 2);

  // Past timestamp
  const past = new Date("2026-09-25T12:00:00Z").toISOString();
  assert.equal(calculateDaysRemaining(past, baseTime), 0);

  // Null or undefined
  assert.equal(calculateDaysRemaining(null, baseTime), null);
  assert.equal(calculateDaysRemaining(undefined, baseTime), null);
});

test("Requirement 3 (A): Standard Free Trial with <= 3 days remaining triggers warning notice", () => {
  const baseTime = new Date("2026-09-27T12:00:00Z").getTime();
  const expiresAt = new Date("2026-09-29T12:00:00Z").toISOString(); // 2 days

  const session = createMockSession({
    subscription: {
      status: "TRIAL",
      plan: "STARTER",
      isPremium: false,
      expiresAt,
      daysRemaining: 2,
    },
  });

  const notice = checkAccountExpiringNotice(session, baseTime);

  assert.ok(notice, "Notice must be triggered");
  assert.equal(notice.isExpiringSoon, true);
  assert.equal(notice.category, "TRIAL");
  assert.equal(notice.daysRemaining, 2);
  assert.equal(notice.isVip, false);
  assert.equal(notice.title, "Tài Khoản Dùng Thử Sắp Hết Hạn");
  assert.match(notice.message, /sắp hết thời gian dùng thử/);
  assert.match(notice.message, /còn 2 ngày/);
});

test("Requirement 3 (A): Standard Free Trial with > 3 days remaining does NOT trigger notice", () => {
  const baseTime = new Date("2026-09-27T12:00:00Z").getTime();
  const expiresAt = new Date("2026-10-04T12:00:00Z").toISOString(); // 7 days

  const session = createMockSession({
    subscription: {
      status: "TRIAL",
      plan: "STARTER",
      isPremium: false,
      expiresAt,
      daysRemaining: 7,
    },
  });

  const notice = checkAccountExpiringNotice(session, baseTime);
  assert.equal(notice, null, "Should not trigger notice when > 3 days remain");
});

test("Requirement 3 (B): VIP Premium account with <= 3 days remaining triggers VIP expiration notice", () => {
  const baseTime = new Date("2026-09-27T12:00:00Z").getTime();
  const expiresAt = new Date("2026-09-30T10:00:00Z").toISOString(); // 3 days

  const session = createMockSession({
    subscription: {
      status: "ACTIVE",
      plan: "STUDIO",
      isPremium: true,
      expiresAt,
      daysRemaining: 3,
    },
  });

  const notice = checkAccountExpiringNotice(session, baseTime);

  assert.ok(notice, "VIP Notice must be triggered");
  assert.equal(notice.isExpiringSoon, true);
  assert.equal(notice.category, "VIP_PREMIUM");
  assert.equal(notice.daysRemaining, 3);
  assert.equal(notice.isVip, true);
  assert.equal(notice.title, "Gói VIP Premium Sắp Hết Hạn");
  assert.match(notice.message, /Gói VIP Premium của bạn sắp hết hạn/);
  assert.ok(notice.affectedFeatures.some(f => f.includes("Google Sheet")));
});

test("Requirement 3 (B): VIP Premium account with > 3 days remaining does NOT trigger notice", () => {
  const baseTime = new Date("2026-09-27T12:00:00Z").getTime();
  const expiresAt = new Date("2026-10-15T12:00:00Z").toISOString(); // 18 days

  const session = createMockSession({
    subscription: {
      status: "ACTIVE",
      plan: "STUDIO",
      isPremium: true,
      expiresAt,
      daysRemaining: 18,
    },
  });

  const notice = checkAccountExpiringNotice(session, baseTime);
  assert.equal(notice, null);
});

test("Requirement 3 (C): Standard Active license with <= 3 days remaining triggers standard active notice", () => {
  const baseTime = new Date("2026-09-27T12:00:00Z").getTime();
  const expiresAt = new Date("2026-09-28T08:00:00Z").toISOString(); // 1 day

  const session = createMockSession({
    subscription: {
      status: "ACTIVE",
      plan: "STARTER",
      isPremium: false,
      expiresAt,
      daysRemaining: 1,
    },
  });

  const notice = checkAccountExpiringNotice(session, baseTime);

  assert.ok(notice);
  assert.equal(notice.isExpiringSoon, true);
  assert.equal(notice.category, "ACTIVE_BASIC");
  assert.equal(notice.daysRemaining, 1);
  assert.equal(notice.isVip, false);
  assert.equal(notice.title, "Bản Quyền Sắp Hết Hạn");
  assert.match(notice.message, /sắp hết hạn sử dụng/);
});

test("Requirement 3 (D): Lifetime account on 7-Day VIP grace trial with <= 3 days triggers VIP Trial notice", () => {
  // Release was 2026-09-24T00:00:00+07:00 (timestamp 1790211600000)
  // End of 7-day trial is +7 days (2026-10-01T00:00:00+07:00)
  // At 2026-09-28T12:00:00+07:00 (approx 2.5 days left -> <= 3 days)
  const simulatedTime = APP_UPDATE_RELEASE_TIMESTAMP + (4.5 * 24 * 60 * 60 * 1000);

  const session = createMockSession({
    subscription: {
      status: "LIFETIME",
      plan: "LIFETIME",
      isPremium: false,
      expiresAt: null,
      daysRemaining: null,
    },
  });

  const notice = checkAccountExpiringNotice(session, simulatedTime);

  assert.ok(notice, "VIP Trial Notice must trigger for Lifetime account");
  assert.equal(notice.isExpiringSoon, true);
  assert.equal(notice.category, "VIP_TRIAL");
  assert.equal(notice.isVip, true);
  assert.ok(notice.daysRemaining <= 3);
  assert.equal(notice.title, "Dùng Thử VIP Premium Sắp Hết Hạn");
  assert.match(notice.message, /thời gian dùng thử tính năng VIP Premium/i);
});

test("Requirement 3: Permanently expired or locked account returns null (AuthGuard blocks these)", () => {
  const expiredSession = createMockSession({
    subscription: {
      status: "EXPIRED",
      plan: "STARTER",
      isPremium: false,
      expiresAt: "2026-09-20T00:00:00Z",
      daysRemaining: 0,
    },
  });

  assert.equal(checkAccountExpiringNotice(expiredSession), null);

  const suspendedSession = createMockSession({
    subscription: {
      status: "SUSPENDED",
      plan: "STARTER",
      isPremium: false,
      expiresAt: null,
      daysRemaining: null,
    },
  });

  assert.equal(checkAccountExpiringNotice(suspendedSession), null);
});

test("Requirement 3: Null session returns null", () => {
  assert.equal(checkAccountExpiringNotice(null), null);
});
