import { googleCredentialManager } from "./googleCredentialBridge.ts";

export interface DriveResolutionResult {
  driveItemId: string;
  driveWebLink: string;
  relativePath: string;
  isAccessible: boolean;
  warnings?: string[];
}

export interface DriveResolutionOptions {
  finalFolderName?: string;
  jobFolderName?: string;
  customerName?: string;
}

export class DriveResolverService {
  private parentNameCache = new Map<string, string>();

  /**
   * Resolves a local or cloud folder to a shareable Google Drive folder link.
   * 
   * As required:
   * 1. Searches Google Drive API for the finished folder by name (e.g. "File hoàn thiện" or final folder).
   * 2. Orders results by latest modified time (modifiedTime desc) to pick the latest edited folder.
   * 3. Correlates parent folder metadata with the job folder or customer name if multiple folders match.
   * 4. Copies and formats the direct shareable folder link (https://drive.google.com/drive/folders/{folderId}?usp=sharing).
   * 5. NEVER falls back to search query URLs (https://drive.google.com/drive/search?q=...).
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

    // 3. Search Google Drive for the finished delivery folder
    try {
      const driveMatch = await this.searchDriveForDeliveryFolder(
        token,
        targetFolderName,
        jobFolderName,
        customerName
      );

      if (driveMatch) {
        const shareLink = `https://drive.google.com/drive/folders/${driveMatch.id}?usp=sharing`;

        // Attempt silent share permission in background (non-blocking)
        this.tryMakeFolderShareable(token, driveMatch.id).catch(() => {});

        return {
          driveItemId: driveMatch.id,
          driveWebLink: shareLink,
          relativePath: targetFolderName,
          isAccessible: true,
        };
      }
    } catch (searchErr) {
      console.warn("Error searching Drive for delivery folder:", searchErr);
    }

    // 4. If not found on Drive, return empty link with informative warning (NEVER a search URL)
    return {
      driveItemId: "",
      driveWebLink: "",
      relativePath: targetFolderName,
      isAccessible: false,
      warnings: [
        `Không tìm thấy thư mục "${targetFolderName}" trên Google Drive (đã tìm kiếm theo thời điểm chỉnh sửa mới nhất). Vui lòng kiểm tra lại đồng bộ Drive.`,
      ],
    };
  }

  /**
   * Multi-tiered search on Google Drive:
   * 1. If jobFolderName exists, locate job folder on Drive and look for finalFolderName / delivery subfolders inside it.
   * 2. Otherwise, search directly by finalFolderName ordered by modifiedTime desc (latest modified first).
   * 3. If multiple candidates exist, verify against parent folder name matching jobFolderName or customerName.
   * 4. If targetFolderName still not found, search by customerName and inspect child folders.
   */
  public async searchDriveForDeliveryFolder(
    token: string,
    targetFolderName: string,
    jobFolderName?: string,
    customerName?: string
  ): Promise<{ id: string; name: string; webViewLink?: string } | null> {
    // Strategy A: If jobFolderName is provided and differs from targetFolderName,
    // locate the job folder on Drive first, then check its children for the final folder
    if (jobFolderName && jobFolderName.toLowerCase() !== targetFolderName.toLowerCase()) {
      const jobNameCond = this.buildNameQuery(jobFolderName);
      const jobQuery = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${jobNameCond}`;
      const jobFolders = await this.queryDriveFiles(token, jobQuery, "modifiedTime desc", 5);

      for (const jobFolder of jobFolders) {
        // Query child folders inside this job folder
        const childQuery = `'${jobFolder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const children = await this.queryDriveFiles(token, childQuery, "modifiedTime desc", 20);

        if (children.length > 0) {
          // Check for exact targetFolderName match
          const exactChild = children.find(
            (c) => c.name.normalize("NFC").trim().toLowerCase() === targetFolderName.toLowerCase()
          );
          if (exactChild) return exactChild;

          // Check for finished keywords: "hoàn thiện", "thành phẩm", "final", "xong", "jpg"
          const keywords = ["hoàn thiện", "hoan thien", "thành phẩm", "thanh pham", "final", "xong", "jpg"];
          const keywordChild = children.find((c) =>
            keywords.some((kw) => c.name.normalize("NFC").trim().toLowerCase().includes(kw))
          );
          if (keywordChild) return keywordChild;

          // If child folders exist but none match keywords, use latest modified child
          return children[0];
        }

        // If no child folders exist in job folder, the job folder itself is the output folder
        return jobFolder;
      }
    }

