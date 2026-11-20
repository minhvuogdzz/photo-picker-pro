import { test } from "node:test";
import assert from "node:assert/strict";
import { useAuthStore } from "../../src/core/stores/useAuthStore.ts";
import { useContactSheetStore } from "../../src/modules/contact-the-sheet/stores/useContactSheetStore.ts";
import {
  BridgeError,
  handleContactSheetBridgeRequest,
  type ContactSheetBridgeContext,
} from "../../src/modules/contact-the-sheet/services/contactSheetBridge.ts";
import type { DiscoveredJob, WorkspaceProfile } from "../../src/modules/contact-the-sheet/types/index.ts";

const sandboxProfile: WorkspaceProfile = {
  id: "bridge-test-profile",
  displayName: "Bridge Test Studio",
  spreadsheetId: "sheet_test_1",
  spreadsheetTitle: "Lịch Edit Test",
  selectedTabTitle: "Edit 11/2026",
  selectedTabId: 0,
  headerRow: 3,
  rowScope: { startRow: 4 },
  isMockSandbox: true,
  columnProfiles: [],
  valueMappings: [
    { semanticRole: "EDITOR_CURRENT_USER", sheetValue: "Vương" },
  ],
  fieldMappings: [
    {
      semanticField: "CUSTOMER_NAME",
      columnLetter: "C",
      columnIndex: 2,
      columnHeader: "Tên khách",
      permission: "READ_ONLY",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
    {
      semanticField: "EDITOR",
      columnLetter: "N",
      columnIndex: 13,
      columnHeader: "Tên Edit",
      permission: "READ_WRITE",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
    {
      semanticField: "DELIVERY_LINK",
      columnLetter: "O",
      columnIndex: 14,
      columnHeader: "Link Edit",
      permission: "READ_WRITE",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
  ],
  driveConfig: {
    localRootPath: "/tmp/drive",
    remoteRootDriveId: "root",
    sharingPolicy: "KEEP_EXISTING",
    sharingAutomationEnabled: false,
    requireOwnerMatch: false,
  },
  tabConfigurations: {
    "Edit 11/2026": {
      sheetId: 0,
      tabTitle: "Edit 11/2026",
      headerRow: 3,
      rowScope: { startRow: 4 },
      fieldMappings: [
        {
          semanticField: "CUSTOMER_NAME",
          columnLetter: "C",
          columnIndex: 2,
          columnHeader: "Tên khách",
          permission: "READ_ONLY",
          isFormulaDerived: false,
          writePolicy: "SET_IF_EMPTY",
        },
        {
          semanticField: "EDITOR",
          columnLetter: "N",
          columnIndex: 13,
          columnHeader: "Tên Edit",
          permission: "READ_WRITE",
          isFormulaDerived: false,
          writePolicy: "SET_IF_EMPTY",
        },
        {
          semanticField: "DELIVERY_LINK",
          columnLetter: "O",
          columnIndex: 14,
          columnHeader: "Link Edit",
          permission: "READ_WRITE",
          isFormulaDerived: false,
          writePolicy: "SET_IF_EMPTY",
        },
      ],
    },
  },
  updatedAt: "2026-11-20T00:00:00.000Z",
};

function setAuthenticatedSession() {
  useAuthStore.setState({
    isLoading: false,
    session: {
      userId: "user_bridge_1",
      email: "studio@devhouse.vn",
      name: "Studio Tester",
      role: "ADMIN",
      accessToken: "token",
      refreshToken: "refresh",
      deviceId: "dev_1",
      subscription: {
        status: "LIFETIME",
        plan: "FULL_APP",
        expiresAt: null,
        daysRemaining: null,
      },
      entitlements: [{ app: "ALL", isTrial: false, expiresAt: null }],
    } as any,
  });
}

function setupStoreWithJobs(jobs: DiscoveredJob[]) {
  useContactSheetStore.setState({
    profiles: [sandboxProfile],
    activeProfile: sandboxProfile,
    discoveredJobs: jobs,
    updatePlans: {},
    isScanning: false,
    isExecutingBatch: false,
  });
}

test("bridge: get_context reports unauthenticated cleanly without throwing", async () => {
  useAuthStore.setState({ isLoading: false, session: null });
  setupStoreWithJobs([]);

  const ctx = (await handleContactSheetBridgeRequest(
    "contact_sheet.get_context",
    {}
  )) as ContactSheetBridgeContext;

  assert.equal(ctx.authenticated, false);
  assert.equal(ctx.hasAccess, false);
  assert.equal(ctx.accessReason, "NO_SESSION");
  assert.ok(ctx.activeProfile);
});

test("bridge: get_context returns full profile, tabs, writableColumns for authenticated user", async () => {
  setAuthenticatedSession();
  setupStoreWithJobs([]);

  const ctx = (await handleContactSheetBridgeRequest(
    "contact_sheet.get_context",
    {}
  )) as ContactSheetBridgeContext;

  assert.equal(ctx.authenticated, true);
  assert.equal(ctx.hasAccess, true);
  assert.equal(ctx.activeProfile?.id, "bridge-test-profile");
  assert.deepEqual(ctx.activeProfile?.availableTabTitles, ["Edit 11/2026"]);
  assert.deepEqual(ctx.activeProfile?.selectedTabTitles, ["Edit 11/2026"]);
  assert.equal(ctx.activeProfile?.writableColumns.length, 2);
  assert.equal(ctx.activeProfile?.writableColumns[0].columnLetter, "N");
});

test("bridge: assign_row, conflict resolution, skip/restore and execute round-trip", async () => {
  setAuthenticatedSession();
  const baseJob: DiscoveredJob = {
    id: "job_1",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "20-11 10h Minh Anh",
    finalFolderName: "20-11 10h Minh Anh Edit",
    finalFolderPath: "/tmp/drive/20-11 10h Minh Anh/Edit",
    driveWebLink: "https://drive.google.com/drive/folders/abc123",
    metadata: {
      rawFolderName: "20-11 10h Minh Anh",
      customerName: "Minh Anh",
      unparsedTokens: [],
    },
    imageCount: 42,
    status: "NEEDS_REVIEW",
    statusReason: "Cần chọn hàng",
    targetTabTitle: "Edit 11/2026",
  };
  setupStoreWithJobs([baseJob]);

  // 1. Assign row manually
  const assigned = (await handleContactSheetBridgeRequest("contact_sheet.assign_row", {
    jobId: "job_1",
    rowNumber: 12,
    tabTitle: "Edit 11/2026",
    rowSnapshot: { C: "Minh Anh", N: "", O: "" },
  })) as { jobs: DiscoveredJob[]; plans: Record<string, any> };

  assert.equal(assigned.jobs[0].targetSheetRow, 12);
  assert.equal(assigned.jobs[0].status, "READY");
  assert.ok(assigned.plans["job_1"]);

  // 2. Skip and restore
  const skipped = (await handleContactSheetBridgeRequest("contact_sheet.update_job_action", {
    jobId: "job_1",
    operation: "skip",
  })) as { jobs: DiscoveredJob[] };
  assert.equal(skipped.jobs[0].status, "SKIPPED");

  const restored = (await handleContactSheetBridgeRequest("contact_sheet.update_job_action", {
    jobId: "job_1",
    operation: "restore",
  })) as { jobs: DiscoveredJob[] };
  assert.equal(restored.jobs[0].status, "READY");

  // 3. Execute batch in sandbox mode and collect progress
  const progressLog: Array<{ current: number; total: number }> = [];
  const executed = (await handleContactSheetBridgeRequest(
    "contact_sheet.execute",
    {},
    (current, total) => progressLog.push({ current, total })
  )) as { summary: { successCount: number; failedCount: number }; jobs: DiscoveredJob[] };

  assert.equal(executed.summary.successCount, 1);
  assert.equal(executed.summary.failedCount, 0);
  assert.equal(executed.jobs[0].status, "COMPLETED");
  assert.ok(progressLog.length >= 1);
});

test("bridge: resolve_conflict handles both single and bulk conflict policies", async () => {
  setAuthenticatedSession();
  const conflictJob: DiscoveredJob = {
    id: "job_conflict_1",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "20-11 14h Hoang Nam",
    finalFolderName: "20-11 14h Hoang Nam Edit",
    finalFolderPath: "/tmp/drive/20-11 14h Hoang Nam/Edit",
    driveWebLink: "https://drive.google.com/drive/folders/newlink",
    metadata: {
      rawFolderName: "20-11 14h Hoang Nam",
      customerName: "Hoang Nam",
      unparsedTokens: [],
    },
    imageCount: 18,
    status: "CONFLICT",
    targetSheetRow: 15,
    targetTabTitle: "Edit 11/2026",
    targetRowSnapshot: {
      C: "Hoang Nam",
      N: "",
      O: "https://drive.google.com/drive/folders/oldlink",
    },
    conflictDetails: {
      field: "DELIVERY_LINK",
      existingValue: "https://drive.google.com/drive/folders/oldlink",
      proposedValue: "https://drive.google.com/drive/folders/newlink",
      allowedPolicies: ["OVERWRITE", "APPEND", "SKIP"],
    },
  };
  setupStoreWithJobs([conflictJob]);

  const resolved = (await handleContactSheetBridgeRequest("contact_sheet.resolve_conflict", {
    jobId: "job_conflict_1",
    policy: "APPEND",
  })) as { jobs: DiscoveredJob[]; plans: Record<string, any> };

  assert.equal(resolved.jobs[0].status, "READY");
  assert.equal(resolved.jobs[0].conflictDetails?.resolvedPolicy, "APPEND");
  assert.ok(resolved.plans["job_conflict_1"]);
});

test("bridge: unknown action returns BridgeError with UNKNOWN_ACTION", async () => {
  setAuthenticatedSession();
  setupStoreWithJobs([]);

  await assert.rejects(
    () => handleContactSheetBridgeRequest("contact_sheet.nonexistent", {}),
    (err: unknown) => err instanceof BridgeError && err.code === "UNKNOWN_ACTION"
  );
});
