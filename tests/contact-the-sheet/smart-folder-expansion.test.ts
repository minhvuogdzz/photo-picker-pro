import { test } from "node:test";
import assert from "node:assert/strict";
import { folderScannerService } from "../../src/modules/contact-the-sheet/services/folderScannerService.ts";
import { finalFolderResolver } from "../../src/modules/contact-the-sheet/services/finalFolderResolver.ts";
import { folderParserService } from "../../src/modules/contact-the-sheet/services/folderParserService.ts";

test("Smart Folder Expansion: Fallback preserves paths when native invoke is not present", async () => {
  const paths = ["/Users/studio/Downloads/28-8 V"];
  const res = await folderScannerService.resolveSmartInputFolders(paths);
  assert.deepEqual(res, paths);
});

test("Smart Job Topology: Single child subfolder treats parent as the root job", () => {
  // Scenario: Customer folder '18-8 10h Hoa Anh Nguyễn' contains 1 subfolder 'Da sua'
  const topology = [
    {
      folder_path: "/Volumes/Drive/28-8 V/18-8 10h Hoa Anh Nguyễn",
      folder_name: "18-8 10h Hoa Anh Nguyễn",
      depth: 0,
      finished_image_count: 0,
      raw_image_count: 0,
      subfolder_names: ["Da sua"],
      representative_extensions: [],
    },
    {
      folder_path: "/Volumes/Drive/28-8 V/18-8 10h Hoa Anh Nguyễn/Da sua",
      folder_name: "Da sua",
      depth: 1,
      finished_image_count: 25,
      raw_image_count: 0,
      subfolder_names: [],
      representative_extensions: ["jpg"],
    },
  ];

  const jobRootEntries = topology.filter((e) => e.depth === 1);
  assert.equal(jobRootEntries.length, 1);

  // According to rule: if jobRootEntries.length <= 1, the root path itself is the job
  const isSingleJob = jobRootEntries.length <= 1;
  assert.equal(isSingleJob, true);

  const rootName = topology[0].folder_name;
  assert.equal(rootName, "18-8 10h Hoa Anh Nguyễn");

  const metadata = folderParserService.parseFolderName(rootName);
  assert.equal(metadata.customerName, "Hoa Anh Nguyễn");
  assert.equal(metadata.shootDate, "18/08");
  assert.equal(metadata.shootTime, "10:00");

  const resolved = finalFolderResolver.resolveDeepestDeliveryFolder(topology);
  assert.equal(resolved.folderName, "Da sua");
  assert.equal(resolved.imageCount, 25);
  assert.equal(resolved.status, "READY");
});

test("Smart Job Topology: Multiple child subfolders in parent folder treat each child as separate job", () => {
  // Scenario: Parent folder '28-8 V' contains multiple customer folders
  const topology = [
    {
      folder_path: "/Volumes/Drive/28-8 V",
      folder_name: "28-8 V",
      depth: 0,
      finished_image_count: 0,
      raw_image_count: 0,
      subfolder_names: ["18-8 10h Hoa Anh Nguyễn", "20-8 8h Lee Thị Thu 1cc"],
      representative_extensions: [],
    },
    {
      folder_path: "/Volumes/Drive/28-8 V/18-8 10h Hoa Anh Nguyễn",
      folder_name: "18-8 10h Hoa Anh Nguyễn",
      depth: 1,
      finished_image_count: 10,
      raw_image_count: 0,
      subfolder_names: [],
      representative_extensions: ["jpg"],
    },
    {
      folder_path: "/Volumes/Drive/28-8 V/20-8 8h Lee Thị Thu 1cc",
      folder_name: "20-8 8h Lee Thị Thu 1cc",
      depth: 1,
      finished_image_count: 15,
      raw_image_count: 0,
      subfolder_names: [],
      representative_extensions: ["jpg"],
    },
  ];

  const jobRootEntries = topology.filter((e) => e.depth === 1);
  assert.equal(jobRootEntries.length, 2);

  // If > 1, multiple individual jobs exist
  const isMultipleJobs = jobRootEntries.length > 1;
  assert.equal(isMultipleJobs, true);

  const parsedJobs = jobRootEntries.map((entry) => {
    return folderParserService.parseFolderName(entry.folder_name);
  });

  assert.equal(parsedJobs[0].customerName, "Hoa Anh Nguyễn");
  assert.equal(parsedJobs[1].customerName, "Lee Thị Thu");
});
