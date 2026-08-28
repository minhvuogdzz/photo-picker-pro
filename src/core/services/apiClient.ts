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

/**
 * Makes an authenticated API request.
 * Automatically injects the access token and handles 401/403/409 errors.
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
    const rawError = await response.json().catch(() => null);
    const message = rawError?.message || `HTTP ${response.status}: ${response.statusText}`;
    const statusCode = rawError?.statusCode || response.status;
    const errorCode = rawError?.errorCode || rawError?.error;

    if (response.status === 401 && endpoint !== "/auth/login") {
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
