import { invoke } from "@tauri-apps/api/core";
import type {
  DiscoveredJob,
  WorkspaceProfile,
  ParsedJobMetadata,
} from "../types/index.ts";
import { finalFolderResolver, type FolderTopologyEntry } from "./finalFolderResolver.ts";
import { folderParserService } from "./folderParserService.ts";
import { driveResolverService } from "./driveResolverService.ts";
import { jobMatchingService, type SheetRowRecord } from "./jobMatchingService.ts";
import { useContactSheetStore } from "../stores/useContactSheetStore.ts";
import folderTreesFixture from "../../../../tests/fixtures/contact-the-sheet/folder-trees.json" with { type: "json" };

/** Max jobs whose Drive lookup runs at the same time (keeps clear of Drive API rate limits). */
const DRIVE_RESOLVE_CONCURRENCY = 5;

export class FolderScannerService {
  /**
   * Intelligently resolves input folder paths according to studio workflow:
   * - If a path contains > 1 direct non-hidden subfolders, expands to all those subfolders.
   * - If a path contains <= 1 direct subfolder (or 0), keeps the path itself as the starting point.
   */
  public async resolveSmartInputFolders(paths: string[]): Promise<string[]> {
    if (!paths || paths.length === 0) return [];
    try {
      const resolved = await invoke<string[]>("resolve_smart_input_folders", { paths });
      if (Array.isArray(resolved) && resolved.length > 0) {
        return resolved;
      }
    } catch (err) {
      console.warn("Native resolve_smart_input_folders not available, using original paths:", err);
    }
    return paths;
  }

