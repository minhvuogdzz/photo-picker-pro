import { test } from "node:test";
import assert from "node:assert/strict";
import { folderParserService } from "../../src/modules/contact-the-sheet/services/folderParserService.ts";

test("Folder Parser: Extracts date, time, social username, and package code from standard studio syntax", () => {
  const result = folderParserService.parseFolderName("7-9 12h _xuka_11 1cc");
  assert.equal(result.shootDate, "07/09");
  assert.equal(result.shootTime, "12:00");
  assert.equal(result.socialUsername, "xuka_11");
  assert.equal(result.packageCode, "1cc");
});

test("Folder Parser: Handles 24-hour time with minutes and slash dates", () => {
  const result = folderParserService.parseFolderName("08/09 14h30 @nobita_vip 2cc");
  assert.equal(result.shootDate, "08/09");
  assert.equal(result.shootTime, "14:30");
  assert.equal(result.socialUsername, "nobita_vip");
  assert.equal(result.packageCode, "2cc");
});

test("Folder Parser: Normalizes Vietnamese diacritics and removes extra whitespace", () => {
  const normA = folderParserService.normalizeForComparison("Nguyễn   Văn   A");
  const normB = folderParserService.normalizeForComparison("nguyen van a");
  assert.equal(normA, normB);

  const normFolderA = folderParserService.normalizeForComparison("7-9 12h _xuka_11 1cc");
  const normFolderB = folderParserService.normalizeForComparison("7-9 12h _Xuka_11 1cc");
  assert.equal(normFolderA, normFolderB);
});
