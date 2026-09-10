export interface FolderTopologyEntry {
  folder_path: string;
  folder_name: string;
  depth: number;
  finished_image_count: number;
  raw_image_count: number;
  subfolder_names: string[];
  representative_extensions: string[];
}

export interface ResolvedFinalFolder {
  folderPath: string;
  folderName: string;
  depth: number;
  imageCount: number;
  status: "READY" | "NEEDS_REVIEW" | "NO_FINISHED_IMAGES";
  reason?: string;
  competingCandidates?: string[];
}

export class FinalFolderResolver {
  /**
   * Resolves the deepest candidate folder that directly contains finished images.
   * Pure domain logic independent of native filesystem APIs.
   */
  public resolveDeepestDeliveryFolder(entries: FolderTopologyEntry[]): ResolvedFinalFolder {
    if (!entries || entries.length === 0) {
      return {
        folderPath: "",
        folderName: "",
        depth: 0,
        imageCount: 0,
        status: "NO_FINISHED_IMAGES",
        reason: "Không tìm thấy thư mục nào",
      };
    }

    // 1. Filter folders that directly contain finished images
    const finishedCandidates = entries.filter((e) => e.finished_image_count > 0);

    if (finishedCandidates.length === 0) {
      return {
        folderPath: entries[0].folder_path,
        folderName: entries[0].folder_name,
        depth: entries[0].depth,
        imageCount: 0,
        status: "NO_FINISHED_IMAGES",
        reason: "Thư mục không chứa ảnh thành phẩm (.jpg, .jpeg, .png, .tif, .webp)",
      };
    }

    // 2. Find maximum depth among finished candidates
    let maxDepth = -1;
    for (const c of finishedCandidates) {
      if (c.depth > maxDepth) {
        maxDepth = c.depth;
      }
    }

    const deepestAtMax = finishedCandidates.filter((c) => c.depth === maxDepth);

    // 3. If exactly one candidate exists at the deepest level, select it
    if (deepestAtMax.length === 1) {
      const best = deepestAtMax[0];
      return {
        folderPath: best.folder_path,
        folderName: best.folder_name,
        depth: best.depth,
        imageCount: best.finished_image_count,
        status: "READY",
      };
    }

    // 4. If multiple candidates exist at the deepest level, check for ambiguity
    // Filter out obvious non-final folders if keywords exist (e.g. prioritize "JPG", "Final", "Export")
    const priorityKeywords = ["final", "jpg", "jpeg", "export", "đã sửa", "tra anh", "trả ảnh"];
    const prioritized = deepestAtMax.filter((c) =>
      priorityKeywords.some((k) => c.folder_name.toLowerCase().includes(k))
    );

    if (prioritized.length === 1) {
      const best = prioritized[0];
      return {
        folderPath: best.folder_path,
        folderName: best.folder_name,
        depth: best.depth,
        imageCount: best.finished_image_count,
        status: "READY",
      };
    }

    // Ambiguity cannot be safely resolved without guessing -> mark NEEDS_REVIEW
    return {
      folderPath: deepestAtMax[0].folder_path,
      folderName: deepestAtMax[0].folder_name,
      depth: maxDepth,
      imageCount: deepestAtMax.reduce((acc, c) => acc + c.finished_image_count, 0),
      status: "NEEDS_REVIEW",
      reason: `Phát hiện ${deepestAtMax.length} thư mục con cùng chứa ảnh thành phẩm ở cùng độ sâu`,
      competingCandidates: deepestAtMax.map((c) => c.folder_path),
    };
  }
}

export const finalFolderResolver = new FinalFolderResolver();
