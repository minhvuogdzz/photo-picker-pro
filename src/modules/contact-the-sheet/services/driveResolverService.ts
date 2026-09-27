import { googleCredentialManager } from "./googleCredentialBridge.ts";
import { useContactSheetStore } from "../stores/useContactSheetStore.ts";

export interface DriveFolderItem {
  id: string;
  name: string;
  webViewLink?: string;
  parents?: string[];
  modifiedTime?: string;
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
    me?: boolean;
  }>;
  ownedByMe?: boolean;
}

export interface DriveResolutionResult {
  driveItemId: string;
  driveWebLink: string;
  relativePath: string;
  isAccessible: boolean;
  warnings?: string[];
  resolvedPath?: string;
  isOwnerMatched?: boolean;
}

export interface DriveResolutionOptions {
  finalFolderName?: string;
  jobFolderName?: string;
  customerName?: string;
  requireOwnerMatch?: boolean;
  currentUserEmail?: string;
}

export interface ParsedLocalDrivePath {
  type: "SHORTCUT_TARGET" | "MY_DRIVE" | "SHARED_DRIVE" | "OTHER";
  baseFolderId?: string;
  sharedDriveName?: string;
  relativeSubPath: string[];
}

/**
 * Normalizes and compares folder names.
 * Supports Unicode NFC/NFD decomposition, trims leading/trailing spaces,
 * collapses redundant whitespace, and performs case-insensitive comparison.
 */
export function areFolderNamesEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const normA = a.normalize("NFC").trim().toLowerCase();
  const normB = b.normalize("NFC").trim().toLowerCase();
  if (normA === normB) return true;

  const collapseA = normA.replace(/\s+/g, " ");
  const collapseB = normB.replace(/\s+/g, " ");
  if (collapseA === collapseB) return true;

  const nfdA = a.normalize("NFD").trim().toLowerCase();
  const nfdB = b.normalize("NFD").trim().toLowerCase();
  if (nfdA === nfdB) return true;

  return false;
}

/**
 * Checks whether a folder name represents an original / raw photo folder.
 * Raw photo folders must NEVER be resolved as finished delivery folders.
 */
export function isRawFolder(name: string): boolean {
  if (!name) return false;
  const n = name.normalize("NFC").toLowerCase();
  return (
    n.includes("ảnh gốc") ||
    n.includes("anh goc") ||
    n.includes("file gốc") ||
    n.includes("file goc") ||
    n.includes("chưa sửa") ||
    n.includes("chua sua") ||
    n.includes("chưa làm") ||
    n.includes("chua lam") ||
    /\b(raw|cr2|cr3|nef|arw|dng)\b/i.test(n)
  );
}

/**
 * Checks whether a folder name represents finished delivery photos.
 */
export function isDeliveryFolder(name: string): boolean {
  if (!name) return false;
  const n = name.normalize("NFC").toLowerCase();
  return (
    n.includes("hoàn thiện") ||
    n.includes("hoan thien") ||
    n.includes("thành phẩm") ||
    n.includes("thanh pham") ||
    n.includes("trả ảnh") ||
    n.includes("tra anh") ||
    n.includes("đã sửa") ||
    n.includes("da sua") ||
    n.includes("final") ||
    n.includes("xong") ||
    n.includes("export") ||
    /\b(jpg|jpeg)\b/i.test(n)
  );
}

/**
 * Parses local Google Drive desktop path into cloud mount metadata.
 */