  /**
   * Scans a parent dropped directory or selected paths, discovering jobs and resolving deepest folders.
   */
  public async scanAndDiscoverJobs(
    rootPaths: string[],
    profile: WorkspaceProfile,
    sheetRows: SheetRowRecord[] = [],
    isMock: boolean = false,
    onProgress?: (msg: string) => void
  ): Promise<DiscoveredJob[]> {
    const discoveredJobs: DiscoveredJob[] = [];

    // 1. In Mock Mode, use deterministic fixture
    if (isMock || profile.isMockSandbox) {
      if (onProgress) onProgress("Đang nạp dữ liệu mẫu Sandbox...");
      const fixtureCases = folderTreesFixture as any[];

      for (let idx = 0; idx < fixtureCases.length; idx++) {
        const c = fixtureCases[idx];
        const topology: FolderTopologyEntry[] = c.topology;
        const resolved = finalFolderResolver.resolveDeepestDeliveryFolder(topology);
        const metadata = folderParserService.parseFolderName(topology[1]?.folder_name || c.name);

        const driveResult = await driveResolverService.resolveLocalFolderToDriveLink(
          resolved.folderPath,
          "",
          "root",
          true,
          {
            finalFolderName: resolved.folderName,
            jobFolderName: topology[1]?.folder_name || c.name,
            customerName: metadata.customerName,
          }
        );

        const job: DiscoveredJob = {
          id: `job_${idx}_${Date.now()}`,
          sourceType: "LOCAL_DRIVE_DESKTOP",
          jobFolderName: topology[1]?.folder_name || c.name,
          finalFolderName: resolved.folderName,
          finalFolderPath: resolved.folderPath,
          driveItemId: driveResult.driveItemId,
          driveWebLink: driveResult.driveWebLink,
          metadata,
          imageCount: resolved.imageCount,
          status: resolved.status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "PENDING",
          statusReason: resolved.reason,
        };

        // Match against sheet rows if available
        if (sheetRows.length > 0) {
          const match = jobMatchingService.matchJobToSheetRows(job, sheetRows, profile);
          job.targetSheetRow = match.targetRow;
          job.targetTabTitle = match.targetTabTitle;
          job.targetRowSnapshot = match.targetSnapshot;
          job.matchConfidence = match.confidence;
          if (match.status === "NEEDS_REVIEW") {
            job.status = "NEEDS_REVIEW";
            job.statusReason = match.reason;
            job.candidateRows = match.candidateRows;
          } else if (match.status === "READY") {
            job.status = "READY";
          }
        }

        discoveredJobs.push(job);
      }

      return discoveredJobs;
    }

    // 2. Live Mode: Native Rust walkdir topology scan
    // Fresh scan: drop cached Drive data (may belong to another account or an older folder state)
    driveResolverService.clearCache();
    // Phase 1: scan topology and collect one work item per job (local, fast)
    interface LiveJobItem {
      id: string;
      jobFolderName: string;
      resolved: ReturnType<typeof finalFolderResolver.resolveDeepestDeliveryFolder>;
      metadata: ParsedJobMetadata;
    }
    const items: LiveJobItem[] = [];
    const buildMetadata = (rootName: string, resolvedName: string): ParsedJobMetadata => {
      const rootMetadata = folderParserService.parseFolderName(rootName);
      const deepestMetadata = folderParserService.parseFolderName(resolvedName);
      const combinedCandidates = Array.from(
        new Set([
          ...(rootMetadata.candidateNames || []),
          ...(deepestMetadata.candidateNames || []),
          rootMetadata.customerName,
          deepestMetadata.customerName,
        ].filter(Boolean) as string[])
      );
      return {
        ...rootMetadata,
        customerName: deepestMetadata.customerName || rootMetadata.customerName,
        socialUsername: deepestMetadata.socialUsername || rootMetadata.socialUsername,
        candidateNames: combinedCandidates,
      };
    };

    const expandedRootPaths = await this.resolveSmartInputFolders(rootPaths);
    for (const rootPath of expandedRootPaths) {
      if (onProgress) onProgress(`Đang quét cấu trúc thư mục: ${rootPath}...`);

      let topology: FolderTopologyEntry[] = [];
      try {
        topology = await invoke<FolderTopologyEntry[]>("scan_folder_topology", {
          rootPath,
          maxDepth: 10,
        });
      } catch (err) {
        console.error("Native folder topology scan failed:", err);
        throw new Error(`Lỗi quét thư mục: ${err}`);
      }

      if (topology.length === 0) continue;

      // depth 0 is root itself; depth 1 are individual job folders
      const jobRootEntries = topology.filter((e) => e.depth === 1);

      // If the folder has <= 1 child (e.g. single customer folder with 0 or 1 subfolder like JPG/Chưa sửa),
      // the root path itself is the single job folder.
      // If the folder contains > 1 child folders, each child folder represents an individual job.
      if (jobRootEntries.length <= 1) {
        const resolved = finalFolderResolver.resolveDeepestDeliveryFolder(topology);
        const rootName = topology[0].folder_name;
        items.push({
          id: `job_single_${items.length}_${Date.now()}`,
          jobFolderName: rootName,
          resolved,
          metadata: buildMetadata(rootName, resolved.folderName),
        });
      } else {
        for (const jobRoot of jobRootEntries) {
          const jobSubtree = topology.filter(
            (e) => e.folder_path === jobRoot.folder_path || e.folder_path.startsWith(jobRoot.folder_path + "/")
          );
          const resolved = finalFolderResolver.resolveDeepestDeliveryFolder(jobSubtree);
          items.push({
            id: `job_${jobRoot.folder_name}_${items.length}_${Date.now()}`,
            jobFolderName: jobRoot.folder_name,
            resolved,
            metadata: buildMetadata(jobRoot.folder_name, resolved.folderName),
          });
        }
      }
    }

    // Phase 2: resolve Drive links + match sheet rows, several jobs at a time
    const effectiveDriveConfig =
      profile?.driveConfig?.localRootPath
        ? profile.driveConfig
        : useContactSheetStore?.getState?.()?.lastDriveConfig || profile?.driveConfig;
    const localRootPath = effectiveDriveConfig?.localRootPath || "";
    const remoteRootDriveId = effectiveDriveConfig?.remoteRootDriveId || "root";
    const requireOwnerMatch = effectiveDriveConfig?.requireOwnerMatch ?? true;
    const currentUserEmail =
      profile.googleAccountEmail ||
      useContactSheetStore?.getState?.()?.googleConnection?.accountEmail;

    let doneCount = 0;
    const processItem = async (item: LiveJobItem): Promise<DiscoveredJob> => {
      const { resolved, metadata } = item;

      let driveResult: any = { driveItemId: "", driveWebLink: "" };
      try {
        driveResult = await driveResolverService.resolveLocalFolderToDriveLink(
          resolved.folderPath,
          localRootPath,
          remoteRootDriveId,
          false,
          {
            finalFolderName: resolved.folderName,
            jobFolderName: item.jobFolderName,
            customerName: metadata.customerName,
            requireOwnerMatch,
            currentUserEmail,
          }
        );
      } catch (err: any) {
        console.warn("Drive resolution warning for", resolved.folderPath, err);
      }

      if (!driveResult?.driveWebLink) {
        driveResult = {
          driveItemId: driveResult?.driveItemId || "",
          driveWebLink: "",
          warnings: driveResult?.warnings || [`Chưa tìm thấy liên kết thư mục trên Google Drive`],
        };
      }

      const job: DiscoveredJob = {
        id: item.id,
        sourceType: "LOCAL_DRIVE_DESKTOP",
        jobFolderName: item.jobFolderName,
        finalFolderName: resolved.folderName,
        finalFolderPath: resolved.folderPath,
        driveItemId: driveResult.driveItemId,
        driveWebLink: driveResult.driveWebLink,
        metadata,
        imageCount: resolved.imageCount,
        status: resolved.status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "PENDING",
        statusReason: resolved.reason,
      };

      if (sheetRows.length > 0) {
        const match = jobMatchingService.matchJobToSheetRows(job, sheetRows, profile);
        job.targetSheetRow = match.targetRow;
        job.targetTabTitle = match.targetTabTitle;
        job.targetRowSnapshot = match.targetSnapshot;
        job.matchConfidence = match.confidence;
        if (match.status === "NEEDS_REVIEW") {
          job.status = "NEEDS_REVIEW";
          job.statusReason = match.reason;
          job.candidateRows = match.candidateRows;
        } else if (match.status === "READY") {
          job.status = "READY";
        }
      }

      doneCount++;
      if (onProgress) onProgress(`Đang tra cứu Google Drive & so khớp (${doneCount}/${items.length})...`);
      return job;
    };

    const results = new Array<DiscoveredJob>(items.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        results[idx] = await processItem(items[idx]);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(DRIVE_RESOLVE_CONCURRENCY, items.length) }, () => worker())
    );
    discoveredJobs.push(...results);

    return discoveredJobs;
  }
}

export const folderScannerService = new FolderScannerService();
