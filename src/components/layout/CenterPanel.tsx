import { useAppStore } from "@/stores/useAppStore";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { Code2, Hash, Regex, Search } from "lucide-react";
import type { CustomerCode } from "@/types";
import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();

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

  const modes = [
    { id: "ExactNumber", label: "Exact", icon: <Hash size={12} /> },
    { id: "Contains", label: "Contains", icon: <Search size={12} /> },
    { id: "Regex", label: "Regex", icon: <Regex size={12} /> },
  ];

  return (
      <div className="panel flex-1 flex flex-col min-h-0 animate-fade-in">
      <div className="panel-header">
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
  );
}
