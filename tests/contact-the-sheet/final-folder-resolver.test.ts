import { test } from "node:test";
import assert from "node:assert/strict";
import { finalFolderResolver } from "../../src/modules/contact-the-sheet/services/finalFolderResolver.ts";
import folderTreesFixture from "../fixtures/contact-the-sheet/folder-trees.json" with { type: "json" };

test("Acceptance Test F: Deepest folder resolution with repeated folder names (X/X/X)", () => {
  const caseRepeat = folderTreesFixture.find((c) => c.name === "case_deepest_repeat");
  assert.ok(caseRepeat, "Fixture case_deepest_repeat must exist");

  const resolved = finalFolderResolver.resolveDeepestDeliveryFolder(caseRepeat.topology);
  assert.equal(resolved.status, "READY");
  assert.equal(resolved.folderPath, caseRepeat.expectedFinalFolderPath);
  assert.equal(resolved.folderName, caseRepeat.expectedFinalFolderName);
  assert.equal(resolved.imageCount, 24);
  assert.equal(resolved.depth, 3);
});

test("Acceptance Test F: Sibling RAW vs JPG folders prefers finished output JPG", () => {
  const caseRawJpg = folderTreesFixture.find((c) => c.name === "case_jpg_raw_siblings");
  assert.ok(caseRawJpg, "Fixture case_jpg_raw_siblings must exist");

  const resolved = finalFolderResolver.resolveDeepestDeliveryFolder(caseRawJpg.topology);
  assert.equal(resolved.status, "READY");
  assert.equal(resolved.folderPath, caseRawJpg.expectedFinalFolderPath);
  assert.equal(resolved.folderName, caseRawJpg.expectedFinalFolderName);
  assert.equal(resolved.imageCount, 30);
});

test("Acceptance Test F: Ambiguous two final folders at same depth returns NEEDS_REVIEW", () => {
  const caseAmbiguous = folderTreesFixture.find((c) => c.name === "case_ambiguous_two_finals");
  assert.ok(caseAmbiguous, "Fixture case_ambiguous_two_finals must exist");

  const resolved = finalFolderResolver.resolveDeepestDeliveryFolder(caseAmbiguous.topology);
  assert.equal(resolved.status, "NEEDS_REVIEW");
  assert.ok(resolved.reason?.includes("2 thư mục con"));
  assert.equal(resolved.competingCandidates?.length, 2);
});

test("Acceptance Test F: Empty folder without finished images returns NO_FINISHED_IMAGES", () => {
  const emptyTopology = [
    {
      folder_path: "/Volumes/Drive/EmptyFolder",
      folder_name: "EmptyFolder",
      depth: 0,
      finished_image_count: 0,
      raw_image_count: 0,
      subfolder_names: [],
      representative_extensions: [],
    },
  ];

  const resolved = finalFolderResolver.resolveDeepestDeliveryFolder(emptyTopology);
  assert.equal(resolved.status, "NO_FINISHED_IMAGES");
});
