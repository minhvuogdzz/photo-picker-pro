import test from "node:test";
import assert from "node:assert/strict";
import type { ExtractedCodeColumn } from "../src/modules/contact-the-sheet/services/sheetExtractorService.ts";

/**
 * Pure helper mirroring the selection logic in SheetCodeExtractorModal
 */
function resolveDefaultSelectedColumns(candidateColumns: ExtractedCodeColumn[]): Set<string> {
  const defaultCols = new Set<string>();
  if (candidateColumns.length > 0) {
    const columnsWithCodes = candidateColumns.filter((c) => c.codeCount > 0);
    if (columnsWithCodes.length > 0) {
      columnsWithCodes.forEach((c) => defaultCols.add(c.columnLetter));
    } else {
      const primary = candidateColumns.find((c) => c.isPrimary) || candidateColumns[0];
      if (primary) {
        defaultCols.add(primary.columnLetter);
      }
    }
  }
  return defaultCols;
}

test("Requirement 1: Column 2 is empty -> checkbox is NOT active; Column 1 has data -> Column 1 is active", () => {
  const candidateColumns: ExtractedCodeColumn[] = [
    {
      columnLetter: "I",
      columnHeader: "Mã ảnh chọn (1)",
      value: "DSC03902, DSC03914, DSC04001",
      codeCount: 3,
      sampleCodes: ["DSC03902", "DSC03914", "DSC04001"],
      isPrimary: true,
    },
    {
      columnLetter: "J",
      columnHeader: "Mã ảnh chọn (2)",
      value: "",
      codeCount: 0,
      sampleCodes: [],
      isPrimary: false,
    },
  ];

  const selected = resolveDefaultSelectedColumns(candidateColumns);

  assert.equal(selected.has("I"), true, "Column I (has 3 codes) must be active");
  assert.equal(selected.has("J"), false, "Column J (empty with 0 codes) must NOT be active");
  assert.equal(selected.size, 1);
});

test("Requirement 1: Column 2 has data -> checkbox is AUTOMATICALLY active along with Column 1", () => {
  const candidateColumns: ExtractedCodeColumn[] = [
    {
      columnLetter: "I",
      columnHeader: "Mã ảnh chọn (1)",
      value: "DSC03902, DSC03914",
      codeCount: 2,
      sampleCodes: ["DSC03902", "DSC03914"],
      isPrimary: true,
    },
    {
      columnLetter: "J",
      columnHeader: "Mã ảnh chọn (2)",
      value: "DSC04060, DSC04065",
      codeCount: 2,
      sampleCodes: ["DSC04060", "DSC04065"],
      isPrimary: false,
    },
  ];

  const selected = resolveDefaultSelectedColumns(candidateColumns);

  assert.equal(selected.has("I"), true, "Column I must be active");
  assert.equal(selected.has("J"), true, "Column J has codes, so it must be automatically active");
  assert.equal(selected.size, 2);
});

test("Requirement 1: Column 1 is empty but Column 2 has data -> Column 2 is active, Column 1 is NOT active", () => {
  const candidateColumns: ExtractedCodeColumn[] = [
    {
      columnLetter: "I",
      columnHeader: "Mã ảnh chọn (1)",
      value: "",
      codeCount: 0,
      sampleCodes: [],
      isPrimary: true,
    },
    {
      columnLetter: "J",
      columnHeader: "Mã ảnh chọn (2)",
      value: "DSC05001",
      codeCount: 1,
      sampleCodes: ["DSC05001"],
      isPrimary: false,
    },
  ];

  const selected = resolveDefaultSelectedColumns(candidateColumns);

  assert.equal(selected.has("I"), false, "Column I is empty, must NOT be active");
  assert.equal(selected.has("J"), true, "Column J has codes, must be automatically active");
  assert.equal(selected.size, 1);
});

test("Requirement 1: Both columns are empty -> falls back to primary column I", () => {
  const candidateColumns: ExtractedCodeColumn[] = [
    {
      columnLetter: "I",
      columnHeader: "Mã ảnh chọn (1)",
      value: "",
      codeCount: 0,
      sampleCodes: [],
      isPrimary: true,
    },
    {
      columnLetter: "J",
      columnHeader: "Mã ảnh chọn (2)",
      value: "",
      codeCount: 0,
      sampleCodes: [],
      isPrimary: false,
    },
  ];

  const selected = resolveDefaultSelectedColumns(candidateColumns);

  assert.equal(selected.has("I"), true, "Falls back to primary column");
  assert.equal(selected.has("J"), false, "Secondary column remains unchecked when both are empty");
  assert.equal(selected.size, 1);
});
