import { test } from "node:test";
import assert from "node:assert/strict";
import { jobMatchingService, type SheetRowRecord } from "../../src/modules/contact-the-sheet/services/jobMatchingService.ts";
import { folderParserService } from "../../src/modules/contact-the-sheet/services/folderParserService.ts";
import type { DiscoveredJob, WorkspaceProfile } from "../../src/modules/contact-the-sheet/types/index.ts";

const mockProfile: WorkspaceProfile = {
  id: "test-profile",
  displayName: "Test",
  spreadsheetId: "test",
  spreadsheetTitle: "Test",
  selectedTabTitle: "Sheet1",
  selectedTabId: 0,
  headerRow: 3,
  fieldMappings: [
    {
      semanticField: "SHOOT_DATE",
      columnLetter: "A",
      columnIndex: 0,
      columnHeader: "Ngày",
      permission: "READ_ONLY",
      isFormulaDerived: true,
      writePolicy: "SET_IF_EMPTY",
    },
    {
      semanticField: "SHOOT_TIME",
      columnLetter: "B",
      columnIndex: 1,
      columnHeader: "Giờ",
      permission: "READ_ONLY",
      isFormulaDerived: true,
      writePolicy: "SET_IF_EMPTY",
    },
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
      semanticField: "JOB_FOLDER_NAME",
      columnLetter: "H",
      columnIndex: 7,
      columnHeader: "Tên file",
      permission: "READ_ONLY",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
    {
      semanticField: "SOCIAL_USERNAME",
      columnLetter: "C",
      columnIndex: 2,
      columnHeader: "Tên khách",
      permission: "READ_ONLY",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
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
  isMockSandbox: true,
  schemaFingerprint: "fp",
  healthStatus: "HEALTHY",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test("Job Matching: Exact Tên file match uniquely resolves target row", () => {
  const job: DiscoveredJob = {
    id: "job1",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "7-9 12h _xuka_11 1cc",
    finalFolderName: "7-9 12h _xuka_11 1cc",
    finalFolderPath: "/path",
    metadata: {
      rawFolderName: "7-9 12h _xuka_11 1cc",
      shootDate: "07/09",
      shootTime: "12:00",
      socialUsername: "xuka_11",
      unparsedTokens: [],
    },
    imageCount: 24,
    status: "PENDING",
  };

  const rows: SheetRowRecord[] = [
    { row: 4, values: { A: "07/09", B: "12:00", C: "Xuka", H: "7-9 12h _xuka_11 1cc" } },
    { row: 5, values: { A: "08/09", B: "14:00", C: "Nobita", H: "8-9 14h _nobita_02 2cc" } },
  ];

  const match = jobMatchingService.matchJobToSheetRows(job, rows, mockProfile);
  assert.equal(match.status, "READY");
  assert.equal(match.targetRow, 4);
  assert.ok((match.confidence || 0) >= 1.0);
});

test("Acceptance Test H: Duplicate customer match returns NEEDS_REVIEW with candidate rows", () => {
  const job: DiscoveredJob = {
    id: "job-ambiguous",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "10-9 10h Doraemon",
    finalFolderName: "Doraemon",
    finalFolderPath: "/path",
    metadata: {
      rawFolderName: "10-9 10h Doraemon",
      shootDate: "10/09",
      shootTime: "10:00",
      customerName: "Doraemon",
      unparsedTokens: [],
    },
    imageCount: 20,
    status: "PENDING",
  };

  // Two rows with same date, time, and customer name but different packages/folders
  const rows: SheetRowRecord[] = [
    { row: 7, values: { A: "10/09", B: "10:00", C: "Doraemon", H: "10-9 10h _mon_01" } },
    { row: 8, values: { A: "10/09", B: "10:00", C: "Doraemon", H: "10-9 10h _mon_02" } },
  ];

  const match = jobMatchingService.matchJobToSheetRows(job, rows, mockProfile);
  assert.equal(match.status, "NEEDS_REVIEW");
  assert.ok(match.candidateRows && match.candidateRows.length === 2);
  assert.equal(match.candidateRows[0].row, 7);
  assert.equal(match.candidateRows[1].row, 8);
});

test("Job Matching: Never matches against #REF! error text", () => {
  const job: DiscoveredJob = {
    id: "job-ref",
    sourceType: "LOCAL_DRIVE_DESKTOP",
    jobFolderName: "#REF!",
    finalFolderName: "#REF!",
    finalFolderPath: "/path",
    metadata: {
      rawFolderName: "#REF!",
      unparsedTokens: ["#REF!"],
    },
    imageCount: 0,
    status: "PENDING",
  };

  const rows: SheetRowRecord[] = [
    { row: 6, values: { A: "09/09", B: "16:00", C: "Chaien", H: "#REF!" } },
  ];

  const match = jobMatchingService.matchJobToSheetRows(job, rows, mockProfile);
  assert.equal(match.status, "NO_MATCH", "Must not match against #REF!");
});

test("Studio Matching: Deepest folder extracts customer name and aligns row in sheet tab (Real User Cases)", () => {
  const testFolders = [
    { folder: "4-9 8h phuog_thyur08 - peppa 2cc", expectedRow: 10, customer: "peppa" },
    { folder: "4-9 9h phw.nah_129 - Ng Phuong Anh 2cc", expectedRow: 11, customer: "Ng Phuong Anh" },
    { folder: "4-9 13h Hoàng Thị Khánh Ly 2cc", expectedRow: 12, customer: "Hoàng Thị Khánh Ly" },
    { folder: "4-9 14h userjz2q6r75cb - Linh 💏 couple", expectedRow: 13, customer: "Linh" },
  ];

  const sheetRows: SheetRowRecord[] = [
    { row: 10, values: { A: "04/09", B: "08:00", C: "peppa", H: "" } },
    { row: 11, values: { A: "04/09", B: "09:00", C: "Ng Phuong Anh", H: "" } },
    { row: 12, values: { A: "04/09", B: "13:00", C: "Hoàng Thị Khánh Ly", H: "" } },
    { row: 13, values: { A: "04/09", B: "14:00", C: "Linh", H: "" } },
  ];

  for (const item of testFolders) {
    const parsed = folderParserService.parseFolderName(item.folder);
    const job: DiscoveredJob = {
      id: `job-${item.expectedRow}`,
      sourceType: "LOCAL_DRIVE_DESKTOP",
      jobFolderName: item.folder,
      finalFolderName: item.folder, // Deepest folder
      finalFolderPath: `/Users/vuongdev/Library/CloudStorage/GoogleDrive-ougn.it2@gmail.com/My Drive/${item.folder}`,
      metadata: parsed,
      imageCount: 20,
      status: "PENDING",
    };

    const match = jobMatchingService.matchJobToSheetRows(job, sheetRows, mockProfile);
    assert.equal(match.status, "READY", `Job "${item.folder}" must match READY`);
    assert.equal(match.targetRow, item.expectedRow, `Job "${item.folder}" must align to row ${item.expectedRow}`);
  }
});
