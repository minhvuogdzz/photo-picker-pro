import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Code2,
  Hash,
  Regex,
  Search,
  FileSpreadsheet,
  Settings2,
  Filter,
  HelpCircle,
  Zap,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  SkipForward,
  X,
} from "lucide-react";
import type { CustomerCode } from "@/core/types";
import { useTranslation } from "@/core/lib/i18n";
import { listen } from "@tauri-apps/api/event";
import { SheetCodeExtractorModal } from "./SheetCodeExtractorModal";
import { CheckFilterStatusModal } from "./CheckFilterStatusModal";
import { FilterSyntaxHelpModal } from "./FilterSyntaxHelpModal";
import { AutoFindToggle } from "./AutoFindToggle";
import { autoFindService } from "../services/autoFindService";

export {
  isCommandToken,
  cleanCodeToken,
  formatPastedCodes,
} from "../utils/codeFormatter";
import { formatPastedCodes } from "../utils/codeFormatter";

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
  const pickerMode = useAppStore((s) => s.pickerMode);
  const isAutoFinding = useAppStore((s) => s.isAutoFinding);
  const autoFindStatus = useAppStore((s) => s.autoFindStatus);
  const setAutoFindStatus = useAppStore((s) => s.setAutoFindStatus);
  const selectedInputFolders = useAppStore((s) => s.selectedInputFolders);
  const inputFolders = useAppStore((s) => s.inputFolders);
  const [isParsingDebounced, setIsParsingDebounced] = useState(false);
  const { t } = useTranslation();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleRetryAutoFind = async () => {
    const activeFolder = selectedInputFolders[0] || inputFolders[0];
    if (activeFolder) {
      const folderName = activeFolder.split(/[/\\]+/).filter(Boolean).pop() || activeFolder;
      autoFindService.clearCache();
      await autoFindService.fetchAndApplyCodesForCustomer(activeFolder, folderName, { forceFresh: true });
    }
  };

  const handleSkipAutoFind = () => {
    const activeFolder = selectedInputFolders[0] || inputFolders[0];
    if (activeFolder) {
      const folderName = activeFolder.split(/[/\\]+/).filter(Boolean).pop() || activeFolder;
      const store = useAppStore.getState();
      const activeEl =
        document.getElementById("active-customer-queue-item") ||
        document.querySelector(`[data-customer-folder="${activeFolder}"]`) ||
        document.querySelector(`[data-folder-name="${folderName}"]`);
      const rect = activeEl?.getBoundingClientRect();
      const startPos = rect
        ? { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
        : undefined;

      store.triggerTossAnimation(folderName, startPos);
      store.addEjectedCustomer({
        folderPath: activeFolder,
        folderName,
        copyCount: 0,
      });
      store.removeInputFolder(activeFolder);
      store.setAutoFindStatus(null);
      store.setPhase("idle");
      store.setRawCodeInput("");
      store.setParsedCodes([]);

      const updatedStore = useAppStore.getState();
      const nextFolder = updatedStore.selectedInputFolders[0] || updatedStore.inputFolders[0];
      if (nextFolder) {
        const nextName = nextFolder.split(/[/\\]+/).filter(Boolean).pop() || nextFolder;
        void autoFindService.fetchAndApplyCodesForCustomer(nextFolder, nextName);
      }
    }
  };



  // Sheet Code Extractor Modal state
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [sheetModalInitialTab, setSheetModalInitialTab] = useState<"extract" | "config">("extract");
  const [isCheckStatusModalOpen, setIsCheckStatusModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Debounced parsing
  const lastParsedInputRef = useRef<string | null>(null);
  const parseInput = useCallback(
    async (input: string) => {
      if (lastParsedInputRef.current === input) {
        return;
      }
      if (!input.trim()) {
        lastParsedInputRef.current = "";
        setParsedCodes([]);
        return;
      }
      setIsParsingDebounced(true);
      try {
        const codes = await invoke<CustomerCode[]>("parse_customer_codes", {
          input,
        });
        lastParsedInputRef.current = input;
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


  const modes = [
    { id: "ExactNumber", label: "Exact", icon: <Hash size={11} /> },
    { id: "Contains", label: "Contains", icon: <Search size={11} /> },
    { id: "Regex", label: "Regex", icon: <Regex size={11} /> },
  ];

  return (
    <div className="panel flex-1 flex flex-col min-h-0 animate-fade-in">
      {/* === TOP HALF: Customer Codes === */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="panel-header py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="panel-title flex items-center gap-2 text-xs">
              <Code2 size={13} className="text-muted-foreground" />
              {t("customer_codes")}
            </span>
            <button
              type="button"
              onClick={() => {
                setSheetModalInitialTab("extract");
                setIsSheetModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all group shadow-2xs select-none bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 cursor-pointer"
              title="Truy xuất mã chọn của khách từ Google Sheet"
            >
              <FileSpreadsheet
                size={12}
                className="text-emerald-500 group-hover:scale-110 transition-transform"
              />
              <span>Truy xuất trang tính</span>
            </button>

            {/* Check TT Button: Only shown in multi-folder mode as requested */}
            {pickerMode === "multi" && (
              <button
                type="button"
                onClick={() => {
                  setIsCheckStatusModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all group shadow-2xs animate-fade-in select-none bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border-amber-500/35 hover:border-amber-500/60 cursor-pointer"
                title="Kiểm tra đối soát trạng thái Chưa lọc trên Google Sheet để giữ lại khách cần lọc"
              >
                <Filter
                  size={12}
                  className="text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform"
                />
                <span>Check TT</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSheetModalInitialTab("config");
                setIsSheetModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border transition-all group shadow-2xs select-none bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60 hover:border-border cursor-pointer"
              title="Cấu hình cột và Tab Google Sheet cho ứng dụng Lọc ảnh"
            >
              <Settings2
                size={12}
                className="text-muted-foreground group-hover:rotate-45 transition-transform"
              />
              <span>Cấu hình Sheet</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {isParsingDebounced && (
              <span className="text-[10px] text-muted-foreground animate-pulse">
                Parsing...
              </span>
            )}
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/50 tabular-nums">
              {parsedCodes.length} {t("codes_count")}
            </span>
            <button
              type="button"
              onClick={() => setIsHelpModalOpen(true)}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all border border-border/60 hover:border-primary/50 cursor-pointer shadow-2xs group"
              title="Hướng dẫn cú pháp & xử lý trùng tiền tố" aria-label="Hướng dẫn cú pháp & xử lý trùng tiền tố"
            >
              <HelpCircle size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </div>
        </div>

        {/* Match Mode Selector & Auto Find Toggle */}
        <div className="px-4 pt-2.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <span id="match-mode-label" className="text-[11px] font-medium text-muted-foreground">{t("mode")}:</span>
            <div role="radiogroup" aria-labelledby="match-mode-label" className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5 border border-border/50">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={matchMode === mode.id}
                  onClick={() => setMatchMode(mode.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] transition-colors cursor-pointer ${
                    matchMode === mode.id
                      ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  }`}
                >
                  {mode.icon}
                  {mode.id === "ExactNumber" ? t("exact") : mode.id === "Contains" ? t("contains") : t("regex")}
                </button>
              ))}
            </div>
          </div>

          {/* Right side: Auto Find Toggle */}
          <AutoFindToggle />
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
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              {t("regex_hint")}
            </p>
          </div>
        )}

        {/* Auto Find Status Feedback Banners */}
        {autoFindStatus?.state === "error" && (
          <div className="mx-4 mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 animate-fade-in flex flex-col gap-1.5 shadow-2xs">
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground">
                  Auto Find: Chưa thể nạp mã cho {autoFindStatus.targetCustomerName || "khách này"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {autoFindStatus.message}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => setAutoFindStatus(null)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end pt-1">
              {pickerMode === "multi" && inputFolders.length > 1 && (
                <button
                  type="button"
                  onClick={handleSkipAutoFind}
                  className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  title="Bỏ qua khách này và chuyển ngay sang khách tiếp theo"
                >
                  <SkipForward size={11} />
                  <span>Bỏ qua sang khách tiếp</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRetryAutoFind}
                className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <RotateCcw size={11} />
                <span>Thử lại</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetModalInitialTab("extract");
                  setIsSheetModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-md bg-card hover:bg-muted border border-border text-foreground font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet size={11} />
                <span>Mở Truy xuất trang tính</span>
              </button>
            </div>
          </div>
        )}

        {autoFindStatus?.state === "success" && (
          <div className="mx-4 mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs animate-fade-in shadow-2xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">
                Đã nạp <strong>{autoFindStatus.codeCount} mã</strong> cho <strong>{autoFindStatus.targetCustomerName}</strong>. Hãy bấm <strong>Quét file</strong>!
              </span>
            </div>
            <button
              type="button"
              aria-label="Đóng"
              onClick={() => setAutoFindStatus(null)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer shrink-0 ml-2"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Code Input Textarea */}
        <div className="flex-1 px-4 py-3 min-h-0 flex flex-col relative">
          <textarea
            ref={textareaRef}
            aria-label={t("customer_codes")}
            className="w-full h-full resize-none font-mono text-[13px] leading-relaxed p-3.5 bg-muted/20 border border-border/60 text-foreground rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus:border-primary/50 transition-colors placeholder:text-muted-foreground/80 disabled:opacity-60"
            style={{ fontFeatureSettings: '"zero" 1, "ss01" 1', scrollbarWidth: 'thin' }}
            placeholder={t("paste_codes_here")}
            value={rawCodeInput}
            onChange={(e) => setRawCodeInput(e.target.value)}
            onPaste={handlePaste}
            spellCheck={false}
            disabled={phase === "scanning" || phase === "copying" || isAutoFinding}
          />

          {/* Hiệu ứng loading chờ quét giữa chừng */}
          {isAutoFinding && (
            <div className="absolute inset-x-4 inset-y-3 z-30 rounded-lg bg-card/90 backdrop-blur-xs border-2 border-emerald-500/40 shadow-xl flex flex-col items-center justify-center p-5 animate-fade-in text-center overflow-hidden">
              {/* Animated top shimmer bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-[srgb-text-flow_2s_linear_infinite]" />

              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(16,185,129,0.25)] animate-pulse">
                <Zap size={22} className="fill-emerald-500/40" />
              </div>

              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Loader2 size={15} className="animate-spin text-emerald-500" />
                <span>Đang tự động nạp mã từ Google Sheet...</span>
              </h4>

              <p className="text-xs text-muted-foreground mt-1 max-w-sm font-mono">
                {autoFindStatus?.targetCustomerName
                  ? `Khách: ${autoFindStatus.targetCustomerName}`
                  : "Đang đối chiếu dữ liệu bảng tính..."}
              </p>

              <span className="text-[10px] text-muted-foreground/80 mt-2 px-2.5 py-0.5 rounded-full bg-muted/60 border border-border/50">
                Chờ nạp xong để bấm Quét file
              </span>
            </div>
          )}
        </div>

        {/* Scan Options */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs pb-3 px-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.filter_raw}
              onChange={(e) => setScanOptions({ filter_raw: e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border accent-primary cursor-pointer disabled:opacity-50 w-3.5 h-3.5"
            />
            <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>Lọc Raw</span>
          </label>
          
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.filter_jpg}
              onChange={(e) => setScanOptions({ filter_jpg: e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border accent-primary cursor-pointer disabled:opacity-50 w-3.5 h-3.5"
            />
            <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>Lọc JPG</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!scanOptions.recursive}
              onChange={(e) => setScanOptions({ recursive: !e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border accent-primary cursor-pointer disabled:opacity-50 w-3.5 h-3.5"
            />
            <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>Chỉ thư mục chọn</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={scanOptions.recursive}
              onChange={(e) => setScanOptions({ recursive: e.target.checked })}
              disabled={phase === "scanning" || phase === "copying"}
              className="rounded border-border accent-primary cursor-pointer disabled:opacity-50 w-3.5 h-3.5"
            />
            <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>Lọc tất cả thư mục con</span>
          </label>
        </div>


      </div>


      {/* Sheet Code Extractor Modal */}
      <SheetCodeExtractorModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        initialTab={sheetModalInitialTab}
      />

      {/* Check TT Filter Status Modal */}
      <CheckFilterStatusModal
        isOpen={isCheckStatusModalOpen}
        onClose={() => setIsCheckStatusModalOpen(false)}
      />

      {/* Filter Syntax Help Modal */}
      <FilterSyntaxHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

    </div>
  );
}