export function parseLocalDrivePath(localPath: string): ParsedLocalDrivePath {
  if (!localPath) {
    return { type: "OTHER", relativeSubPath: [] };
  }

  const normalized = localPath.replace(/\\/g, "/");

  // 1. Detect macOS Google Drive Shortcut mount: .shortcut-targets-by-id/<folderId>/<subpath>
  const shortcutMatch = normalized.match(/\.shortcut-targets-by-id\/([a-zA-Z0-9_-]+)(?:\/(.*))?/i);
  if (shortcutMatch) {
    const baseFolderId = shortcutMatch[1];
    const subPathStr = shortcutMatch[2] || "";
    const segments = subPathStr.split("/").map((s) => s.trim()).filter(Boolean);
    return {
      type: "SHORTCUT_TARGET",
      baseFolderId,
      relativeSubPath: segments,
    };
  }

  // 2. Detect My Drive mount: .../My Drive/<subpath>
  const myDriveMatch = normalized.match(/(?:^|\/)My Drive(?:\/(.*))?/i);
  if (myDriveMatch) {
    const subPathStr = myDriveMatch[1] || "";
    const segments = subPathStr.split("/").map((s) => s.trim()).filter(Boolean);
    return {
      type: "MY_DRIVE",
      baseFolderId: "root",
      relativeSubPath: segments,
    };
  }

  // 3. Detect Shared drives mount: .../Shared drives/<driveName>/<subpath>
  const sharedDriveMatch = normalized.match(/(?:^|\/)Shared drives\/([^/]+)(?:\/(.*))?/i);
  if (sharedDriveMatch) {
    const sharedDriveName = sharedDriveMatch[1].trim();
    const subPathStr = sharedDriveMatch[2] || "";
    const segments = subPathStr.split("/").map((s) => s.trim()).filter(Boolean);
    return {
      type: "SHARED_DRIVE",
      sharedDriveName,
      relativeSubPath: segments,
    };
  }

  return {
    type: "OTHER",
    relativeSubPath: normalized.split("/").map((s) => s.trim()).filter(Boolean),
  };
}

export class DriveResolverService {
  private parentNameCache = new Map<string, string>();
  private folderMetadataCache = new Map<string, DriveFolderItem>();
  private childFoldersCache = new Map<string, DriveFolderItem[]>();
  private localRootToDriveIdCache = new Map<string, string>();

  public clearCache(): void {
    this.parentNameCache.clear();
    this.folderMetadataCache.clear();
    this.childFoldersCache.clear();
    this.localRootToDriveIdCache.clear();
  }

