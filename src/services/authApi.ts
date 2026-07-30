/**
 * Auth API service.
 *
 * Provides login, logout, subscription validation, and password reset.
 * Currently uses a local mock implementation (no backend required).
 * When the NestJS backend is deployed, swap mock calls for real HTTP requests.
 */

import { invoke } from "@tauri-apps/api/core";
import { apiRequest, USE_MOCK, isOnline } from "./apiClient";
import type {
  AuthSession,
  LocalSession,
  LoginRequest,
  SubscriptionInfo,
} from "@/types/auth";

/** Trial duration in days */
const TRIAL_DAYS = 7;

/** Subscription validation interval in milliseconds (4 hours) */
export const SUBSCRIPTION_CHECK_INTERVAL = 4 * 60 * 60 * 1000;

/** Converts AuthSession to LocalSession for Rust storage */
function toLocalSession(session: AuthSession): LocalSession {
  return {
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    user_id: session.userId,
    email: session.email,
    name: session.name,
    subscription_status: session.subscription.status,
    subscription_plan: session.subscription.plan,
    expires_at: session.subscription.expiresAt,
    device_id: session.deviceId,
    last_sync_at: session.lastSyncAt,
  };
}

/** Converts LocalSession from Rust storage to AuthSession */
function fromLocalSession(local: LocalSession): AuthSession {
  const expiresAt = local.expires_at;
  let daysRemaining: number | null = null;

  if (expiresAt) {
    const expiry = new Date(expiresAt).getTime();
    const now = Date.now();
    daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
  }

  return {
    accessToken: local.access_token,
    refreshToken: local.refresh_token,
    userId: local.user_id,
    email: local.email,
    name: local.name,
    subscription: {
      status: local.subscription_status as AuthSession["subscription"]["status"],
      plan: local.subscription_plan as AuthSession["subscription"]["plan"],
      expiresAt: local.expires_at,
      daysRemaining,
    },
    deviceId: local.device_id,
    lastSyncAt: local.last_sync_at,
  };
}

/** Creates a mock trial subscription */
function createTrialSubscription(): SubscriptionInfo {
  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return {
    status: "TRIAL",
    plan: "STARTER",
    expiresAt,
    daysRemaining: TRIAL_DAYS,
  };
}

/**
 * Authenticates user with email and password.
 * In mock mode: accepts any credentials with password >= 6 chars.
 */
export async function login(request: LoginRequest, autoLogin: boolean = true): Promise<AuthSession> {
  if (USE_MOCK) {
    // Mock validation
    if (!request.email.includes("@")) {
      throw new Error("Email không hợp lệ");
    }
    if (request.password.length < 6) {
      throw new Error("Mật khẩu phải có ít nhất 6 ký tự");
    }

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800));

    const session: AuthSession = {
      accessToken: `mock_at_${Date.now()}`,
      refreshToken: `mock_rt_${Date.now()}`,
      userId: `user_${request.email.split("@")[0]}`,
      email: request.email,
      name: request.email.split("@")[0],
      subscription: createTrialSubscription(),
      deviceId: request.deviceFingerprint,
      lastSyncAt: new Date().toISOString(),
    };

    // Save session based on autoLogin choice
    if (autoLogin) {
      await invoke("save_auth_session", { session: toLocalSession(session) });
    } else {
      sessionStorage.setItem("temp_auth_session", JSON.stringify(session));
      sessionStorage.setItem("auto_login", "false");
    }
    return session;
  }

  // Real API call
  const session = await apiRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: request,
  });
  
  if (autoLogin) {
    await invoke("save_auth_session", { session: toLocalSession(session) });
  } else {
    sessionStorage.setItem("temp_auth_session", JSON.stringify(session));
    sessionStorage.setItem("auto_login", "false");
  }
  return session;
}

/** Loads existing session from disk or sessionStorage */
export async function loadSession(): Promise<AuthSession | null> {
  const memSession = sessionStorage.getItem("temp_auth_session");
  if (memSession) {
    try {
      return JSON.parse(memSession);
    } catch {
      // Ignore parse error
    }
  }

  const local = await invoke<LocalSession | null>("load_auth_session");
  if (!local) return null;
  return fromLocalSession(local);
}

