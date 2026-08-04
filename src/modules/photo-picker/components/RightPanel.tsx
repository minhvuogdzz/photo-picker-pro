import { useEffect } from "react";
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
  const { t } = useTranslation();
  
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const { handleScanAndMatch, handleCancelScan } = useScanAndMatch();
  const { handleCopy, handleCancelCopy } = useCopyOperation();
  const { handleExport } = useExport();

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

  const isActive = phase === "scanning" || phase === "copying";
  const canScan = selectedInputFolders.length > 0 && !isActive;
  const canCopy =
    matchResult &&
    matchResult.found_count > 0 &&
    (outputMode === "SameAsOriginal" || outputFolder) &&
    !isActive;

  return (
    <div className="panel w-72 flex flex-col min-h-0 animate-fade-in">
      <div className="panel-header py-5 px-6">
        <span className="panel-title flex items-center gap-2">
          <HardDrive size={14} className="text-primary" />
          {t("dashboard")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto panel-body flex flex-col gap-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="stat-card">
            <div className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-success" />
              <span className="stat-value text-success">
                {matchResult?.found_count ?? 0}
              </span>
            </div>
            <span className="stat-label">{t("found")}</span>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-1.5">
              <XCircle size={14} className="text-destructive" />
              <span className="stat-value text-destructive">
                {matchResult?.missing_count ?? 0}
              </span>
            </div>
            <span className="stat-label">{t("missing")}</span>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-1.5">
              <Copy size={14} className="text-warning" />
              <span className="stat-value text-warning">
                {matchResult?.duplicate_count ?? 0}
              </span>
            </div>
            <span className="stat-label">{t("duplicate")}</span>
          </div>

          <div className="stat-card">
            <div className="flex items-center gap-1.5">
              <HardDrive size={14} className="text-info" />
              <span className="stat-value text-info">
                {scannedFiles.length.toLocaleString()}
              </span>
            </div>
            <span className="stat-label">{t("scanned")}</span>
          </div>
        </div>

        {/* Progress Section */}
        {progress && isActive && (
          <div className="panel p-3 space-y-2 animate-slide-up">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground/80">
                {phase === "scanning" ? t("scanning") : t("copying")}
              </span>
              <span className="text-xs font-mono text-primary">
                {progress.percentage.toFixed(1)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-info rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress.percentage, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {progress.current.toLocaleString()}/{progress.total.toLocaleString()}
              </span>
              <div className="flex items-center gap-3">
                {progress.speed && (
                  <span className="flex items-center gap-1">
                    <Zap size={10} />
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

            <p className="text-xs text-muted-foreground truncate">
              {progress.message}
            </p>
          </div>
        )}

        {/* Copy Result */}
        {copyResult && phase === "done" && (
          <div className="panel p-3 space-y-2 animate-slide-up">
            <span className="text-xs font-medium text-foreground/80">
              {t("operation_complete")}
            </span>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("success")}</span>
                <span className="text-success font-mono">
                  {copyResult.success_count}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t("skipped")}</span>
                <span className="text-warning font-mono">
                  {copyResult.skipped_count}
                </span>
              </div>
              {copyResult.error_count > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t("errors")}</span>
                  <span className="text-destructive font-mono">
                    {copyResult.error_count}
                  </span>
                </div>
              )}
            </div>
            {copyResult.errors.length > 0 && (
              <div className="mt-2 p-2 bg-destructive/10 rounded-md max-h-32 overflow-y-auto">
                {copyResult.errors.map((err, i) => (
                  <p
                    key={i}
                    className="text-xs text-destructive/80 truncate"
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
        <div className="space-y-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FolderOutput size={14} />
            {t("output_destination")}
          </span>

          <div className="flex flex-col gap-2">
            <div className={`flex flex-col gap-2 p-2.5 rounded-xl border transition-all ${outputMode === "Folder" ? "bg-primary/5 border-primary shadow-sm" : "bg-card border-border hover:border-primary/50"}`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={outputMode === "Folder"}
                  onChange={() => setOutputMode("Folder")}
                  className="rounded text-primary focus:ring-primary/50 cursor-pointer w-4 h-4"
                />
                <span className={`text-xs font-medium ${outputMode === "Folder" ? "text-primary" : "text-foreground"}`}>{t("choose_folder")}</span>
              </label>

              {outputMode === "Folder" && (
                <div className="pl-6 space-y-2 pb-1">
                  <button
                    onClick={handleSelectOutput}
                    className="btn-outline w-full text-sm py-3 px-3 justify-start cursor-pointer flex items-center gap-2 bg-background hover:bg-accent"
                  >
                    <FolderOutput size={18} className="text-muted-foreground shrink-0" />
                    {outputFolder ? (
                      <span className="truncate flex-1 text-left font-medium">{getFolderName(outputFolder)}</span>
                    ) : (
                      <span className="text-muted-foreground flex-1 text-left">{t("select_output_folder")}</span>
                    )}
                  </button>
                  {outputFolder && (
                    <p className="text-[11px] text-muted-foreground truncate px-1" title={outputFolder}>
                      {outputFolder}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className={`flex flex-col gap-2 p-2.5 rounded-xl border transition-all ${outputMode === "SameAsOriginal" ? "bg-primary/5 border-primary shadow-sm" : "bg-card border-border hover:border-primary/50"}`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={outputMode === "SameAsOriginal"}
                  onChange={() => setOutputMode("SameAsOriginal")}
                  className="rounded text-primary focus:ring-primary/50 cursor-pointer w-4 h-4"
                />
                <span className={`text-xs font-medium ${outputMode === "SameAsOriginal" ? "text-primary" : "text-foreground"}`}>{t("same_as_original")}</span>
              </label>

              {outputMode === "SameAsOriginal" && (
                <div className="pl-6 pb-1">
                  <div className="p-2.5 bg-info/10 border border-info/20 rounded-lg">
                    <p className="text-xs text-info leading-relaxed">
                      {t("same_as_original_hint")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {matchResult && matchResult.missing_count > 0 && (
          <div className="flex items-start gap-2 p-2 bg-warning/10 rounded-lg">
            <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning/80">
              {matchResult.missing_count} code(s) not found in scanned folders.
              You can export a missing report.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 mt-auto pb-2">
          {isActive ? (
            <button
              onClick={handleCancel}
              className="btn-destructive w-full py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-sm"
            >
              <Ban size={20} />
              {t("cancel")}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleScanAndMatch}
                disabled={!canScan}
                className="btn-primary py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <ScanSearch size={20} />
                {t("scan_match")}
              </button>

              <button
                onClick={() => handleCopy("Copy")}
                disabled={!canCopy}
                className="btn-secondary py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 shadow-sm hover:shadow transition-all border border-border"
              >
                <Copy size={20} />
                {t("copy")}
              </button>
            </div>
          )}

          {matchResult && (
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">Export:</span>
              <button
                onClick={() => handleExport("txt")}
                className="text-xs font-medium px-3 py-1.5 rounded-md hover:bg-accent/50 text-foreground/80 transition-colors"
              >
                TXT
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="text-xs font-medium px-3 py-1.5 rounded-md hover:bg-accent/50 text-foreground/80 transition-colors"
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