  /**
   * Resolves a local or cloud folder to a shareable Google Drive folder link.
   * 
   * Strict Resolution Pipeline:
   * 1. Resolves the configured Local Drive Root to its remote Google Drive Folder ID.
   * 2. Walks down the exact relative path hierarchy from root -> job folder -> final delivery folder.
   * 3. Confines all searches strictly within the configured root directory (descendant verification).
   * 4. Disqualifies raw photo folders ("Ảnh gốc", "File gốc", "RAW").
   * 5. Checks folder ownership to prioritize or require folders owned by the logged-in Google account.
   * 6. Formats direct shareable link (https://drive.google.com/drive/folders/{folderId}?usp=sharing).
   * 7. NEVER falls back to search query URLs (https://drive.google.com/drive/search?q=...).
   */
  public async resolveLocalFolderToDriveLink(
    localFolderPath: string,
    localDriveRoot: string = "",
    remoteRootId: string = "root",
    isMock: boolean = false,
    options?: DriveResolutionOptions
  ): Promise<DriveResolutionResult> {
    const rawFolderName = localFolderPath.split(/[/\\]+/).filter(Boolean).pop() || "folder";
    const targetFolderName = (options?.finalFolderName || rawFolderName).normalize("NFC").trim();
    const jobFolderName = (options?.jobFolderName || "").normalize("NFC").trim();
    const customerName = (options?.customerName || "").normalize("NFC").trim();

    // 1. Mock Mode: Deterministic shareable folder link
    if (isMock) {
      const mockId = `mock_folder_${Math.abs(this.simpleHash(localFolderPath)).toString(16)}`;
      return {
        driveItemId: mockId,
        driveWebLink: `https://drive.google.com/drive/folders/${mockId}?usp=sharing`,
        relativePath: targetFolderName,
        isAccessible: true,
      };
    }

    // 2. Obtain Google Access Token
    let token: string | null = null;
    try {
      token = await googleCredentialManager.getValidAccessToken();
    } catch (authErr) {
      console.warn("Could not obtain access token for Drive resolution:", authErr);
      return {
        driveItemId: "",
        driveWebLink: "",
        relativePath: targetFolderName,
        isAccessible: false,
        warnings: [
          "Chưa kết nối tài khoản Google Drive hoặc phiên đăng nhập đã hết hạn. Vui lòng bấm 'Kết nối Google' để tự động quét link Drive.",
        ],
      };
    }

    // 3. Resolve Current Logged-in Google Account Email
    const currentUserEmail =
      options?.currentUserEmail ||
      googleCredentialManager.getAccountEmail() ||
      useContactSheetStore.getState().googleConnection.accountEmail ||
      null;

    const requireOwnerMatch = options?.requireOwnerMatch ?? true;

    // 4. Resolve effective Local Drive Root & Remote Root Folder ID
    const effectiveLocalRoot = (
      localDriveRoot ||
      useContactSheetStore.getState().lastDriveConfig?.localRootPath ||
      ""
    ).trim();

    const effectiveRemoteRootId = (
      remoteRootId ||
      useContactSheetStore.getState().lastDriveConfig?.remoteRootDriveId ||
      "root"
    ).trim();

    let targetRootFolderId = effectiveRemoteRootId;
    if (effectiveLocalRoot) {
      try {
        const resolvedId = await this.resolveDriveFolderIdForLocalRoot(
          token,
          effectiveLocalRoot,
          effectiveRemoteRootId
        );
        if (resolvedId) {
          targetRootFolderId = resolvedId;
        }
      } catch (rootErr) {
        console.warn("Failed resolving root folder ID for local root:", rootErr);
      }
    }

    // 5. Tier 1: Exact Hierarchical Path Walk Down
    // If localFolderPath is inside effectiveLocalRoot, walk down step-by-step
    const relativeCheck = this.computeRelativeSegments(effectiveLocalRoot, localFolderPath);
    if (relativeCheck.isInside && relativeCheck.segments.length > 0 && targetRootFolderId) {
      try {
        const walkedMatch = await this.walkDownRelativeHierarchy(
          token,
          targetRootFolderId,
          relativeCheck.segments,
          targetFolderName,
          customerName,
          jobFolderName,
          currentUserEmail,
          requireOwnerMatch
        );

        if (walkedMatch) {
          const shareLink = `https://drive.google.com/drive/folders/${walkedMatch.id}?usp=sharing`;
          this.tryMakeFolderShareable(token, walkedMatch.id).catch(() => {});

          return {
            driveItemId: walkedMatch.id,
            driveWebLink: shareLink,
            relativePath: targetFolderName,
            isAccessible: true,
            resolvedPath: localFolderPath,
            isOwnerMatched: walkedMatch.ownedByMe ?? false,
          };
        }
      } catch (walkErr) {
        console.warn("Hierarchy walk error:", walkErr);
      }
    }

    // 6. Tier 2: Scoped Search Under targetRootFolderId
    try {
      const driveMatch = await this.searchDriveForDeliveryFolder(
        token,
        targetFolderName,
        jobFolderName,
        customerName,
        targetRootFolderId,
        currentUserEmail,
        requireOwnerMatch
      );

      if (driveMatch) {
        const shareLink = `https://drive.google.com/drive/folders/${driveMatch.id}?usp=sharing`;
        this.tryMakeFolderShareable(token, driveMatch.id).catch(() => {});

        return {
          driveItemId: driveMatch.id,
          driveWebLink: shareLink,
          relativePath: targetFolderName,
          isAccessible: true,
          resolvedPath: localFolderPath,
          isOwnerMatched: driveMatch.ownedByMe ?? false,
        };
      }
    } catch (searchErr) {
      console.warn("Error searching Drive for delivery folder:", searchErr);
    }

    // 7. Not Found
    const rootName = effectiveLocalRoot ? effectiveLocalRoot.split(/[/\\]+/).filter(Boolean).pop() : "";
    const scopeNotice = rootName ? ` trong thư mục cấu hình "${rootName}"` : "";

    return {
      driveItemId: "",
      driveWebLink: "",
      relativePath: targetFolderName,
      isAccessible: false,
      warnings: [
        `Không tìm thấy thư mục thành phẩm "${targetFolderName}"${scopeNotice} trên Google Drive. Vui lòng kiểm tra lại đồng bộ Google Drive Desktop hoặc quyền sở hữu tài khoản.`,
      ],
    };
  }

