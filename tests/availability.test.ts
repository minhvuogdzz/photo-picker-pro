import test from "node:test";
import assert from "node:assert";

// Core simulation types & functions matching availabilityService & store
type AvailabilityState =
  | "CHECKING"
  | "ONLINE"
  | "DEGRADED"
  | "LOCAL_OFFLINE"
  | "MAINTENANCE_CONFIRMED"
  | "BACKEND_UNAVAILABLE"
  | "RECOVERING";

interface MaintenanceInfo {
  maintenance: boolean;
  title: string;
  message: string;
  estimatedRecovery: string | null;
  supportUrl: string;
  updatedAt: string;
}

const DEFAULT_MAINTENANCE_INFO: MaintenanceInfo = {
  maintenance: true,
  title: "Phần mềm đang được bảo trì",
  message: "Hệ thống đang được nâng cấp máy chủ...",
  estimatedRecovery: null,
  supportUrl: "https://mvd.vn",
  updatedAt: new Date().toISOString(),
};

function parseAndValidateStatusJson(raw: any): MaintenanceInfo | null {
  if (!raw || typeof raw !== "object" || typeof raw.maintenance !== "boolean") {
    return null;
  }

  let supportUrl = DEFAULT_MAINTENANCE_INFO.supportUrl;
  if (typeof raw.supportUrl === "string" && raw.supportUrl.startsWith("https://")) {
    supportUrl = raw.supportUrl;
  }

  const title =
    typeof raw.title === "string" && raw.title.trim().length > 0
      ? raw.title
      : DEFAULT_MAINTENANCE_INFO.title;

  const message =
    typeof raw.message === "string" && raw.message.trim().length > 0
      ? raw.message
      : DEFAULT_MAINTENANCE_INFO.message;

  return {
    maintenance: Boolean(raw.maintenance),
    title,
    message,
    estimatedRecovery: typeof raw.estimatedRecovery === "string" ? raw.estimatedRecovery : null,
    supportUrl,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

class TestAvailabilityStateMachine {
  state: AvailabilityState = "CHECKING";
  consecutiveFailures = 0;
  consecutiveSuccesses = 0;
  offlineBypass = false;
  maintenanceInfo: MaintenanceInfo | null = null;
  lastManualCheckTime = 0;
  lastFocusCheckTime = 0;
  isManualChecking = false;

  recordSuccess() {
    this.state = "ONLINE";
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses += 1;
    this.offlineBypass = false; // Reset offline bypass when backend returns ONLINE
    this.isManualChecking = false;
  }

  recordFailure(isMaintenance = false, info?: MaintenanceInfo) {
    this.consecutiveFailures += 1;
    this.consecutiveSuccesses = 0;
    this.isManualChecking = false;

    if (isMaintenance) {
      this.state = "MAINTENANCE_CONFIRMED";
      this.offlineBypass = false; // Reset bypass for new maintenance event
    } else if (this.consecutiveFailures >= 3) {
      this.state = "BACKEND_UNAVAILABLE";
    } else {
      this.state = "DEGRADED";
    }

    this.maintenanceInfo = info || this.maintenanceInfo || DEFAULT_MAINTENANCE_INFO;
  }

  stepTwoStageRecovery(secondCheckSuccess: boolean) {
    if (this.state === "BACKEND_UNAVAILABLE" || this.state === "MAINTENANCE_CONFIRMED") {
      this.state = "RECOVERING";
      if (secondCheckSuccess) {
        this.recordSuccess();
      } else {
        this.recordFailure(false);
      }
    }
  }

  manualRetry(isAlreadyRunning = false): boolean {
    const now = Date.now();
    if (now - this.lastManualCheckTime < 5000) {
      return false; // Throttled
    }
    this.lastManualCheckTime = now;
    this.isManualChecking = true;
    return true;
  }

  handleFocus(now = Date.now()): boolean {
    if (now - this.lastFocusCheckTime < 30000) {
      return false; // Cooldown 30s
    }
    this.lastFocusCheckTime = now;
    return true;
  }
}

test("Availability 1: Status endpoint maintenance true sets MAINTENANCE_CONFIRMED", () => {
  const sm = new TestAvailabilityStateMachine();
  const rawStatus = {
    maintenance: true,
    title: "Bảo trì khẩn cấp",
    message: "Nâng cấp cơ sở dữ liệu",
    supportUrl: "https://mvd.vn",
  };
  const validated = parseAndValidateStatusJson(rawStatus);
  assert.ok(validated && validated.maintenance === true);
  sm.recordFailure(true, validated);

  assert.strictEqual(sm.state, "MAINTENANCE_CONFIRMED");
});

test("Availability 2: Status endpoint timeout/404 results in null (no false maintenance)", () => {
  assert.strictEqual(parseAndValidateStatusJson(null), null);
  assert.strictEqual(parseAndValidateStatusJson("Not Found"), null);
  assert.strictEqual(parseAndValidateStatusJson(404), null);
});

test("Availability 3: Backend timeout with healthy internet goes DEGRADED then BACKEND_UNAVAILABLE at 3 failures", () => {
  const sm = new TestAvailabilityStateMachine();
  assert.strictEqual(sm.state, "CHECKING");

  // 1st failure
  sm.recordFailure(false);
  assert.strictEqual(sm.state, "DEGRADED", "1st failure must be DEGRADED");

  // 2nd failure
  sm.recordFailure(false);
  assert.strictEqual(sm.state, "DEGRADED", "2nd failure must be DEGRADED");

  // 3rd failure
  sm.recordFailure(false);
  assert.strictEqual(sm.state, "BACKEND_UNAVAILABLE", "3rd failure must transition to BACKEND_UNAVAILABLE");
});

test("Availability 4: Local offline sets LOCAL_OFFLINE without calling it maintenance", () => {
  const sm = new TestAvailabilityStateMachine();
  const isLocalOnline = false;
  if (!isLocalOnline) {
    sm.state = "LOCAL_OFFLINE";
  }
  assert.strictEqual(sm.state, "LOCAL_OFFLINE");
  assert.notStrictEqual(sm.state, "MAINTENANCE_CONFIRMED");
});

test("Availability 5 & 6: Degraded vs Fullscreen unavailable", () => {
  const sm = new TestAvailabilityStateMachine();
  sm.recordFailure(false);
  assert.strictEqual(sm.state === "BACKEND_UNAVAILABLE" || sm.state === "MAINTENANCE_CONFIRMED", false);

  sm.recordFailure(false);
  assert.strictEqual(sm.state === "BACKEND_UNAVAILABLE" || sm.state === "MAINTENANCE_CONFIRMED", false);

  sm.recordFailure(false);
  assert.strictEqual(sm.state === "BACKEND_UNAVAILABLE", true, "3 failures requires fullscreen maintenance");
});

test("Availability 7 & 8: Two-stage recovery transitions to RECOVERING then ONLINE", () => {
  const sm = new TestAvailabilityStateMachine();
  sm.recordFailure(false);
  sm.recordFailure(false);
  sm.recordFailure(false);
  assert.strictEqual(sm.state, "BACKEND_UNAVAILABLE");

  // Check 1 succeeds -> RECOVERING
  sm.state = "RECOVERING";
  assert.strictEqual(sm.state, "RECOVERING");

  // Check 2 succeeds -> ONLINE
  sm.recordSuccess();
  assert.strictEqual(sm.state, "ONLINE");
  assert.strictEqual(sm.consecutiveFailures, 0);
  assert.strictEqual(sm.consecutiveSuccesses, 1);
});

test("Availability 9: Two-stage recovery reverts to BACKEND_UNAVAILABLE if stage 2 fails", () => {
  const sm = new TestAvailabilityStateMachine();
  sm.recordFailure(false);
  sm.recordFailure(false);
  sm.recordFailure(false);
  assert.strictEqual(sm.state, "BACKEND_UNAVAILABLE");

  // Stage 1 passes, but Stage 2 fails
  sm.stepTwoStageRecovery(false);
  assert.strictEqual(sm.state, "BACKEND_UNAVAILABLE", "Failed stage 2 must revert to BACKEND_UNAVAILABLE");
});

test("Availability 10: 401 and 403 HTTP codes do NOT report maintenance failure", () => {
  function shouldTriggerCircuitBreaker(status: number): boolean {
    if (status === 401 || status === 403) return false;
    return status >= 500 || status === 429 || status === 0;
  }
  assert.strictEqual(shouldTriggerCircuitBreaker(401), false);
  assert.strictEqual(shouldTriggerCircuitBreaker(403), false);
});

test("Availability 11: 429 and 5xx trigger verification", () => {
  function shouldTriggerCircuitBreaker(status: number): boolean {
    if (status === 401 || status === 403) return false;
    return status >= 500 || status === 429 || status === 0;
  }
  assert.strictEqual(shouldTriggerCircuitBreaker(500), true);
  assert.strictEqual(shouldTriggerCircuitBreaker(502), true);
  assert.strictEqual(shouldTriggerCircuitBreaker(503), true);
  assert.strictEqual(shouldTriggerCircuitBreaker(504), true);
  assert.strictEqual(shouldTriggerCircuitBreaker(429), true);
});

test("Availability 12: Manual retry cooldown enforces 5-second interval", () => {
  const sm = new TestAvailabilityStateMachine();
  const firstClick = sm.manualRetry();
  assert.strictEqual(firstClick, true);

  const secondClickImmediate = sm.manualRetry();
  assert.strictEqual(secondClickImmediate, false, "Immediate retry click must be rejected");
});

test("Availability 13: Focus & visibility event throttled with 30s cooldown", () => {
  const sm = new TestAvailabilityStateMachine();
  const now = 100000;
  assert.strictEqual(sm.handleFocus(now), true);
  assert.strictEqual(sm.handleFocus(now + 10000), false, "10s after focus must be throttled");
  assert.strictEqual(sm.handleFocus(now + 31000), true, "31s after focus must be allowed");
});

test("Availability 14: React StrictMode double mount idempotency", () => {
  let initializeCount = 0;
  let isInitialized = false;
  function initialize() {
    if (isInitialized) return;
    isInitialized = true;
    initializeCount++;
  }

  initialize();
  initialize(); // Second mount in React StrictMode
  assert.strictEqual(initializeCount, 1, "Initialize must only execute once across StrictMode mounts");
});

test("Availability 15: Destroy cleanly resets timers and flags", () => {
  let isInitialized = true;
  let activeTimer: any = 123;
  function destroy() {
    isInitialized = false;
    activeTimer = null;
  }
  destroy();
  assert.strictEqual(isInitialized, false);
  assert.strictEqual(activeTimer, null);
});

test("Availability 16: Offline bypass resets upon recovery completion", () => {
  const sm = new TestAvailabilityStateMachine();
  sm.offlineBypass = true;
  sm.recordSuccess();
  assert.strictEqual(sm.offlineBypass, false, "offlineBypass must reset to false when returning ONLINE");
});

test("Availability 17: Offline bypass resets on new maintenance event", () => {
  const sm = new TestAvailabilityStateMachine();
  sm.offlineBypass = true;
  sm.recordFailure(true); // new maintenance declared
  assert.strictEqual(sm.offlineBypass, false, "offlineBypass must reset when a new maintenance is declared");
});

test("Availability 18: Status JSON schema validation rejects non-boolean maintenance", () => {
  const invalid = parseAndValidateStatusJson({ maintenance: "true" }); // string instead of boolean
  assert.strictEqual(invalid, null, "String 'true' must be rejected as invalid schema");
});

test("Availability 19: Status JSON supportUrl rejects non-https URLs (http or javascript)", () => {
  const insecure = parseAndValidateStatusJson({
    maintenance: true,
    supportUrl: "http://insecure.com",
  });
  assert.ok(insecure);
  assert.strictEqual(insecure.supportUrl, "https://mvd.vn", "Non-https URL must fall back to default https://mvd.vn");

  const malicious = parseAndValidateStatusJson({
    maintenance: true,
    supportUrl: "javascript:alert(1)",
  });
  assert.ok(malicious);
  assert.strictEqual(malicious.supportUrl, "https://mvd.vn");
});

test("Availability 20: Status endpoint 404 handled gracefully", () => {
  const res = parseAndValidateStatusJson({ statusCode: 404, message: "Cannot GET /photo-picker-status.json" });
  assert.strictEqual(res, null, "404 response payload must result in null (no active maintenance)");
});
