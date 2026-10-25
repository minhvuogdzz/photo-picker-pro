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
  private leafFolderCache = new Map<string, boolean>();
  // In-flight requests, so concurrent jobs share one Drive call instead of repeating it
  private inflight = new Map<string, Promise<any>>();

  private dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;
    const p = fn().finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  public clearCache(): void {
    this.leafFolderCache.clear();
    this.inflight.clear();
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

        if (walkedMatch && (await this.confirmOwnership(token, walkedMatch.id, currentUserEmail, requireOwnerMatch))) {
          const shareLink = `https://drive.google.com/drive/folders/${walkedMatch.id}?usp=sharing`;
          this.tryMakeFolderShareable(token, walkedMatch.id).catch(() => {});

          return {
            driveItemId: walkedMatch.id,
            driveWebLink: shareLink,
            relativePath: targetFolderName,
            isAccessible: true,
            resolvedPath: localFolderPath,
            isOwnerMatched: true,
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

      if (driveMatch && (await this.confirmOwnership(token, driveMatch.id, currentUserEmail, requireOwnerMatch))) {
        const shareLink = `https://drive.google.com/drive/folders/${driveMatch.id}?usp=sharing`;
        this.tryMakeFolderShareable(token, driveMatch.id).catch(() => {});

        return {
          driveItemId: driveMatch.id,
          driveWebLink: shareLink,
          relativePath: targetFolderName,
          isAccessible: true,
          resolvedPath: localFolderPath,
          isOwnerMatched: true,
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
    return this.dedupe(`root:${cacheKey}`, () =>
      this.resolveDriveFolderIdForLocalRootUncached(token, localRoot, fallbackRemoteId, cacheKey)
    );
  }

  private async resolveDriveFolderIdForLocalRootUncached(
    token: string,
    localRoot: string,
    fallbackRemoteId: string,
    cacheKey: string
  ): Promise<string> {
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
      const sameNameChildren = nonRawChildren.filter((c) => areFolderNamesEqual(c.name, seg));
      let nextChild: DriveFolderItem | undefined =
        (requireOwnerMatch ?? true)
          ? sameNameChildren.find((c) => this.isFolderOwnedByCurrentUser(c, currentUserEmail)) || sameNameChildren[0]
          : sameNameChildren[0];

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

    // Resolve to a leaf folder (no sub-folders, contains files): the matched folder itself
    // or one of its immediate children (exact name / delivery keywords first)
    const candidate = await this.pickLeafDeliveryFolder(
      token,
      lastMatchedFolder,
      targetFolderName,
      currentUserEmail,
      requireOwnerMatch ?? true
    );
    if (!candidate) {
      return null;
    }

    return {
      id: candidate.id,
      name: candidate.name,
      ownedByMe: this.isFolderOwnedByCurrentUser(candidate, currentUserEmail),
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

        // Pick a leaf folder inside (or equal to) this job folder; otherwise try the next older job folder
        const leaf = await this.pickLeafDeliveryFolder(token, jobFolder, cleanTargetName, currentUserEmail, requireOwnerMatch ?? true);
        if (leaf) {
          return {
            id: leaf.id,
            name: leaf.name,
            webViewLink: leaf.webViewLink,
            ownedByMe: leaf.ownedByMe ?? this.isFolderOwnedByCurrentUser(leaf, currentUserEmail),
          };
        }
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

      // Only leaf folders (no sub-folders, contains files) owned by the connected account are delivery folders
      if (!(await this.isEligibleDeliveryFolder(token, c, currentUserEmail, requireOwnerMatch ?? true))) continue;

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

        const leaf = await this.pickLeafDeliveryFolder(token, custFolder, cleanTargetName, currentUserEmail, requireOwnerMatch ?? true);
        if (leaf) {
          return {
            id: leaf.id,
            name: leaf.name,
            webViewLink: leaf.webViewLink,
            ownedByMe: leaf.ownedByMe ?? this.isFolderOwnedByCurrentUser(leaf, currentUserEmail),
          };
        }
      }
    }

    return null;
  }

  /**
   * Picks the delivery folder for a container (job / customer / matched folder).
   * Only a leaf folder qualifies: it has no sub-folders and contains at least one file.
   * Order: the container itself, then immediate children by exact target name,
   * delivery keywords, then the rest (latest modified first). Raw folders are skipped.
   * Every returned folder is a leaf with files AND owned by the connected account.
   */
  public async pickLeafDeliveryFolder(
    token: string,
    container: DriveFolderItem,
    targetFolderName?: string,
    currentUserEmail?: string | null,
    requireOwnerMatch: boolean = true
  ): Promise<DriveFolderItem | null> {
    if (await this.isEligibleDeliveryFolder(token, container, currentUserEmail, requireOwnerMatch)) {
      return container;
    }

    const children = await this.getChildFolders(token, container.id);
    const validChildren = children.filter((c) => !isRawFolder(c.name));
    const ordered = [
      ...validChildren.filter((c) => targetFolderName && areFolderNamesEqual(c.name, targetFolderName)),
      ...validChildren.filter((c) => isDeliveryFolder(c.name)),
      ...validChildren,
    ].filter((c, idx, arr) => arr.findIndex((x) => x.id === c.id) === idx);

    for (const child of ordered) {
      if (await this.isEligibleDeliveryFolder(token, child, currentUserEmail, requireOwnerMatch)) {
        return child;
      }
    }

    return null;
  }

  /**
   * Last line of defence before a link is returned: re-reads the folder straight from Drive
   * (bypassing every cache, which could hold data from another account or an earlier scan)
   * and checks it is still owned by the connected account. Skipped only when the owner check is off.
   */
  private async confirmOwnership(
    token: string,
    folderId: string,
    currentUserEmail: string | null | undefined,
    requireOwnerMatch: boolean
  ): Promise<boolean> {
    if (!requireOwnerMatch) return true;
    const fresh = await this.getFolderById(token, folderId, true);
    if (!fresh || !this.isFolderOwnedByCurrentUser(fresh, currentUserEmail)) {
      console.warn(`[DriveResolver] Rejected folder ${folderId}: not owned by the connected Google account.`);
      return false;
    }
    return true;
  }

  /**
   * A folder may receive the link only if ALL hold: it has no sub-folders, it contains at least
   * one file, and it is owned by the Google account connected to the sheet.
   * (The "latest modified" condition comes from the Drive query order, newest first.)
   */
  public async isEligibleDeliveryFolder(
    token: string,
    folder: DriveFolderItem,
    currentUserEmail?: string | null,
    requireOwnerMatch: boolean = true
  ): Promise<boolean> {
    if (requireOwnerMatch && !this.isFolderOwnedByCurrentUser(folder, currentUserEmail)) return false;
    return this.isLeafFolderWithFiles(token, folder.id);
  }

  /**
   * Returns true when the folder has no sub-folders and contains at least one file.
   */
  public async isLeafFolderWithFiles(token: string, folderId: string): Promise<boolean> {
    if (this.leafFolderCache.has(folderId)) {
      return this.leafFolderCache.get(folderId)!;
    }

    return this.dedupe(`leaf:${folderId}`, async () => {
      const subFolders = await this.getChildFolders(token, folderId);
      let isLeaf = false;
      if (subFolders.length === 0) {
        const fileQuery = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
        const files = await this.queryDriveFiles(token, fileQuery, "modifiedTime desc", 1);
        isLeaf = files.length > 0;
      }

      this.leafFolderCache.set(folderId, isLeaf);
      return isLeaf;
    });
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

    return this.dedupe(`children:${parentId}`, async () => {
      const query = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const folders = await this.queryDriveFiles(token, query, "modifiedTime desc", 100);
      this.childFoldersCache.set(parentId, folders);
      return folders;
    });
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

  public async getFolderById(
    token: string,
    folderId: string,
    forceFresh: boolean = false
  ): Promise<DriveFolderItem | null> {
    if (!forceFresh && this.folderMetadataCache.has(folderId)) {
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
