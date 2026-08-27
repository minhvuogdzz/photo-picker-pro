import { useAppStore } from "@/core/stores/useAppStore";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
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
import type { CustomerCode } from "@/core/types";
import { useTranslation } from "@/core/lib/i18n";
import { getFolderName } from "@/core/lib/utils";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";

const VALID_EXTENSIONS_SET = new Set([
  "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp",
  "heic", "heif", "raw", "cr2", "cr3", "nef", "arw", "orf",
  "rw2", "dng", "raf", "pef", "srw", "x3f", "psd"
]);

const EXTENSION_REGEX = /\.(jpe?g|png|gif|bmp|tiff?|webp|heic|heif|raw|cr[23]|nef|arw|orf|rw2|dng|raf|pef|srw|x3f|psd)$/i;

/**
 * Clean a single token:
 * Strips all non-alphanumeric characters from leading and trailing ends of each code,
 * while preserving valid image file extensions (e.g. .jpg, .cr3, .png, etc.)
 * and camera prefix underscore (e.g. _MG_1234.CR2).
 */
export function cleanCodeToken(token: string): string {
  let t = token.trim();
  if (!t) return "";

  // 1. Strip leading non-alphanumeric characters.
  //    Keep leading '_' only if immediately followed by an alphabetic character (e.g. _MG_1234, _DSC001)
  t = t.replace(/^[^a-zA-Z0-9_]+/, "");
  t = t.replace(/^_(?![a-zA-Z])/, "");

  // 2. Strip trailing symbols/punctuation
  t = t.replace(/[^a-zA-Z0-9_.]+$/, "");

  // Check if it ends with a valid image extension
  const hasValidExt = EXTENSION_REGEX.test(t);

  if (!hasValidExt) {
    // If not a valid file extension, strip any trailing dots, underscores, dashes
    t = t.replace(/[._-]+$/, "");
  }

  // Strip any remaining trailing non-alphanumeric symbols if not part of valid ext
  if (!hasValidExt) {
    t = t.replace(/[^a-zA-Z0-9]+$/, "");
  }

  return t.trim();
}

/**
 * Auto-format pasted codes:
 * - Normalizes quotes, unicode zeros, unicode dashes.
 * - Handles codes joined by dots when NOT a file extension (e.g. zha0401.zha0407 -> zha0401, zha0407).
 * - Handles codes joined by dashes (e.g. HPP01099-01006-01078 or ZHA_0555-0573-0576 or HYTU3068.CR3-HYTU3124.CR3).
 * - Handles codes joined by pluses, slashes, colons, commas, semicolons, tabs, pipes, brackets, spaces.
 * - Cleans leading/trailing non-alphanumeric symbols from every code.
 * - Outputs one code per line.
 */
