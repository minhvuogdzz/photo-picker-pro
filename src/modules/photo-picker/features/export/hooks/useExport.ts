import { useCallback } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

export function useExport() {
  const matchResult = useAppStore((s) => s.matchResult);

  const handleExport = useCallback(
    async (format: string) => {
      if (!matchResult) return;
      try {
        const extension = format === "csv" ? "csv" : format === "json" ? "json" : "txt";
        const path = await save({
          defaultPath: `photo_picker_report.${extension}`,
          filters: [
            {
              name: `${format.toUpperCase()} File`,
              extensions: [extension],
            },
          ],
        });
        
        if (path) {
          await invoke("export_log", {
            result: matchResult,
            format,
            outputPath: path,
          });
        }
      } catch (error) {
        console.error("Export error:", error);
      }
    },
    [matchResult]
  );

  return { handleExport };
}