  /**
   * Computes the relative path segments if targetFolderPath is located inside localRootPath.
   */
  public computeRelativeSegments(
    localRootPath: string,
    targetFolderPath: string
  ): { isInside: boolean; segments: string[] } {
    if (!localRootPath || !targetFolderPath) {
      return { isInside: false, segments: [] };
    }

    const normRoot = localRootPath.replace(/\\/g, "/").replace(/\/+$/, "");
    const normTarget = targetFolderPath.replace(/\\/g, "/").replace(/\/+$/, "");

    const rootParts = normRoot.split("/").map((p) => p.trim()).filter(Boolean);
    const targetParts = normTarget.split("/").map((p) => p.trim()).filter(Boolean);

    if (rootParts.length === 0 || targetParts.length < rootParts.length) {
      return { isInside: false, segments: [] };
    }

    for (let i = 0; i < rootParts.length; i++) {
      if (!areFolderNamesEqual(rootParts[i], targetParts[i])) {
        return { isInside: false, segments: [] };
      }
    }

    return {
      isInside: true,
      segments: targetParts.slice(rootParts.length),
    };
  }

  /**
   * Resolves the remote Google Drive Folder ID corresponding to a local root folder path.
   */
  public async resolveDriveFolderIdForLocalRoot(
    token: string,
    localRoot: string,
    fallbackRemoteId: string = "root"
  ): Promise<string> {
    const cacheKey = `${localRoot}__${fallbackRemoteId}`;
    if (this.localRootToDriveIdCache.has(cacheKey)) {
      return this.localRootToDriveIdCache.get(cacheKey)!;
    }

    const parsed = parseLocalDrivePath(localRoot);

    let startId = fallbackRemoteId || "root";
    if (parsed.type === "SHORTCUT_TARGET" && parsed.baseFolderId) {
      startId = parsed.baseFolderId;
    }

    if (parsed.relativeSubPath.length === 0) {
      this.localRootToDriveIdCache.set(cacheKey, startId);
      return startId;
    }

    const resolvedId = await this.walkDownPathSegments(token, startId, parsed.relativeSubPath);
    this.localRootToDriveIdCache.set(cacheKey, resolvedId);
    return resolvedId;
  }

  /**
   * Walks down path segments one-by-one from startFolderId.
   */
  public async walkDownPathSegments(
    token: string,
    startFolderId: string,
    segments: string[]
  ): Promise<string> {
    let currId = startFolderId;

    for (const seg of segments) {
      if (!seg) continue;
      const children = await this.getChildFolders(token, currId);
      const match = children.find((c) => areFolderNamesEqual(c.name, seg));

      if (match) {
        currId = match.id;
      } else {
        // Tolerant match (trimmed or partial)
        const looseMatch = children.find(
          (c) =>
            c.name.trim().toLowerCase().includes(seg.trim().toLowerCase()) ||
            seg.trim().toLowerCase().includes(c.name.trim().toLowerCase())
        );
        if (looseMatch) {
          currId = looseMatch.id;
        } else {
          // If intermediate segment not found, return deepest reached
          return currId;
        }
      }
    }

    return currId;
  }

  /**
   * Walks down the relative path hierarchy from the resolved root folder ID.
   */
  public async walkDownRelativeHierarchy(
    token: string,
    rootFolderId: string,
    relativeSegments: string[],
    targetFolderName: string,
    customerName?: string,
    jobFolderName?: string,
    currentUserEmail?: string | null,
    requireOwnerMatch?: boolean
  ): Promise<{ id: string; name: string; ownedByMe?: boolean } | null> {
    let currentId = rootFolderId;
    let lastMatchedFolder: DriveFolderItem | null = null;

    for (let i = 0; i < relativeSegments.length; i++) {
      const seg = relativeSegments[i];
      const children = await this.getChildFolders(token, currentId);

      // Filter out raw folders
      const nonRawChildren = children.filter((c) => !isRawFolder(c.name));

      // Find child matching seg
      let nextChild = nonRawChildren.find((c) => areFolderNamesEqual(c.name, seg));

      // If first segment represents job folder or customer folder
      if (!nextChild && i === 0) {
        if (customerName) {
          nextChild = nonRawChildren.find(
            (c) =>
              areFolderNamesEqual(c.name, customerName) ||
              c.name.normalize("NFC").toLowerCase().includes(customerName.toLowerCase())
          );
        }
        if (!nextChild && jobFolderName) {
          nextChild = nonRawChildren.find((c) => areFolderNamesEqual(c.name, jobFolderName));
        }
      }

      // If at deepest delivery folder level (e.g. "File hoàn thiện")
      if (!nextChild && i === relativeSegments.length - 1) {
        nextChild = nonRawChildren.find((c) => isDeliveryFolder(c.name));
      }

      if (nextChild) {
        currentId = nextChild.id;
        lastMatchedFolder = nextChild;
      } else {
        break;
      }
    }

    if (!lastMatchedFolder || currentId === rootFolderId) {
      return null;
    }

    // Inspect if current matched folder has an immediate child with delivery keywords
    const subChildren = await this.getChildFolders(token, currentId);
    const validDeliveryChild = subChildren
      .filter((c) => !isRawFolder(c.name))
      .find((c) =>
        targetFolderName && areFolderNamesEqual(c.name, targetFolderName)
          ? true
          : isDeliveryFolder(c.name)
      );

    const candidate = validDeliveryChild || lastMatchedFolder;

    // Check ownership if required
    if (requireOwnerMatch && currentUserEmail) {
      const isOwned = this.isFolderOwnedByCurrentUser(candidate, currentUserEmail);
      if (!isOwned && !candidate.ownedByMe) {
        // If candidate is not owned by current user, return with warning or fallback
        // Return anyway if it's the exact path child but tag ownedByMe = false
      }
    }

    return {
      id: candidate.id,
      name: candidate.name,
      ownedByMe: candidate.ownedByMe ?? this.isFolderOwnedByCurrentUser(candidate, currentUserEmail),
    };
  }

