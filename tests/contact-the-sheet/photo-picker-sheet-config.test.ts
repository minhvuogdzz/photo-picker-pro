import { test } from "node:test";
import assert from "node:assert/strict";
import { sheetUpdateService } from "../../src/modules/contact-the-sheet/services/sheetUpdateService.ts";
import { sheetExtractorService } from "../../src/modules/contact-the-sheet/services/sheetExtractorService.ts";
import type { WorkspaceProfile, TabConfiguration } from "../../src/modules/contact-the-sheet/types/index.ts";

const mockPickerProfile: WorkspaceProfile = {
  id: "photo-picker-profile",
  displayName: "Photo Picker Studio Sheet",
  spreadsheetId: "1mQQ7FeFvy93kked5T_ob7wiiRa8XhX9IC54i6M_J0ak",
  spreadsheetTitle: "MVD Production Sheet",
  selectedTabTitle: "Edit 9/2026",
  selectedTabId: 101,
  headerRow: 4,
  fieldMappings: [
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
      semanticField: "SELECTED_IMAGE_CODES_PRIMARY",
      columnLetter: "I",
      columnIndex: 8,
      columnHeader: "Mã ảnh chọn (1)",
      permission: "READ_ONLY",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
    {
      semanticField: "SELECTED_IMAGE_CODES_SECONDARY",
      columnLetter: "J",
      columnIndex: 9,
      columnHeader: "Mã ảnh chọn (2)",
      permission: "READ_ONLY",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
    {
      semanticField: "PHOTO_PICK_STATUS",
      columnLetter: "G",
      columnIndex: 6,
      columnHeader: "Trạng Thái 1",
      permission: "READ_WRITE",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
  ],
  valueMappings: [
    {
      semanticRole: "PHOTO_PICK_STATUS_COMPLETED",
      sheetValue: "Đã lọc",
    },
  ],
  rowScope: {
    startRow: 5,
    endRow: 500,
    ignoreEmptyRows: true,
  },
  driveConfig: {
    localRootPath: "",
    remoteRootDriveId: "root",
    sharingPolicy: "KEEP_EXISTING",
    sharingAutomationEnabled: false,
  },
  isMockSandbox: true,
  schemaFingerprint: "fingerprint-picker-1",
  healthStatus: "HEALTHY",
  tabConfigurations: {
    "Edit 9/2026": {
      sheetId: 101,
      tabTitle: "Edit 9/2026",
      headerRow: 4,
      rowScope: { startRow: 5, endRow: 500, ignoreEmptyRows: true },
      schemaFingerprint: "fp9",
      updatedAt: new Date().toISOString(),
      fieldMappings: [
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
          semanticField: "SELECTED_IMAGE_CODES_PRIMARY",
          columnLetter: "I",
          columnIndex: 8,
          columnHeader: "Mã ảnh chọn (1)",
          permission: "READ_ONLY",
          isFormulaDerived: false,
          writePolicy: "SET_IF_EMPTY",
        },
        {
          semanticField: "SELECTED_IMAGE_CODES_SECONDARY",
          columnLetter: "J",
          columnIndex: 9,
          columnHeader: "Mã ảnh chọn (2)",
          permission: "READ_ONLY",
          isFormulaDerived: false,
          writePolicy: "SET_IF_EMPTY",
        },
        {
          semanticField: "PHOTO_PICK_STATUS",
          columnLetter: "G",
          columnIndex: 6,
          columnHeader: "Trạng Thái 1",
          permission: "READ_WRITE",
          isFormulaDerived: false,
          writePolicy: "SET_IF_EMPTY",
        },
      ],
    },
    "Edit 10/2026": {
      sheetId: 102,
      tabTitle: "Edit 10/2026",
      headerRow: 3,
      rowScope: { startRow: 4, endRow: 500, ignoreEmptyRows: true },
      schemaFingerprint: "fp10",
      updatedAt: new Date().toISOString(),
      fieldMappings: [
        {
          semanticField: "JOB_FOLDER_NAME",
          columnLetter: "F",
          columnIndex: 5,
          columnHeader: "Tên file",
          permission: "READ_ONLY",
          isFormulaDerived: false,
          writePolicy: "SET_IF_EMPTY",
        },
        {
          semanticField: "SELECTED_IMAGE_CODES_PRIMARY",
          columnLetter: "G",
          columnIndex: 6,
          columnHeader: "Mã ảnh chọn (1)",
          permission: "READ_ONLY",
          isFormulaDerived: false,
          writePolicy: "SET_IF_EMPTY",
        },
      ],
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test("Photo Picker Sheet Config: Tab configuration independent resolution", () => {
  const tab9 = mockPickerProfile.tabConfigurations?.["Edit 9/2026"];
  const tab10 = mockPickerProfile.tabConfigurations?.["Edit 10/2026"];

  assert.ok(tab9);
  assert.ok(tab10);

  // Tab 9 maps H to JOB_FOLDER_NAME and I to SELECTED_IMAGE_CODES_PRIMARY
  const tab9JobCol = tab9.fieldMappings.find((m) => m.semanticField === "JOB_FOLDER_NAME");
  assert.equal(tab9JobCol?.columnLetter, "H");

  const tab9CodeCol1 = tab9.fieldMappings.find((m) => m.semanticField === "SELECTED_IMAGE_CODES_PRIMARY");
  assert.equal(tab9CodeCol1?.columnLetter, "I");

  // Tab 10 shifted columns: F is JOB_FOLDER_NAME and G is SELECTED_IMAGE_CODES_PRIMARY
  const tab10JobCol = tab10.fieldMappings.find((m) => m.semanticField === "JOB_FOLDER_NAME");
  assert.equal(tab10JobCol?.columnLetter, "F");

  const tab10CodeCol1 = tab10.fieldMappings.find((m) => m.semanticField === "SELECTED_IMAGE_CODES_PRIMARY");
  assert.equal(tab10CodeCol1?.columnLetter, "G");
});

test("Photo Picker Sheet Config: Extracts codes and matches target row by Column H", () => {
  const sampleRows = [
    {
      row: 5,
      values: {
        G: "Đã gửi ảnh",
        H: "4-9 8h phuog_thyur08 - peppa 2cc",
        I: "HIP00511, HIP00515, HIP00533, HIP00542",
        J: "HIP00600",
      },
    },
  ];

  const result = sheetExtractorService.extractCodesForFolder(
    "4-9 8h phuog_thyur08 - peppa 2cc",
    "",
    sampleRows,
    mockPickerProfile
  );

  assert.equal(result.status, "READY");
  assert.equal(result.matchedRow, 5);
  assert.equal(result.candidateColumns.length, 2);

  const colI = result.candidateColumns.find((c) => c.columnLetter === "I");
  assert.ok(colI);
  assert.equal(colI.codeCount, 4);
  assert.deepEqual(colI.sampleCodes, ["HIP00511", "HIP00515", "HIP00533", "HIP00542"]);

  const colJ = result.candidateColumns.find((c) => c.columnLetter === "J");
  assert.ok(colJ);
  assert.equal(colJ.codeCount, 1);
  assert.deepEqual(colJ.sampleCodes, ["HIP00600"]);

  // Format with only Col I selected
  const formattedColIOnly = sheetExtractorService.formatExtractedCodes([colI]);
  assert.equal(formattedColIOnly, "HIP00511\nHIP00515\nHIP00533\nHIP00542");

  // Format with both Col I and Col J selected
  const formattedBoth = sheetExtractorService.formatExtractedCodes([colI, colJ]);
  assert.equal(formattedBoth, "HIP00511\nHIP00515\nHIP00533\nHIP00542\nHIP00600");
});

test("Photo Picker Sheet Config: Column permissions and write policy for status", async () => {
  const statusMapping = mockPickerProfile.fieldMappings.find((m) => m.semanticField === "PHOTO_PICK_STATUS");
  assert.ok(statusMapping);
  assert.equal(statusMapping.permission, "READ_WRITE");
  assert.equal(statusMapping.columnLetter, "G");

  // Test updateSingleCell with Mock Sandbox
  const updateResult = await sheetUpdateService.updateSingleCell(
    mockPickerProfile,
    5,
    statusMapping.columnLetter,
    "Đã lọc",
    statusMapping.writePolicy
  );

  assert.equal(updateResult.success, true);

  // Test row scope violation (row 4 is header, startRow is 5)
  const scopeViolationResult = await sheetUpdateService.updateSingleCell(
    mockPickerProfile,
    4, // header row
    statusMapping.columnLetter,
    "Đã lọc",
    statusMapping.writePolicy
  );

  assert.equal(scopeViolationResult.success, false);
  assert.match(scopeViolationResult.error || "", /phạm vi/);
});

test("Photo Picker Sheet Config: Strictly isolates configured code columns (1 & 2) and rejects random columns", () => {
  const snapshotWithUnrelatedColumns = {
    H: "4-9 8h phuong_thuy - peppa 2cc",
    I: "HIP0111, HIP0222", // Configured primary
    J: "", // Configured secondary (empty)
    R: "07, 09, 2026", // Column header "Time mã" (unrelated)
    L: "10, 09, 2026", // Column header "Hẹn trả ảnh" (unrelated)
  };

  const detected = sheetExtractorService.detectCodeColumns(mockPickerProfile, snapshotWithUnrelatedColumns);

  // Must ONLY contain configured I (primary) and J (secondary)
  assert.equal(detected.length, 2);
  assert.equal(detected[0].columnLetter, "I");
  assert.equal(detected[0].columnHeader, "Mã ảnh chọn (1)");
  assert.equal(detected[0].codeCount, 2);
  assert.equal(detected[0].isPrimary, true);

  assert.equal(detected[1].columnLetter, "J");
  assert.equal(detected[1].columnHeader, "Mã ảnh chọn (2)");
  assert.equal(detected[1].codeCount, 0); // Empty column still present
  assert.equal(detected[1].isPrimary, false);

  // Confirm R and L are strictly excluded
  assert.equal(detected.some((c) => c.columnLetter === "R"), false);
  assert.equal(detected.some((c) => c.columnLetter === "L"), false);
});
