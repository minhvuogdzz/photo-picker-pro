import { useEffect, useState } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  CheckCircle,
  XCircle,
  Copy,
  AlertTriangle,
  FolderOutput,
  HardDrive,
  Timer,
  Zap,
  ScanSearch,
  Ban,
  Clipboard,
  ClipboardCheck,
} from "lucide-react";
import { formatDuration, getFolderName } from "@/core/lib/utils";
import { useTranslation } from "@/core/lib/i18n";
import { useScanAndMatch } from "@/modules/photo-picker/features/scanner/hooks/useScanAndMatch";
import { useCopyOperation } from "@/modules/photo-picker/features/copy/hooks/useCopyOperation";
import { useExport } from "@/modules/photo-picker/features/export/hooks/useExport";

export function RightPanel() {
  const matchResult = useAppStore((s) => s.matchResult);
  const scannedFiles = useAppStore((s) => s.scannedFiles);
  const progress = useAppStore((s) => s.progress);
  const phase = useAppStore((s) => s.phase);
  const outputFolder = useAppStore((s) => s.outputFolder);
  const setOutputFolder = useAppStore((s) => s.setOutputFolder);
  const copyResult = useAppStore((s) => s.copyResult);
  const outputMode = useAppStore((s) => s.outputMode);
  const setOutputMode = useAppStore((s) => s.setOutputMode);
  const selectedInputFolders = useAppStore((s) => s.selectedInputFolders);
  const inputFolders = useAppStore((s) => s.inputFolders);
  const { t } = useTranslation();
  
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const { handleScanAndMatch, handleCancelScan } = useScanAndMatch();
  const { handleCopy, handleCancelCopy } = useCopyOperation();
  const { handleExport } = useExport();

  const [copiedDuplicates, setCopiedDuplicates] = useState(false);
  const [copiedMissing, setCopiedMissing] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Set default output folder from settings on mount
  useEffect(() => {
    if (!outputFolder && settings.default_output) {
      setOutputFolder(settings.default_output);
    }
  }, [settings.default_output, outputFolder, setOutputFolder]);

  const handleSelectOutput = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Output Folder",
      });
      if (selected && typeof selected === "string") {
        setOutputFolder(selected);
        updateSetting("default_output", selected);
        await invoke("save_settings", { settings: { ...settings, default_output: selected } });
      }
    } catch (error) {
      console.error("Failed to open output folder dialog:", error);
    }
  };

  const handleCancel = () => {
    if (phase === "scanning") handleCancelScan();
    else if (phase === "copying") handleCancelCopy();
  };

  // Collect duplicate codes
  const duplicateCodes = matchResult
    ? matchResult.matches
        .filter((m) => m.status === "InputDuplicate")
        .map((m) => m.code)
    : [];

  // Collect missing codes
  const missingCodes = matchResult
    ? matchResult.matches
        .filter((m) => m.status === "Missing")
        .map((m) => m.code)
    : [];

  const currentFolderNames = (selectedInputFolders.length > 0 ? selectedInputFolders : inputFolders)
    .map(getFolderName)
    .filter(Boolean)
    .join(", ");

  const formatErrorText = (options?: { includeMissing?: boolean; includeDuplicates?: boolean }) => {
    const { includeMissing = true, includeDuplicates = true } = options || {};
    const parts: string[] = [];

    if (currentFolderNames) {
      parts.push(currentFolderNames);
    }

    if (includeMissing && missingCodes.length > 0) {
      parts.push(`sai mã: ${missingCodes.join(", ")}`);
    }

    if (includeDuplicates && duplicateCodes.length > 0) {
      parts.push(`trùng mã: ${duplicateCodes.join(", ")}`);
    }

    return parts.join(" ");
  };

  const handleCopyAllErrors = async () => {
    const text = formatErrorText({ includeMissing: true, includeDuplicates: true });
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyDuplicates = async () => {
    if (duplicateCodes.length === 0) return;
    const text = formatErrorText({ includeMissing: false, includeDuplicates: true });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDuplicates(true);
      setTimeout(() => setCopiedDuplicates(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyMissing = async () => {
    if (missingCodes.length === 0) return;
    const text = formatErrorText({ includeMissing: true, includeDuplicates: false });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMissing(true);
      setTimeout(() => setCopiedMissing(false), 2000);
    } catch {
      // fallback
    }
  };

  const isActive = phase === "scanning" || phase === "copying";
  const canScan = selectedInputFolders.length > 0 && !isActive;
  const canCopy =
    matchResult &&
    matchResult.found_count > 0 &&
    (outputMode === "SameAsOriginal" || outputFolder) &&
    !isActive;

  return (
    <div className="panel w-72 flex flex-col min-h-0 animate-fade-in">
      <div className="panel-header py-3 px-4">
        <span className="panel-title flex items-center gap-2 text-xs">
          <HardDrive size={13} className="text-muted-foreground" />
          {t("dashboard")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
        {/* Stats Cards — compact, professional */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
            <CheckCircle size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {matchResult?.found_count ?? 0}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none">{t("found")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
            <XCircle size={13} className="text-red-500 dark:text-red-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {matchResult?.missing_count ?? 0}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none">{t("missing")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
            <Copy size={13} className="text-amber-500 dark:text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {matchResult?.duplicate_count ?? 0}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none">{t("duplicate")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
            <HardDrive size={13} className="text-blue-500 dark:text-blue-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {scannedFiles.length.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none">{t("scanned")}</span>
            </div>
          </div>
        </div>

        {/* Combined error summary if both missing & duplicates exist */}
        {duplicateCodes.length > 0 && missingCodes.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-1.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-primary flex items-center gap-1">
                <Copy size={11} />
                Gộp tất cả lỗi ({missingCodes.length + duplicateCodes.length})
              </span>
              <button
                onClick={handleCopyAllErrors}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer font-medium"
              >
                {copiedAll ? <ClipboardCheck size={10} /> : <Clipboard size={10} />}
                {copiedAll ? "Đã sao chép" : "Sao chép tất cả"}
              </button>
            </div>
            <div className="max-h-20 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              <p className="text-[10px] text-foreground/85 font-mono leading-relaxed break-all bg-background/50 p-1.5 rounded border border-border/30">
                {formatErrorText({ includeMissing: true, includeDuplicates: true })}
              </p>
            </div>
          </div>
        )}

        {/* Duplicate codes section */}
        {duplicateCodes.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Copy size={11} />
                Mã trùng ({duplicateCodes.length})
              </span>
              <button
                onClick={handleCopyDuplicates}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
              >
                {copiedDuplicates ? <ClipboardCheck size={10} /> : <Clipboard size={10} />}
                {copiedDuplicates ? "Đã sao chép" : "Sao chép"}
              </button>
            </div>
            <div className="max-h-20 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-300/70 font-mono leading-relaxed break-all">
                {formatErrorText({ includeMissing: false, includeDuplicates: true })}
              </p>
            </div>
          </div>
        )}

        {/* Missing codes section */}
        {missingCodes.length > 0 && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                <XCircle size={11} />
                Sai mã ({missingCodes.length})
              </span>
              <button
                onClick={handleCopyMissing}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
              >
                {copiedMissing ? <ClipboardCheck size={10} /> : <Clipboard size={10} />}
                {copiedMissing ? "Đã sao chép" : "Sao chép"}
              </button>
            </div>
            <div className="max-h-20 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              <p className="text-[10px] text-red-700/80 dark:text-red-300/70 font-mono leading-relaxed break-all">
                {formatErrorText({ includeMissing: true, includeDuplicates: false })}
              </p>
            </div>
          </div>
        )}

        {/* Progress Section */}
        {progress && isActive && (
          <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 space-y-2 animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground/80">
                {phase === "scanning" ? t("scanning") : t("copying")}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {progress.percentage.toFixed(1)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress.percentage, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {progress.current.toLocaleString()}/{progress.total.toLocaleString()}
              </span>
              <div className="flex items-center gap-3">
                {progress.speed && (
                  <span className="flex items-center gap-1">
                    <Zap size={9} />
                    {progress.speed}
                  </span>
                )}
                {progress.eta_seconds != null && progress.eta_seconds > 0 && (
                  <span className="flex items-center gap-1">
                    <Timer size={9} />
                    {formatDuration(progress.eta_seconds)}
                  </span>
                )}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground truncate">
              {progress.message}
            </p>
          </div>
        )}

        {/* Copy Result */}
        {copyResult && phase === "done" && (
          <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5 space-y-1.5 animate-slide-up">
            <span className="text-[11px] font-medium text-foreground/80">
              {t("operation_complete")}
            </span>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{t("success")}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                  {copyResult.success_count}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{t("skipped")}</span>
                <span className="text-amber-500 font-mono text-[11px]">
                  {copyResult.skipped_count}
                </span>
              </div>
              {copyResult.error_count > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{t("errors")}</span>
                  <span className="text-red-500 font-mono text-[11px]">
                    {copyResult.error_count}
                  </span>
                </div>
              )}
            </div>
            {copyResult.errors.length > 0 && (
              <div className="mt-1.5 p-2 bg-red-500/5 border border-red-500/20 rounded-md max-h-28 overflow-y-auto">
                {copyResult.errors.map((err, i) => (
                  <p
                    key={i}
                    className="text-[10px] text-red-500/80 truncate"
                    title={err}
                  >
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Output Options */}
        <div className="space-y-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FolderOutput size={12} />
            {t("output_destination")}
          </span>

          <div className="flex flex-col gap-1.5">
            <div className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-all ${outputMode === "Folder" ? "bg-primary/5 border-primary/40" : "bg-card border-border/40 hover:border-muted-foreground/30"}`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={outputMode === "Folder"}
                  onChange={() => setOutputMode("Folder")}
                  className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer w-3.5 h-3.5"
                />
                <span className={`text-[11px] font-medium ${outputMode === "Folder" ? "text-foreground" : "text-muted-foreground"}`}>{t("choose_folder")}</span>
              </label>

              {outputMode === "Folder" && (
                <div className="pl-5 space-y-1.5 pb-0.5">
                  <button
                    onClick={handleSelectOutput}
                    className="btn-outline w-full text-[11px] py-2 px-2.5 justify-start cursor-pointer flex items-center gap-2 bg-background hover:bg-accent rounded-md"
                  >
                    <FolderOutput size={14} className="text-muted-foreground shrink-0" />
                    {outputFolder ? (
                      <span className="truncate flex-1 text-left font-medium">{getFolderName(outputFolder)}</span>
                    ) : (
                      <span className="text-muted-foreground flex-1 text-left">{t("select_output_folder")}</span>
                    )}
                  </button>
                  {outputFolder && (
                    <p className="text-[10px] text-muted-foreground truncate px-0.5" title={outputFolder}>
                      {outputFolder}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className={`flex flex-col gap-1.5 p-2 rounded-lg border transition-all ${outputMode === "SameAsOriginal" ? "bg-primary/5 border-primary/40" : "bg-card border-border/40 hover:border-muted-foreground/30"}`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={outputMode === "SameAsOriginal"}
                  onChange={() => setOutputMode("SameAsOriginal")}
                  className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer w-3.5 h-3.5"
                />
                <span className={`text-[11px] font-medium ${outputMode === "SameAsOriginal" ? "text-foreground" : "text-muted-foreground"}`}>{t("same_as_original")}</span>
              </label>

              {outputMode === "SameAsOriginal" && (
                <div className="pl-5 pb-0.5">
                  <div className="p-2 bg-blue-500/5 border border-blue-500/15 rounded-md">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed">
                      {t("same_as_original_hint")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warnings — refined */}
        {matchResult && matchResult.missing_count > 0 && (
          <div className="flex items-start gap-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 leading-relaxed">
              {matchResult.missing_count} mã không tìm thấy trong thư mục đã quét. Có thể export báo cáo.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-auto pb-1">
          {isActive ? (
            <button
              onClick={handleCancel}
              className="btn-destructive w-full py-2.5 rounded-lg text-xs font-semibold flex justify-center items-center gap-2"
            >
              <Ban size={14} />
              {t("cancel")}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleScanAndMatch}
                disabled={!canScan}
                className="btn-primary py-2.5 rounded-lg text-xs font-semibold flex justify-center items-center gap-1.5 transition-all"
              >
                <ScanSearch size={14} />
                {t("scan_match")}
              </button>

              <button
                onClick={() => handleCopy("Copy")}
                disabled={!canCopy}
                className="btn-secondary py-2.5 rounded-lg text-xs font-semibold flex justify-center items-center gap-1.5 transition-all border border-border"
              >
                <Copy size={14} />
                {t("copy")}
              </button>
            </div>
          )}

          {matchResult && (
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground">Export:</span>
              <button
                onClick={() => handleExport("txt")}
                className="text-[10px] font-medium px-2.5 py-1 rounded-md hover:bg-accent/50 text-foreground/70 transition-colors"
              >
                TXT
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="text-[10px] font-medium px-2.5 py-1 rounded-md hover:bg-accent/50 text-foreground/70 transition-colors"
              >
                CSV
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