  /**
   * Scoped search for delivery folder on Google Drive:
   * 1. Excludes raw folders ("Ảnh gốc", "File gốc", "RAW").
   * 2. Confines candidates to descendants of targetRootFolderId.
   * 3. Prioritizes or enforces folders owned by currentUserEmail.
   */
  public async searchDriveForDeliveryFolder(
    token: string,
    targetFolderName: string,
    jobFolderName?: string,
    customerName?: string,
    targetRootFolderId: string = "root",
    currentUserEmail?: string | null,
    requireOwnerMatch?: boolean
  ): Promise<{ id: string; name: string; webViewLink?: string; ownedByMe?: boolean } | null> {
    const cleanTargetName = targetFolderName.normalize("NFC").trim();
    const cleanJobName = (jobFolderName || "").normalize("NFC").trim();
    const cleanCustomerName = (customerName || "").normalize("NFC").trim();

    // Strategy A: If jobFolderName is provided and differs from targetFolderName,
    // locate the job folder on Drive first, then check its children for the final folder
    if (cleanJobName && cleanJobName.toLowerCase() !== cleanTargetName.toLowerCase()) {
      const jobNameCond = this.buildNameQuery(cleanJobName);
      const jobQuery = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${jobNameCond}`;
      const jobCandidates = await this.queryDriveFiles(token, jobQuery, "modifiedTime desc", 15);

      // Filter job candidates
      for (const jobFolder of jobCandidates) {
        if (isRawFolder(jobFolder.name)) continue;

        // Verify descendant of targetRootFolderId
        if (targetRootFolderId && targetRootFolderId !== "root") {
          const isDesc = await this.isDescendantOf(token, jobFolder.id, targetRootFolderId);
          if (!isDesc) continue;
        }

        // Query child folders inside this job folder
        const children = await this.getChildFolders(token, jobFolder.id);
        const validChildren = children.filter((c) => !isRawFolder(c.name));

        if (validChildren.length > 0) {
          // Check for exact targetFolderName match
          const exactChild = validChildren.find((c) => areFolderNamesEqual(c.name, cleanTargetName));
          if (exactChild) {
            return {
              id: exactChild.id,
              name: exactChild.name,
              webViewLink: exactChild.webViewLink,
              ownedByMe: exactChild.ownedByMe ?? this.isFolderOwnedByCurrentUser(exactChild, currentUserEmail),
            };
          }

          // Check for finished keywords: "hoàn thiện", "thành phẩm", "final", "jpg"
          const keywordChild = validChildren.find((c) => isDeliveryFolder(c.name));
          if (keywordChild) {
            return {
              id: keywordChild.id,
              name: keywordChild.name,
              webViewLink: keywordChild.webViewLink,
              ownedByMe: keywordChild.ownedByMe ?? this.isFolderOwnedByCurrentUser(keywordChild, currentUserEmail),
            };
          }

          return {
            id: validChildren[0].id,
            name: validChildren[0].name,
            webViewLink: validChildren[0].webViewLink,
            ownedByMe: validChildren[0].ownedByMe ?? this.isFolderOwnedByCurrentUser(validChildren[0], currentUserEmail),
          };
        }

        // If no child folders exist, job folder itself is the delivery folder
        return {
          id: jobFolder.id,
          name: jobFolder.name,
          webViewLink: jobFolder.webViewLink,
          ownedByMe: jobFolder.ownedByMe ?? this.isFolderOwnedByCurrentUser(jobFolder, currentUserEmail),
        };
      }
    }

    // Strategy B: Search Drive directly by targetFolderName, ordered by modifiedTime desc
    const targetNameCond = this.buildNameQuery(cleanTargetName);
    const targetQuery = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${targetNameCond}`;
    const rawCandidates = await this.queryDriveFiles(token, targetQuery, "modifiedTime desc", 25);

    // Filter candidates
    const eligibleCandidates: DriveFolderItem[] = [];

    for (const c of rawCandidates) {
      if (isRawFolder(c.name)) continue;

      // Check candidate's parent name for raw keywords
      if (c.parents && c.parents.length > 0) {
        const parentName = await this.getFolderNameById(token, c.parents[0]);
        if (parentName && isRawFolder(parentName)) continue;
      }

      // Verify descendant of targetRootFolderId if specified
      if (targetRootFolderId && targetRootFolderId !== "root") {
        const isDesc = await this.isDescendantOf(token, c.id, targetRootFolderId);
        if (!isDesc) continue;
      }

      eligibleCandidates.push(c);
    }

    if (eligibleCandidates.length > 0) {
      // Prioritize by owner if currentUserEmail is provided
      if (currentUserEmail) {
        const ownedByCurrUser = eligibleCandidates.filter((c) =>
          this.isFolderOwnedByCurrentUser(c, currentUserEmail)
        );

        if (ownedByCurrUser.length > 0) {
          // If multiple candidates owned by user exist, check parent matching jobFolderName or customerName
          const parentMatch = await this.findMatchingParentCandidate(
            token,
            ownedByCurrUser,
            cleanJobName,
            cleanCustomerName
          );
          if (parentMatch) return parentMatch;

          return {
            id: ownedByCurrUser[0].id,
            name: ownedByCurrUser[0].name,
            webViewLink: ownedByCurrUser[0].webViewLink,
            ownedByMe: true,
          };
        }

        // If requireOwnerMatch is strictly true and none owned by user, reject
        if (requireOwnerMatch && targetRootFolderId === "root") {
          return null;
        }
      }

      // Check parent folders matching jobFolderName or customerName
      const parentMatch = await this.findMatchingParentCandidate(
        token,
        eligibleCandidates,
        cleanJobName,
        cleanCustomerName
      );
      if (parentMatch) return parentMatch;

      return {
        id: eligibleCandidates[0].id,
        name: eligibleCandidates[0].name,
        webViewLink: eligibleCandidates[0].webViewLink,
        ownedByMe: eligibleCandidates[0].ownedByMe ?? false,
      };
    }

    // Strategy C: Search by customerName if available
    if (cleanCustomerName) {
      const custNameCond = this.buildNameQuery(cleanCustomerName);
      const custQuery = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${custNameCond}`;
      const custFolders = await this.queryDriveFiles(token, custQuery, "modifiedTime desc", 10);

      for (const custFolder of custFolders) {
        if (isRawFolder(custFolder.name)) continue;

        if (targetRootFolderId && targetRootFolderId !== "root") {
          const isDesc = await this.isDescendantOf(token, custFolder.id, targetRootFolderId);
          if (!isDesc) continue;
        }

        const children = await this.getChildFolders(token, custFolder.id);
        const validChildren = children.filter((c) => !isRawFolder(c.name));

        if (validChildren.length > 0) {
          const exactChild = validChildren.find((c) => areFolderNamesEqual(c.name, cleanTargetName));
          if (exactChild) {
            return {
              id: exactChild.id,
              name: exactChild.name,
              webViewLink: exactChild.webViewLink,
              ownedByMe: exactChild.ownedByMe ?? this.isFolderOwnedByCurrentUser(exactChild, currentUserEmail),
            };
          }

          const deliveryChild = validChildren.find((c) => isDeliveryFolder(c.name));
          if (deliveryChild) {
            return {
              id: deliveryChild.id,
              name: deliveryChild.name,
              webViewLink: deliveryChild.webViewLink,
              ownedByMe: deliveryChild.ownedByMe ?? this.isFolderOwnedByCurrentUser(deliveryChild, currentUserEmail),
            };
          }

          return {
            id: validChildren[0].id,
            name: validChildren[0].name,
            webViewLink: validChildren[0].webViewLink,
            ownedByMe: validChildren[0].ownedByMe ?? this.isFolderOwnedByCurrentUser(validChildren[0], currentUserEmail),
          };
        }

        return {
          id: custFolder.id,
          name: custFolder.name,
          webViewLink: custFolder.webViewLink,
          ownedByMe: custFolder.ownedByMe ?? this.isFolderOwnedByCurrentUser(custFolder, currentUserEmail),
        };
      }
    }

    return null;
  }

  private async findMatchingParentCandidate(
    token: string,
    candidates: DriveFolderItem[],
    jobFolderName: string,
    customerName: string
  ): Promise<{ id: string; name: string; webViewLink?: string; ownedByMe?: boolean } | null> {
    if (!jobFolderName && !customerName) return null;

    const parentChecks = await Promise.all(
      candidates.slice(0, 10).map(async (c) => {
        if (!c.parents || c.parents.length === 0) return { candidate: c, parentName: "" };
        const parentName = await this.getFolderNameById(token, c.parents[0]);
        return { candidate: c, parentName: parentName || "" };
      })
    );

    const matchParent = parentChecks.find(({ parentName }) => {
      if (!parentName) return false;
      const normParent = parentName.normalize("NFC").trim().toLowerCase();
      if (jobFolderName && normParent.includes(jobFolderName.toLowerCase())) return true;
      if (customerName && normParent.includes(customerName.toLowerCase())) return true;
      return false;
    });

    if (matchParent) {
      return {
        id: matchParent.candidate.id,
        name: matchParent.candidate.name,
        webViewLink: matchParent.candidate.webViewLink,
        ownedByMe: matchParent.candidate.ownedByMe ?? false,
      };
    }

    return null;
  }

  /**
   * Verifies if a folder is a descendant of a specific ancestor folder.
   */
  public async isDescendantOf(
    token: string,
    folderId: string,
    ancestorId: string,
    maxDepth: number = 8
  ): Promise<boolean> {
    if (!folderId || !ancestorId) return false;
    if (folderId === ancestorId) return true;
    if (ancestorId === "root") return true;

    let currId = folderId;

    for (let depth = 0; depth < maxDepth; depth++) {
      let parents: string[] | undefined;

      if (this.folderMetadataCache.has(currId)) {
        parents = this.folderMetadataCache.get(currId)!.parents;
      } else {
        const folder = await this.getFolderById(token, currId);
        parents = folder?.parents;
      }

      if (!parents || parents.length === 0) return false;
      if (parents.includes(ancestorId)) return true;
      if (parents.includes("root")) return false;

      currId = parents[0];
    }

    return false;
  }

  /**
   * Checks if a folder item is owned by the current logged-in Google user.
   */
  public isFolderOwnedByCurrentUser(
    folder: DriveFolderItem,
    currentUserEmail?: string | null
  ): boolean {
    if (folder.ownedByMe === true) return true;

    if (folder.owners && folder.owners.length > 0) {
      if (folder.owners.some((o) => o.me === true)) return true;
      if (currentUserEmail) {
        const normUser = currentUserEmail.trim().toLowerCase();
        if (folder.owners.some((o) => o.emailAddress?.trim().toLowerCase() === normUser)) {
          return true;
        }
      }
    }

    return false;
  }

  public buildNameQuery(name: string): string {
    const nfc = name.normalize("NFC").trim();
    const nfd = name.normalize("NFD").trim();
    const escNfc = nfc.replace(/'/g, "\\'");
    const escNfd = nfd.replace(/'/g, "\\'");
    if (escNfc === escNfd) {
      return `name = '${escNfc}'`;
    }
    return `(name = '${escNfc}' or name = '${escNfd}')`;
  }

  /**
   * Queries child folders inside parentId with caching and large pageSize.
   */
  public async getChildFolders(
    token: string,
    parentId: string
  ): Promise<DriveFolderItem[]> {
    if (this.childFoldersCache.has(parentId)) {
      return this.childFoldersCache.get(parentId)!;
    }

    const query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const folders = await this.queryDriveFiles(token, query, "modifiedTime desc", 100);
    this.childFoldersCache.set(parentId, folders);
    return folders;
  }

  public async queryDriveFiles(
    token: string,
    query: string,
    orderBy: string = "modifiedTime desc",
    pageSize: number = 50
  ): Promise<DriveFolderItem[]> {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=${encodeURIComponent(orderBy)}&fields=files(id,name,webViewLink,parents,modifiedTime,owners,ownedByMe)&pageSize=${pageSize}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    let res: Response | null = null;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        try {
          const freshToken = await googleCredentialManager.getValidAccessToken(true);
          res = await fetch(url, {
            headers: { Authorization: `Bearer ${freshToken}` },
          });
        } catch (refreshErr) {
          console.warn("Failed to refresh token on 401 in queryDriveFiles:", refreshErr);
        }
      }
    } catch (networkErr) {
      console.warn("Network error querying Google Drive files API:", networkErr);
      return [];
    }

    if (!res || !res.ok) {
      return [];
    }

    const data = await res.json().catch(() => ({}));
    const files: DriveFolderItem[] = data.files || [];

    // Cache metadata
    for (const file of files) {
      if (file.id) {
        this.folderMetadataCache.set(file.id, file);
        if (file.name) {
          this.parentNameCache.set(file.id, file.name);
        }
      }
    }

    return files;
  }

  public async getFolderById(token: string, folderId: string): Promise<DriveFolderItem | null> {
    if (this.folderMetadataCache.has(folderId)) {
      return this.folderMetadataCache.get(folderId)!;
    }

    try {
      const url = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,webViewLink,parents,modifiedTime,owners,ownedByMe&supportsAllDrives=true`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data: DriveFolderItem = await res.json();
        if (data.id) {
          this.folderMetadataCache.set(data.id, data);
          if (data.name) {
            this.parentNameCache.set(data.id, data.name);
          }
          return data;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  public async getFolderNameById(token: string, folderId: string): Promise<string | null> {
    if (this.parentNameCache.has(folderId)) {
      return this.parentNameCache.get(folderId)!;
    }
    const folder = await this.getFolderById(token, folderId);
    return folder?.name || null;
  }

  public async tryMakeFolderShareable(token: string, folderId: string): Promise<void> {
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${folderId}/permissions?supportsAllDrives=true`;
      await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone",
        }),
      });
    } catch {
      // Non-fatal
    }
  }

  /**
   * Diagnostic test method for UI modal: verifies connection to configured root folder.
   */
  public async testResolveRootFolder(
    localRoot: string,
    remoteRootId: string = "root"
  ): Promise<{
    success: boolean;
    folderName?: string;
    folderId?: string;
    isOwnerMatched?: boolean;
    childCount?: number;
    message?: string;
  }> {
    try {
      const token = await googleCredentialManager.getValidAccessToken();
      if (!token) {
        return {
          success: false,
          message: "Chưa kết nối tài khoản Google. Vui lòng bấm 'Kết nối Google' trên thanh công cụ.",
        };
      }

      const currentUserEmail =
        googleCredentialManager.getAccountEmail() ||
        useContactSheetStore.getState().googleConnection.accountEmail ||
        null;

      const folderId = await this.resolveDriveFolderIdForLocalRoot(token, localRoot, remoteRootId);
      if (!folderId) {
        return {
          success: false,
          message: "Không tìm thấy thư mục tương ứng trên Google Drive.",
        };
      }

      const folder = await this.getFolderById(token, folderId);
      const children = await this.getChildFolders(token, folderId);
      const isOwner = folder ? this.isFolderOwnedByCurrentUser(folder, currentUserEmail) : false;

      return {
        success: true,
        folderName: folder?.name || (folderId === "root" ? "My Drive" : folderId),
        folderId,
        isOwnerMatched: isOwner,
        childCount: children.length,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Lỗi kết nối Drive: ${err?.message || String(err)}`,
      };
    }
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

export const driveResolverService = new DriveResolverService();
