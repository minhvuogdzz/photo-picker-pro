import { useEffect, useState } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  Copy,
  FolderOutput,
  Timer,
  ScanSearch,
  Ban,
  Clipboard,
  ClipboardCheck,
  FileSpreadsheet,
  Loader2,
  Gauge,
} from "lucide-react";
import { formatDuration, getFolderName } from "@/core/lib/utils";
import { localizeBackendMessage, useTranslation } from "@/core/lib/i18n";
import { useScanAndMatch } from "@/modules/photo-picker/features/scanner/hooks/useScanAndMatch";
import { useCopyOperation } from "@/modules/photo-picker/features/copy/hooks/useCopyOperation";
import { useExport } from "@/modules/photo-picker/features/export/hooks/useExport";
import { sheetFilterAutomationService } from "@/modules/contact-the-sheet/services/sheetFilterAutomationService";
import { MiniTrashBin } from "./MiniTrashBin";
import { CollapsibleSection } from "./CollapsibleSection";

interface RightPanelProps {
  readonly width?: number;
}

export function RightPanel({ width = 288 }: RightPanelProps = {}) {
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
  const isAutoFinding = useAppStore((s) => s.isAutoFinding);
  const autoFindStatus = useAppStore((s) => s.autoFindStatus);
  const sheetUpdateStatus = useAppStore((s) => s.sheetUpdateStatus);
  const { t, tr, lang } = useTranslation();
  
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
      parts.push(`${tr("sai mã:", "missing:")} ${missingCodes.join(", ")}`);
    }

    if (includeDuplicates && duplicateCodes.length > 0) {
      parts.push(`${tr("trùng mã:", "duplicate:")} ${duplicateCodes.join(", ")}`);
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
  const canScan = selectedInputFolders.length > 0 && !isActive && !isAutoFinding;
  const canCopy =
    matchResult &&
    matchResult.found_count > 0 &&
    (outputMode === "SameAsOriginal" || outputFolder) &&
    !isActive;

  const errorCount = missingCodes.length + duplicateCodes.length;
  const outputSummary =
    outputMode === "Folder"
      ? outputFolder
        ? getFolderName(outputFolder)
        : t("select_output_folder")
      : t("same_as_original");

  return (
    <div
      style={{ width: `${width}px` }}
      className="panel shrink-0 flex flex-col min-h-0 animate-fade-in"
    >
      <div className="panel-header h-11 px-3">
        <span className="panel-title">{t("dashboard")}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
        {/* Stats */}
        <div className="grid grid-cols-2 rounded-lg border border-border overflow-hidden">
          <StatCell value={matchResult?.found_count ?? 0} label={t("found")} dotClass="bg-success" />
          <StatCell value={matchResult?.missing_count ?? 0} label={t("missing")} dotClass="bg-destructive" border="left" />
          <StatCell value={matchResult?.duplicate_count ?? 0} label={t("duplicate")} dotClass="bg-warning" border="top" />
          <StatCell value={scannedFiles.length} label={t("scanned")} dotClass="bg-muted-foreground/60" border="both" />
        </div>

        {/* Code issues (collapsible) */}
        {errorCount > 0 && (
          <CollapsibleSection
            id="code_issues"
            title={tr("Mã lỗi", "Code issues")}
            summary={String(errorCount)}
            actions={
              missingCodes.length > 0 && duplicateCodes.length > 0 ? (
                <button
                  type="button"
                  onClick={handleCopyAllErrors}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07] transition-colors"
                  title={tr("Sao chép tất cả mã lỗi", "Copy all issues")}
                >
                  {copiedAll ? <ClipboardCheck size={12} /> : <Clipboard size={12} />}
                  {copiedAll ? tr("Đã sao chép", "Copied") : tr("Sao chép tất cả", "Copy all")}
                </button>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-2">
              {missingCodes.length > 0 && (
                <IssueGroup
                  label={tr(`Sai mã (${missingCodes.length})`, `Missing (${missingCodes.length})`)}
                  dotClass="bg-destructive"
                  codes={missingCodes}
                  copied={copiedMissing}
                  onCopy={handleCopyMissing}
                  copyLabel={tr("Sao chép", "Copy")}
                  copiedLabel={tr("Đã sao chép", "Copied")}
                />
              )}
              {duplicateCodes.length > 0 && (
                <IssueGroup
                  label={tr(`Mã trùng (${duplicateCodes.length})`, `Duplicates (${duplicateCodes.length})`)}
                  dotClass="bg-warning"
                  codes={duplicateCodes}
                  copied={copiedDuplicates}
                  onCopy={handleCopyDuplicates}
                  copyLabel={tr("Sao chép", "Copy")}
                  copiedLabel={tr("Đã sao chép", "Copied")}
                />
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Progress Section */}
        {progress && isActive && (
          <div className="rounded-lg border border-border bg-foreground/[0.02] p-2.5 space-y-2 animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                {phase === "scanning" ? t("scanning") : t("copying")}
              </span>
              <span className="text-xs font-mono tabular-nums text-muted-foreground">
                {progress.percentage.toFixed(1)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 bg-foreground/[0.08] rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress.percentage, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>
                {progress.current.toLocaleString()}/{progress.total.toLocaleString()}
              </span>
              <div className="flex items-center gap-3">
                {progress.speed && (
                  <span className="flex items-center gap-1">
                    <Gauge size={11} />
                    {progress.speed}
                  </span>
                )}
                {progress.eta_seconds != null && progress.eta_seconds > 0 && (
                  <span className="flex items-center gap-1">
                    <Timer size={10} />
                    {formatDuration(progress.eta_seconds)}
                  </span>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground truncate">
              {progress.message ? localizeBackendMessage(progress.message, lang) : ""}
            </p>
          </div>
        )}

        {/* Copy Result */}
        {copyResult && phase === "done" && (
          <div className="rounded-lg border border-border bg-foreground/[0.02] p-2.5 space-y-1.5 animate-slide-up">
            <span className="text-xs font-medium text-foreground">
              {t("operation_complete")}
            </span>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("success")}</span>
                <span className="text-success font-mono tabular-nums">
                  {copyResult.success_count}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("skipped")}</span>
                <span className="text-warning font-mono tabular-nums">
                  {copyResult.skipped_count}
                </span>
              </div>
              {copyResult.error_count > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t("errors")}</span>
                  <span className="text-destructive font-mono tabular-nums">
                    {copyResult.error_count}
                  </span>
                </div>
              )}
            </div>
            {copyResult.errors.length > 0 && (
              <div className="mt-1.5 p-2 bg-destructive/5 border border-destructive/20 rounded-md max-h-28 overflow-y-auto">
                {copyResult.errors.map((err, i) => (
                  <p
                    key={i}
                    className="text-[11px] text-destructive truncate"
                    title={err}
                  >
                    {err}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Google Sheets Status Auto-Update Card */}
        {phase === "done" && sheetUpdateStatus && sheetUpdateStatus.state !== "idle" && (
          <div
            className={`rounded-lg border p-2.5 space-y-1.5 animate-slide-up ${
              sheetUpdateStatus.state === "success"
                ? "border-success/25 bg-success/[0.06] text-foreground"
                : sheetUpdateStatus.state === "updating"
                ? "border-primary/25 bg-primary/[0.06] text-foreground"
                : "border-warning/25 bg-warning/[0.06] text-foreground"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <FileSpreadsheet
                  size={13}
                  strokeWidth={1.75}
                  className={
                    sheetUpdateStatus.state === "success"
                      ? "text-success"
                      : sheetUpdateStatus.state === "updating"
                      ? "text-primary"
                      : "text-warning"
                  }
                />
                <span>{tr("Google Sheets Trạng Thái", "Google Sheets Status")}</span>
              </span>
              {sheetUpdateStatus.state === "updating" && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 size={11} className="animate-spin" />
                  {tr("Đang đồng bộ...", "Syncing...")}
                </span>
              )}
              {sheetUpdateStatus.state === "success" && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-success/12 text-success font-medium">
                  {tr("Đã đổi trạng thái", "Status updated")}
                </span>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed break-words">
              {sheetUpdateStatus.message}
            </p>

            {sheetUpdateStatus.state === "error" && (
              <button
                type="button"
                onClick={() => {
                  const effectiveFolders = selectedInputFolders.length > 0 ? selectedInputFolders : inputFolders;
                  sheetFilterAutomationService.updateStatusOnFilterComplete(effectiveFolders, copyResult);
                }}
                className="mt-1 h-6 px-2 rounded-md bg-warning/15 hover:bg-warning/25 text-warning text-[11px] font-medium transition-colors cursor-pointer"
              >
                {tr("Thử lại cập nhật Google Sheet", "Retry Google Sheet update")}
              </button>
            )}
          </div>
        )}

        {/* Output destination (collapsible) */}
        <CollapsibleSection
          id="output_destination"
          title={t("output_destination")}
          summary={outputSummary}
        >
          <div className="flex flex-col gap-2">
            <div role="radiogroup" aria-label={t("output_destination")} className="grid grid-cols-2 gap-0.5 p-0.5 rounded-md bg-foreground/[0.05] border border-border">
              <button
                type="button"
                role="radio"
                aria-checked={outputMode === "Folder"}
                onClick={() => setOutputMode("Folder")}
                className={outputSegmentClass(outputMode === "Folder")}
              >
                {t("choose_folder")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={outputMode === "SameAsOriginal"}
                onClick={() => setOutputMode("SameAsOriginal")}
                className={outputSegmentClass(outputMode === "SameAsOriginal")}
              >
                {t("same_as_original")}
              </button>
            </div>

            {outputMode === "Folder" ? (
              <button
                type="button"
                onClick={handleSelectOutput}
                className="w-full flex items-center gap-2 h-9 px-2.5 rounded-md border border-border bg-foreground/[0.03] hover:bg-foreground/[0.07] transition-colors text-left"
                title={outputFolder || t("select_output_folder")}
              >
                <FolderOutput size={14} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0 flex flex-col">
                  {outputFolder ? (
                    <>
                      <span className="text-xs font-medium text-foreground truncate">{getFolderName(outputFolder)}</span>
                      <span className="text-[10.5px] text-muted-foreground truncate">{outputFolder}</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("select_output_folder")}</span>
                  )}
                </span>
              </button>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">{t("same_as_original_hint")}</p>
            )}
          </div>
        </CollapsibleSection>

        {/* Mini Trash Bin Anchor (Ejected Customers) */}
        <MiniTrashBin />

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-auto pt-1">
          {isActive ? (
            <button
              type="button"
              onClick={handleCancel}
              className="btn-destructive w-full h-9 rounded-md text-xs font-medium flex justify-center items-center gap-2"
            >
              <Ban size={14} strokeWidth={1.75} />
              {t("cancel")}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleScanAndMatch}
                disabled={!canScan}
                className={`btn-primary h-9 rounded-md text-xs font-medium flex justify-center items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  autoFindStatus?.state === "success" && !matchResult
                    ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
                    : ""
                }`}
              >
                {isAutoFinding ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{tr("Đang nạp mã...", "Loading codes...")}</span>
                  </>
                ) : (
                  <>
                    <ScanSearch size={14} strokeWidth={1.75} />
                    {t("scan_match")}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleCopy("Copy")}
                disabled={!canCopy}
                className="btn-secondary h-9 rounded-md text-xs font-medium flex justify-center items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Copy size={14} strokeWidth={1.75} />
                {t("copy")}
              </button>
            </div>
          )}

          {matchResult && (
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <span>{tr("Xuất báo cáo", "Export report")}</span>
              <button
                type="button"
                onClick={() => handleExport("txt")}
                className="px-1.5 py-0.5 rounded text-foreground/80 hover:text-foreground hover:bg-foreground/[0.07] transition-colors"
              >
                TXT
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => handleExport("csv")}
                className="px-1.5 py-0.5 rounded text-foreground/80 hover:text-foreground hover:bg-foreground/[0.07] transition-colors"
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

function outputSegmentClass(active: boolean): string {
  return `h-7 px-2 rounded-[5px] text-xs truncate transition-colors ${
    active
      ? "bg-background text-foreground font-medium shadow-xs dark:bg-white/[0.11]"
      : "text-muted-foreground hover:text-foreground"
  }`;
}

function StatCell({
  value,
  label,
  dotClass,
  border,
}: {
  readonly value: number;
  readonly label: string;
  readonly dotClass: string;
  readonly border?: "left" | "top" | "both";
}) {
  const borderClass =
    border === "left"
      ? "border-l border-border"
      : border === "top"
        ? "border-t border-border"
        : border === "both"
          ? "border-l border-t border-border"
          : "";
  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2 ${borderClass}`}>
      <span className="text-base font-semibold tabular-nums text-foreground leading-tight">
        {value.toLocaleString()}
      </span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
        {label}
      </span>
    </div>
  );
}

function IssueGroup({
  label,
  dotClass,
  codes,
  copied,
  onCopy,
  copyLabel,
  copiedLabel,
}: {
  readonly label: string;
  readonly dotClass: string;
  readonly codes: readonly string[];
  readonly copied: boolean;
  readonly onCopy: () => void;
  readonly copyLabel: string;
  readonly copiedLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/90">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07] transition-colors"
        >
          {copied ? <ClipboardCheck size={12} /> : <Clipboard size={12} />}
          {copied ? copiedLabel : copyLabel}
        </button>
      </div>
      <p
        className="text-xs font-mono text-muted-foreground leading-relaxed break-all max-h-20 overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {codes.join(", ")}
      </p>
    </div>
  );
}
