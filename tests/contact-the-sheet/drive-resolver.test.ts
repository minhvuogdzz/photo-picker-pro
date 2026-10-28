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
    // Every folder contains files unless a test says otherwise (leaf-folder check)
    if (query.includes("mimeType != ")) return [{ id: "file_img_1", name: "IMG_0001.jpg" }];

    // If querying by job folder name
    if (query.includes("5-9 18h Huyền Phan 1cc")) {
      return []; // simulate job folder not found directly
    }

    // If querying by targetFolderName "File hoàn thiện"
    if (query.includes("File hoàn thiện")) {
      return [
        {
          id: "folder_recent_other_client",
          ownedByMe: true,
          name: "File hoàn thiện",
          parents: ["parent_other"],
          modifiedTime: "2026-09-11T01:00:00Z",
        },
        {
          id: "folder_huyen_phan",
          ownedByMe: true,
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
    // Every folder contains files unless a test says otherwise (leaf-folder check)
    if (query.includes("mimeType != ")) return [{ id: "file_img_1", name: "IMG_0001.jpg" }];

    if (query.includes("File hoàn thiện")) {
      return [
        {
          id: "folder_latest_modified",
          ownedByMe: true,
          name: "File hoàn thiện",
          parents: ["parent_unknown"],
          modifiedTime: "2026-09-11T01:30:00Z",
        },
        {
          id: "folder_older",
          ownedByMe: true,
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
    // Every folder contains files unless a test says otherwise (leaf-folder check)
    if (query.includes("mimeType != ")) return [{ id: "file_img_1", name: "IMG_0001.jpg" }];

    // Found job folder
    if (query.includes("10-9 15h Huy hoàng")) {
      return [
        {
          id: "job_folder_id_456",
          ownedByMe: true,
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
          ownedByMe: true,
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
    // Every folder contains files unless a test says otherwise (leaf-folder check)
    if (query.includes("mimeType != ")) return [{ id: "file_img_1", name: "IMG_0001.jpg" }];

    // 1. Children of shortcut base: 1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI
    if (query.includes("'1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI' in parents")) {
      return [
        { id: "folder_photoshop", name: "Photoshop ", parents: ["1wmPRksbQLAUMq5SnBi7TazBZ7ax5WuYI"], ownedByMe: true },
      ];
    }
    // 2. Children of Photoshop
    if (query.includes("'folder_photoshop' in parents")) {
      return [
        { id: "folder_file_hoan_thien", name: "File hoàn thiện", parents: ["folder_photoshop"], ownedByMe: true },
      ];
    }
    // 3. Children of File hoàn thiện
    if (query.includes("'folder_file_hoan_thien' in parents")) {
      return [
        { id: "folder_vuong", name: "Vương", parents: ["folder_file_hoan_thien"], ownedByMe: true },
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


test("Drive Resolver: skips latest folder that still has sub-folders and picks older leaf folder", async () => {
  const service = new DriveResolverService();

  (service as any).queryDriveFiles = async (token: string, query: string) => {
    if (query.includes("mimeType != ")) return [{ id: "file_img_1", name: "IMG_0001.jpg" }];
    // Latest candidate still contains a sub-folder (not finished yet)
    if (query.includes("'folder_latest_with_sub' in parents")) {
      return [{ id: "nested_sub", name: "Chọn lại", parents: ["folder_latest_with_sub"] }];
    }
    if (query.includes("File hoàn thiện")) {
      return [
        { id: "folder_latest_with_sub", name: "File hoàn thiện", parents: ["p1"], modifiedTime: "2026-09-11T01:30:00Z", ownedByMe: true },
        { id: "folder_older_leaf", name: "File hoàn thiện", parents: ["p2"], modifiedTime: "2026-09-08T10:00:00Z", ownedByMe: true },
      ];
    }
    return [];
  };
  (service as any).getFolderNameById = async () => null;

  const match = await service.searchDriveForDeliveryFolder("mock_token", "File hoàn thiện");

  assert.ok(match);
  assert.equal(match.id, "folder_older_leaf", "Folder with sub-folders must be skipped");
});

test("Drive Resolver: skips empty folder (no files) even if it is the latest", async () => {
  const service = new DriveResolverService();

  (service as any).queryDriveFiles = async (token: string, query: string) => {
    if (query.includes("mimeType != ")) {
      return query.includes("'folder_latest_empty' in parents") ? [] : [{ id: "file_img_1", name: "IMG_0001.jpg" }];
    }
    if (query.includes("File hoàn thiện")) {
      return [
        { id: "folder_latest_empty", name: "File hoàn thiện", parents: ["p1"], modifiedTime: "2026-09-11T01:30:00Z", ownedByMe: true },
        { id: "folder_older_with_files", name: "File hoàn thiện", parents: ["p2"], modifiedTime: "2026-09-08T10:00:00Z", ownedByMe: true },
      ];
    }
    return [];
  };
  (service as any).getFolderNameById = async () => null;

  const match = await service.searchDriveForDeliveryFolder("mock_token", "File hoàn thiện");

  assert.ok(match);
  assert.equal(match.id, "folder_older_with_files", "Empty folder must be skipped");
});

test("Drive Resolver: job folder whose children all have sub-folders falls back to older job folder", async () => {
  const service = new DriveResolverService();

  (service as any).queryDriveFiles = async (token: string, query: string) => {
    if (query.includes("mimeType != ")) return [{ id: "file_img_1", name: "IMG_0001.jpg" }];
    if (query.includes("'job_new' in parents")) {
      return [{ id: "job_new_final", name: "File hoàn thiện", parents: ["job_new"], ownedByMe: true }];
    }
    if (query.includes("'job_new_final' in parents")) {
      return [{ id: "job_new_final_nested", name: "Bản 2", parents: ["job_new_final"] }];
    }
    if (query.includes("'job_old' in parents")) {
      return [{ id: "job_old_final", name: "File hoàn thiện", parents: ["job_old"], ownedByMe: true }];
    }
    if (query.includes("12-9 9h Lan Anh")) {
      return [
        { id: "job_new", name: "12-9 9h Lan Anh", modifiedTime: "2026-09-12T10:00:00Z", ownedByMe: true },
        { id: "job_old", name: "12-9 9h Lan Anh", modifiedTime: "2026-09-12T08:00:00Z", ownedByMe: true },
      ];
    }
    return [];
  };

  const match = await service.searchDriveForDeliveryFolder(
    "mock_token",
    "File hoàn thiện",
    "12-9 9h Lan Anh",
    "Lan Anh"
  );

  assert.ok(match);
  assert.equal(match.id, "job_old_final", "Must pick leaf folder from older job folder");
});

test("Drive Resolver: skips latest leaf folder owned by someone else and picks the one owned by connected account", async () => {
  const service = new DriveResolverService();

  (service as any).queryDriveFiles = async (token: string, query: string) => {
    if (query.includes("mimeType != ")) return [{ id: "file_img_1", name: "IMG_0001.jpg" }];
    if (query.includes("File hoàn thiện")) {
      return [
        {
          id: "leaf_other_owner",
          name: "File hoàn thiện",
          parents: ["p1"],
          modifiedTime: "2026-09-11T01:30:00Z",
          ownedByMe: false,
          owners: [{ emailAddress: "someone@else.com", me: false }],
        },
        {
          id: "leaf_my_owner",
          name: "File hoàn thiện",
          parents: ["p2"],
          modifiedTime: "2026-09-08T10:00:00Z",
          ownedByMe: true,
        },
      ];
    }
    return [];
  };
  (service as any).getFolderNameById = async () => null;

  const match = await service.searchDriveForDeliveryFolder(
    "mock_token",
    "File hoàn thiện",
    "",
    "",
    "root",
    "me@studio.com",
    true
  );

  assert.ok(match);
  assert.equal(match.id, "leaf_my_owner", "Folder owned by another account must be skipped");
});

test("Drive Resolver: returns null when the only leaf folder is owned by another account", async () => {
  const service = new DriveResolverService();

  (service as any).queryDriveFiles = async (token: string, query: string) => {
    if (query.includes("mimeType != ")) return [{ id: "file_img_1", name: "IMG_0001.jpg" }];
    if (query.includes("File hoàn thiện")) {
      return [{ id: "leaf_other", name: "File hoàn thiện", parents: ["p1"], ownedByMe: false }];
    }
    return [];
  };
  (service as any).getFolderNameById = async () => null;

  const match = await service.searchDriveForDeliveryFolder(
    "mock_token",
    "File hoàn thiện",
    "",
    "",
    "root",
    "me@studio.com",
    true
  );

  assert.equal(match, null);
});

test("Drive Resolver: owner check switched off allows a leaf folder owned by another account", async () => {
  const service = new DriveResolverService();

  (service as any).queryDriveFiles = async (token: string, query: string) => {
    if (query.includes("mimeType != ")) return [{ id: "file_img_1", name: "IMG_0001.jpg" }];
    if (query.includes("File hoàn thiện")) {
      return [{ id: "leaf_other", name: "File hoàn thiện", parents: ["p1"], ownedByMe: false }];
    }
    return [];
  };
  (service as any).getFolderNameById = async () => null;

  const match = await service.searchDriveForDeliveryFolder(
    "mock_token",
    "File hoàn thiện",
    "",
    "",
    "root",
    "me@studio.com",
    false
  );

  assert.ok(match);
  assert.equal(match.id, "leaf_other");
});

test("Drive Resolver: final fresh ownership check rejects a folder whose cached data said it was mine", async () => {
  const service = new DriveResolverService();
  googleCredentialManager.getValidAccessToken = async () => "mock_valid_token";

  // Search (with stale cached metadata) believes the folder is owned by the connected account...
  service.searchDriveForDeliveryFolder = async () => ({
    id: "stale_folder",
    name: "File hoàn thiện",
    ownedByMe: true,
  });
  // ...but Drive, asked fresh, says it belongs to someone else.
  (service as any).getFolderById = async (token: string, id: string, forceFresh?: boolean) =>
    forceFresh
      ? { id, name: "File hoàn thiện", ownedByMe: false, owners: [{ emailAddress: "other@x.com", me: false }] }
      : { id, name: "File hoàn thiện", ownedByMe: true };

  const result = await service.resolveLocalFolderToDriveLink(
    "/some/local/Job/File hoàn thiện",
    "",
    "root",
    false,
    {
      finalFolderName: "File hoàn thiện",
      currentUserEmail: "me@studio.com",
      requireOwnerMatch: true,
    }
  );

  assert.equal(result.isAccessible, false);
  assert.equal(result.driveWebLink, "", "Must not return a link to a folder owned by someone else");
});

test("Drive Resolver Strategy A: Finds leaf delivery folder even when jobFolderName === targetFolderName (post sync_subfolder_names)", async () => {
  const service = new DriveResolverService();

  // Mock queryDriveFiles: when searching for cleanJobName, return the customer job folder on Drive
  (service as any).queryDriveFiles = async (token: string, q: string) => {
    if (q.includes("01-08 Khanh Chi")) {
      return [
        {
          id: "job_drive_folder_id",
          name: "01-08 Khanh Chi",
          owners: [{ me: true, emailAddress: "me@studio.com" }],
          modifiedTime: "2026-10-28T12:00:00Z",
        },
      ];
    }
    return [];
  };

  // Mock getChildFolders for the job folder: returns a leaf delivery child (e.g. named 'Done' or '01-08 Khanh Chi')
  (service as any).getChildFolders = async (token: string, parentId: string) => {
    if (parentId === "job_drive_folder_id") {
      return [
        {
          id: "delivery_subfolder_id",
          name: "Done",
          owners: [{ me: true, emailAddress: "me@studio.com" }],
          modifiedTime: "2026-10-28T12:05:00Z",
          webViewLink: "https://drive.google.com/folders/delivery_subfolder_id",
        },
      ];
    }
    return [];
  };

  // Mock isLeafFolderWithFiles: job folder has subfolders (false), delivery subfolder is leaf (true)
  (service as any).isLeafFolderWithFiles = async (token: string, folderId: string) => {
    return folderId === "delivery_subfolder_id";
  };

  const match = await service.searchDriveForDeliveryFolder(
    "mock_token",
    "01-08 Khanh Chi", // targetFolderName matches jobFolderName after subfolder rename sync
    "01-08 Khanh Chi", // jobFolderName
    "Khanh Chi",
    "root",
    "me@studio.com",
    true
  );

  assert.ok(match, "Strategy A must execute and find delivery folder even when jobFolderName === targetFolderName");
  assert.equal(match.id, "delivery_subfolder_id");
  assert.equal(match.webViewLink, "https://drive.google.com/folders/delivery_subfolder_id");
});