export function formatPastedCodes(text: string): string {
  if (!text || !text.trim()) return "";

  // 1. Normalize all quote types (curly/smart quotes → straight) then strip them
  let normalized = text
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036«»„‟]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  normalized = normalized.replace(/["']/g, "");

  // Normalize unicode zeros to standard ASCII '0'
  normalized = normalized
    .replace(/[\uFF10\u{1D7F6}\u{1D7CE}\u{1D7D8}\u{1D7E2}\u{1D7EC}\u3007]/gu, "0");

  // Normalize unicode dashes to standard hyphen '-'
  normalized = normalized.replace(/[\u2010-\u2015\u2212]/g, "-");

  // 2. Separate valid file extensions that are followed by another code:
  //    e.g. "HYTU3068.CR3-HYTU3124.CR3" or "zha0401.jpg.zha0407.jpg" or "zha0401.jpg+zha0407"
  normalized = normalized.replace(
    /(\.(?:jpe?g|png|gif|bmp|tiff?|webp|heic|heif|raw|cr[23]|nef|arw|orf|rw2|dng|raf|pef|srw|x3f|psd))([^a-zA-Z0-9\s]*)([a-zA-Z0-9])/gi,
    "$1\n$3"
  );

  // 3. Separate codes joined by dots when NOT a valid file extension:
  //    e.g. "zha0401.zha0407" or "01234.01235" -> check if the part after dot is a valid extension.
  //    If not, replace dot with newline.
  normalized = normalized.replace(/\.([a-zA-Z0-9_]+)/g, (match, afterDot) => {
    if (VALID_EXTENSIONS_SET.has(afterDot.toLowerCase())) {
      return match; // keep valid extension like .jpg
    }
    return "\n" + afterDot; // split into new line
  });

  // 4. Separate dash-joined codes/numbers:
  //    e.g. "HPP01099-01006-01078-00987"
  //    e.g. "ZHA_0555-0573-0576"
  //    e.g. "01099-01006"
  //    Match: any digit(s) followed by dash(es) followed by alphanumeric
  while (/(\d+)-+([a-zA-Z0-9])/g.test(normalized)) {
    normalized = normalized.replace(/(\d+)-+([a-zA-Z0-9])/g, "$1\n$2");
  }

  // 5. Replace plus signs '+' and other explicit delimiter symbols with newline:
  //    e.g. "+1234+5678" or "+zha0401+zha0407" or "[zha0401] [zha0407]"
  normalized = normalized.replace(/[+;,|/\\:()<>[\]{}*~#!?^$%&•·]+/g, "\n");

  // 6. Split by newlines and whitespace
  const rawTokens = normalized.split(/[\r\n\s]+/);

  const cleaned: string[] = [];
  for (const raw of rawTokens) {
    const t = cleanCodeToken(raw);
    if (t.length > 0) {
      cleaned.push(t);
    }
  }

  return cleaned.join("\n");
}

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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Handle paste event — auto-format codes and respect selection / replacement
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData("text/plain");
      if (!pastedText) return;

      // Prevent default paste behavior so we can apply formatted text
      e.preventDefault();

      const formatted = formatPastedCodes(pastedText);
      if (!formatted) return;

      const textarea = textareaRef.current;
      const current = rawCodeInput;

      let newValue = formatted;

      if (textarea) {
        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;

        if (start === 0 && end === current.length) {
          // Entire text is selected (e.g. Cmd+A) -> replace everything
          newValue = formatted;
        } else if (start !== end) {
          // A substring is selected -> replace only the selected portion
          const before = current.substring(0, start);
          const after = current.substring(end);
          newValue = before + formatted + after;
        } else if (current.trim() === "") {
          // Textarea is currently empty -> simply set formatted
          newValue = formatted;
        } else {
          // Cursor is at a single position without selection
          const before = current.substring(0, start);
          const after = current.substring(start);

          if (start === current.length) {
            // Cursor is at the end -> append with newline
            const trimmedCurrent = current.trimEnd();
            newValue = trimmedCurrent ? trimmedCurrent + "\n" + formatted : formatted;
          } else {
            // Cursor is in the middle -> insert at cursor
            newValue = before + formatted + after;
          }
        }
      } else {
        const trimmedCurrent = current.trim();
        newValue = trimmedCurrent ? trimmedCurrent + "\n" + formatted : formatted;
      }

      setRawCodeInput(newValue);
    },
    [rawCodeInput, setRawCodeInput]
  );

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
    { id: "ExactNumber", label: "Exact", icon: <Hash size={11} /> },
    { id: "Contains", label: "Contains", icon: <Search size={11} /> },
    { id: "Regex", label: "Regex", icon: <Regex size={11} /> },
  ];

  return (
    <div className="panel flex-1 flex flex-col min-h-0 animate-fade-in">
      {/* === TOP HALF: Customer Codes === */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="panel-header py-3 px-4">
          <span className="panel-title flex items-center gap-2 text-xs">
            <Code2 size={13} className="text-muted-foreground" />
            {t("customer_codes")}
          </span>
          <div className="flex items-center gap-2">
            {isParsingDebounced && (
              <span className="text-[10px] text-muted-foreground animate-pulse">
                Parsing...
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/40">
              {parsedCodes.length} {t("codes_count")}
            </span>
          </div>
        </div>

        {/* Match Mode Selector */}
        <div className="px-4 pt-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{t("mode")}:</span>
          <div className="flex gap-0.5 bg-muted/40 rounded-md p-0.5">
            {modes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setMatchMode(mode.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all cursor-pointer ${
                  matchMode === mode.id
                    ? "bg-primary text-primary-foreground shadow-sm font-medium"
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
              className="input-field text-[11px] font-mono py-1.5"
              placeholder={t("regex_placeholder")}
              value={regexPattern}
              onChange={(e) => setRegexPattern(e.target.value)}
            />
            <p className="text-[9px] text-muted-foreground/70 mt-1 leading-relaxed">
              {t("regex_hint")}
            </p>
          </div>
        )}

        {/* Code Input Textarea */}
        <div className="flex-1 px-4 py-3 min-h-0 flex flex-col">
          <textarea
            ref={textareaRef}
            className="w-full h-full resize-none font-mono text-[12px] leading-relaxed p-3 bg-muted/20 border border-border/50 text-foreground rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-muted-foreground/40"
            style={{ fontFeatureSettings: '"zero" 1, "ss01" 1', scrollbarWidth: 'thin' }}
            placeholder={t("paste_codes_here")}
            value={rawCodeInput}
            onChange={(e) => setRawCodeInput(e.target.value)}
            onPaste={handlePaste}
            spellCheck={false}
            disabled={phase === "scanning" || phase === "copying"}
          />
        </div>

        {/* Scan Options */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] pb-2.5 px-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.filter_raw}
              onChange={(e) => setScanOptions({ filter_raw: e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer disabled:opacity-50 w-3 h-3"
            />
            <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>Lọc Raw</span>
          </label>
          
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.filter_jpg}
              onChange={(e) => setScanOptions({ filter_jpg: e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer disabled:opacity-50 w-3 h-3"
            />
            <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>Lọc JPG</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!scanOptions.recursive}
              onChange={(e) => setScanOptions({ recursive: !e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer disabled:opacity-50 w-3 h-3"
            />
            <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>Chỉ thư mục chọn</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.recursive}
              onChange={(e) => setScanOptions({ recursive: e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border text-primary focus:ring-primary/50 cursor-pointer disabled:opacity-50 w-3 h-3"
            />
            <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>Lọc tất cả thư mục con</span>
          </label>
        </div>


      </div>

      {/* === DIVIDER === */}
      <div className="border-t border-border/50" />

      {/* === BOTTOM HALF: Sync Folder Names === */}
      <div className="flex flex-col" style={{ height: "200px", minHeight: "160px" }}>
        <div className="px-4 py-2 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-2 text-[11px] font-medium text-foreground">
            <FolderSync size={13} className="text-emerald-500" />
            Đồng bộ tên thư mục con
            {syncFolders.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/40">{syncFolders.length}</span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            {syncFolders.length > 0 && (
              <button
                onClick={clearSyncFolders}
                className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={10} />
                Xoá hết
              </button>
            )}
            <button
              onClick={handleAddSyncFolders}
              className="text-[10px] text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer font-medium"
            >
              <FolderOpen size={10} />
              Thêm
            </button>
          </div>
        </div>

        <div
          className={`flex-1 mx-4 mb-2 overflow-y-auto rounded-lg border border-dashed transition-all ${
            syncFolders.length === 0 ? "border-border/50" : "border-border/30"
          }`}
        >
          {syncFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <FolderSync size={20} className="text-muted-foreground/30 mb-1.5" />
              <p className="text-[10px] text-muted-foreground">
                Bấm <strong>Thêm</strong> để chọn nhiều thư mục cùng lúc
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {syncFolders.map((folder, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-card border border-border/30 group"
                >
                  <FolderOpen size={12} className="text-emerald-500 shrink-0" />
                  <span className="flex-1 text-[11px] truncate" title={folder}>
                    {getFolderName(folder)}
                  </span>
                  <button
                    onClick={() => removeSyncFolder(folder)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sync result message */}
        {syncResult && (
          <div className="mx-4 mb-2 text-[10px] text-muted-foreground bg-muted/20 rounded-md px-2.5 py-1.5 whitespace-pre-line">
            {syncResult}
          </div>
        )}

        {/* Action buttons */}
        <div className="px-4 pb-2.5 flex gap-2 shrink-0">
          <button
            onClick={() => handleSyncAll("all")}
            disabled={isSyncing || syncFolders.length === 0}
            className="btn-primary text-[11px] py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40 rounded-lg"
          >
            {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <FolderSync size={12} />}
            Đồng bộ tất cả
          </button>
          <button
            onClick={() => handleSyncAll("last")}
            disabled={isSyncing || syncFolders.length === 0}
            className="btn-outline text-[11px] py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5 disabled:opacity-40 rounded-lg"
          >
            {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <FolderOpen size={12} />}
            Chỉ thư mục cuối
          </button>
        </div>
      </div>
    </div>
  );
}
