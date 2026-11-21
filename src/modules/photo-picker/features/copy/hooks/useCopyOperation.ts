import { useCallback } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CopyResult, ProgressEvent, CopyOptions } from "@/core/types";
import { sheetFilterAutomationService } from "@/modules/contact-the-sheet/services/sheetFilterAutomationService";
import { autoFindService } from "@/modules/photo-picker/services/autoFindService";
import { trText } from "../../../../../core/lib/i18n.ts";

export function useCopyOperation() {
  const matchResult = useAppStore((s) => s.matchResult);
  const outputMode = useAppStore((s) => s.outputMode);
  const outputFolder = useAppStore((s) => s.outputFolder);
  const selectedInputFolders = useAppStore((s) => s.selectedInputFolders);
  const inputFolders = useAppStore((s) => s.inputFolders);
  const setCopyResult = useAppStore((s) => s.setCopyResult);
  const setPhase = useAppStore((s) => s.setPhase);
  const setProgress = useAppStore((s) => s.setProgress);

  const handleCopy = useCallback(
    async (operation: "Copy" | "Move") => {
      if (!matchResult) return;
      if (outputMode === "Folder" && !outputFolder) {
        alert(trText("Vui lòng chọn thư mục đầu ra.", "Please select an output folder."));
        return;
      }

      const effectiveFolders = selectedInputFolders.length > 0 ? selectedInputFolders : inputFolders;
      let unlistenCopy: (() => void) | null = null;

      try {
        setPhase("copying");
        setProgress(null);
        
        unlistenCopy = await listen<ProgressEvent>("copy-progress", (event) => {
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
          input_folders: effectiveFolders,
        };
        
        const result = await invoke<CopyResult>("copy_files", {
          matches: matchResult.matches,
          options,
        });
        
        unlistenCopy();
        unlistenCopy = null;
        setCopyResult(result);
        setProgress(null);

        const store = useAppStore.getState();
        // Snapshot the finished customer's Sheet context BEFORE Auto Find overwrites it for the next customer
        const completedSheetCtx = store.sheetFilterContext;

        if (completedSheetCtx && (result.success_count > 0 || result.skipped_count > 0)) {
          autoFindService.updateCachedRowStatus(
            completedSheetCtx.spreadsheetId,
            completedSheetCtx.tabTitle,
            completedSheetCtx.matchedRow,
            completedSheetCtx.statusColumnLetter || "G",
            completedSheetCtx.statusValue || "Đã lọc"
          );
        }

        if (store.pickerMode === "multi" && effectiveFolders.length > 0) {
          const finishedFolder = effectiveFolders[0];
          const folderName =
            finishedFolder.split(/[/\\]+/).filter(Boolean).pop() || finishedFolder;

          // If either dontAskRemoveCompleted OR autoFindEnabled is true:
          // Immediately eject customer with crumple & toss animation from left queue!
          if (store.dontAskRemoveCompleted || store.autoFindEnabled) {
            // 1. Capture exact start position of finished customer in left queue before removing from DOM
            const activeEl =
              document.getElementById("active-customer-queue-item") ||
              document.querySelector(`[data-customer-folder="${finishedFolder}"]`) ||
              document.querySelector(`[data-folder-name="${folderName}"]`);
            const rect = activeEl?.getBoundingClientRect();
            const startPos = rect
              ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
              : undefined;

            // 2. Trigger toss animation & record to trash can
            store.triggerTossAnimation(folderName, startPos);
            store.addEjectedCustomer({
              folderPath: finishedFolder,
              folderName,
              copyCount: result.success_count,
            });

            // 3. Remove finished folder from queue
            store.removeInputFolder(finishedFolder);

            // 4. Reset phase to idle and clear previous customer's results so UI is fresh for next customer
            store.setPhase("idle");
            store.setCopyResult(null);
            store.setMatchResult(null);
            store.setRawCodeInput("");
            store.setParsedCodes([]);

            // 5. If Auto Find is ON:
            // Identify the newly active next customer and auto-extract their sheet codes immediately!
            if (store.autoFindEnabled) {
              const updatedStore = useAppStore.getState();
              const nextCustomerFolder =
                updatedStore.selectedInputFolders[0] || updatedStore.inputFolders[0];

              if (nextCustomerFolder) {
                const nextFolderName =
                  nextCustomerFolder.split(/[/\\]+/).filter(Boolean).pop() || nextCustomerFolder;

                void autoFindService.fetchAndApplyCodesForCustomer(nextCustomerFolder, nextFolderName);
              }
            }
          } else {
            setPhase("done");
            store.setCompletedCustomerPendingRemoval({
              folderPath: finishedFolder,
              folderName,
            });
          }
        } else {
          setPhase("done");
        }

        // Run Google Sheet status auto-update asynchronously in background (never blocks queue transition)
        sheetFilterAutomationService
          .updateStatusOnFilterComplete(effectiveFolders, result, completedSheetCtx)
          .then((updateRes) => {
            if (updateRes && updateRes.success && completedSheetCtx) {
              autoFindService.updateCachedRowStatus(
                completedSheetCtx.spreadsheetId,
                completedSheetCtx.tabTitle,
                completedSheetCtx.matchedRow,
                completedSheetCtx.statusColumnLetter || "G",
                completedSheetCtx.statusValue || "Đã lọc"
              );
            }
          })
          .catch((err) => {
            console.error("[useCopyOperation] Background status update error:", err);
          });
      } catch (error) {
        console.error("Copy error:", error);
        alert(trText("Lỗi chép file: ", "File copy error: ") + (typeof error === "string" ? error : JSON.stringify(error)));
        setPhase("matched");
        setProgress(null);
      } finally {
        if (unlistenCopy) unlistenCopy();
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
