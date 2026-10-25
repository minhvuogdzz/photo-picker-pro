import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCodesAcrossTabs,
  getTabStartRow,
  getTabStatusMapping,
  parseSavedTabs,
  resolveCheckedTabs,
} from "../../src/modules/photo-picker/services/sheetTabExtractionService.ts";

const fm = (semanticField: string, columnLetter: string, columnHeader: string, permission = "READ_ONLY") => ({
  semanticField,
  columnLetter,
  columnIndex: columnLetter.charCodeAt(0) - 65,
  columnHeader,
  permission,
  isFormulaDerived: false,
  writePolicy: "SET_IF_EMPTY",
});

// "9/10" uses the standard layout (also the profile default = active tab)
const septMappings = [
  fm("SHOOT_DATE", "A", "Ngày"),
  fm("CUSTOMER_NAME", "C", "Tên khách"),
  fm("JOB_FOLDER_NAME", "H", "Tên file"),
  fm("SELECTED_IMAGE_CODES_PRIMARY", "I", "Mã ảnh chọn (1)"),
  fm("SELECTED_IMAGE_CODES_SECONDARY", "J", "Mã ảnh chọn (2)"),
  fm("PHOTO_PICK_STATUS", "M", "Trạng Thái Lọc", "READ_WRITE"),
];

// "10/10" was laid out differently: Tên file in G, codes in K, status in N, data starts one row higher
const octMappings = [
  fm("SHOOT_DATE", "A", "Ngày"),
  fm("CUSTOMER_NAME", "C", "Tên khách"),
  fm("JOB_FOLDER_NAME", "G", "Tên file"),
  fm("SELECTED_IMAGE_CODES_PRIMARY", "K", "Mã chọn"),
  fm("PHOTO_PICK_STATUS", "N", "Trạng thái", "READ_WRITE"),
];

const profile: any = {
  id: "p",
  selectedTabTitle: "9/10",
  selectedTabId: 1,
  headerRow: 4,
  rowScope: { startRow: 5 },
  fieldMappings: septMappings,
  valueMappings: [{ semanticRole: "PHOTO_PICK_STATUS_COMPLETED", sheetValue: "Đã lọc" }],
  tabConfigurations: {
    "9/10": { sheetId: 1, tabTitle: "9/10", headerRow: 4, rowScope: { startRow: 5 }, fieldMappings: septMappings },
    "10/10": { sheetId: 2, tabTitle: "10/10", headerRow: 3, rowScope: { startRow: 4 }, fieldMappings: octMappings },
  },
};

const sept = (r: number, file: string, code: string, status: string, customer = "Khach") => ({
  row: r,
  values: { A: "07/09", C: customer, H: file, I: code, J: "", M: status },
});
const oct = (r: number, file: string, code: string, status: string, customer = "Khach") => ({
  row: r,
  values: { A: "01/10", C: customer, G: file, K: code, N: status },
});

test("resolveCheckedTabs: saved tabs kept in sheet order, otherwise falls back to the active tab", () => {
  const available = ["9/10", "10/10", "Edit 9/2026"];
  assert.deepEqual(resolveCheckedTabs(["10/10", "9/10"], available, "9/10"), ["9/10", "10/10"]);
  assert.deepEqual(resolveCheckedTabs(null, available, "10/10"), ["10/10"]);
  // Saved tabs from another spreadsheet → active tab
  assert.deepEqual(resolveCheckedTabs(["Tháng 1"], available, "10/10"), ["10/10"]);
  // Active tab not on this sheet → first tab of the sheet
  assert.deepEqual(resolveCheckedTabs(null, available, "Edit 6/2026"), ["9/10"]);
  // User unchecked everything → nothing (UI asks for at least one tab)
  assert.deepEqual(resolveCheckedTabs([], available, "9/10"), []);
});

test("parseSavedTabs ignores broken / empty storage values", () => {
  assert.deepEqual(parseSavedTabs('["9/10","10/10","9/10"]'), ["9/10", "10/10"]);
  assert.equal(parseSavedTabs("[]"), null);
  assert.equal(parseSavedTabs("{bad json"), null);
  assert.equal(parseSavedTabs('{"a":1}'), null);
  assert.equal(parseSavedTabs(null), null);
});

test("Per-tab start row and status column (used for loading and write-back)", () => {
  assert.equal(getTabStartRow(profile, "9/10"), 5);
  assert.equal(getTabStartRow(profile, "10/10"), 4);
  // Unconfigured tab → profile default
  assert.equal(getTabStartRow(profile, "Edit 9/2026"), 5);
  assert.equal(getTabStatusMapping(profile, "9/10")?.columnLetter, "M");
  assert.equal(getTabStatusMapping(profile, "10/10")?.columnLetter, "N");
});

