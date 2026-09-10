import { test } from "node:test";
import assert from "node:assert/strict";
import { batchPlannerService } from "../../src/modules/contact-the-sheet/services/batchPlannerService.ts";
import { conflictDetectorService } from "../../src/modules/contact-the-sheet/services/conflictDetectorService.ts";
import { sheetUpdateService } from "../../src/modules/contact-the-sheet/services/sheetUpdateService.ts";
import type { DiscoveredJob, WorkspaceProfile } from "../../src/modules/contact-the-sheet/types/index.ts";

const testProfile: WorkspaceProfile = {
  id: "test-profile",
  displayName: "Test",
  spreadsheetId: "test",
  spreadsheetTitle: "Test",
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
  valueMappings: [
    {
      semanticRole: "EDITOR_CURRENT_USER",
      sheetValue: "Vương",
    },
  ],
  rowScope: { startRow: 4, ignoreEmptyRows: true },
  driveConfig: {
    localRootPath: "",
    remoteRootDriveId: "root",
    sharingPolicy: "KEEP_EXISTING",
    sharingAutomationEnabled: false,
  },
  isMockSandbox: true,
  schemaFingerprint: "fp",
  healthStatus: "HEALTHY",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test("Acceptance Test C: Exact job match with empty cells proposes Editor and Drive link update", () => {
  const job: DiscoveredJob = {
    id: "job-c",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "7-9 12h _xuka_11 1cc",
    finalFolderName: "7-9 12h _xuka_11 1cc",
    finalFolderPath: "/path",
    driveItemId: "drive_123",
    driveWebLink: "https://drive.google.com/drive/folders/drive_123",
    metadata: {
      rawFolderName: "7-9 12h _xuka_11 1cc",
      unparsedTokens: [],
    },
    imageCount: 24,
    status: "READY",
    targetSheetRow: 4,
    targetRowSnapshot: {
      N: "", // Tên Edit empty
      O: "", // Link Edit empty
    },
  };

  const { job: evaluated, plan } = batchPlannerService.planJobUpdate(job, testProfile);
  assert.equal(evaluated.status, "READY");
  assert.equal(plan.isSafeToExecute, true);
  assert.equal(plan.writes.length, 2);

  const editorWrite = plan.writes.find((w) => w.field === "EDITOR");
  assert.equal(editorWrite?.newValue, "Vương");
  assert.equal(editorWrite?.allowed, true);

  const linkWrite = plan.writes.find((w) => w.field === "DELIVERY_LINK");
  assert.equal(linkWrite?.newValue, "https://drive.google.com/drive/folders/drive_123");
  assert.equal(linkWrite?.allowed, true);
});

test("Acceptance Test D: Link Edit containing existing notes and URLs triggers CONFLICT", () => {
  const existingNotesAndUrls = "https://drive.google.com/drive/folders/old_link\n\nko sửa mí mắt đc nhé\n\nhttps://drive.google.com/drive/folders/second_link";
  
  const conflictCheck = conflictDetectorService.inspectLinkConflict(existingNotesAndUrls);
  assert.equal(conflictCheck.hasConflict, true);
  assert.equal(conflictCheck.conflictType, "MULTIPLE_URLS");
  assert.equal(conflictCheck.suggestedAction, "ASK");

  const job: DiscoveredJob = {
    id: "job-d",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "8-9 14h _nobita_02 2cc",
    finalFolderName: "8-9 14h _nobita_02 2cc",
    finalFolderPath: "/path",
    driveItemId: "new_drive_456",
    driveWebLink: "https://drive.google.com/drive/folders/new_drive_456",
    metadata: { rawFolderName: "8-9 14h _nobita_02 2cc", unparsedTokens: [] },
    imageCount: 30,
    status: "READY",
    targetSheetRow: 5,
    targetRowSnapshot: {
      N: "Hân",
      O: existingNotesAndUrls,
    },
  };

  const { job: evaluated, plan } = batchPlannerService.planJobUpdate(job, testProfile);
  assert.equal(evaluated.status, "CONFLICT");
  assert.equal(plan.isSafeToExecute, false, "Must not execute automatically when conflict exists");
  assert.ok(evaluated.conflictDetails, "Must provide conflict details for user resolution");

  // User chooses APPEND:
  const resolvedVal = conflictDetectorService.resolveCellValue(
    existingNotesAndUrls,
    "https://drive.google.com/drive/folders/new_drive_456",
    "APPEND"
  );
  assert.ok(resolvedVal.includes("ko sửa mí mắt đc nhé"));
  assert.ok(resolvedVal.includes("https://drive.google.com/drive/folders/new_drive_456"));
});

test("Acceptance Test G: 12-job batch separates READY, CONFLICT, and NEEDS_REVIEW for partial safe update", () => {
  const jobs: DiscoveredJob[] = [];
  
  // 10 Ready jobs
  for (let i = 1; i <= 10; i++) {
    jobs.push({
      id: `job_ready_${i}`,
      sourceType: "LOCAL_DRIVE_DESKTOP",
      jobFolderName: `Job ${i}`,
      finalFolderName: `Final ${i}`,
      finalFolderPath: `/path/${i}`,
      driveWebLink: `https://drive.google.com/${i}`,
      metadata: { rawFolderName: `Job ${i}`, unparsedTokens: [] },
      imageCount: 20,
      status: "READY",
      targetSheetRow: 10 + i,
      targetRowSnapshot: { N: "", O: "" },
    });
  }

  // 1 Conflict job (Link Edit non-empty)
  jobs.push({
    id: "job_conflict",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "Job Conflict",
    finalFolderName: "Final Conflict",
    finalFolderPath: "/path/conflict",
    driveWebLink: "https://drive.google.com/conflict",
    metadata: { rawFolderName: "Job Conflict", unparsedTokens: [] },
    imageCount: 20,
    status: "READY",
    targetSheetRow: 25,
    targetRowSnapshot: { N: "", O: "https://drive.google.com/old" },
  });

  // 1 Needs Review job (no row determined)
  jobs.push({
    id: "job_review",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "Job Review",
    finalFolderName: "Final Review",
    finalFolderPath: "/path/review",
    driveWebLink: "https://drive.google.com/review",
    metadata: { rawFolderName: "Job Review", unparsedTokens: [] },
    imageCount: 20,
    status: "NEEDS_REVIEW",
  });

  const summary = batchPlannerService.planBatch(jobs, testProfile);
  assert.equal(summary.readyJobs.length, 10, "Exactly 10 jobs must be READY");
  assert.equal(summary.conflictJobs.length, 1, "Exactly 1 job must be CONFLICT");
  assert.equal(summary.needsReviewJobs.length, 1, "Exactly 1 job must be NEEDS_REVIEW");

  // Partial execution: updating 10 ready jobs should succeed
  assert.ok(summary.readyJobs.every((j) => summary.plans[j.id].isSafeToExecute));
});

test("Policy Protection: SET_IF_EMPTY strictly protects existing editor name and blocks overwriting", () => {
  const jobWithExistingEditor: DiscoveredJob = {
    id: "job-existing-editor",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "5-9 18h _khanhhvan_ - Emma Hoàng 1cc",
    finalFolderName: "5-9 18h _khanhhvan_ - Emma Hoàng 1cc",
    finalFolderPath: "/path",
    driveItemId: "drive_new_789",
    driveWebLink: "https://drive.google.com/drive/folders/drive_new_789",
    metadata: { rawFolderName: "5-9 18h _khanhhvan_ - Emma Hoàng 1cc", unparsedTokens: [] },
    imageCount: 15,
    status: "READY",
    targetSheetRow: 335,
    targetRowSnapshot: {
      N: "Hân", // Existing editor is Hân
      O: "",    // Link is empty
    },
  };

  const { job: evaluated, plan } = batchPlannerService.planJobUpdate(jobWithExistingEditor, testProfile);

  // Editor write MUST NOT be allowed
  const editorWrite = plan.writes.find((w) => w.field === "EDITOR");
  assert.equal(editorWrite?.allowed, false, "SET_IF_EMPTY must disallow overwriting an existing editor");
  assert.equal(editorWrite?.blockedReason, "EXISTING_VALUE_CONFLICT");

  // Link write IS allowed because O is empty
  const linkWrite = plan.writes.find((w) => w.field === "DELIVERY_LINK");
  assert.equal(linkWrite?.allowed, true);
  assert.equal(linkWrite?.newValue, "https://drive.google.com/drive/folders/drive_new_789");

  // Job should still be safe to update the empty link without corrupting the editor name
  assert.equal(evaluated.status, "READY");
  assert.equal(plan.isSafeToExecute, true);
});

test("Policy Protection: SET_IF_EMPTY with identical editor value does not schedule redundant write", () => {
  const jobWithSameEditor: DiscoveredJob = {
    id: "job-same-editor",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "5-9 18h _khanhhvan_ - Emma Hoàng 1cc",
    finalFolderName: "5-9 18h _khanhhvan_ - Emma Hoàng 1cc",
    finalFolderPath: "/path",
    driveItemId: "drive_new_789",
    driveWebLink: "https://drive.google.com/drive/folders/drive_new_789",
    metadata: { rawFolderName: "5-9 18h _khanhhvan_ - Emma Hoàng 1cc", unparsedTokens: [] },
    imageCount: 15,
    status: "READY",
    targetSheetRow: 335,
    targetRowSnapshot: {
      N: "Vương", // Already Vương
      O: "https://drive.google.com/drive/folders/drive_new_789", // Already same link
    },
  };

  const { job: evaluated, plan } = batchPlannerService.planJobUpdate(jobWithSameEditor, testProfile);

  // Both cells already contain the desired values
  assert.equal(evaluated.status, "COMPLETED");
  assert.equal(plan.isSafeToExecute, false, "No writes needed when cells are already up to date");
});

test("Policy Protection: ASK_BEFORE_OVERWRITE triggers CONFLICT when existing cell has different value", () => {
  const askProfile: WorkspaceProfile = {
    ...testProfile,
    fieldMappings: testProfile.fieldMappings.map((m) =>
      m.semanticField === "EDITOR" ? { ...m, writePolicy: "ASK_BEFORE_OVERWRITE" } : m
    ),
  };

  const jobToAsk: DiscoveredJob = {
    id: "job-ask-conflict",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "Job Ask",
    finalFolderName: "Job Ask",
    finalFolderPath: "/path",
    driveWebLink: "https://drive.google.com/drive/new",
    metadata: { rawFolderName: "Job Ask", unparsedTokens: [] },
    imageCount: 10,
    status: "READY",
    targetSheetRow: 100,
    targetRowSnapshot: {
      N: "Tuấn", // Existing editor is Tuấn, currentUser is Vương
      O: "",
    },
  };

  const { job: evaluated, plan } = batchPlannerService.planJobUpdate(jobToAsk, askProfile);

  assert.equal(evaluated.status, "CONFLICT", "Must enter CONFLICT status when cell has different value");
  assert.equal(plan.isSafeToExecute, false, "Must block execution until user confirms overwrite");
  assert.equal(evaluated.conflictDetails?.field, "Tên Edit");
  assert.equal(evaluated.conflictDetails?.existingValue, "Tuấn");
  assert.equal(evaluated.conflictDetails?.proposedValue, "Vương");
});
