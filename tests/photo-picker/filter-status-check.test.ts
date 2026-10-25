import test from "node:test";
import assert from "node:assert/strict";
import {
  checkFolder,
  foldText,
  formatDateKey,
  getVietnamTodayKey,
  parseDueDateKey,
  type FilterCheckConditions,
} from "../../src/modules/photo-picker/services/filterStatusCheckService.ts";

const fm = (semanticField: string, columnLetter: string, columnHeader: string) => ({
  semanticField,
  columnLetter,
  columnIndex: columnLetter.charCodeAt(0) - 65,
  columnHeader,
  permission: "READ_ONLY",
  isFormulaDerived: false,
  writePolicy: "SET_IF_EMPTY",
});

const mappings = [
  fm("SHOOT_DATE", "A", "Ngày"),
  fm("CUSTOMER_NAME", "C", "Tên khách"),
  fm("JOB_FOLDER_NAME", "H", "Tên file"),
  fm("PHOTO_PICK_STATUS", "M", "Trạng Thái Lọc"),
];

const profile: any = {
  id: "p",
  selectedTabTitle: "Edit 9/2026",
  headerRow: 4,
  rowScope: { startRow: 5 },
  fieldMappings: mappings,
  valueMappings: [],
  tabConfigurations: {
    "Edit 9/2026": { sheetId: 1, headerRow: 4, rowScope: { startRow: 5 }, fieldMappings: mappings },
    // Data on this tab starts one row higher than the active tab
    "Edit 10/2026": { sheetId: 2, headerRow: 3, rowScope: { startRow: 4 }, fieldMappings: mappings },
  },
};

const TODAY = 20261024;
const conditions: FilterCheckConditions = {
  statusColumn: "M",
  targetStatusValue: "Chưa lọc",
  photoCode1Column: "I",
  photoCode2Column: null,
  dueDateColumn: null,
  todayKey: TODAY,
};

const row = (r: number, file: string, status: string, code = "0123", due = "") => ({
  row: r,
  values: { A: "07/09", C: "Khach", H: file, I: code, L: due, M: status },
});

test("Status typed in decomposed Unicode / with odd spaces still matches 'Chưa lọc'", () => {
  for (const status of ["Chưa lọc".normalize("NFD"), "Chưa lọc", "Chưa  lọc ", "chưa lọc", "Chưa lọc​"]) {
    const res = checkFolder("/d/7-9 _xuka", "7-9 _xuka", [{ tabTitle: "Edit 9/2026", rows: [row(5, "7-9 _xuka", status)] }], profile, conditions);
    assert.equal(res.isKept, true, `status ${JSON.stringify(status)} should be kept`);
  }
  assert.equal(foldText("Đã lọc") === foldText("Chưa lọc"), false);
});

test("Duplicate file name: keeps the folder when a later row is still 'Chưa lọc'", () => {
  const rows = [row(5, "7-9 12h _xuka", "Đã lọc"), row(30, "7-9 12h _xuka", "Chưa lọc")];
  const res = checkFolder("/d/7-9 12h _xuka", "7-9 12h _xuka", [{ tabTitle: "Edit 9/2026", rows }], profile, conditions);
  assert.equal(res.isKept, true);
  assert.equal(res.matchedRow, 30);
});

test("Multi-tab: first data row of another tab is not cut by the active tab's start row", () => {
  const res = checkFolder(
    "/d/1-10 9h _nobita",
    "1-10 9h _nobita",
    [
      { tabTitle: "Edit 9/2026", rows: [row(5, "7-9 _xuka", "Chưa lọc")] },
      { tabTitle: "Edit 10/2026", rows: [row(4, "1-10 9h _nobita", "Chưa lọc")] },
    ],
    profile,
    conditions
  );
  assert.equal(res.isKept, true);
  assert.equal(res.tabTitle, "Edit 10/2026");
  assert.equal(res.matchedRow, 4);
});

test("Empty photo code cell (incl. zero-width only) is still kicked out", () => {
  for (const code of ["", "  ", "​"]) {
    const res = checkFolder("/d/x", "7-9 _xuka", [{ tabTitle: "Edit 9/2026", rows: [row(5, "7-9 _xuka", "Chưa lọc", code)] }], profile, conditions);
    assert.equal(res.isKept, false);
  }
});

test("Due date: dd/mm without year (as on the real sheet) is read and compared to today", () => {
  const due = { ...conditions, dueDateColumn: "L" };
  const check = (d: string) =>
    checkFolder("/d/x", "7-9 _xuka", [{ tabTitle: "Edit 9/2026", rows: [row(5, "7-9 _xuka", "Chưa lọc", "01", d)] }], profile, due).isKept;
  assert.equal(check("24/10"), true);
  assert.equal(check("10/09"), true);
  assert.equal(check("25/10"), false);
  assert.equal(check("24/10/2026"), true);
  assert.equal(check(""), false);
});

test("parseDueDateKey accepts common sheet formats", () => {
  const cases: Array<[string, number | null]> = [
    ["24/10/2026", 20261024],
    ["4/9/2026", 20260904],
    ["24-10-2026", 20261024],
    ["24.10.2026", 20261024],
    ["24/10/26", 20261024],
    ["24/10", 20261024],
    ["T7 24/10", 20261024],
    ["24/10 sáng", 20261024],
    ["2026-10-24", 20261024],
    ["46319", 20261024],
    ["31/02/2026", null],
    ["abc", null],
  ];
  for (const [input, expected] of cases) {
    assert.equal(parseDueDateKey(input, TODAY), expected, input);
  }
  // Year inferred to the closest date: "28/12" read on 05/01/2027 is last December
  assert.equal(parseDueDateKey("28/12", 20270105), 20261228);
  assert.equal(parseDueDateKey("03/01", 20261230), 20270103);
});

test("Vietnam today key ignores machine timezone", () => {
  // 2026-10-23T18:30Z is already 24/10 in Vietnam
  assert.equal(getVietnamTodayKey(new Date("2026-10-23T18:30:00Z")), 20261024);
  assert.equal(formatDateKey(20261024), "24/10/2026");
});
