import { invoke } from "@tauri-apps/api/core";
import type { PhotoFile } from "@/core/types";

// In-memory cache for thumbnails in the current session
const thumbnailMemoryCache = new Map<string, string>();

export const photoPreviewService = {
  /**
   * List all photo files in a folder
   */
  async listFolderPhotos(folderPath: string, recursive: boolean = false): Promise<PhotoFile[]> {
    try {
      const files = await invoke<PhotoFile[]>("list_folder_photos", {
        folderPath,
        recursive,
      });
      return files;
    } catch (error) {
      console.error("[photoPreviewService] listFolderPhotos failed:", error);
      throw error;
    }
  },

  /**
   * Get single thumbnail (data URL)
   */
  async getThumbnail(filePath: string, maxSize?: number): Promise<string> {
    const cacheKey = `${filePath}_${maxSize || 360}`;
    if (thumbnailMemoryCache.has(cacheKey)) {
      return thumbnailMemoryCache.get(cacheKey)!;
    }

    try {
      const dataUrl = await invoke<string>("get_photo_thumbnail", {
        filePath,
        maxSize,
      });
      thumbnailMemoryCache.set(cacheKey, dataUrl);
      return dataUrl;
    } catch (error) {
      console.error("[photoPreviewService] getThumbnail failed:", error);
      throw error;
    }
  },

  /**
   * Batch fetch thumbnails for visible images
   */
  async getThumbnailsBatch(
    filePaths: string[],
    maxSize: number = 320
  ): Promise<Record<string, string>> {
    const uncachedPaths: string[] = [];
    const results: Record<string, string> = {};

    for (const path of filePaths) {
      const cacheKey = `${path}_${maxSize}`;
      if (thumbnailMemoryCache.has(cacheKey)) {
        results[path] = thumbnailMemoryCache.get(cacheKey)!;
      } else {
        uncachedPaths.push(path);
      }
    }

    if (uncachedPaths.length === 0) {
      return results;
    }

    try {
      const batchResult = await invoke<Record<string, string>>("get_photo_thumbnails_batch", {
        filePaths: uncachedPaths,
        maxSize,
      });

      for (const [path, dataUrl] of Object.entries(batchResult)) {
        results[path] = dataUrl;
        thumbnailMemoryCache.set(`${path}_${maxSize}`, dataUrl);
      }

      return results;
    } catch (error) {
      console.error("[photoPreviewService] getThumbnailsBatch failed:", error);
      return results;
    }
  },

  /**
   * Clear cache
   */
  async clearCache(): Promise<number> {
    thumbnailMemoryCache.clear();
    try {
      const freed = await invoke<number>("clear_thumbnail_cache");
      return freed;
    } catch {
      return 0;
    }
  },

  /**
   * Copy selected rated photos to a destination directory
   */
  async copyPhotos(
    filePaths: string[],
    destinationFolder: string
  ): Promise<{ success_count: number; failed_count: number; errors: string[] }> {
    try {
      const result = await invoke<{
        success_count: number;
        failed_count: number;
        errors: string[];
      }>("copy_photo_files", {
        filePaths,
        destinationFolder,
      });
      return result;
    } catch (error) {
      console.error("[photoPreviewService] copyPhotos failed:", error);
      throw error;
    }
  },
};
