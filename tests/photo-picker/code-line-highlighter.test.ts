import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeCodeInputLines } from "../../src/modules/photo-picker/utils/codeLineHighlighter.ts";
import type { MatchResult, PhotoFile } from "../../src/core/types/index.ts";

const dummyPhoto: PhotoFile = {
  full_path: "/photos/IMG_1234.JPG",
  filename: "IMG_1234.JPG",
  extension: "jpg",
  folder: "/photos",
  size: 1024,
  normalized_number: "1234",
};

describe("analyzeCodeInputLines", () => {
  it("identifies the exact line of a missing code (Sai mã) and computes char offsets", () => {
    const rawCodeInput = ["1234", "2345", "3456", "4567", "5678"].join("\n");
    const matchResult: MatchResult = {
      total_codes: 5,
      found_count: 4,
      missing_count: 1,
      duplicate_count: 0,
      matches: [
        { code: "1234", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "2345", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "3456", status: "Missing", photo: null, all_matches: [] },
        { code: "4567", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "5678", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
      ],
    };

    const result = analyzeCodeInputLines(rawCodeInput, matchResult);
    assert.equal(result.lines.length, 5);
    assert.equal(result.missingLineCount, 1);
    assert.equal(result.duplicateLineCount, 0);

    // Line 3 (index 2) is "3456" -> Missing
    assert.equal(result.lines[0].primaryStatus, "Found");
    assert.equal(result.lines[1].primaryStatus, "Found");
    assert.equal(result.lines[2].primaryStatus, "Missing");
    assert.equal(result.lines[2].lineNumber, 3);
    assert.equal(
      rawCodeInput.slice(result.lines[2].charStart, result.lines[2].charEnd),
      "3456"
    );
    assert.equal(result.lines[3].primaryStatus, "Found");
    assert.equal(result.lines[4].primaryStatus, "Found");

    // LeftPanel error location points to line 3 (index 2)
    assert.equal(result.matchErrorLocations.length, 1);
    assert.equal(result.matchErrorLocations[0].lineIndex, 2);
    assert.equal(result.matchErrorLocations[0].lineNumber, 3);
    assert.equal(result.matchErrorLocations[0].match.code, "3456");
  });

  it("highlights BOTH duplicate input lines and cross-references their peer line numbers", () => {
    const rawCodeInput = ["ZHA7921", "ZHA8013", "ZHA7964", "ZHA8013", "ZHA7852"].join("\n");
    const matchResult: MatchResult = {
      total_codes: 5,
      found_count: 4,
      missing_count: 0,
      duplicate_count: 1,
      matches: [
        { code: "ZHA7921", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "ZHA8013", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "ZHA7964", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "ZHA8013", status: "InputDuplicate", photo: null, all_matches: [] },
        { code: "ZHA7852", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
      ],
    };

    const result = analyzeCodeInputLines(rawCodeInput, matchResult);
    assert.equal(result.missingLineCount, 0);
    // Both line 2 and line 4 are highlighted as duplicate lines!
    assert.equal(result.duplicateLineCount, 2);

    // Line 2 (index 1) is InputDuplicate referencing peer line 4
    assert.equal(result.lines[1].primaryStatus, "InputDuplicate");
    assert.deepEqual(result.lines[1].peerDuplicateLineNumbers, [4]);
    assert.equal(result.lines[1].duplicateOfLineNumber, 4);

    // Line 4 (index 3) is InputDuplicate referencing peer line 2
    assert.equal(result.lines[3].primaryStatus, "InputDuplicate");
    assert.deepEqual(result.lines[3].peerDuplicateLineNumbers, [2]);
    assert.equal(result.lines[3].duplicateOfLineNumber, 2);

    assert.equal(result.matchErrorLocations.length, 1);
    assert.equal(result.matchErrorLocations[0].lineIndex, 3);
    assert.equal(result.matchErrorLocations[0].lineNumber, 4);
    assert.deepEqual(result.matchErrorLocations[0].allDuplicateLineNumbers, [2, 4]);
  });

  it("does NOT flag letters standing alone on a line (e.g. 'Dc') as Missing, while flagging wrong prefix+number codes (e.g. 'HNI1234')", () => {
    const rawCodeInput = ["Dc", "05304", "HNI1234"].join("\n");
    const matchResult: MatchResult = {
      total_codes: 2,
      found_count: 1,
      missing_count: 1,
      duplicate_count: 0,
      matches: [
        { code: "05304", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "HNI1234", status: "Missing", photo: null, all_matches: [] },
      ],
    };

    const result = analyzeCodeInputLines(rawCodeInput, matchResult);
    // Line 1 ("Dc" - standalone letters without digits) is NOT Missing
    assert.equal(result.lines[0].primaryStatus, "Pending");
    // Line 2 ("05304") is Found
    assert.equal(result.lines[1].primaryStatus, "Found");
    // Line 3 ("HNI1234" - wrong prefix attached to photo number) IS Missing
    assert.equal(result.lines[2].primaryStatus, "Missing");
    assert.equal(result.missingLineCount, 1);
  });

  it("flags short/invalid numeric lines (< 3 digits, e.g. '6') as Missing when matchResult is present", () => {
    const rawCodeInput = ["1234", "6"].join("\n");
    const matchResult: MatchResult = {
      total_codes: 1,
      found_count: 1,
      missing_count: 0,
      duplicate_count: 0,
      matches: [
        { code: "1234", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
      ],
    };

    const result = analyzeCodeInputLines(rawCodeInput, matchResult);
    assert.equal(result.lines[0].primaryStatus, "Found");
    assert.equal(result.lines[1].primaryStatus, "Missing");
    assert.equal(result.missingLineCount, 1);
  });

  it("clears error highlight immediately when user edits a missing line before re-match completes", () => {
    const matchResult: MatchResult = {
      total_codes: 2,
      found_count: 1,
      missing_count: 1,
      duplicate_count: 0,
      matches: [
        { code: "1234", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "3456", status: "Missing", photo: null, all_matches: [] },
      ],
    };

    // User edits line 2 from "3456" to "3459"
    const editedResult = analyzeCodeInputLines("1234\n3459", matchResult);
    assert.equal(editedResult.lines[0].primaryStatus, "Found");
    assert.equal(editedResult.lines[1].primaryStatus, "Pending");
    assert.equal(editedResult.missingLineCount, 0);
  });

  it("supports cascading file extension inheritance (.CR3 -> .CR2) without false duplicate warnings", () => {
    const rawCodeInput = ["IMG_1234.CR3", "1235", "IMG_1234.CR2", "1235"].join("\n");
    const matchResult: MatchResult = {
      total_codes: 4,
      found_count: 4,
      missing_count: 0,
      duplicate_count: 0,
      matches: [
        { code: "IMG_1234.CR3", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "IMG1235.CR3", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "IMG_1234.CR2", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
        { code: "IMG1235.CR2", status: "Found", photo: dummyPhoto, all_matches: [dummyPhoto] },
      ],
    };

    const result = analyzeCodeInputLines(rawCodeInput, matchResult);
    assert.equal(result.duplicateLineCount, 0);
    assert.equal(result.missingLineCount, 0);
    assert.equal(result.lines[0].primaryStatus, "Found");
    assert.equal(result.lines[1].primaryStatus, "Found");
    assert.equal(result.lines[2].primaryStatus, "Found");
    assert.equal(result.lines[3].primaryStatus, "Found");
  });
});
