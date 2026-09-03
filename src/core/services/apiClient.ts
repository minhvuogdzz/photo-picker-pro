/**
 * HTTP API client for Photo Picker Pro backend.
 *
 * Handles JWT Bearer injection, refresh token rotation, and error handling.
 * When no backend is configured (USE_MOCK = true), falls through to mock service.
 */

import { useAuthStore } from "@/core/stores/useAuthStore";
import { invoke } from "@tauri-apps/api/core";
import type { AuthSession } from "@/core/types/auth";

/** Set to true to use local mock API (no backend required) */
const USE_MOCK = false;

/** Backend API base URL — update when NestJS backend is deployed */
const API_BASE_URL = import.meta.env.DEV ? "http://localhost:3000" : "https://photo-picker-backend.vercel.app";

interface ApiResponse<T> {
  readonly data: T;
  readonly success: boolean;
  readonly message?: string;
}

interface ApiError {
  readonly message: string;
  readonly statusCode: number;
}

/** Creates headers with JWT Bearer token */
function createHeaders(accessToken?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
}

export class ApiErrorResponse extends Error {
  readonly statusCode: number;
  readonly errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.name = "ApiErrorResponse";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

function toLocalSession(session: AuthSession) {
  return {
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    user_id: session.userId,
    email: session.email,
    username: session.username || (session.email.includes("@") ? session.email.split("@")[0] : session.email),
    name: session.name,
    subscription_status: session.subscription.status,
    subscription_plan: session.subscription.plan,
    expires_at: session.subscription.expiresAt,
    device_id: session.deviceId,
    last_sync_at: session.lastSyncAt,
  };
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const currentSession = useAuthStore.getState().session;
  if (!currentSession?.refreshToken) {
    return null;
  }

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
      });

      if (!res.ok) {
        return null;
      }

      const json = await res.json();
      if (!json.success || !json.data?.accessToken) {
        return null;
      }

      const updatedSession: AuthSession = {
        ...currentSession,
        ...json.data,
      };

      // Update zustand store
      useAuthStore.getState().setSession(updatedSession);

      // Persist to storage
      const autoLogin = sessionStorage.getItem("auto_login") !== "false";
      if (autoLogin) {
        await invoke("save_auth_session", { session: toLocalSession(updatedSession) }).catch(() => {});
      } else {
        sessionStorage.setItem("temp_auth_session", JSON.stringify(updatedSession));
      }

      return json.data.accessToken as string;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Makes an authenticated API request.
 * Automatically injects the access token and handles 401/403/409 errors with silent token refresh.
 */
let availabilityReporter: ((statusCode?: number) => void) | null = null;
export function setAvailabilityReporter(fn: (statusCode?: number) => void) {
  availabilityReporter = fn;
}

export async function apiRequest<T>(
  endpoint: string,
  options: {
    readonly method?: string;
    readonly body?: unknown;
    readonly accessToken?: string;
  } = {}
): Promise<T> {
  if (USE_MOCK) {
    throw new Error("MOCK_MODE");
  }

  const { method = "GET", body, accessToken } = options;
  const url = `${API_BASE_URL}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: createHeaders(accessToken),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (netErr: any) {
    // Network failure (server unreachable, DNS error, Vercel pause)
    availabilityReporter?.(0);
    throw netErr;
  }

  if (!response.ok) {
    const rawError = await response.json().catch(() => null);
    const message = rawError?.message || `HTTP ${response.status}: ${response.statusText}`;
    const statusCode = rawError?.statusCode || response.status;
    const errorCode = rawError?.errorCode || rawError?.error;

    // Report server errors (500, 502, 503, 504, 429) to availability circuit breaker
    if (response.status >= 500 || response.status === 429) {
      availabilityReporter?.(response.status);
    }

    if (response.status === 401 && endpoint !== "/auth/login" && endpoint !== "/auth/refresh") {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Automatically retry original request with newly refreshed access token
        return apiRequest<T>(endpoint, {
          ...options,
          accessToken: newToken,
        });
      }
      throw new ApiErrorResponse("SESSION_EXPIRED", 401);
    }
    if (response.status === 403 && endpoint !== "/auth/login") {
      throw new ApiErrorResponse("SUBSCRIPTION_INVALID", 403);
    }

    throw new ApiErrorResponse(
      Array.isArray(message) ? message.join(", ") : message,
      statusCode,
      errorCode
    );
  }

  const result: ApiResponse<T> = await response.json();
  
  if (result && typeof result === 'object' && 'success' in result) {
    if (!result.success) {
      throw new ApiErrorResponse(result.message || `HTTP ${response.status}: Lỗi không xác định`, response.status);
    }
    return result.data as T;
  }
  
  // Fallback for endpoints that don't return ApiResponse wrapper (if any)
  return result as unknown as T;
}

/** Checks if the device is currently online */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export { USE_MOCK, API_BASE_URL };
