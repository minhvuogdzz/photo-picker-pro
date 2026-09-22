import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/core/stores/useAppStore";
import type { CustomerFolderItem } from "@/core/types";

export class BatchFolderService {
  /**
   * Intelligently expands dropped or selected paths (e.g. Month folder, Day folders, Customer folders)
   * into individual Customer Folder items via Rust multi-threaded 2-level expansion.
   */
  public async expandAndIngestFolders(paths: string[]): Promise<CustomerFolderItem[]> {
    if (!paths || paths.length === 0) return [];

    try {
      // Call Rust 2-level parallel scanner
      const items = await invoke<CustomerFolderItem[]>("expand_batch_customer_folders", {
        paths,
      });

      if (items && items.length > 0) {
        // Natural sort by day and customer folder name
        const sorted = [...items].sort((a, b) => {
          if (a.day_name && b.day_name && a.day_name !== b.day_name) {
            return a.day_name.localeCompare(b.day_name, undefined, { numeric: true });
          }
          return a.folder_name.localeCompare(b.folder_name, undefined, { numeric: true });
        });

        useAppStore.getState().addBatchInputFolders(sorted);
        return sorted;
      }
    } catch (err) {
      console.warn("[BatchFolderService] Rust expansion failed, falling back to direct ingestion:", err);
    }

    // Fallback: ingest paths directly
    const fallbackItems: CustomerFolderItem[] = paths.map((p) => {
      const folderName = p.split(/[/\\]+/).filter(Boolean).pop() || p;
      return {
        folder_path: p,
        folder_name: folderName,
        image_count: 0,
      };
    });

    useAppStore.getState().addBatchInputFolders(fallbackItems);
    return fallbackItems;
  }
}

export const batchFolderService = new BatchFolderService();
