import { useCallback } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ScanResult, MatchResult, ProgressEvent } from "@/types";

export function useScanAndMatch() {
  const selectedInputFolders = useAppStore((s) => s.selectedInputFolders);
  const parsedCodes = useAppStore((s) => s.parsedCodes);
  const matchMode = useAppStore((s) => s.matchMode);
  const regexPattern = useAppStore((s) => s.regexPattern);
  const scanOptions = useAppStore((s) => s.scanOptions);
  
  const setScannedFiles = useAppStore((s) => s.setScannedFiles);
  const setMatchResult = useAppStore((s) => s.setMatchResult);
  const setCopyResult = useAppStore((s) => s.setCopyResult);
  const setPhase = useAppStore((s) => s.setPhase);
  const setProgress = useAppStore((s) => s.setProgress);

  const handleScanAndMatch = useCallback(async () => {
    if (selectedInputFolders.length === 0) {
      alert("Vui lòng chọn ít nhất 1 thư mục đầu vào!");
      return;
    }
    
    try {
      // Reset previous results
      setMatchResult(null);
      setCopyResult(null);
      setScannedFiles([]);
      setPhase("scanning");
      setProgress(null);
      
      const unlistenScan = await listen<ProgressEvent>("scan-progress", (event) => {
        setProgress(event.payload);
      });
      
      const scanResult = await invoke<ScanResult>("scan_folders", {
        paths: selectedInputFolders,
        options: scanOptions,
      });
      
      unlistenScan();
      setScannedFiles([...scanResult.files]);
      
      if (parsedCodes.length > 0) {
        setPhase("matching");
        const result = await invoke<MatchResult>("match_photos", {
          codes: parsedCodes,
          files: scanResult.files,
          mode: matchMode,
          regexPattern: matchMode === "Regex" ? regexPattern : null,
          folderCount: selectedInputFolders.length,
        });
        
        setMatchResult(result);
        setPhase("matched");
      } else {
        setPhase("scanned");
      }
      setProgress(null);
    } catch (error) {
      console.error("Scan/Match error:", error);
      alert("Lỗi trong quá trình quét/lọc: " + (typeof error === 'string' ? error : JSON.stringify(error)));
      setPhase("idle");
      setProgress(null);
    }
  }, [
    selectedInputFolders, parsedCodes, matchMode, regexPattern, scanOptions,
    setScannedFiles, setMatchResult, setCopyResult, setPhase, setProgress,
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
