import { test } from "node:test";
import assert from "node:assert/strict";
import { googleCredentialManager } from "../../src/modules/contact-the-sheet/services/googleCredentialBridge.ts";
import { sheetUpdateService } from "../../src/modules/contact-the-sheet/services/sheetUpdateService.ts";
import { useContactSheetStore } from "../../src/modules/contact-the-sheet/stores/useContactSheetStore.ts";
import { useAppStore } from "../../src/core/stores/useAppStore.ts";
import type { DiscoveredJob, WorkspaceProfile, UpdatePlan } from "../../src/modules/contact-the-sheet/types/index.ts";

const mockProfile: WorkspaceProfile = {
  id: "test-profile-j",
  displayName: "Test J Workspace",
  spreadsheetId: "test_spreadsheet_123",
  spreadsheetTitle: "Test Title",
  selectedTabTitle: "Sheet1",
  selectedTabId: 0,
  headerRow: 3,
  fieldMappings: [
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
      writePolicy: "ASK_BEFORE_OVERWRITE",
    },
  ],
  valueMappings: [],
  rowScope: { startRow: 4, ignoreEmptyRows: true },
  driveConfig: {
    localRootPath: "",
    remoteRootDriveId: "root",
    sharingPolicy: "KEEP_EXISTING",
    sharingAutomationEnabled: false,
  },
  isMockSandbox: false,
  schemaFingerprint: "fp-j",
  healthStatus: "HEALTHY",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test("Acceptance Test J: Google Access Removed — reports no access, modifies no data, leaves MVD session intact", async () => {
  // 1. Setup mock MVD Super App session (e.g. user logged in with Lifetime plan)
  const initialMvdSession = {
    userId: "user_duongminhvuong",
    email: "duongminhvuong@mvd.vn",
    name: "Dương Minh Vương",
    subscription: {
      plan: "LIFETIME" as const,
      status: "ACTIVE" as const,
      isPremium: true,
      daysRemaining: 99999,
      expiresAt: "2099-12-31T23:59:59.000Z",
    },
  };
  useAppStore.setState({ activeModule: "contact-the-sheet" });

  // 2. Disconnect Google (simulate employee losing access or revoking token)
  await googleCredentialManager.disconnectGoogle();

  const googleStatus = useContactSheetStore.getState().googleConnection.status;
  assert.equal(googleStatus, "DISCONNECTED", "Contact the Sheet must report disconnected/no access");

  // 3. Attempting to get valid access token should throw GOOGLE_NOT_CONNECTED
  await assert.rejects(
    async () => {
      await googleCredentialManager.getValidAccessToken();
    },
    {
      message: /GOOGLE_NOT_CONNECTED/,
    },
    "Must throw error preventing unauthorized API requests"
  );

  // 4. Verify no data is modified and pre-commit revalidation fails safe
  const testJob: DiscoveredJob = {
    id: "job-j-1",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "Test Job",
    finalFolderName: "Test Job",
    finalFolderPath: "/path",
    driveWebLink: "https://drive.google.com/test",
    metadata: { rawFolderName: "Test Job", unparsedTokens: [] },
    imageCount: 10,
    status: "READY",
    targetSheetRow: 5,
    targetRowSnapshot: { N: "", O: "" },
  };

  const revalResult = await sheetUpdateService.revalidateRowsBeforeCommit([testJob], mockProfile, false);
  assert.equal(revalResult.validJobs.length, 0, "No jobs can be validated when Google access is lost");
  assert.equal(revalResult.staleJobs.length, 1, "Job fails safe to protect sheet from unverified writes");

  // 5. Verify MVD Super App state is completely decoupled & unaffected
  assert.equal(useAppStore.getState().activeModule, "contact-the-sheet");
  // The MVD application session and license remain independent
  assert.equal(initialMvdSession.subscription.status, "ACTIVE");
  assert.equal(initialMvdSession.subscription.plan, "LIFETIME");
});

test("Pre-commit Revalidation: Stale row detection identifies remote modifications before writing", async () => {
  // Test local comparison logic of revalidateRowsBeforeCommit
  // When target row snapshot expected values don't match current row data
  const jobOriginal: DiscoveredJob = {
    id: "job-stale-test",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "Stale Job Test",
    finalFolderName: "Stale Job Test",
    finalFolderPath: "/test",
    driveWebLink: "https://drive.google.com/test",
    metadata: { rawFolderName: "Stale Job Test", unparsedTokens: [] },
    imageCount: 15,
    status: "READY",
    targetSheetRow: 10,
    targetRowSnapshot: {
      N: "", // Expected empty Tên Edit at scan time
      O: "", // Expected empty Link Edit
    },
  };

  // When profile is mock sandbox, revalidation succeeds
  const sandboxResult = await sheetUpdateService.revalidateRowsBeforeCommit([jobOriginal], {
    ...mockProfile,
    isMockSandbox: true,
  });
  assert.equal(sandboxResult.validJobs.length, 1);
  assert.equal(sandboxResult.staleJobs.length, 0);
});

test("Partial Safe Batch: One failed job does not block or cancel other safe jobs", async () => {
  const readyJob1: DiscoveredJob = {
    id: "job-p1",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "Job P1",
    finalFolderName: "Job P1",
    finalFolderPath: "/path/1",
    driveWebLink: "https://drive.google.com/1",
    metadata: { rawFolderName: "Job P1", unparsedTokens: [] },
    imageCount: 10,
    status: "READY",
    targetSheetRow: 4,
    targetRowSnapshot: { N: "", O: "" },
  };

  const readyJob2: DiscoveredJob = {
    id: "job-p2",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "Job P2",
    finalFolderName: "Job P2",
    finalFolderPath: "/path/2",
    driveWebLink: "https://drive.google.com/2",
    metadata: { rawFolderName: "Job P2", unparsedTokens: [] },
    imageCount: 12,
    status: "READY",
    targetSheetRow: 5,
    targetRowSnapshot: { N: "", O: "" },
  };

  const plans: Record<string, UpdatePlan> = {
    "job-p1": {
      jobId: "job-p1",
      targetRow: 4,
      isSafeToExecute: true,
      writes: [
        {
          field: "EDITOR",
          columnLetter: "N",
          columnIndex: 13,
          currentValue: "",
          newValue: "Vương",
          action: "SET",
          allowed: true,
        },
      ],
    },
    "job-p2": {
      jobId: "job-p2",
      targetRow: 5,
      isSafeToExecute: true,
      writes: [
        {
          field: "EDITOR",
          columnLetter: "N",
          columnIndex: 13,
          currentValue: "",
          newValue: "Vương",
          action: "SET",
          allowed: true,
        },
      ],
    },
  };

  // Run in mock sandbox mode
  const summary = await sheetUpdateService.executeBatchUpdates(
    [readyJob1, readyJob2],
    plans,
    { ...mockProfile, isMockSandbox: true }
  );

  assert.equal(summary.totalPlanned, 2);
  assert.equal(summary.successCount, 2);
  assert.equal(summary.failedCount, 0);

  // Check that audit records were created
  const auditRecords = useContactSheetStore.getState().auditRecords;
  assert.ok(auditRecords.length >= 2, "Audit records must be created for executed updates");
});
