import { invoke } from "@tauri-apps/api/core";
import type {
  DiscoveredJob,
  WorkspaceProfile,
  ParsedJobMetadata,
} from "../types/index.ts";
import { finalFolderResolver, FolderTopologyEntry } from "./finalFolderResolver.ts";
import { folderParserService } from "./folderParserService.ts";
import { driveResolverService } from "./driveResolverService.ts";
import { jobMatchingService, SheetRowRecord } from "./jobMatchingService.ts";
import folderTreesFixture from "../../../../tests/fixtures/contact-the-sheet/folder-trees.json" with { type: "json" };

export class FolderScannerService {
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
    for (const rootPath of rootPaths) {
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

      // Group folders by top-level child of root
      // depth 0 is root itself; depth 1 are individual job folders
      const jobRootEntries = topology.filter((e) => e.depth === 1);

      if (jobRootEntries.length === 0) {
        // Root path itself is the single job folder
        const resolved = finalFolderResolver.resolveDeepestDeliveryFolder(topology);
        const rootName = topology[0].folder_name;
        const rootMetadata = folderParserService.parseFolderName(rootName);
        const deepestMetadata = folderParserService.parseFolderName(resolved.folderName);

        const combinedCandidates = Array.from(
          new Set([
            ...(rootMetadata.candidateNames || []),
            ...(deepestMetadata.candidateNames || []),
            rootMetadata.customerName,
            deepestMetadata.customerName,
          ].filter(Boolean) as string[])
        );

        const metadata: ParsedJobMetadata = {
          ...rootMetadata,
          customerName: deepestMetadata.customerName || rootMetadata.customerName,
          socialUsername: deepestMetadata.socialUsername || rootMetadata.socialUsername,
          candidateNames: combinedCandidates,
        };

        let driveResult: any = { driveItemId: "", driveWebLink: "" };
        try {
          driveResult = await driveResolverService.resolveLocalFolderToDriveLink(
            resolved.folderPath,
            profile.driveConfig.localRootPath,
            profile.driveConfig.remoteRootDriveId,
            false,
            {
              finalFolderName: resolved.folderName,
              jobFolderName: rootName,
              customerName: metadata.customerName,
            }
          );
        } catch (err: any) {
          console.warn("Drive resolution warning for single job", resolved.folderPath, err);
        }

        if (!driveResult?.driveWebLink) {
          driveResult = {
            driveItemId: driveResult?.driveItemId || "",
            driveWebLink: "",
            warnings: driveResult?.warnings || [`Chưa tìm thấy liên kết thư mục trên Google Drive`],
          };
        }

        const job: DiscoveredJob = {
          id: `job_single_${Date.now()}`,
          sourceType: "LOCAL_DRIVE_DESKTOP",
          jobFolderName: rootName,
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
      } else {
        // Multiple jobs under parent folder (e.g. "10-9/job1", "10-9/job2", ...)
        for (const jobRoot of jobRootEntries) {
          const jobSubtree = topology.filter(
            (e) => e.folder_path === jobRoot.folder_path || e.folder_path.startsWith(jobRoot.folder_path + "/")
          );

          const resolved = finalFolderResolver.resolveDeepestDeliveryFolder(jobSubtree);
          const rootMetadata = folderParserService.parseFolderName(jobRoot.folder_name);
          const deepestMetadata = folderParserService.parseFolderName(resolved.folderName);

          const combinedCandidates = Array.from(
            new Set([
              ...(rootMetadata.candidateNames || []),
              ...(deepestMetadata.candidateNames || []),
              rootMetadata.customerName,
              deepestMetadata.customerName,
            ].filter(Boolean) as string[])
          );

          const metadata: ParsedJobMetadata = {
            ...rootMetadata,
            customerName: deepestMetadata.customerName || rootMetadata.customerName,
            socialUsername: deepestMetadata.socialUsername || rootMetadata.socialUsername,
            candidateNames: combinedCandidates,
          };

          let driveResult: any = { driveItemId: "", driveWebLink: "" };
          try {
            driveResult = await driveResolverService.resolveLocalFolderToDriveLink(
              resolved.folderPath,
              profile.driveConfig.localRootPath,
              profile.driveConfig.remoteRootDriveId,
              false,
              {
                finalFolderName: resolved.folderName,
                jobFolderName: jobRoot.folder_name,
                customerName: metadata.customerName,
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
            id: `job_${jobRoot.folder_name}_${Date.now()}`,
            sourceType: "LOCAL_DRIVE_DESKTOP",
            jobFolderName: jobRoot.folder_name,
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
      }
    }

    return discoveredJobs;
  }
}

export const folderScannerService = new FolderScannerService();
