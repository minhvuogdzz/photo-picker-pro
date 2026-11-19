import { useCallback } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CustomerCode, ScanResult, MatchResult, ProgressEvent, PhotoFile } from "@/core/types";

export function buildScanSignature(paths: string[], options: unknown): string {
  return JSON.stringify({ paths, options });
}

export function useScanAndMatch() {
  const setScannedFiles = useAppStore((s) => s.setScannedFiles);
  const setLastScanSignature = useAppStore((s) => s.setLastScanSignature);
  const setMatchResult = useAppStore((s) => s.setMatchResult);
  const setCopyResult = useAppStore((s) => s.setCopyResult);
  const setParsedCodes = useAppStore((s) => s.setParsedCodes);
  const setPhase = useAppStore((s) => s.setPhase);
  const setProgress = useAppStore((s) => s.setProgress);

  const handleScanAndMatch = useCallback(async () => {
    const state = useAppStore.getState();
    const effectiveFolders =
      state.selectedInputFolders.length > 0 ? state.selectedInputFolders : state.inputFolders;

    if (effectiveFolders.length === 0) {
      alert("Vui lòng chọn ít nhất 1 thư mục đầu vào!");
      return;
    }

    let unlistenScan: (() => void) | null = null;
    let unlistenMatch: (() => void) | null = null;

    try {
      setCopyResult(null);

      // 1. Always parse the live rawCodeInput immediately so editing a code and clicking "Quét file"
      // never suffers from debounce lag or stale closure state.
      const currentRawInput = useAppStore.getState().rawCodeInput;
      let activeCodes: CustomerCode[] = [];
      if (currentRawInput.trim()) {
        activeCodes = await invoke<CustomerCode[]>("parse_customer_codes", {
          input: currentRawInput,
        });
        setParsedCodes(activeCodes);
      } else {
        setParsedCodes([]);
      }

      const currentState = useAppStore.getState();
      const scanOptions = currentState.scanOptions;
      const matchMode = currentState.matchMode;
      const regexPattern = currentState.regexPattern;
      const currentSignature = buildScanSignature(effectiveFolders, scanOptions);

      let filesToMatch: PhotoFile[] = currentState.scannedFiles;
      const canReuseCachedScan =
        currentState.lastScanSignature === currentSignature && filesToMatch.length > 0;

      // 2. If this folder + scanOptions was not scanned yet, scan it now.
      // If it was already scanned (e.g. user edited a code in the box and clicked "Quét file"),
      // reuse the in-memory scannedFiles for instant (<1ms) matching!
      if (!canReuseCachedScan) {
        setMatchResult(null);
        setScannedFiles([]);
        setPhase("scanning");
        setProgress(null);

        unlistenScan = await listen<ProgressEvent>("scan-progress", (event) => {
          setProgress(event.payload);
        });

        const scanResult = await invoke<ScanResult>("scan_folders", {
          paths: effectiveFolders,
          options: scanOptions,
        });

        unlistenScan();
        unlistenScan = null;

        filesToMatch = [...scanResult.files];
        setScannedFiles(filesToMatch);
        setLastScanSignature(currentSignature);
      }

      // Re-check live rawCodeInput in case the user edited codes while the folder was scanning
      const latestRawInput = useAppStore.getState().rawCodeInput;
      if (latestRawInput !== currentRawInput) {
        if (latestRawInput.trim()) {
          activeCodes = await invoke<CustomerCode[]>("parse_customer_codes", {
            input: latestRawInput,
          });
          setParsedCodes(activeCodes);
        } else {
          activeCodes = [];
          setParsedCodes([]);
        }
      }

      if (activeCodes.length > 0) {
        setPhase("matching");

        unlistenMatch = await listen<ProgressEvent>("match-progress", (event) => {
          setProgress(event.payload);
        });

        let result = await invoke<MatchResult>("match_photos", {
          codes: activeCodes,
          files: filesToMatch,
          mode: matchMode,
          regexPattern: matchMode === "Regex" ? regexPattern : null,
          folderCount: effectiveFolders.length,
        });

        unlistenMatch();
        unlistenMatch = null;

        // If we reused a cached scan and some codes are still missing, do a fast directory refresh
        // in case new files were added to the folder on disk since the first scan.
        if (canReuseCachedScan && result.missing_count > 0) {
          const refreshedScan = await invoke<ScanResult>("scan_folders", {
            paths: effectiveFolders,
            options: scanOptions,
          });
          if (refreshedScan.files.length !== filesToMatch.length) {
            filesToMatch = [...refreshedScan.files];
            setScannedFiles(filesToMatch);
            setLastScanSignature(currentSignature);
            result = await invoke<MatchResult>("match_photos", {
              codes: activeCodes,
              files: filesToMatch,
              mode: matchMode,
              regexPattern: matchMode === "Regex" ? regexPattern : null,
              folderCount: effectiveFolders.length,
            });
          }
        }

        setMatchResult(result);
        setPhase("matched");
      } else {
        setMatchResult(null);
        setPhase("scanned");
      }
      setProgress(null);
    } catch (error) {
      console.error("Scan/Match error:", error);
      alert("Lỗi trong quá trình quét/lọc: " + (typeof error === "string" ? error : JSON.stringify(error)));
      setPhase("idle");
      setProgress(null);
    } finally {
      if (unlistenScan) unlistenScan();
      if (unlistenMatch) unlistenMatch();
    }
  }, [
    setScannedFiles,
    setLastScanSignature,
    setMatchResult,
    setCopyResult,
    setParsedCodes,
    setPhase,
    setProgress,
  ]);

  const handleCancelScan = useCallback(async () => {
    try {
      await invoke("cancel_scan");
      setPhase("idle");
      setProgress(null);
    } catch (error) {
      console.error("Cancel scan error:", error);
    }
  }, [setPhase, setProgress]);

  return { handleScanAndMatch, handleCancelScan };
}
