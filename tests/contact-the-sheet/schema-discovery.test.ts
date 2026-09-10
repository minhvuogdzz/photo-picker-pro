import { test } from "node:test";
import assert from "node:assert/strict";
import { sheetDiscoveryService } from "../../src/modules/contact-the-sheet/services/sheetDiscoveryService.ts";
import { schemaHealthService } from "../../src/modules/contact-the-sheet/services/schemaHealthService.ts";
import realSheetFixture from "../fixtures/contact-the-sheet/real-sheet-structure.json" with { type: "json" };
import type { WorkspaceProfile, ColumnProfile } from "../../src/modules/contact-the-sheet/types/index.ts";

test("Acceptance Test A: Real Sheet discovery identifies row 3 as header and detects non-header notes", () => {
  const rowData = realSheetFixture.sheets[0].data[0].rowData;
  
  // 1. Score candidate headers
  const candidates = sheetDiscoveryService.scoreHeaderCandidates(rowData);
  assert.ok(candidates.length > 0, "Should detect candidate header rows");

  // Top candidate must be row 3
  const topCandidate = candidates[0];
  assert.equal(topCandidate.row, 3, "Row 3 should be scored as the primary header row");
  assert.ok(topCandidate.score > 0.8, "Row 3 score should be high confidence");

  // Rows 1 and 2 must not be chosen as header
  const row1Score = candidates.find((c) => c.row === 1)?.score || 0;
  assert.ok(topCandidate.score > row1Score, "Row 3 must score higher than Row 1 summary note");
});

test("Acceptance Test A: Column profiler detects dropdowns, formulas, links, and #REF! errors", () => {
  const rowData = realSheetFixture.sheets[0].data[0].rowData;
  const columns = sheetDiscoveryService.buildColumnProfiles(rowData, 3, 26);

  // Column H (Tên file)
  const tenFileCol = columns.find((c) => c.letter === "H");
  assert.ok(tenFileCol, "Column H must exist");
  assert.equal(tenFileCol?.headerName, "Tên file");
  assert.equal(tenFileCol?.suggestedSemanticField, "JOB_FOLDER_NAME");

  // Column N (Tên Edit) - Dropdown detection
  const tenEditCol = columns.find((c) => c.letter === "N");
  assert.ok(tenEditCol, "Column N must exist");
  assert.equal(tenEditCol?.headerName, "Tên Edit");
  assert.equal(tenEditCol?.suggestedSemanticField, "EDITOR");
  assert.ok(tenEditCol?.dropdownOptions?.includes("Vương"), "Dropdown options must include Vương");

  // Column O (Link Edit) - Link field detection
  const linkEditCol = columns.find((c) => c.letter === "O");
  assert.ok(linkEditCol, "Column O must exist");
  assert.equal(linkEditCol?.headerName, "Link Edit");
  assert.equal(linkEditCol?.suggestedSemanticField, "DELIVERY_LINK");
  assert.equal(linkEditCol?.isHyperlinkField, true);

  // Column S (Time edit) - Formula-derived detection
  const timeEditCol = columns.find((c) => c.letter === "S");
  assert.ok(timeEditCol, "Column S must exist");
  assert.equal(timeEditCol?.hasFormulas, true);
  assert.equal(timeEditCol?.detectedSourceType, "FORMULA");

  // Detect #REF! error in column H (Row 6 Chaien has #REF!)
  assert.equal(tenFileCol?.hasErrors, true, "Column H must be flagged with hasErrors due to #REF!");
});

test("Acceptance Test I: Column shift detection and auto-remap", () => {
  const dummyProfile: WorkspaceProfile = {
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
    valueMappings: [],
    rowScope: { startRow: 4, ignoreEmptyRows: true },
    driveConfig: {
      localRootPath: "",
      remoteRootDriveId: "root",
      sharingPolicy: "KEEP_EXISTING",
      sharingAutomationEnabled: false,
    },
    isMockSandbox: true,
    schemaFingerprint: "old_fingerprint",
    healthStatus: "HEALTHY",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Simulate studio inserting a column before N:
  // Now Tên Edit is at column O (index 14) and Link Edit is at column P (index 15)
  const shiftedColumns: ColumnProfile[] = [
    {
      index: 13,
      letter: "N",
      headerName: "Cột Mới Chèn",
      headerRow: 3,
      detectedSourceType: "DIRECT_VALUE",
      hasFormulas: false,
      formulaCount: 0,
      sampleValues: [],
      isHyperlinkField: false,
      hasErrors: false,
    },
    {
      index: 14,
      letter: "O",
      headerName: "Tên Edit",
      headerRow: 3,
      detectedSourceType: "DIRECT_VALUE",
      hasFormulas: false,
      formulaCount: 0,
      sampleValues: [],
      isHyperlinkField: false,
      hasErrors: false,
    },
    {
      index: 15,
      letter: "P",
      headerName: "Link Edit",
      headerRow: 3,
      detectedSourceType: "DIRECT_VALUE",
      hasFormulas: false,
      formulaCount: 0,
      sampleValues: [],
      isHyperlinkField: true,
      hasErrors: false,
    },
  ];

  const report = schemaHealthService.verifyWorkspaceHealth(dummyProfile, shiftedColumns);
  assert.equal(report.status, "SCHEMA_SHIFTED");
  assert.equal(report.shiftedFields.length, 2);
  assert.equal(report.shiftedFields.find((s) => s.field === "EDITOR")?.newLetter, "O");
  assert.equal(report.shiftedFields.find((s) => s.field === "DELIVERY_LINK")?.newLetter, "P");

  // Test auto-remap
  const remapped = schemaHealthService.autoRemapShiftedColumns(dummyProfile, report.shiftedFields, shiftedColumns);
  assert.equal(remapped.find((m) => m.semanticField === "EDITOR")?.columnLetter, "O");
  assert.equal(remapped.find((m) => m.semanticField === "DELIVERY_LINK")?.columnLetter, "P");
});
