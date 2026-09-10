import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaMappingService } from "../../src/modules/contact-the-sheet/services/schemaMappingService.ts";
import type { WorkspaceProfile } from "../../src/modules/contact-the-sheet/types/index.ts";

const securityProfile: WorkspaceProfile = {
  id: "security-profile",
  displayName: "Security Test",
  spreadsheetId: "test",
  spreadsheetTitle: "Test",
  selectedTabTitle: "Sheet1",
  selectedTabId: 0,
  headerRow: 3,
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
      writePolicy: "ASK_BEFORE_OVERWRITE",
    },
    {
      semanticField: "EDIT_COMPLETED_AT",
      columnLetter: "S",
      columnIndex: 18,
      columnHeader: "Time edit",
      permission: "READ_ONLY",
      isFormulaDerived: true,
      writePolicy: "SET_IF_EMPTY",
    },
  ],
  valueMappings: [],
  rowScope: { startRow: 4, endRow: 100, ignoreEmptyRows: true },
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

test("Acceptance Test B & K: Formula cells are strictly blocked from being overwritten", () => {
  const result = schemaMappingService.evaluateWritePermission(
    securityProfile,
    "DELIVERY_LINK",
    4,
    "=IMPORTRANGE(...)",
    true // isTargetCellFormula = true
  );

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "FORMULA_CELL", "Must block writes to formula cells");
});

test("Acceptance Test K: App-level field protection blocks writes to READ_ONLY fields (Tên khách)", () => {
  const result = schemaMappingService.evaluateWritePermission(
    securityProfile,
    "CUSTOMER_NAME",
    4,
    "Xuka",
    false
  );

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "FIELD_READ_ONLY", "Must block writes to READ_ONLY fields even if user has Google Editor rights");
});

test("Write Security: Blocks writes outside configured row scope (e.g. Header row 3)", () => {
  const resultHeader = schemaMappingService.evaluateWritePermission(
    securityProfile,
    "EDITOR",
    3, // header row
    "Tên Edit",
    false
  );

  assert.equal(resultHeader.allowed, false);
  assert.equal(resultHeader.reason, "OUTSIDE_ROW_SCOPE");

  const resultBeyondScope = schemaMappingService.evaluateWritePermission(
    securityProfile,
    "EDITOR",
    101, // beyond endRow 100
    "",
    false
  );

  assert.equal(resultBeyondScope.allowed, false);
  assert.equal(resultBeyondScope.reason, "OUTSIDE_ROW_SCOPE");
});

test("Acceptance Test E: Time edit is formula-derived and remains READ_ONLY", () => {
  const result = schemaMappingService.evaluateWritePermission(
    securityProfile,
    "EDIT_COMPLETED_AT",
    4,
    "",
    false
  );

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "FIELD_READ_ONLY", "Formula-derived time field must not be directly written");
});
