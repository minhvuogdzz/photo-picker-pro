import { test } from "node:test";
import assert from "node:assert/strict";
import { sheetDiscoveryService } from "../../src/modules/contact-the-sheet/services/sheetDiscoveryService.ts";
import { useContactSheetStore } from "../../src/modules/contact-the-sheet/stores/useContactSheetStore.ts";
import type { ColumnProfile, FieldMapping, TabConfiguration, WorkspaceProfile } from "../../src/modules/contact-the-sheet/types/index.ts";

test("Multi-Tab 1: autoDetectOrCloneMappings adapts to shifted columns on target tab", () => {
  // Base mappings from Tab 1 (where Tên file is Col H, Tên Edit is Col N, Link Edit is Col O)
  const baseMappings: FieldMapping[] = [
    {
      semanticField: "JOB_FOLDER_NAME",
      columnLetter: "H",
      columnIndex: 7,
      columnHeader: "Tên file",
      permission: "READ_ONLY",
      isFormulaDerived: true,
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
  ];

  // Target Tab 2 has shifted columns:
  // - Col J (idx 9) is "Tên file"
  // - Col P (idx 15) is "Tên Edit"
  // - Col Q (idx 16) is "Link Edit"
  const targetTabColumns: ColumnProfile[] = [
    {
      index: 0,
      letter: "A",
      headerName: "Ngày chụp",
      headerRow: 2,
      detectedSourceType: "DIRECT_VALUE",
      hasFormulas: false,
      formulaCount: 0,
      sampleValues: ["2026-09-01"],
      isHyperlinkField: false,
      hasErrors: false,
      suggestedSemanticField: "SHOOT_DATE",
      suggestedConfidence: 1.0,
    },
    {
      index: 9,
      letter: "J",
      headerName: "Tên file",
      headerRow: 2,
      detectedSourceType: "DIRECT_VALUE",
      hasFormulas: false,
      formulaCount: 0,
      sampleValues: ["010926_1000_HA_STUDIO"],
      isHyperlinkField: false,
      hasErrors: false,
      suggestedSemanticField: "JOB_FOLDER_NAME",
      suggestedConfidence: 1.0,
    },
    {
      index: 15,
      letter: "P",
      headerName: "Tên Edit",
      headerRow: 2,
      detectedSourceType: "DIRECT_VALUE",
      hasFormulas: false,
      formulaCount: 0,
      sampleValues: ["Vương"],
      isHyperlinkField: false,
      hasErrors: false,
      suggestedSemanticField: "EDITOR",
      suggestedConfidence: 1.0,
    },
    {
      index: 16,
      letter: "Q",
      headerName: "Link Edit",
      headerRow: 2,
      detectedSourceType: "DIRECT_VALUE",
      hasFormulas: false,
      formulaCount: 0,
      sampleValues: ["https://drive.google.com/..."],
      isHyperlinkField: true,
      hasErrors: false,
      suggestedSemanticField: "DELIVERY_LINK",
      suggestedConfidence: 1.0,
    },
  ];

  const adaptedMappings = sheetDiscoveryService.autoDetectOrCloneMappings(targetTabColumns, baseMappings);

  // Assert Tên file mapped to Col J
  const tenFile = adaptedMappings.find((m) => m.semanticField === "JOB_FOLDER_NAME");
  assert.ok(tenFile, "Tên file must be mapped");
  assert.equal(tenFile?.columnLetter, "J");
  assert.equal(tenFile?.columnIndex, 9);
  assert.equal(tenFile?.permission, "READ_ONLY");

  // Assert Tên Edit mapped to Col P with READ_WRITE
  const tenEdit = adaptedMappings.find((m) => m.semanticField === "EDITOR");
  assert.ok(tenEdit, "Tên Edit must be mapped");
  assert.equal(tenEdit?.columnLetter, "P");
  assert.equal(tenEdit?.columnIndex, 15);
  assert.equal(tenEdit?.permission, "READ_WRITE");

  // Assert Link Edit mapped to Col Q with READ_WRITE and ASK_BEFORE_OVERWRITE
  const linkEdit = adaptedMappings.find((m) => m.semanticField === "DELIVERY_LINK");
  assert.ok(linkEdit, "Link Edit must be mapped");
  assert.equal(linkEdit?.columnLetter, "Q");
  assert.equal(linkEdit?.columnIndex, 16);
  assert.equal(linkEdit?.permission, "READ_WRITE");
  assert.equal(linkEdit?.writePolicy, "ASK_BEFORE_OVERWRITE");
});

test("Multi-Tab 2: Formula columns on target tab are strictly forced to READ_ONLY even if writable on base", () => {
  const baseMappings: FieldMapping[] = [
    {
      semanticField: "EDITOR",
      columnLetter: "N",
      columnIndex: 13,
      columnHeader: "Tên Edit",
      permission: "READ_WRITE",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
  ];

  // On target tab, Tên Edit has formulas (e.g. VLOOKUP from another sheet)
  const targetTabColumns: ColumnProfile[] = [
    {
      index: 15,
      letter: "P",
      headerName: "Tên Edit",
      headerRow: 2,
      detectedSourceType: "FORMULA",
      hasFormulas: true,
      formulaCount: 10,
      sampleValues: ["=VLOOKUP(...)"],
      isHyperlinkField: false,
      hasErrors: false,
      suggestedSemanticField: "EDITOR",
      suggestedConfidence: 1.0,
    },
  ];

  const adaptedMappings = sheetDiscoveryService.autoDetectOrCloneMappings(targetTabColumns, baseMappings);
  const tenEdit = adaptedMappings.find((m) => m.semanticField === "EDITOR");

  assert.equal(tenEdit?.permission, "READ_ONLY", "Formula columns MUST be forced to READ_ONLY");
  assert.equal(tenEdit?.isFormulaDerived, true);
});

test("Multi-Tab 3: WorkspaceProfile tabConfigurations stores and switches active tab independently", () => {
  const tab1Config: TabConfiguration = {
    sheetId: 1001,
    tabTitle: "Tháng 8",
    headerRow: 3,
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
    ],
    rowScope: { startRow: 4, ignoreEmptyRows: true },
    schemaFingerprint: "fp-thang-8",
    updatedAt: new Date().toISOString(),
  };

  const tab2Config: TabConfiguration = {
    sheetId: 1002,
    tabTitle: "Tháng 9",
    headerRow: 2,
    fieldMappings: [
      {
        semanticField: "JOB_FOLDER_NAME",
        columnLetter: "J",
        columnIndex: 9,
        columnHeader: "Tên file",
        permission: "READ_ONLY",
        isFormulaDerived: false,
        writePolicy: "SET_IF_EMPTY",
      },
    ],
    rowScope: { startRow: 3, ignoreEmptyRows: true },
    schemaFingerprint: "fp-thang-9",
    updatedAt: new Date().toISOString(),
  };

  const profile: WorkspaceProfile = {
    id: "test-multitab-ws",
    displayName: "Multi Tab Studio",
    spreadsheetId: "test-sheet-id",
    spreadsheetTitle: "Bảng tính Studio 2026",
    selectedTabTitle: "Tháng 8",
    selectedTabId: 1001,
    headerRow: 3,
    fieldMappings: tab1Config.fieldMappings,
    valueMappings: [],
    rowScope: tab1Config.rowScope,
    driveConfig: {
      localRootPath: "",
      remoteRootDriveId: "root",
      sharingPolicy: "KEEP_EXISTING",
      sharingAutomationEnabled: false,
    },
    isMockSandbox: true,
    schemaFingerprint: "fp-thang-8",
    healthStatus: "HEALTHY",
    tabConfigurations: {
      "Tháng 8": tab1Config,
      "Tháng 9": tab2Config,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  useContactSheetStore.getState().saveProfile(profile);
  useContactSheetStore.getState().setActiveProfile(profile.id);

  // Initially active is Tháng 8
  assert.equal(useContactSheetStore.getState().activeProfile?.selectedTabTitle, "Tháng 8");
  assert.equal(useContactSheetStore.getState().activeProfile?.headerRow, 3);
  assert.equal(useContactSheetStore.getState().activeProfile?.fieldMappings[0].columnLetter, "H");

  // Switch to Tháng 9
  useContactSheetStore.getState().switchActiveTab("Tháng 9");

  const activeNow = useContactSheetStore.getState().activeProfile;
  assert.equal(activeNow?.selectedTabTitle, "Tháng 9");
  assert.equal(activeNow?.selectedTabId, 1002);
  assert.equal(activeNow?.headerRow, 2);
  assert.equal(activeNow?.fieldMappings[0].columnLetter, "J");
  assert.equal(activeNow?.rowScope.startRow, 3);

  // Switch back to Tháng 8
  useContactSheetStore.getState().switchActiveTab("Tháng 8");
  const activeBack = useContactSheetStore.getState().activeProfile;
  assert.equal(activeBack?.selectedTabTitle, "Tháng 8");
  assert.equal(activeBack?.headerRow, 3);
  assert.equal(activeBack?.fieldMappings[0].columnLetter, "H");
});
