import { useCallback } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CopyResult, ProgressEvent, CopyOptions } from "@/core/types";

export function useCopyOperation() {
  const matchResult = useAppStore((s) => s.matchResult);
  const outputMode = useAppStore((s) => s.outputMode);
  const outputFolder = useAppStore((s) => s.outputFolder);
  const inputFolders = useAppStore((s) => s.inputFolders);
  const setCopyResult = useAppStore((s) => s.setCopyResult);
  const setPhase = useAppStore((s) => s.setPhase);
  const setProgress = useAppStore((s) => s.setProgress);

  const handleCopy = useCallback(
    async (operation: "Copy" | "Move") => {
      if (!matchResult) return;
      if (outputMode === "Folder" && !outputFolder) {
        alert("Vui lòng chọn thư mục đầu ra.");
        return;
      }
      try {
        setPhase("copying");
        setProgress(null);
        
        const unlistenCopy = await listen<ProgressEvent>("copy-progress", (event) => {
          setProgress(event.payload);
        });
        
        const options: CopyOptions = {
          operation,
          output_mode: outputMode,
          output_folder: outputMode === "Folder" ? outputFolder : "",
          duplicate_policy: "CopyFirst",
          folder_structure: "Flat",
          prefix: null,
          suffix: null,
          input_folders: inputFolders,
        };
        
        const result = await invoke<CopyResult>("copy_files", {
          matches: matchResult.matches,
          options,
        });
        
        unlistenCopy();
        setCopyResult(result);
        setPhase("done");
        setProgress(null);
      } catch (error) {
        console.error("Copy error:", error);
        alert("Lỗi chép file: " + (typeof error === 'string' ? error : JSON.stringify(error)));
        setPhase("matched");
        setProgress(null);
      }
    },
    [matchResult, outputFolder, outputMode, inputFolders, setCopyResult, setPhase, setProgress]
  );

  const handleCancelCopy = useCallback(async () => {
    try {
      await invoke("cancel_copy");
      setPhase("idle");
      setProgress(null);
    } catch (error) {
      console.error("Cancel copy error:", error);
    }
  }, [setPhase, setProgress]);

  return { handleCopy, handleCancelCopy };
}