/** Clears session from disk and server */
export async function logout(accessToken?: string): Promise<void> {
  sessionStorage.removeItem("temp_auth_session");
  sessionStorage.removeItem("auto_login");
  // Try to notify server (best effort)
  if (!USE_MOCK && accessToken) {
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        accessToken,
      });
    } catch {
      // Ignore server errors on logout
    }
  }
  await invoke("clear_auth_session");
}

/**
 * Validates subscription with server.
 * In mock mode: always returns Active with refreshed expiry.
 */
export async function validateSubscription(
  session: AuthSession
): Promise<AuthSession> {
  if (USE_MOCK) {
    // Mock: refresh the subscription and sync timestamp
    const updated: AuthSession = {
      ...session,
      subscription: {
        ...session.subscription,
        status: session.subscription.status === "LIFETIME" ? "LIFETIME" : "ACTIVE",
        daysRemaining: session.subscription.expiresAt
          ? Math.max(0, Math.ceil(
              (new Date(session.subscription.expiresAt).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            ))
          : null,
      },
      lastSyncAt: new Date().toISOString(),
    };

    const autoLogin = sessionStorage.getItem("auto_login") !== "false";
    if (autoLogin) {
      await invoke("save_auth_session", { session: toLocalSession(updated) });
    } else {
      sessionStorage.setItem("temp_auth_session", JSON.stringify(updated));
    }
    return updated;
  }

  // Real API call
  const partialSession = await apiRequest<Partial<AuthSession>>("/subscription/validate", {
    method: "POST",
    accessToken: session.accessToken,
  });

  const updatedSession: AuthSession = {
    ...session,
    ...partialSession,
    subscription: {
      ...session.subscription,
      ...(partialSession.subscription || {}),
    },
  };

  const autoLogin = sessionStorage.getItem("auto_login") !== "false";
  if (autoLogin) {
    await invoke("save_auth_session", { session: toLocalSession(updatedSession) });
  } else {
    sessionStorage.setItem("temp_auth_session", JSON.stringify(updatedSession));
  }
  return updatedSession;
}

/** Checks if offline grace period (7 days) is still valid */
export async function checkOfflinePeriod(lastSyncAt: string): Promise<boolean> {
  return invoke<boolean>("is_offline_period_valid", { lastSyncAt });
}

/** Gets the device fingerprint */
export async function getDeviceFingerprint(): Promise<string> {
  return invoke<string>("get_device_fingerprint");
}

/** Requests password reset email (mock: always succeeds) */
export async function requestPasswordReset(email: string): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return;
  }
  await apiRequest("/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

/** Verifies the 6-digit reset code (mock: any 6-digit code works) */
export async function verifyResetCode(
  email: string,
  code: string
): Promise<boolean> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return code.length === 6 && /^\d{6}$/.test(code);
  }
  const result = await apiRequest<{ valid: boolean }>("/auth/verify-reset-code", {
    method: "POST",
    body: { email, code },
  });
  return result.valid;
}

/** Resets password with verification code (mock: always succeeds) */
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  if (USE_MOCK) {
    if (newPassword.length < 6) {
      throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự");
    }
    await new Promise((r) => setTimeout(r, 500));
    return;
  }
  await apiRequest("/auth/reset-password", {
    method: "POST",
    body: { email, code, newPassword },
  });
}

/** Đăng ký tài khoản (Gửi mã OTP) */
export async function register(email: string): Promise<void> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 500));
    return;
  }
  await apiRequest("/auth/register", {
    method: "POST",
    body: { email },
  });
}

/** Xác nhận OTP và tạo tài khoản, trả về session */
export async function verifyRegister(
  request: LoginRequest & { name: string; code: string }
): Promise<AuthSession> {
  if (USE_MOCK) {
    throw new Error("Mock mode không hỗ trợ Đăng ký");
  }
  const session = await apiRequest<AuthSession>("/auth/verify-register", {
    method: "POST",
    body: request,
  });
  await invoke("save_auth_session", { session: toLocalSession(session) });
  return session;
}

/** Checks if a subscription status allows app usage */
export function isSubscriptionActive(status: string): boolean {
  return ["ACTIVE", "TRIAL", "LIFETIME"].includes(status);
}
