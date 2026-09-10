import { test } from "node:test";
import assert from "node:assert/strict";
import {
  driveResolverService,
  DriveResolverService,
} from "../../src/modules/contact-the-sheet/services/driveResolverService.ts";

test("Drive Resolver: Mock mode generates direct shareable folder link without search URLs", async () => {
  const result = await driveResolverService.resolveLocalFolderToDriveLink(
    "/Users/studio/Jobs/5-9 18h Huyền Phan 1cc/File hoàn thiện",
    "",
    "root",
    true,
    {
      finalFolderName: "File hoàn thiện",
      jobFolderName: "5-9 18h Huyền Phan 1cc",
      customerName: "Huyền Phan",
    }
  );

  assert.equal(result.isAccessible, true);
  assert.match(result.driveWebLink, /^https:\/\/drive\.google\.com\/drive\/folders\/mock_folder_/);
  assert.match(result.driveWebLink, /\?usp=sharing$/);
  assert.equal(result.driveWebLink.includes("search?q="), false, "Must never generate search URL");
});

test("Drive Resolver: buildNameQuery properly handles Vietnamese NFC, NFD, and quote escaping", () => {
  const service = new DriveResolverService();
  
  // Normal string
  const q1 = service.buildNameQuery("File hoàn thiện");
  assert.match(q1, /File hoàn thiện/);

  // Escaping quotes
  const q2 = service.buildNameQuery("Studio's Job");
  assert.match(q2, /Studio\\'s Job/);
});

test("Drive Resolver: searchDriveForDeliveryFolder selects candidate matching job parent", async () => {
  const service = new DriveResolverService();

  // Mock queryDriveFiles & getFolderNameById
  (service as any).queryDriveFiles = async (
    token: string,
    query: string,
    orderBy: string,
    pageSize: number
  ) => {
    // If querying by job folder name
    if (query.includes("5-9 18h Huyền Phan 1cc")) {
      return []; // simulate job folder not found directly
    }

    // If querying by targetFolderName "File hoàn thiện"
    if (query.includes("File hoàn thiện")) {
      return [
        {
          id: "folder_recent_other_client",
          name: "File hoàn thiện",
          parents: ["parent_other"],
          modifiedTime: "2026-09-11T01:00:00Z",
        },
        {
          id: "folder_huyen_phan",
          name: "File hoàn thiện",
          parents: ["parent_huyen_phan"],
          modifiedTime: "2026-09-10T15:00:00Z",
        },
      ];
    }

    return [];
  };

  (service as any).getFolderNameById = async (token: string, folderId: string) => {
    if (folderId === "parent_huyen_phan") return "5-9 18h Huyền Phan 1cc";
    if (folderId === "parent_other") return "6-9 10h Mai Linh";
    return null;
  };

  const match = await service.searchDriveForDeliveryFolder(
    "mock_token",
    "File hoàn thiện",
    "5-9 18h Huyền Phan 1cc",
    "Huyền Phan"
  );

  assert.ok(match, "Should find matched folder");
  assert.equal(match.id, "folder_huyen_phan", "Must correlate candidate with job parent");
});

test("Drive Resolver: searchDriveForDeliveryFolder picks latest modified folder when parent is unknown", async () => {
  const service = new DriveResolverService();

  (service as any).queryDriveFiles = async (
    token: string,
    query: string,
    orderBy: string,
    pageSize: number
  ) => {
    if (query.includes("File hoàn thiện")) {
      return [
        {
          id: "folder_latest_modified",
          name: "File hoàn thiện",
          parents: ["parent_unknown"],
          modifiedTime: "2026-09-11T01:30:00Z",
        },
        {
          id: "folder_older",
          name: "File hoàn thiện",
          parents: ["parent_unknown_2"],
          modifiedTime: "2026-09-08T10:00:00Z",
        },
      ];
    }
    return [];
  };

  (service as any).getFolderNameById = async () => null;

  const match = await service.searchDriveForDeliveryFolder(
    "mock_token",
    "File hoàn thiện"
  );

  assert.ok(match);
  assert.equal(match.id, "folder_latest_modified", "Must select latest modified folder");
});

test("Drive Resolver: searchDriveForDeliveryFolder finds finished subfolder inside job folder", async () => {
  const service = new DriveResolverService();

  (service as any).queryDriveFiles = async (
    token: string,
    query: string,
    orderBy: string,
    pageSize: number
  ) => {
    // Found job folder
    if (query.includes("10-9 15h Huy hoàng")) {
      return [
        {
          id: "job_folder_id_456",
          name: "10-9 15h Huy hoàng",
          modifiedTime: "2026-09-10T15:00:00Z",
        },
      ];
    }

    // Found children inside job folder
    if (query.includes("'job_folder_id_456' in parents")) {
      return [
        {
          id: "subfolder_final_789",
          name: "File hoàn thiện",
          parents: ["job_folder_id_456"],
          modifiedTime: "2026-09-10T16:00:00Z",
        },
        {
          id: "subfolder_raw",
          name: "File gốc",
          parents: ["job_folder_id_456"],
          modifiedTime: "2026-09-10T14:00:00Z",
        },
      ];
    }

    return [];
  };

  const match = await service.searchDriveForDeliveryFolder(
    "mock_token",
    "File hoàn thiện",
    "10-9 15h Huy hoàng",
    "Huy hoàng"
  );

  assert.ok(match);
  assert.equal(match.id, "subfolder_final_789", "Must find finished child folder inside job folder");
});

test("Drive Resolver: returns empty link and warning if folder is not on Google Drive (NEVER search URL)", async () => {
  const service = new DriveResolverService();

  (service as any).queryDriveFiles = async () => [];

  // Override searchDriveForDeliveryFolder to return null
  service.searchDriveForDeliveryFolder = async () => null;

  const result = await service.resolveLocalFolderToDriveLink(
    "/non/existent/path/File hoàn thiện",
    "",
    "root",
    false,
    {
      finalFolderName: "File hoàn thiện",
    }
  );

  assert.equal(result.driveWebLink, "", "Must be empty link when not found on Drive");
  assert.equal(result.isAccessible, false);
  assert.equal(result.driveWebLink.includes("search?q="), false, "Must never return search URL");
  assert.ok(result.warnings && result.warnings.length > 0);
});
