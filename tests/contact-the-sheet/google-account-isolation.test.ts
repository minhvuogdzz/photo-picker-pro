import { test } from "node:test";
import assert from "node:assert/strict";
import { googleCredentialManager } from "../../src/modules/contact-the-sheet/services/googleCredentialBridge.ts";
import { useContactSheetStore, DEFAULT_PRODUCTION_PROFILE } from "../../src/modules/contact-the-sheet/stores/useContactSheetStore.ts";
import { useAuthStore } from "../../src/core/stores/useAuthStore.ts";
import type { AuthSession } from "../../src/core/types/auth.ts";

const createMockSession = (userId: string, email: string): AuthSession => ({
  userId,
  email,
  name: `User ${userId}`,
  accessToken: `mock_jwt_${userId}`,
  refreshToken: `mock_refresh_${userId}`,
  deviceId: "mock_device_1",
  lastSyncAt: new Date().toISOString(),
  subscription: {
    status: "ACTIVE",
    plan: "PROFESSIONAL",
    isPremium: true,
    expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    daysRemaining: 30,
  },
});

test("Google Account Isolation: User A and User B have strictly isolated Google credentials", async () => {
  // Simulate browser window.localStorage in node test environment
  const storageMock: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => storageMock[k] ?? null,
      setItem: (k: string, v: string) => { storageMock[k] = v; },
      removeItem: (k: string) => { delete storageMock[k]; },
      clear: () => { Object.keys(storageMock).forEach((k) => delete storageMock[k]); },
    },
  };

  // 1. User A logs into the app
  const sessionA = createMockSession("user_a", "vuong.studio.a@gmail.com");
  useAuthStore.getState().setSession(sessionA);

  // User A connects their Google Account
  storageMock["mvd_google_active_email_user_a"] = "google_user_a@gmail.com";
  storageMock["mvd_google_access_token_user_a"] = "ya29.user_a_token";
  storageMock["mvd_google_token_expires_at_user_a"] = String(Date.now() + 3600000);
  storageMock["mvd_google_user_name_user_a"] = "Vuong A Google";

  googleCredentialManager.restoreSavedSession();

  assert.equal(googleCredentialManager.isConnected(), true);
  assert.equal(googleCredentialManager.getAccountEmail(), "google_user_a@gmail.com");
  assert.equal(useContactSheetStore.getState().googleConnection.accountEmail, "google_user_a@gmail.com");
  assert.equal(useContactSheetStore.getState().googleConnection.status, "CONNECTED");

  // 2. User A logs out of the app
  useAuthStore.getState().logout();

  // On logout, Google connection must be disconnected in-memory and in useContactSheetStore
  assert.equal(googleCredentialManager.isConnected(), false);
  assert.equal(googleCredentialManager.getAccountEmail(), null);
  assert.equal(useContactSheetStore.getState().googleConnection.status, "DISCONNECTED");
  assert.equal(useContactSheetStore.getState().googleConnection.accountEmail, undefined);

  // 3. User B logs into the app on the same device
  const sessionB = createMockSession("user_b", "staff.studio.b@gmail.com");
  useAuthStore.getState().setSession(sessionB);

  // User B MUST NOT inherit User A's Google account!
  assert.equal(googleCredentialManager.isConnected(), false);
  assert.equal(googleCredentialManager.getAccountEmail(), null);
  assert.equal(useContactSheetStore.getState().googleConnection.status, "DISCONNECTED");
  assert.equal(useContactSheetStore.getState().googleConnection.accountEmail, undefined);

  // 4. User B connects a different Google Account
  storageMock["mvd_google_active_email_user_b"] = "google_user_b@gmail.com";
  storageMock["mvd_google_access_token_user_b"] = "ya29.user_b_token";
  storageMock["mvd_google_token_expires_at_user_b"] = String(Date.now() + 3600000);
  storageMock["mvd_google_user_name_user_b"] = "Staff B Google";

  googleCredentialManager.restoreSavedSession();

  assert.equal(googleCredentialManager.isConnected(), true);
  assert.equal(googleCredentialManager.getAccountEmail(), "google_user_b@gmail.com");
  assert.equal(useContactSheetStore.getState().googleConnection.accountEmail, "google_user_b@gmail.com");

  // 5. User B logs out, User A logs back in
  useAuthStore.getState().logout();
  assert.equal(googleCredentialManager.isConnected(), false);

  useAuthStore.getState().setSession(sessionA);
  assert.equal(googleCredentialManager.isConnected(), true);
  assert.equal(googleCredentialManager.getAccountEmail(), "google_user_a@gmail.com");

  // Clean up
  await googleCredentialManager.disconnectGoogle();
  assert.equal(googleCredentialManager.isConnected(), false);
});

test("Google Account Disconnect: Explicit disconnect clears credentials and resets connection state", async () => {
  const storageMock: Record<string, string> = {};
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => storageMock[k] ?? null,
      setItem: (k: string, v: string) => { storageMock[k] = v; },
      removeItem: (k: string) => { delete storageMock[k]; },
      clear: () => { Object.keys(storageMock).forEach((k) => delete storageMock[k]); },
    },
  };

  const session = createMockSession("user_disconnect_test", "test@studio.com");
  useAuthStore.getState().setSession(session);

  storageMock["mvd_google_active_email_user_disconnect_test"] = "to_disconnect@gmail.com";
  storageMock["mvd_google_access_token_user_disconnect_test"] = "ya29.token";
  storageMock["mvd_google_token_expires_at_user_disconnect_test"] = String(Date.now() + 3600000);

  googleCredentialManager.restoreSavedSession();
  assert.equal(googleCredentialManager.isConnected(), true);

  // User clicks "Đăng xuất Google"
  await googleCredentialManager.disconnectGoogle();

  assert.equal(googleCredentialManager.isConnected(), false);
  assert.equal(googleCredentialManager.getAccountEmail(), null);
  assert.equal(storageMock["mvd_google_active_email_user_disconnect_test"], undefined);
  assert.equal(useContactSheetStore.getState().googleConnection.status, "DISCONNECTED");
});

test("Google Sheet Link Parser: Accurately extracts spreadsheet ID from full URLs or raw IDs", () => {
  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    if (/^[a-zA-Z0-9-_]{15,}$/.test(trimmed)) {
      return trimmed;
    }
    return trimmed;
  };

  const standardUrl = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing";
  assert.equal(extractSpreadsheetId(standardUrl), "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");

  const multiAccountUrl = "https://docs.google.com/spreadsheets/u/1/d/1mQQ7FeFvy93kked5T_ob7wiiRa8XhX9lC54i6M_J0ak/edit#gid=0";
  assert.equal(extractSpreadsheetId(multiAccountUrl), "1mQQ7FeFvy93kked5T_ob7wiiRa8XhX9lC54i6M_J0ak");

  const rawId = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";
  assert.equal(extractSpreadsheetId(rawId), "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms");

  const emptyProfileId = DEFAULT_PRODUCTION_PROFILE.spreadsheetId;
  assert.equal(emptyProfileId, "");
});
