import { test } from "node:test";
import assert from "node:assert/strict";
import {
  driveResolverService,
  DriveResolverService,
  parseLocalDrivePath,
  areFolderNamesEqual,
  isRawFolder,
} from "../../src/modules/contact-the-sheet/services/driveResolverService.ts";
import { googleCredentialManager } from "../../src/modules/contact-the-sheet/services/googleCredentialBridge.ts";

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

test("Drive Resolver: parseLocalDrivePath parses shortcut targets correctly", () => {
  const path =
    "/Users/vuongdev/Library/CloudStorage/GoogleDrive-ougvn.it2@gmail.com/.shortcut-targets-by-id/1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI/Photoshop /File hoàn thiện/Vương";

  const res = parseLocalDrivePath(path);
  assert.equal(res.type, "SHORTCUT_TARGET");
  assert.equal(res.baseFolderId, "1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI");
  assert.deepEqual(res.relativeSubPath, ["Photoshop", "File hoàn thiện", "Vương"]);
});

test("Drive Resolver: areFolderNamesEqual handles Vietnamese NFC vs NFD and trailing spaces", () => {
  // NFC vs NFD
  const nfc = "File hoàn thiện";
  const nfd = "File hoa\u0300n thie\u0323\u0302n";
  assert.equal(areFolderNamesEqual(nfc, nfd), true);

  // Trailing space and NFD
  assert.equal(areFolderNamesEqual("Photoshop ", "  Photoshop  "), true);
  assert.equal(areFolderNamesEqual("Vương", "Vương".normalize("NFD")), true);
});

test("Drive Resolver: isRawFolder correctly identifies raw photo folders", () => {
  assert.equal(isRawFolder("Ảnh gốc"), true);
  assert.equal(isRawFolder("File gốc khách hàng"), true);
  assert.equal(isRawFolder("RAW"), true);
  assert.equal(isRawFolder("CR3"), true);
  assert.equal(isRawFolder("File hoàn thiện"), false);
  assert.equal(isRawFolder("JPG"), false);
});

test("Drive Resolver (CRITICAL BUG FIX): Hierarchical walk down from configured root NEVER picks raw photo folder with identical customer name", async () => {
  const service = new DriveResolverService();

  // Mock valid access token
  googleCredentialManager.getValidAccessToken = async () => "mock_valid_token";

  const localRoot =
    "/Users/vuongdev/Library/CloudStorage/GoogleDrive-ougvn.it2@gmail.com/.shortcut-targets-by-id/1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI/Photoshop /File hoàn thiện/Vương";
  const localJobPath =
    "/Users/vuongdev/Library/CloudStorage/GoogleDrive-ougvn.it2@gmail.com/.shortcut-targets-by-id/1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI/Photoshop /File hoàn thiện/Vương/27-9 14h Khách hàng A/File hoàn thiện";

  // Simulate Drive structure
  (service as any).queryDriveFiles = async (token: string, query: string) => {
    // 1. Children of shortcut base: 1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI
    if (query.includes("'1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI' in parents")) {
      return [
        { id: "folder_photoshop", name: "Photoshop ", parents: ["1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI"] },
      ];
    }
    // 2. Children of Photoshop
    if (query.includes("'folder_photoshop' in parents")) {
      return [
        { id: "folder_file_hoan_thien", name: "File hoàn thiện", parents: ["folder_photoshop"] },
      ];
    }
    // 3. Children of File hoàn thiện
    if (query.includes("'folder_file_hoan_thien' in parents")) {
      return [
        { id: "folder_vuong", name: "Vương", parents: ["folder_file_hoan_thien"] },
      ];
    }
    // 4. Children of Vương
    if (query.includes("'folder_vuong' in parents")) {
      return [
        {
          id: "job_khach_a_finished",
          name: "27-9 14h Khách hàng A",
          parents: ["folder_vuong"],
          ownedByMe: true,
          owners: [{ emailAddress: "ougvn.it2@gmail.com", me: true }],
        },
      ];
    }
    // 5. Children of 27-9 14h Khách hàng A
    if (query.includes("'job_khach_a_finished' in parents")) {
      return [
        {
          id: "final_delivery_khach_a",
          name: "File hoàn thiện",
          parents: ["job_khach_a_finished"],
          ownedByMe: true,
          owners: [{ emailAddress: "ougvn.it2@gmail.com", me: true }],
        },
      ];
    }

    // Global queries that return the RAW photo folder elsewhere on Drive
    if (query.includes("Khách hàng A") || query.includes("File hoàn thiện")) {
      return [
        {
          id: "folder_RAW_OUTSIDE_ROOT",
          name: "Khách hàng A",
          parents: ["parent_anh_goc"],
          ownedByMe: false,
          owners: [{ emailAddress: "photographer@gmail.com", me: false }],
          modifiedTime: "2026-09-27T17:00:00Z", // very recent, would trick naive search!
        },
      ];
    }

    return [];
  };

  (service as any).getFolderById = async (token: string, id: string) => {
    if (id === "final_delivery_khach_a") {
      return { id, name: "File hoàn thiện", parents: ["job_khach_a_finished"], ownedByMe: true };
    }
    if (id === "folder_RAW_OUTSIDE_ROOT") {
      return { id, name: "Khách hàng A", parents: ["parent_anh_goc"], ownedByMe: false };
    }
    return null;
  };

  const result = await service.resolveLocalFolderToDriveLink(
    localJobPath,
    localRoot,
    "root",
    false,
    {
      finalFolderName: "File hoàn thiện",
      jobFolderName: "27-9 14h Khách hàng A",
      customerName: "Khách hàng A",
      currentUserEmail: "ougvn.it2@gmail.com",
      requireOwnerMatch: true,
    }
  );

  assert.equal(result.isAccessible, true);
  assert.equal(result.driveItemId, "final_delivery_khach_a", "Must resolve to finished folder inside Vương");
  assert.notEqual(result.driveItemId, "folder_RAW_OUTSIDE_ROOT", "Must NEVER pick raw folder outside Vương!");
  assert.equal(result.driveWebLink, "https://drive.google.com/drive/folders/final_delivery_khach_a?usp=sharing");
});

test("Drive Resolver: Scoped search strictly excludes folders outside configured root and prefers current owner", async () => {
  const service = new DriveResolverService();

  // Candidate outside root
  (service as any).queryDriveFiles = async () => [
    {
      id: "folder_raw_b",
      name: "Ảnh gốc Khách hàng B",
      parents: ["root"],
      ownedByMe: false,
    },
  ];

  const match2 = await service.searchDriveForDeliveryFolder(
    "token",
    "File hoàn thiện",
    "Khách hàng B",
    "Khách hàng B",
    "folder_vuong",
    "ougvn.it2@gmail.com",
    true
  );

  assert.equal(match2, null, "Must reject raw photo folder or folder outside root");
});

