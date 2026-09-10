import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sheetExtractorService,
  SheetExtractorService,
} from "../../src/modules/contact-the-sheet/services/sheetExtractorService.ts";
import type { WorkspaceProfile } from "../../src/modules/contact-the-sheet/types/index.ts";

const mockProfile: WorkspaceProfile = {
  id: "profile-test",
  displayName: "Studio Test",
  spreadsheetId: "sheet-test-id",
  spreadsheetTitle: "Lịch chụp T9",
  selectedTabTitle: "Edit 9/2026",
  selectedTabId: 0,
  headerRow: 3,
  fieldMappings: [
    {
      semanticField: "JOB_FOLDER_NAME",
      columnLetter: "G",
      columnIndex: 6,
      columnHeader: "Tên file",
      permission: "READ_ONLY",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
    {
      semanticField: "CUSTOMER_NAME",
      columnLetter: "D",
      columnIndex: 3,
      columnHeader: "Tên khách hàng",
      permission: "READ_ONLY",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
    {
      semanticField: "SELECTED_IMAGE_CODES_PRIMARY",
      columnLetter: "J",
      columnIndex: 9,
      columnHeader: "Mã ảnh chọn (1)",
      permission: "READ_ONLY",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
    {
      semanticField: "SELECTED_IMAGE_CODES_SECONDARY",
      columnLetter: "K",
      columnIndex: 10,
      columnHeader: "Mã ảnh chọn (2) - Ảnh cổng",
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

test("Sheet Extractor: parseTokenList parses various delimiters and formats", () => {
  const service = new SheetExtractorService();
  const input = "0012, 0015; 0024+ 0039\n0081\t0095 / ZHA0100.jpg";
  const tokens = service.parseTokenList(input);

  assert.deepEqual(tokens, ["0012", "0015", "0024", "0039", "0081", "0095", "ZHA0100.jpg"]);
});

test("Sheet Extractor: detectCodeColumns detects primary and secondary code columns", () => {
  const snapshot = {
    D: "Huyền Phan",
    G: "5-9 18h Huyền Phan 1cc",
    J: "0012, 0015, 0024, 0039, 0081",
    K: "0001, 0002",
  };

  const cols = sheetExtractorService.detectCodeColumns(mockProfile, snapshot);
  assert.equal(cols.length, 2);

  assert.equal(cols[0].columnLetter, "J");
  assert.equal(cols[0].columnHeader, "Mã ảnh chọn (1)");
  assert.equal(cols[0].codeCount, 5);
  assert.equal(cols[0].isPrimary, true);

  assert.equal(cols[1].columnLetter, "K");
  assert.equal(cols[1].columnHeader, "Mã ảnh chọn (2) - Ảnh cổng");
  assert.equal(cols[1].codeCount, 2);
  assert.equal(cols[1].isPrimary, false);
});

test("Sheet Extractor: extractCodesForFolder matches folder and returns candidate columns", () => {
  const rows = [
    {
      row: 4,
      values: {
        D: "Huyền Phan",
        G: "5-9 18h Huyền Phan 1cc",
        J: "0012, 0015, 0024, 0039, 0081",
        K: "0005",
      },
    },
    {
      row: 5,
      values: {
        D: "Mai Linh",
        G: "6-9 10h Mai Linh",
        J: "1100, 1102, 1105",
      },
    },
  ];

  const result = sheetExtractorService.extractCodesForFolder(
    "5-9 18h Huyền Phan 1cc",
    "/path/to/5-9 18h Huyền Phan 1cc",
    rows,
    mockProfile
  );

  assert.equal(result.status, "READY");
  assert.equal(result.matchedRow, 4);
  assert.equal(result.candidateColumns.length, 2);
  assert.equal(result.candidateColumns[0].columnLetter, "J");
  assert.equal(result.candidateColumns[0].codeCount, 5);
});

test("Sheet Extractor: formatExtractedCodes combines multiple columns into clean lines", () => {
  const columns = [
    { value: "0012, 0015, 0024" },
    { value: "0024, 0090, 0095" }, // 0024 duplicated
  ];

  const formatted = sheetExtractorService.formatExtractedCodes(columns);
  assert.equal(formatted, "0012\n0015\n0024\n0090\n0095");
});
