import test from "node:test";
import assert from "node:assert/strict";
import {
  checkAccountExpiringNotice,
  calculateDaysRemaining,
} from "../src/core/services/accountExpirationService.ts";
import type { AuthSession } from "../src/core/types/auth.ts";

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
      expiresAt,
      daysRemaining: 2,
    },
  });

  const notice = checkAccountExpiringNotice(session, baseTime);

  assert.ok(notice, "Notice must be triggered");
  assert.equal(notice.isExpiringSoon, true);
  assert.equal(notice.category, "TRIAL");
  assert.equal(notice.daysRemaining, 2);
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
      expiresAt,
      daysRemaining: 7,
    },
  });

  const notice = checkAccountExpiringNotice(session, baseTime);
  assert.equal(notice, null, "Should not trigger notice when > 3 days remain");
});

test("Requirement 3 (C): Standard Active license with <= 3 days remaining triggers standard active notice", () => {
  const baseTime = new Date("2026-09-27T12:00:00Z").getTime();
  const expiresAt = new Date("2026-09-28T08:00:00Z").toISOString(); // 1 day

  const session = createMockSession({
    subscription: {
      status: "ACTIVE",
      plan: "STARTER",
      expiresAt,
      daysRemaining: 1,
    },
  });

  const notice = checkAccountExpiringNotice(session, baseTime);

  assert.ok(notice);
  assert.equal(notice.isExpiringSoon, true);
  assert.equal(notice.category, "ACTIVE_BASIC");
  assert.equal(notice.daysRemaining, 1);
  assert.equal(notice.title, "Bản Quyền Sắp Hết Hạn");
  assert.match(notice.message, /sắp hết hạn sử dụng/);
});

test("Requirement 3: Permanently expired or locked account returns null (AuthGuard blocks these)", () => {
  const expiredSession = createMockSession({
    subscription: {
      status: "EXPIRED",
      plan: "STARTER",
      expiresAt: "2026-09-20T00:00:00Z",
      daysRemaining: 0,
    },
  });

  assert.equal(checkAccountExpiringNotice(expiredSession), null);

  const suspendedSession = createMockSession({
    subscription: {
      status: "SUSPENDED",
      plan: "STARTER",
      expiresAt: null,
      daysRemaining: null,
    },
  });

  assert.equal(checkAccountExpiringNotice(suspendedSession), null);
});

test("Requirement 3: Null session returns null", () => {
  assert.equal(checkAccountExpiringNotice(null), null);
});
