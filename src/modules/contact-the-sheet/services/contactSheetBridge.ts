import { useAuthStore } from "../../../core/stores/useAuthStore.ts";
import { checkAppAccess, hasGoogleFeatureAccess } from "../../../core/services/appEntitlementPolicy.ts";
import { useContactSheetStore } from "../stores/useContactSheetStore.ts";
import { folderScannerService } from "./folderScannerService.ts";
import { sheetDiscoveryService } from "./sheetDiscoveryService.ts";
import { batchPlannerService } from "./batchPlannerService.ts";
import { sheetUpdateService } from "./sheetUpdateService.ts";
import { googleCredentialManager } from "./googleCredentialBridge.ts";
import { trText } from "../../../core/lib/i18n.ts";
import type { SheetRowRecord } from "./jobMatchingService.ts";
import type { DiscoveredJob, UpdatePlan, WorkspaceProfile } from "../types/index.ts";

export type BridgeProgressReporter = (current: number, total: number, message: string) => void;

export class BridgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
  }
}

export interface BridgeProfileSummary {
  id: string;
  displayName: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  selectedTabTitle: string;
  headerRow: number;
  isMockSandbox: boolean;
}

export interface BridgeWritableColumn {
  columnLetter: string;
  columnHeader: string;
  semanticField: string;
}

export interface BridgeActiveProfile extends BridgeProfileSummary {
  availableTabTitles: string[];
  selectedTabTitles: string[];
  writableColumns: BridgeWritableColumn[];
  driveLocalRootPath: string;
}

export interface ContactSheetBridgeContext {
  authenticated: boolean;
  userEmail: string | null;
  hasAccess: boolean;
  accessReason: string;
  google: {
    status: string;
    accountEmail: string | null;
    hasDriveAccess: boolean;
    hasSheetsAccess: boolean;
  };
  profiles: BridgeProfileSummary[];
  activeProfile: BridgeActiveProfile | null;
  jobs: DiscoveredJob[];
  plans: Record<string, UpdatePlan>;
}

const AUTH_HYDRATION_TIMEOUT_MS = 8_000;
const AUTH_POLL_INTERVAL_MS = 100;

function getAvailableTabTitles(profile: WorkspaceProfile | null): string[] {
  if (!profile) return [];
  const configured = profile.tabConfigurations ? Object.keys(profile.tabConfigurations) : [];
  const selected = profile.selectedTabTitle ? [profile.selectedTabTitle] : [];
  return Array.from(new Set([...configured, ...selected])).filter(Boolean);
}

function getDefaultSelectedTabTitles(profile: WorkspaceProfile | null): string[] {
  if (!profile) return [];
  if (profile.tabConfigurations && Object.keys(profile.tabConfigurations).length > 0) {
    return Object.keys(profile.tabConfigurations);
  }
  return profile.selectedTabTitle ? [profile.selectedTabTitle] : [];
}

function toProfileSummary(profile: WorkspaceProfile): BridgeProfileSummary {
  return {
    id: profile.id,
    displayName: profile.displayName,
    spreadsheetId: profile.spreadsheetId,
    spreadsheetTitle: profile.spreadsheetTitle,
    selectedTabTitle: profile.selectedTabTitle,
    headerRow: profile.headerRow || 3,
    isMockSandbox: Boolean(profile.isMockSandbox),
  };
}

function toActiveProfile(profile: WorkspaceProfile | null): BridgeActiveProfile | null {
  if (!profile) return null;
  const writableColumns: BridgeWritableColumn[] = (profile.fieldMappings || [])
    .filter((m) => m.permission === "READ_WRITE")
    .map((m) => ({
      columnLetter: m.columnLetter,
      columnHeader: m.columnHeader,
      semanticField: m.semanticField,
    }));

  return {
    ...toProfileSummary(profile),
    availableTabTitles: getAvailableTabTitles(profile),
    selectedTabTitles: getDefaultSelectedTabTitles(profile),
    writableColumns,
    driveLocalRootPath: profile.driveConfig?.localRootPath || "",
  };
}

