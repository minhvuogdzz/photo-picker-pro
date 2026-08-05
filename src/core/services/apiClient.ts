/**
 * HTTP API client for Photo Picker Pro backend.
 *
 * Handles JWT Bearer injection, refresh token rotation, and error handling.
 * When no backend is configured (USE_MOCK = true), falls through to mock service.
 */

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

/**
 * Makes an authenticated API request.
 * Automatically injects the access token and handles 401 errors.
 */
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

  const response = await fetch(url, {
    method,
    headers: createHeaders(accessToken),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      message: `HTTP ${response.status}: ${response.statusText}`,
      statusCode: response.status,
    }));

    if (response.status === 401 && endpoint !== "/auth/login") {
      throw new Error("SESSION_EXPIRED");
    }
    if (response.status === 403 && endpoint !== "/auth/login") {
      throw new Error("SUBSCRIPTION_INVALID");
    }

    throw new Error(error.message);
  }

  const result: ApiResponse<T> = await response.json();
  
  if (result && typeof result === 'object' && 'success' in result) {
    if (!result.success) {
      throw new Error(result.message || `HTTP ${response.status}: Lỗi không xác định`);
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
