import { useAppStore } from "@/stores/useAppStore";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import {
  Code2,
  Hash,
  Regex,
  Search,
  FolderSync,
  FolderOpen,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import type { CustomerCode } from "@/types";
import { useTranslation } from "@/lib/i18n";
import { getFolderName } from "@/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";

export function CenterPanel() {
  const rawCodeInput = useAppStore((s) => s.rawCodeInput);
  const setRawCodeInput = useAppStore((s) => s.setRawCodeInput);
  const parsedCodes = useAppStore((s) => s.parsedCodes);
  const setParsedCodes = useAppStore((s) => s.setParsedCodes);
  const matchMode = useAppStore((s) => s.matchMode);
  const setMatchMode = useAppStore((s) => s.setMatchMode);
  const regexPattern = useAppStore((s) => s.regexPattern);
  const setRegexPattern = useAppStore((s) => s.setRegexPattern);
  const matchResult = useAppStore((s) => s.matchResult);
  const phase = useAppStore((s) => s.phase);
  const scanOptions = useAppStore((s) => s.scanOptions);
  const setScanOptions = useAppStore((s) => s.setScanOptions);
  const [isParsingDebounced, setIsParsingDebounced] = useState(false);
  const syncFolders = useAppStore((s) => s.syncFolders);
  const addSyncFolders = useAppStore((s) => s.addSyncFolders);
  const removeSyncFolder = useAppStore((s) => s.removeSyncFolder);
  const clearSyncFolders = useAppStore((s) => s.clearSyncFolders);
  const setActiveDropZone = useAppStore((s) => s.setActiveDropZone);
  const activeDropZone = useAppStore((s) => s.activeDropZone);
  const { t } = useTranslation();

  // Sync folder states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Debounced parsing
  const parseInput = useCallback(
    async (input: string) => {
      if (!input.trim()) {
        setParsedCodes([]);
        return;
      }
      setIsParsingDebounced(true);
      try {
        const codes = await invoke<CustomerCode[]>("parse_customer_codes", {
          input,
        });
        setParsedCodes(codes);
      } catch (error) {
        console.error("Parse error:", error);
      } finally {
        setIsParsingDebounced(false);
      }
    },
    [setParsedCodes]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      parseInput(rawCodeInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [rawCodeInput, parseInput]);

  // Add folders for sync uses global store now

  const handleAddSyncFolders = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Chọn thư mục cần đồng bộ tên",
      });
      if (selected) {
        const folders = Array.isArray(selected) ? selected : [selected];
        addSyncFolders(folders);
      }
    } catch (err) {
      console.error("Failed to open folder dialog:", err);
    }
  };

  const handleSyncAll = async (mode: "all" | "last") => {
    if (syncFolders.length === 0) return;
    setIsSyncing(true);
    setSyncResult(null);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const folder of syncFolders) {
      try {
        await invoke<string>("sync_subfolder_names", {
          folderPath: folder,
          mode,
        });
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push(`${getFolderName(folder)}: ${String(err)}`);
      }
    }

    if (errorCount === 0) {
      setSyncResult(`✅ Đã đồng bộ thành công ${successCount} thư mục!`);
    } else {
      setSyncResult(
        `⚠️ Thành công: ${successCount}, Lỗi: ${errorCount}\n${errors.join("\n")}`
      );
    }
    setIsSyncing(false);
  };

  const modes = [
    { id: "ExactNumber", label: "Exact", icon: <Hash size={12} /> },
    { id: "Contains", label: "Contains", icon: <Search size={12} /> },
    { id: "Regex", label: "Regex", icon: <Regex size={12} /> },
  ];

  return (
    <div className="panel flex-1 flex flex-col min-h-0 animate-fade-in">
      {/* === TOP HALF: Customer Codes === */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="panel-header py-5 px-6">
          <span className="panel-title flex items-center gap-2">
            <Code2 size={14} className="text-primary" />
            {t("customer_codes")}
          </span>
          <div className="flex items-center gap-2">
            {isParsingDebounced && (
              <span className="text-xs text-muted-foreground animate-pulse-soft">
                Parsing...
              </span>
            )}
            <span className="badge-info">
              {parsedCodes.length} {t("codes_count")}
            </span>
          </div>
        </div>

        {/* Match Mode Selector */}
        <div className="px-4 pt-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("mode")}:</span>
          <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
            {modes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setMatchMode(mode.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                  matchMode === mode.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode.icon}
                {mode.id === "ExactNumber" ? t("exact") : mode.id === "Contains" ? t("contains") : t("regex")}
              </button>
            ))}
          </div>
        </div>

        {/* Regex Pattern Input */}
        {matchMode === "Regex" && (
          <div className="px-4 pt-2">
            <input
              type="text"
              className="input-field text-xs font-mono"
              placeholder="Enter regex pattern..."
              value={regexPattern}
              onChange={(e) => setRegexPattern(e.target.value)}
            />
          </div>
        )}

        {/* Code Input Textarea */}
        <div className="flex-1 px-4 py-3 min-h-0">
          <textarea
            className="w-full h-full input-field resize-none font-mono text-xs leading-relaxed"
            placeholder={t("paste_codes_here")}
            value={rawCodeInput}
            onChange={(e) => setRawCodeInput(e.target.value)}
            spellCheck={false}
            disabled={phase === "scanning" || phase === "copying"}
          />
        </div>

        {/* Scan Options */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs pb-3">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.filter_raw}
              onChange={(e) => setScanOptions({ filter_raw: e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer disabled:opacity-50"
            />
            <span className={phase === "scanning" || phase === "copying" ? "opacity-50" : ""}>Lọc Raw (CR2, CR3, ARW...)</span>
          </label>
          
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.filter_jpg}
              onChange={(e) => setScanOptions({ filter_jpg: e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer disabled:opacity-50"
            />
            <span className={phase === "scanning" || phase === "copying" ? "opacity-50" : ""}>Lọc JPG</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!scanOptions.recursive}
              onChange={(e) => setScanOptions({ recursive: !e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer disabled:opacity-50"
            />
            <span className={phase === "scanning" || phase === "copying" ? "opacity-50" : ""}>Chỉ lọc thư mục chọn</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.recursive}
              onChange={(e) => setScanOptions({ recursive: e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer disabled:opacity-50"
            />
            <span className={phase === "scanning" || phase === "copying" ? "opacity-50" : ""}>Lọc tất cả thư mục con</span>
          </label>
        </div>

        {/* Preview Results Table (when matched) */}
        {matchResult && matchResult.matches.length > 0 && (
          <div className="border-t border-border/50 max-h-[40%] min-h-0 overflow-hidden flex flex-col">
            <div className="px-4 py-2 flex items-center justify-between bg-muted/20">
              <span className="text-xs font-medium text-muted-foreground">
                Match Results
              </span>
              <span className="text-xs text-muted-foreground">
                {matchResult.matches.length} entries
              </span>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="sticky top-0 bg-card z-10">
                  <tr>
                    <th className="table-header">Code</th>
                    <th className="table-header">File</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {matchResult.matches.map((match, idx) => (
                    <tr key={`${match.code}-${idx}`} className="table-row">
                      <td className="table-cell font-mono text-xs">
                        {match.code}
                      </td>
                      <td className="table-cell text-xs truncate max-w-[200px]" title={match.photo?.full_path}>
                        {match.photo?.filename || "—"}
                      </td>
                      <td className="table-cell">
                        <span
                          className={
                            match.status === "Found"
                              ? "badge-success"
                              : match.status === "Missing"
                                ? "badge-destructive"
                                : "badge-warning"
                          }
                        >
                          {match.status === "Found" ? t("found") : match.status === "Missing" ? t("missing") : t("duplicate")}
                          {match.status === "Duplicate" &&
                            ` (${match.all_matches.length})`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* === DIVIDER === */}
      <div className="border-t-2 border-border/60" />

      {/* === BOTTOM HALF: Sync Folder Names === */}
      <div className="flex flex-col" style={{ height: "220px", minHeight: "180px" }}>
        <div className="px-4 py-2 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-2 text-xs font-semibold">
            <FolderSync size={14} className="text-emerald-500" />
            Đồng bộ tên thư mục con
            {syncFolders.length > 0 && (
              <span className="badge badge-info text-[10px]">{syncFolders.length}</span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            {syncFolders.length > 0 && (
              <button
                onClick={clearSyncFolders}
                className="text-xs text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={12} />
                Xoá hết
              </button>
            )}
            <button
              onClick={handleAddSyncFolders}
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer font-medium"
            >
              <FolderOpen size={12} />
              Thêm
            </button>
          </div>
        </div>

        <div
          className={`flex-1 mx-4 mb-2 overflow-y-auto rounded-lg border-2 border-dashed transition-all ${
            syncFolders.length === 0 ? "border-border/60" : "border-border/30"
          }`}
        >
          {syncFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <FolderSync size={24} className="text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                Bấm <strong>Thêm</strong> để chọn nhiều thư mục cùng lúc
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {syncFolders.map((folder, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-card border border-border/40 group"
                >
                  <FolderOpen size={13} className="text-emerald-500 shrink-0" />
                  <span className="flex-1 text-xs truncate" title={folder}>
                    {getFolderName(folder)}
                  </span>
                  <button
                    onClick={() => removeSyncFolder(folder)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sync result message */}
        {syncResult && (
          <div className="mx-4 mb-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-1.5 whitespace-pre-line">
            {syncResult}
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 pb-3 flex gap-2 shrink-0">
          <button
            onClick={() => handleSyncAll("all")}
            disabled={isSyncing || syncFolders.length === 0}
            className="btn-primary text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <FolderSync size={13} />}
            Đồng bộ tất cả
          </button>
          <button
            onClick={() => handleSyncAll("last")}
            disabled={isSyncing || syncFolders.length === 0}
            className="btn-outline text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <FolderOpen size={13} />}
            Chỉ thư mục cuối
          </button>
        </div>
      </div>
    </div>
  );
}