export function buildContactSheetContext(): ContactSheetBridgeContext {
  const authState = useAuthStore.getState();
  const session = authState.session;
  const access = checkAppAccess(session, "contact-the-sheet");
  const store = useContactSheetStore.getState();

  return {
    authenticated: Boolean(session),
    userEmail: session?.email || null,
    hasAccess: access.hasAccess,
    accessReason: access.reason,
    google: {
      status: store.googleConnection.status,
      accountEmail: store.googleConnection.accountEmail || null,
      hasDriveAccess: store.googleConnection.hasDriveAccess,
      hasSheetsAccess: store.googleConnection.hasSheetsAccess,
    },
    profiles: store.profiles.map(toProfileSummary),
    activeProfile: toActiveProfile(store.activeProfile),
    jobs: store.discoveredJobs,
    plans: store.updatePlans,
  };
}

async function waitForAuthHydration(): Promise<void> {
  const start = Date.now();
  while (useAuthStore.getState().isLoading) {
    if (Date.now() - start >= AUTH_HYDRATION_TIMEOUT_MS) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, AUTH_POLL_INTERVAL_MS));
  }

  const session = useAuthStore.getState().session;
  const googleStatus = useContactSheetStore.getState().googleConnection.status;
  if (session && hasGoogleFeatureAccess(session) && googleStatus === "DISCONNECTED") {
    googleCredentialManager.restoreSavedSession();
    // Allow asynchronous native fallback restore (get_google_active_account) a short window
    if (useContactSheetStore.getState().googleConnection.status === "DISCONNECTED") {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

function assertContactSheetAccess(): void {
  const session = useAuthStore.getState().session;
  if (!session) {
    throw new BridgeError(
      "NOT_AUTHENTICATED",
      trText(
        "Bạn chưa đăng nhập DH Studio Pro. Hãy mở DH Studio Pro để đăng nhập trước.",
        "You are not signed in to DH Studio Pro. Open DH Studio Pro to sign in first."
      )
    );
  }
  const access = checkAppAccess(session, "contact-the-sheet");
  if (!access.hasAccess) {
    throw new BridgeError(
      "ENTITLEMENT_DENIED",
      trText(
        "Tài khoản hiện tại chưa mở khóa bản quyền Contact the Sheet.",
        "This account does not have Contact the Sheet license access."
      )
    );
  }
}

function assertActiveProfile(): WorkspaceProfile {
  const profile = useContactSheetStore.getState().activeProfile;
  if (!profile) {
    throw new BridgeError(
      "NO_ACTIVE_PROFILE",
      trText(
        "Chưa có cấu hình Google Sheet trong DH Studio Pro. Hãy mở DH Studio Pro để cấu hình Sheet.",
        "No Google Sheet configuration found in DH Studio Pro. Open DH Studio Pro to configure Sheet."
      )
    );
  }
  return profile;
}

export async function handleContactSheetBridgeRequest(
  action: string,
  rawParams: unknown,
  onProgress?: BridgeProgressReporter
): Promise<unknown> {
  const params = (rawParams && typeof rawParams === "object" ? rawParams : {}) as Record<
    string,
    any
  >;

  await waitForAuthHydration();

  switch (action) {
    case "contact_sheet.get_context": {
      return buildContactSheetContext();
    }

    case "contact_sheet.select_profile": {
      assertContactSheetAccess();
      const profileId = typeof params.profileId === "string" ? params.profileId.trim() : "";
      if (!profileId) {
        throw new BridgeError("INVALID_REQUEST", trText("Thiếu profileId.", "Missing profileId."));
      }
      useContactSheetStore.getState().setActiveProfile(profileId);
      return buildContactSheetContext();
    }

    case "contact_sheet.remove_tab": {
      assertContactSheetAccess();
      const tabTitle = typeof params.tabTitle === "string" ? params.tabTitle.trim() : "";
      if (!tabTitle) {
        throw new BridgeError("INVALID_REQUEST", trText("Thiếu tabTitle.", "Missing tabTitle."));
      }
      const profile = assertActiveProfile();
      const available = getAvailableTabTitles(profile);
      if (available.length > 1) {
        useContactSheetStore.getState().removeTabConfiguration(tabTitle);
      }
      return buildContactSheetContext();
    }

    case "contact_sheet.undo_apply_all_tabs": {
      assertContactSheetAccess();
      assertActiveProfile();
      useContactSheetStore.getState().undoApplyAllTabs();
      return buildContactSheetContext();
    }

    case "contact_sheet.scan": {
      assertContactSheetAccess();
      const activeProfile = assertActiveProfile();
      const store = useContactSheetStore.getState();

      if (store.isScanning || store.isExecutingBatch) {
        throw new BridgeError("BUSY", trText("DH Studio Pro đang bận xử lý một tác vụ khác.", "DH Studio Pro is busy with another task."));
      }

      const paths: string[] = Array.isArray(params.paths)
        ? params.paths.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        : [];
      if (paths.length === 0) {
        throw new BridgeError("INVALID_REQUEST", trText("Chưa chọn thư mục nào để quét.", "No folders selected to scan."));
      }

      const requestedTabs: string[] = Array.isArray(params.tabTitles)
        ? params.tabTitles.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        : getDefaultSelectedTabTitles(activeProfile);
      if (requestedTabs.length === 0) {
        throw new BridgeError(
          "NO_TABS_SELECTED",
          trText(
            "Chưa chọn tab nào. Vui lòng chọn ít nhất một tab trước khi quét.",
            "No tabs selected. Please select at least one tab before scanning."
          )
        );
      }

      const googleStatus = store.googleConnection.status;
      const isSandbox = activeProfile.isMockSandbox && googleStatus !== "CONNECTED";
      if (!isSandbox && googleStatus !== "CONNECTED") {
        throw new BridgeError(
          "GOOGLE_NOT_CONNECTED",
          trText(
            "Chưa kết nối tài khoản Google trong DH Studio Pro.",
            "Google account is not connected in DH Studio Pro."
          )
        );
      }
      if (!isSandbox && !activeProfile.spreadsheetId) {
        throw new BridgeError(
          "NO_ACTIVE_PROFILE",
          trText(
            "Chưa liên kết Google Sheet trong cấu hình Contact the Sheet.",
            "No Google Sheet linked in Contact the Sheet settings."
          )
        );
      }

      const replaceExisting = params.replaceExisting !== false;

      let effectivePaths = paths;
      try {
        const resolved = await folderScannerService.resolveSmartInputFolders(paths);
        if (resolved && resolved.length > 0) {
          effectivePaths = resolved;
        }
      } catch (err) {
        console.warn("[DH Bridge] Smart folder expansion fallback:", err);
      }

      store.setLastScannedPaths(effectivePaths);
      store.setIsScanning(true);
      const report = (current: number, total: number, message: string) => {
        useContactSheetStore.getState().setScanProgress({ current, total, message });
        onProgress?.(current, total, message);
      };

      report(5, 100, trText("Đang phân tích cây thư mục...", "Analyzing folder tree..."));

      try {
        report(
          20,
          100,
          isSandbox
            ? trText("Đang nạp dữ liệu bảng tính mẫu...", "Loading sample spreadsheet data...")
            : trText(`Đang tải dữ liệu Google Sheet (${requestedTabs.length} tab)...`, `Loading Google Sheet data (${requestedTabs.length} tab(s))...`)
        );

        const allSheetRows: SheetRowRecord[] = [];
        const perTabRows = await Promise.all(
          requestedTabs.map(async (tabTitle) => {
            const tabConfig = activeProfile.tabConfigurations?.[tabTitle];
            const startRow = tabConfig?.rowScope?.startRow ?? activeProfile.rowScope.startRow;
            try {
              const rows = await sheetDiscoveryService.fetchSheetRowsForMatching(
                activeProfile.spreadsheetId,
                tabTitle,
                startRow,
                undefined,
                isSandbox
              );
              return rows.map((r) => ({ ...r, tabTitle }));
            } catch (tabErr) {
              console.warn(`[DH Bridge] Lỗi nạp tab ${tabTitle}:`, tabErr);
              return [];
            }
          })
        );
        for (const rows of perTabRows) {
          allSheetRows.push(...rows);
        }

        report(
          50,
          100,
          trText(
            `Đang quét thư mục thành phẩm và so khớp trên ${requestedTabs.length} tab...`,
            `Scanning finished folders and matching across ${requestedTabs.length} tab(s)...`
          )
        );

        const jobs = await folderScannerService.scanAndDiscoverJobs(
          effectivePaths,
          activeProfile,
          allSheetRows,
          isSandbox,
          (msg) => report(68, 100, msg)
        );

        report(86, 100, trText("Đang lập kế hoạch cập nhật bảng tính...", "Planning spreadsheet updates..."));

        const planSummary = batchPlannerService.planBatch(jobs, activeProfile);
        const finalJobs = [
          ...planSummary.readyJobs,
          ...planSummary.conflictJobs,
          ...planSummary.needsReviewJobs,
          ...planSummary.errorJobs,
        ];

        const latestStore = useContactSheetStore.getState();
        if (replaceExisting) {
          latestStore.clearJobs();
          Object.entries(planSummary.plans).forEach(([id, p]) => latestStore.setUpdatePlan(id, p));
          latestStore.setDiscoveredJobs(finalJobs);
        } else {
          Object.entries(planSummary.plans).forEach(([id, p]) => latestStore.setUpdatePlan(id, p));
          const existingRemaining = latestStore.discoveredJobs.filter(
            (oldJob) =>
              !finalJobs.some(
                (newJob) =>
                  newJob.jobFolderName === oldJob.jobFolderName ||
                  newJob.finalFolderPath === oldJob.finalFolderPath
              )
          );
          latestStore.setDiscoveredJobs([...existingRemaining, ...finalJobs]);
        }

        report(100, 100, trText("Đã hoàn tất quét.", "Scan completed."));

        const updatedState = useContactSheetStore.getState();
        return {
          resolvedPaths: effectivePaths,
          jobs: updatedState.discoveredJobs,
          plans: updatedState.updatePlans,
        };
      } catch (err: any) {
        if (err instanceof BridgeError) throw err;
        throw new BridgeError("INTERNAL_ERROR", err?.message || String(err));
      } finally {
        useContactSheetStore.getState().setIsScanning(false);
        useContactSheetStore.getState().setScanProgress(null);
      }
    }

    case "contact_sheet.resolve_conflict": {
      assertContactSheetAccess();
      const activeProfile = assertActiveProfile();
      const policy = params.policy;
      if (policy !== "OVERWRITE" && policy !== "APPEND" && policy !== "SKIP") {
        throw new BridgeError("INVALID_REQUEST", trText("Chính sách xử lý xung đột không hợp lệ.", "Invalid conflict resolution policy."));
      }

      const store = useContactSheetStore.getState();
      const isBulk = Boolean(params.bulk);

      if (isBulk) {
        const conflicts = store.discoveredJobs.filter((j) => j.status === "CONFLICT");
        for (const job of conflicts) {
          const allowed = job.conflictDetails?.allowedPolicies || ["OVERWRITE", "SKIP"];
          const effectivePolicy =
            policy === "APPEND" && !allowed.includes("APPEND") ? "OVERWRITE" : policy;
          const updatedJob: DiscoveredJob = {
            ...job,
            conflictDetails: job.conflictDetails
              ? { ...job.conflictDetails, resolvedPolicy: effectivePolicy }
              : undefined,
            status: effectivePolicy === "SKIP" ? "SKIPPED" : "READY",
          };
          const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(
            updatedJob,
            activeProfile
          );
          store.setUpdatePlan(plannedJob.id, plan);
          store.updateJob(plannedJob.id, plannedJob);
        }
      } else {
        const jobId = typeof params.jobId === "string" ? params.jobId : "";
        const job = store.discoveredJobs.find((j) => j.id === jobId);
        if (!job) {
          throw new BridgeError("INVALID_REQUEST", trText("Không tìm thấy job cần xử lý xung đột.", "Job not found for conflict resolution."));
        }
        const allowed = job.conflictDetails?.allowedPolicies || ["OVERWRITE", "SKIP"];
        const effectivePolicy =
          policy === "APPEND" && !allowed.includes("APPEND") ? "OVERWRITE" : policy;
        const updatedJob: DiscoveredJob = {
          ...job,
          conflictDetails: job.conflictDetails
            ? { ...job.conflictDetails, resolvedPolicy: effectivePolicy }
            : undefined,
          status: effectivePolicy === "SKIP" ? "SKIPPED" : "READY",
        };
        const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(
          updatedJob,
          activeProfile
        );
        store.setUpdatePlan(plannedJob.id, plan);
        store.updateJob(plannedJob.id, plannedJob);
      }

      const updated = useContactSheetStore.getState();
      return {
        jobs: updated.discoveredJobs,
        plans: updated.updatePlans,
      };
    }

    case "contact_sheet.assign_row": {
      assertContactSheetAccess();
      const activeProfile = assertActiveProfile();
      const jobId = typeof params.jobId === "string" ? params.jobId : "";
      const rowNumber = Number(params.rowNumber);
      if (!jobId || !Number.isInteger(rowNumber) || rowNumber <= 0) {
        throw new BridgeError("INVALID_REQUEST", trText("Số hàng không hợp lệ (cần số nguyên lớn hơn 0).", "Invalid row number (positive integer required)."));
      }

      const store = useContactSheetStore.getState();
      const job = store.discoveredJobs.find((j) => j.id === jobId);
      if (!job) {
        throw new BridgeError("INVALID_REQUEST", trText("Không tìm thấy job cần gán hàng.", "Job not found for row assignment."));
      }

      const targetTabTitle =
        (typeof params.tabTitle === "string" && params.tabTitle.trim()) ||
        job.targetTabTitle ||
        activeProfile.selectedTabTitle;

      const rowSnapshot =
        params.rowSnapshot && typeof params.rowSnapshot === "object"
          ? (params.rowSnapshot as Record<string, string>)
          : job.targetRowSnapshot;

      const updatedJob: DiscoveredJob = {
        ...job,
        targetSheetRow: rowNumber,
        targetTabTitle,
        targetRowSnapshot: rowSnapshot,
        statusReason: undefined,
      };

      const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(
        updatedJob,
        activeProfile
      );
      store.setUpdatePlan(job.id, plan);
      store.updateJob(job.id, plannedJob);

      const updated = useContactSheetStore.getState();
      return {
        jobs: updated.discoveredJobs,
        plans: updated.updatePlans,
      };
    }

    case "contact_sheet.update_job_action": {
      assertContactSheetAccess();
      const operation = typeof params.operation === "string" ? params.operation : "";
      const store = useContactSheetStore.getState();

      if (operation === "clear_all") {
        store.clearJobs();
      } else {
        const jobId = typeof params.jobId === "string" ? params.jobId : "";
        const job = store.discoveredJobs.find((j) => j.id === jobId);
        if (!job) {
          throw new BridgeError("INVALID_REQUEST", trText("Không tìm thấy job.", "Job not found."));
        }

        if (operation === "skip") {
          store.updateJob(jobId, {
            status: "SKIPPED",
            statusReason: trText("Người dùng bỏ qua", "Skipped by user"),
          });
        } else if (operation === "restore") {
          const activeProfile = assertActiveProfile();
          if (job.targetSheetRow && job.targetSheetRow > 0) {
            const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(
              { ...job, status: "READY", statusReason: undefined },
              activeProfile
            );
            store.setUpdatePlan(job.id, plan);
            store.updateJob(job.id, plannedJob);
          } else {
            store.updateJob(jobId, {
              status: "NEEDS_REVIEW",
              statusReason: trText("Cần gán số hàng", "Needs row assignment"),
            });
          }
        } else if (operation === "remove") {
          store.removeJob(jobId);
        } else {
          throw new BridgeError("INVALID_REQUEST", trText(`Thao tác không hợp lệ: ${operation}`, `Invalid operation: ${operation}`));
        }
      }

      const updated = useContactSheetStore.getState();
      return {
        jobs: updated.discoveredJobs,
        plans: updated.updatePlans,
      };
    }

    case "contact_sheet.execute": {
      assertContactSheetAccess();
      const activeProfile = assertActiveProfile();
      const store = useContactSheetStore.getState();

      if (store.isScanning || store.isExecutingBatch) {
        throw new BridgeError("BUSY", trText("DH Studio Pro đang bận xử lý một tác vụ khác.", "DH Studio Pro is busy with another task."));
      }

      const requestedIds: Set<string> | null = Array.isArray(params.jobIds)
        ? new Set(params.jobIds.filter((id): id is string => typeof id === "string"))
        : null;

      const readyJobs = store.discoveredJobs.filter(
        (j) => j.status === "READY" && (!requestedIds || requestedIds.has(j.id))
      );

      if (readyJobs.length === 0) {
        return {
          summary: {
            batchId: `batch_${Date.now().toString(36)}`,
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            totalPlanned: 0,
            successCount: 0,
            conflictCount: 0,
            skippedCount: 0,
            failedCount: 0,
            errors: [],
          },
          jobs: store.discoveredJobs,
          plans: store.updatePlans,
        };
      }

      store.setIsExecutingBatch(true);
      store.setBatchProgress({ current: 0, total: readyJobs.length });
      onProgress?.(0, readyJobs.length, trText(`Đang cập nhật 0/${readyJobs.length} job...`, `Updating 0/${readyJobs.length} job(s)...`));

      try {
        const summary = await sheetUpdateService.executeBatchUpdates(
          readyJobs,
          store.updatePlans,
          activeProfile,
          (current, total) => {
            useContactSheetStore.getState().setBatchProgress({ current, total });
            onProgress?.(current, total, trText(`Đang cập nhật ${current}/${total} job...`, `Updating ${current}/${total} job(s)...`));
          }
        );

        const readyIdSet = new Set(readyJobs.map((j) => j.id));
        const failedById = new Map(summary.errors.map((e) => [e.jobId, e.error]));
        const allStale = summary.successCount === 0 && summary.conflictCount > 0 && summary.failedCount === 0;

        const nextJobs = useContactSheetStore.getState().discoveredJobs.map((j): DiscoveredJob => {
          if (!readyIdSet.has(j.id)) return j;
          const errMsg = failedById.get(j.id);
          if (errMsg) {
            return { ...j, status: "ERROR", statusReason: errMsg };
          }
          if (allStale) {
            return {
              ...j,
              status: "CONFLICT",
              statusReason: trText("Hàng này vừa được người khác chỉnh sửa trên Sheet", "This row was just modified by someone else on the Sheet"),
            };
          }
          return { ...j, status: "COMPLETED" };
        });

        useContactSheetStore.getState().setDiscoveredJobs(nextJobs);

        const updated = useContactSheetStore.getState();
        return {
          summary,
          jobs: updated.discoveredJobs,
          plans: updated.updatePlans,
        };
      } catch (err: any) {
        if (err instanceof BridgeError) throw err;
        throw new BridgeError("INTERNAL_ERROR", err?.message || String(err));
      } finally {
        useContactSheetStore.getState().setIsExecutingBatch(false);
        useContactSheetStore.getState().setBatchProgress(null);
      }
    }

    default:
      throw new BridgeError("UNKNOWN_ACTION", trText(`Action không được hỗ trợ: ${action}`, `Unsupported action: ${action}`));
  }
}

interface IncomingBridgeEventPayload {
  dispatchId: string;
  action: string;
  params: unknown;
}

/**
 * Registers the Tauri WebView listener for DH Ecosystem Bridge requests.
 * Safe to call in non-Tauri environments (no-op).
 */
export function initContactSheetBridge(): () => void {
  if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__) {
    return () => {};
  }

  let disposed = false;
  let unlistenRequest: (() => void) | undefined;
  let unlistenOpenTab: (() => void) | undefined;

  Promise.all([import("@tauri-apps/api/event"), import("@tauri-apps/api/core")])
    .then(async ([{ listen }, { invoke }]) => {
      if (disposed) return;

      unlistenRequest = await listen<IncomingBridgeEventPayload>(
        "dh-bridge:request",
        async (event) => {
          const { dispatchId, action, params } = event.payload;
          try {
            const data = await handleContactSheetBridgeRequest(
              action,
              params,
              (current, total, message) => {
                void invoke("bridge_emit_progress", {
                  dispatchId,
                  current,
                  total,
                  message,
                }).catch(() => {});
              }
            );
            await invoke("bridge_reply", {
              dispatchId,
              ok: true,
              data,
              errorCode: null,
              errorMessage: null,
            });
          } catch (err: any) {
            const code = err instanceof BridgeError ? err.code : "INTERNAL_ERROR";
            const message = err?.message || String(err);
            await invoke("bridge_reply", {
              dispatchId,
              ok: false,
              data: null,
              errorCode: code,
              errorMessage: message,
            }).catch(() => {});
          }
        }
      );

      unlistenOpenTab = await listen<{ module?: string; tab?: string }>(
        "dh-bridge:open-tab",
        (event) => {
          const tab = event.payload?.tab;
          if (tab) {
            try {
              sessionStorage.setItem("dh_contact_sheet_requested_tab", tab);
            } catch {
              // ignore
            }
            window.dispatchEvent(new CustomEvent("dh-contact-sheet:set-tab", { detail: { tab } }));
          }
        }
      );

      if (!disposed) {
        await invoke("bridge_mark_ready").catch(() => {});
      }
    })
    .catch((err) => {
      console.warn("[DH Bridge] Failed to initialize Tauri listener:", err);
    });

  return () => {
    disposed = true;
    unlistenRequest?.();
    unlistenOpenTab?.();
  };
}
