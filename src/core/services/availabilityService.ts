/**
 * Backend Availability & Maintenance Mode Service
 *
 * Centralized service managing backend health checks, independent status polling,
 * circuit breaker, exponential backoff with jitter, and offline detection.
 */

import { API_BASE_URL, setAvailabilityReporter } from "./apiClient";
import {
  useAvailabilityStore,
  AvailabilityState,
  MaintenanceInfo,
  DEFAULT_MAINTENANCE_INFO,
} from "@/core/stores/useAvailabilityStore";

const HEALTH_CHECK_TIMEOUT_MS = 4000;
const STATUS_CHECK_TIMEOUT_MS = 3500;
const CONNECTIVITY_PROBE_TIMEOUT_MS = 3000;
const MANUAL_RETRY_COOLDOWN_MS = 5000;
const FOCUS_COOLDOWN_MS = 30000; // 30 seconds cooldown for focus re-checks
const RECOVERY_VERIFY_DELAY_MS = 2500; // 2.5s delay before 2nd verification in recovering state

// Backoff schedule (in seconds): 60s -> 90s -> 120s -> 180s -> 300s (max 5 minutes)
const BACKOFF_STEPS = [60, 90, 120, 180, 300];

// Independent status endpoint URL (configurable via env or fallback to GitHub raw status JSON)
const STATUS_ENDPOINT =
  import.meta.env.VITE_STATUS_ENDPOINT ||
  "https://raw.githubusercontent.com/minhvuogdzz/photo-picker-pro/main/photo-picker-status.json";