test("Exact Tên file hit on the second tab uses that tab's file + code columns", () => {
  const res = extractCodesAcrossTabs(
    "1-10 9h _nobita",
    "/d/1-10 9h _nobita",
    [
      { tabTitle: "9/10", rows: [sept(5, "7-9 12h _xuka_11 1cc", "0001", "Chưa lọc")] },
      { tabTitle: "10/10", rows: [oct(4, "1-10 9h _nobita", "0456, 0789", "Chưa lọc")] },
    ],
    profile,
    "Đã lọc"
  );
  assert.equal(res.status, "READY");
  assert.equal(res.matchedTabTitle, "10/10");
  assert.equal(res.matchedRow, 4);
  assert.deepEqual(
    res.candidateColumns.map((c) => [c.columnLetter, c.codeCount]),
    [["K", 2]]
  );
  assert.deepEqual(res.searchedTabs, ["9/10", "10/10"]);
});

test("Same file on two tabs: prefers the row that still has codes and is not yet 'Đã lọc'", () => {
  const tabRows = [
    { tabTitle: "9/10", rows: [sept(12, "1-10 9h _nobita", "0001", "Đã lọc")] },
    { tabTitle: "10/10", rows: [oct(7, "1-10 9h _nobita", "0456", "Chưa lọc")] },
  ];
  const res = extractCodesAcrossTabs("1-10 9h _nobita", "", tabRows, profile, "Đã lọc");
  assert.equal(res.matchedTabTitle, "10/10");
  assert.equal(res.matchedRow, 7);
  assert.equal(res.sameFileRows.length, 2);
  assert.match(res.reason || "", /9\/10 dòng 12 \(đã lọc\), 10\/10 dòng 7/);

  // User picks the other row explicitly
  const picked = extractCodesAcrossTabs("1-10 9h _nobita", "", tabRows, profile, "Đã lọc", { tabTitle: "9/10", row: 12 });
  assert.equal(picked.matchedTabTitle, "9/10");
  assert.equal(picked.matchedRow, 12);
  assert.deepEqual(picked.candidateColumns.map((c) => c.columnLetter), ["I", "J"]);
});

test("Same file twice: a row not yet filtered wins even without codes; ties keep the first row", () => {
  const notFilteredNoCodes = extractCodesAcrossTabs(
    "1-10 9h _nobita",
    "",
    [
      { tabTitle: "9/10", rows: [sept(5, "1-10 9h _nobita", "0001", "Đã lọc"), sept(9, "1-10 9h _nobita", "", "Chưa lọc")] },
    ],
    profile,
    "Đã lọc"
  );
  assert.equal(notFilteredNoCodes.matchedRow, 9);

  const tie = extractCodesAcrossTabs(
    "1-10 9h _nobita",
    "",
    [
      { tabTitle: "9/10", rows: [sept(5, "1-10 9h _nobita", "0001", "Chưa lọc")] },
      { tabTitle: "10/10", rows: [oct(4, "1-10 9h _nobita", "0456", "Chưa lọc")] },
    ],
    profile,
    "Đã lọc"
  );
  assert.equal(tie.matchedTabTitle, "9/10");
  assert.equal(tie.matchedRow, 5);
});

test("Fuzzy fallback across tabs reports the tab of the match (same row number exists on both tabs)", () => {
  const res = extractCodesAcrossTabs(
    "7-9 12h _xuka_11 1cc",
    "",
    [
      { tabTitle: "9/10", rows: [sept(6, "3-9 8h _mon_01", "0001", "Chưa lọc", "Mon")] },
      { tabTitle: "10/10", rows: [oct(6, "7-9 12h _xuka_11 1cc (edit lại)", "0456 0457", "Chưa lọc", "Xuka")] },
    ],
    profile,
    "Đã lọc"
  );
  assert.equal(res.status, "READY");
  assert.equal(res.matchedTabTitle, "10/10");
  assert.equal(res.matchedRow, 6);
  assert.deepEqual(res.sameFileRows, []);
  assert.deepEqual(
    res.candidateColumns.map((c) => [c.columnLetter, c.codeCount]),
    [["K", 2]]
  );
});

test("Rows above a tab's own start row are ignored; no match lists the searched tabs", () => {
  const res = extractCodesAcrossTabs(
    "1-10 9h _nobita",
    "",
    // Row 3 is the header area of "10/10" (data starts at row 4)
    [{ tabTitle: "10/10", rows: [oct(3, "1-10 9h _nobita", "0456", "Chưa lọc")] }],
    profile,
    "Đã lọc"
  );
  assert.equal(res.status, "NO_MATCH");
  assert.equal(res.matchedRow, undefined);
  assert.deepEqual(res.searchedTabs, ["10/10"]);
});
