/**
 * Single place that converts and persists the auth session, shared by the API client
 * (silent token refresh) and the auth API (login / validate / refresh).
 */

import { invoke } from "@tauri-apps/api/core";
import type { AuthSession, LocalSession } from "@/core/types/auth";

/** Converts AuthSession to LocalSession for Rust storage */
export function toLocalSession(session: AuthSession): LocalSession {
  const ents = session.entitlements || session.subscription.entitlements || [];
  return {
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    user_id: session.userId,
    email: session.email,
    username: session.username || (session.email.includes("@") ? session.email.split("@")[0] : session.email),
    name: session.name,
    role: session.role,
    subscription_status: session.subscription.status,
    subscription_plan: session.subscription.plan,
    is_premium: session.subscription.isPremium ?? false,
    expires_at: session.subscription.expiresAt,
    device_id: session.deviceId,
    last_sync_at: session.lastSyncAt,
    entitlements: ents.map((e) => ({
      app: e.app,
      expires_at: e.expiresAt,
      is_trial: e.isTrial ?? false,
    })),
  };
}

/**
 * Applies a server response on top of the current session. Endpoints such as /auth/refresh
 * omit fields (isPremium, top-level entitlements, sessionDurationMinutes), so a plain spread
 * would silently drop them.
 */
export function mergeSession(current: AuthSession, update: Partial<AuthSession>): AuthSession {
  const entitlements =
    update.subscription?.entitlements ||
    update.entitlements ||
    current.subscription?.entitlements ||
    current.entitlements;

  return {
    ...current,
    ...update,
    subscription: {
      ...current.subscription,
      ...(update.subscription || {}),
      entitlements,
    },
    entitlements,
  };
}

/** Saves the session to disk (auto-login) or to this run's sessionStorage only. */
export async function persistSession(session: AuthSession): Promise<void> {
  const autoLogin = sessionStorage.getItem("auto_login") !== "false";
  if (autoLogin) {
    await invoke("save_auth_session", { session: toLocalSession(session) }).catch(() => {});
  } else {
    sessionStorage.setItem("temp_auth_session", JSON.stringify(session));
  }
}