/**
 * Isolated fetch with dedicated AbortController and timeout.
 * Prevents sharing aborted signals across sequential requests.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

class AvailabilityService {
  private isChecking = false;
  private isInitialized = false;
  private timer: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private lastManualCheckTime = 0;
  private lastFocusCheckTime = 0;
  private currentCheckPromise: Promise<void> | null = null;

  /**
   * Initializes the availability service and event listeners (called once on app mount)
   */
  public initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Register circuit breaker reporter with apiClient
    setAvailabilityReporter((statusCode) => this.reportApiFailure(statusCode));

    // Expose for dev/testing
    if (typeof window !== "undefined" && import.meta.env.DEV) {
      (window as any).__availability = {
        service: this,
        store: useAvailabilityStore,
      };
    }

    // Listen to local network changes
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);

    // Listen to window focus & visibility changes (debounced with cooldown)
    window.addEventListener("focus", this.handleFocus);
    document.addEventListener("visibilitychange", this.handleFocus);

    // Run initial health check in background
    this.performHealthCheck();
  }

  /**
   * Cleans up listeners and timers
   */
  public destroy() {
    this.isInitialized = false;
    setAvailabilityReporter(() => {});
    this.clearAllTimers();
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    window.removeEventListener("focus", this.handleFocus);
    document.removeEventListener("visibilitychange", this.handleFocus);
  }

  private handleOnline = () => {
    const store = useAvailabilityStore.getState();
    if (store.state === "LOCAL_OFFLINE") {
      store.setState("CHECKING");
      this.performHealthCheck();
    }
  };

  private handleOffline = () => {
    this.clearAllTimers();
    useAvailabilityStore.getState().setState("LOCAL_OFFLINE");
  };

  private handleFocus = () => {
    if (document.visibilityState !== "visible") return;

    const now = Date.now();
    const cooldown = import.meta.env.DEV ? 2000 : FOCUS_COOLDOWN_MS;
    if (now - this.lastFocusCheckTime < cooldown) {
      return;
    }
    this.lastFocusCheckTime = now;

    // In dev mode, always recheck on focus so switching from terminal immediately tests the new state
    if (import.meta.env.DEV) {
      this.performHealthCheck();
      return;
    }

    const store = useAvailabilityStore.getState();
    // Only recheck on focus if currently in maintenance or degraded
    if (
      store.state === "BACKEND_UNAVAILABLE" ||
      store.state === "MAINTENANCE_CONFIRMED" ||
      store.state === "DEGRADED"
    ) {
      this.performHealthCheck();
    }
  };

  /**
   * Manual retry triggered by user clicking "Thử lại ngay".
   * Safely joins in-flight check if one is running, preventing duplicate parallel requests.
   */
  public async manualRetry(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastManualCheckTime < MANUAL_RETRY_COOLDOWN_MS) {
      return false;
    }
    this.lastManualCheckTime = now;

    const store = useAvailabilityStore.getState();
    store.setIsManualChecking(true);

    try {
      if (this.currentCheckPromise) {
        // A check is already in-flight, await it rather than spawning a duplicate
        await this.currentCheckPromise;
        return true;
      }

      await this.performHealthCheck(true);
      return true;
    } finally {
      store.setIsManualChecking(false);
    }
  }

  /**
   * Reports an API failure encountered by apiClient (circuit breaker integration)
   */
  public reportApiFailure(statusCode?: number) {
    // 401/403 are auth/permissions errors, not backend maintenance
    if (statusCode === 401 || statusCode === 403) {
      return;
    }

    const store = useAvailabilityStore.getState();
    // If already in maintenance, no need to trigger again
    if (
      store.state === "MAINTENANCE_CONFIRMED" ||
      store.state === "BACKEND_UNAVAILABLE"
    ) {
      return;
    }

    // If server returned 500, 502, 503, 504, 429 or timeout, trigger health verification
    this.performHealthCheck();
  }

  /**
   * Core Health Verification Logic
   */
  public performHealthCheck(isManual: boolean = false): Promise<void> {
    if (this.currentCheckPromise) {
      return this.currentCheckPromise;
    }

    this.currentCheckPromise = this.runHealthCheckInternal(isManual).finally(() => {
      this.currentCheckPromise = null;
    });

    return this.currentCheckPromise;
  }

  private async runHealthCheckInternal(isManual: boolean): Promise<void> {
    const store = useAvailabilityStore.getState();

    try {
      // 1. Check local network connectivity first
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        store.setState("LOCAL_OFFLINE");
        this.clearAllTimers();
        return;
      }

      // 2. Check independent status endpoint (with its own 3.5s timeout)
      const statusResult = await this.fetchIndependentStatus();
      if (statusResult?.maintenance) {
        store.recordFailure(true, statusResult);
        this.scheduleNextPeriodicCheck();
        return;
      }

      // 3. Check Backend /health endpoint (with its own 4s timeout)
      const backendHealthy = await this.fetchBackendHealth();

      if (backendHealthy) {
        // If coming from an outage (BACKEND_UNAVAILABLE or MAINTENANCE_CONFIRMED),
        // perform REAL two-stage verification
        if (
          store.state === "BACKEND_UNAVAILABLE" ||
          store.state === "MAINTENANCE_CONFIRMED"
        ) {
          store.setState("RECOVERING");
          this.clearAllTimers();

          // Schedule Stage 2 verification after 2.5 seconds
          this.recoveryTimer = setTimeout(async () => {
            this.recoveryTimer = null;
            const secondCheck = await this.fetchBackendHealth();
            if (secondCheck) {
              // 2nd check succeeded -> Full ONLINE recovery
              store.recordSuccess();
            } else {
              // 2nd check failed -> Revert to BACKEND_UNAVAILABLE
              store.recordFailure(false);
              this.scheduleNextPeriodicCheck();
            }
          }, RECOVERY_VERIFY_DELAY_MS);
          return;
        }

        // Normal healthy response
        store.recordSuccess();
        this.clearAllTimers();
        return;
      }

      // 4. Backend health check failed
      // Run connectivity probe with its OWN fresh controller to check if internet works
      const internetAlive = await this.verifyInternetConnection();
      if (!internetAlive) {
        store.setState("LOCAL_OFFLINE");
        this.clearAllTimers();
        return;
      }

      // Internet works, but backend failed
      store.recordFailure(false, statusResult || undefined);
      this.scheduleNextPeriodicCheck();
    } catch {
      store.recordFailure(false);
      this.scheduleNextPeriodicCheck();
    } finally {
      if (isManual) {
        store.setIsManualChecking(false);
      }
    }
  }

  /**
   * Fetches backend /health with dedicated 4s timeout
   */
  private async fetchBackendHealth(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(
        `${API_BASE_URL}/health`,
        {
          method: "GET",
          cache: "no-store",
        },
        HEALTH_CHECK_TIMEOUT_MS
      );

      if (!res.ok) {
        return false;
      }

      const data = await res.json().catch(() => null);
      return Boolean(data && data.status === "ok");
    } catch {
      return false;
    }
  }

  /**
   * Fetches the independent status endpoint with dedicated 3.5s timeout and strict schema validation
   */
  private async fetchIndependentStatus(): Promise<MaintenanceInfo | null> {
    if (!STATUS_ENDPOINT) return null;

    try {
      const res = await fetchWithTimeout(
        STATUS_ENDPOINT,
        {
          method: "GET",
          cache: "no-store",
        },
        STATUS_CHECK_TIMEOUT_MS
      );

      if (!res.ok) return null;
      const data = await res.json().catch(() => null);

      // Validate JSON schema
      if (
        data &&
        typeof data === "object" &&
        typeof data.maintenance === "boolean"
      ) {
        // Validate supportUrl: must be https
        let validSupportUrl = DEFAULT_MAINTENANCE_INFO.supportUrl;
        if (
          typeof data.supportUrl === "string" &&
          data.supportUrl.startsWith("https://")
        ) {
          validSupportUrl = data.supportUrl;
        }

        const title =
          typeof data.title === "string" && data.title.trim().length > 0
            ? data.title
            : DEFAULT_MAINTENANCE_INFO.title;

        const message =
          typeof data.message === "string" && data.message.trim().length > 0
            ? data.message
            : DEFAULT_MAINTENANCE_INFO.message;

        return {
          maintenance: Boolean(data.maintenance),
          title,
          message,
          estimatedRecovery:
            typeof data.estimatedRecovery === "string"
              ? data.estimatedRecovery
              : null,
          supportUrl: validSupportUrl,
          updatedAt:
            typeof data.updatedAt === "string"
              ? data.updatedAt
              : new Date().toISOString(),
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Connectivity probe with dedicated 3s timeout
   */
  private async verifyInternetConnection(): Promise<boolean> {
    // Probe 1: Cloudflare trace
    try {
      await fetchWithTimeout(
        "https://cloudflare.com/cdn-cgi/trace",
        {
          method: "GET",
          mode: "no-cors",
          cache: "no-store",
        },
        CONNECTIVITY_PROBE_TIMEOUT_MS
      );
      return true;
    } catch {
      // Fallback probe 2: 1.1.1.1
      try {
        await fetchWithTimeout(
          "https://1.1.1.1/cdn-cgi/trace",
          {
            method: "GET",
            mode: "no-cors",
            cache: "no-store",
          },
          CONNECTIVITY_PROBE_TIMEOUT_MS
        );
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Schedules next health check with exponential backoff and ±15% jitter
   */
  private scheduleNextPeriodicCheck() {
    this.clearAllTimers();

    const store = useAvailabilityStore.getState();
    const failures = store.consecutiveFailures;
    const stepIndex = Math.min(failures, BACKOFF_STEPS.length - 1);
    const baseSeconds = BACKOFF_STEPS[stepIndex];

    // ±15% jitter to prevent thundering herd problem
    const jitterFactor = 0.85 + Math.random() * 0.3;
    const jitteredSeconds = Math.max(30, Math.round(baseSeconds * jitterFactor));

    let countdown = jitteredSeconds;
    store.setNextRetryCountdown(countdown);

    this.countdownTimer = setInterval(() => {
      countdown -= 1;
      if (countdown >= 0) {
        useAvailabilityStore.getState().setNextRetryCountdown(countdown);
      }
    }, 1000);

    this.timer = setTimeout(() => {
      this.clearAllTimers();
      this.performHealthCheck();
    }, jitteredSeconds * 1000);
  }

  private clearAllTimers() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    useAvailabilityStore.getState().setNextRetryCountdown(0);
  }
}

export const availabilityService = new AvailabilityService();