    // Strategy B: Search Drive directly by targetFolderName, ordered by modifiedTime desc (latest modified first)
    const targetNameCond = this.buildNameQuery(targetFolderName);
    const targetQuery = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${targetNameCond}`;
    const candidates = await this.queryDriveFiles(token, targetQuery, "modifiedTime desc", 20);

    if (candidates.length > 0) {
      if (candidates.length === 1 || (!jobFolderName && !customerName)) {
        return candidates[0];
      }

      // If multiple candidates exist, check parent folders to match jobFolderName or customerName
      const parentChecks = await Promise.all(
        candidates.slice(0, 10).map(async (c) => {
          if (!c.parents || c.parents.length === 0) return { candidate: c, parentName: "" };
          const parentName = await this.getFolderNameById(token, c.parents[0]);
          return { candidate: c, parentName: parentName || "" };
        })
      );

      // Match against jobFolderName or customerName
      const matchParent = parentChecks.find(({ parentName }) => {
        if (!parentName) return false;
        const normParent = parentName.normalize("NFC").trim().toLowerCase();
        if (jobFolderName && normParent.includes(jobFolderName.toLowerCase())) return true;
        if (customerName && normParent.includes(customerName.toLowerCase())) return true;
        return false;
      });

      if (matchParent) {
        return matchParent.candidate;
      }

      // If parent check doesn't identify a specific parent, pick candidates[0] (latest modified time)
      return candidates[0];
    }

    // Strategy C: If targetFolderName was not found, search by customerName if available
    if (customerName) {
      const custNameCond = this.buildNameQuery(customerName);
      const custQuery = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and ${custNameCond}`;
      const custFolders = await this.queryDriveFiles(token, custQuery, "modifiedTime desc", 5);

      if (custFolders.length > 0) {
        // Check if customer folder has child folders
        const childQuery = `'${custFolders[0].id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const children = await this.queryDriveFiles(token, childQuery, "modifiedTime desc", 10);
        if (children.length > 0) {
          const exactChild = children.find(
            (c) => c.name.normalize("NFC").trim().toLowerCase() === targetFolderName.toLowerCase()
          );
          if (exactChild) return exactChild;
          return children[0];
        }
        return custFolders[0];
      }
    }

    return null;
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

  public async queryDriveFiles(
    token: string,
    query: string,
    orderBy: string = "modifiedTime desc",
    pageSize: number = 20
  ): Promise<Array<{ id: string; name: string; webViewLink?: string; parents?: string[]; modifiedTime?: string }>> {
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=${encodeURIComponent(orderBy)}&fields=files(id,name,webViewLink,parents,modifiedTime)&pageSize=${pageSize}&supportsAllDrives=true&includeItemsFromAllDrives=true`;

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
    return data.files || [];
  }

  public async getFolderNameById(token: string, folderId: string): Promise<string | null> {
    if (this.parentNameCache.has(folderId)) {
      return this.parentNameCache.get(folderId)!;
    }
    try {
      const url = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name&supportsAllDrives=true`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.name) {
          this.parentNameCache.set(folderId, data.name);
          return data.name;
        }
      }
    } catch {
      // ignore
    }
    return null;
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
      // Non-fatal: user's OAuth scope might be read-only or folder already shared
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
