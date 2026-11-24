import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  XCircle,
  RotateCcw,
  SkipForward,
  X,
} from "lucide-react";
import type { CustomerCode, MatchResult } from "@/core/types";
import { useTranslation } from "@/core/lib/i18n";
import { listen } from "@tauri-apps/api/event";
import { SheetCodeExtractorModal } from "./SheetCodeExtractorModal";
import { CheckFilterStatusModal } from "./CheckFilterStatusModal";
import { FilterSyntaxHelpModal } from "./FilterSyntaxHelpModal";
import { AutoFindToggle } from "./AutoFindToggle";
import { autoFindService } from "../services/autoFindService";
import { buildScanSignature, useScanAndMatch } from "../features/scanner/hooks/useScanAndMatch";
import { analyzeCodeInputLines } from "../utils/codeLineHighlighter";

export {
  isCommandToken,
  cleanCodeToken,
  formatPastedCodes,
} from "../utils/codeFormatter";
import { formatPastedCodes } from "../utils/codeFormatter";

const CODE_LINE_HEIGHT_PX = 24;
const CODE_PAD_VERTICAL_PX = 12;
const CODE_GUTTER_WIDTH_PX = 38;
const CODE_TEXT_PAD_LEFT_PX = 10;
const CODE_TEXTAREA_PAD_LEFT_PX = CODE_GUTTER_WIDTH_PX + CODE_TEXT_PAD_LEFT_PX;

const EXTENSION_BRANCH_OPTIONS = [
  { id: "cr2", label: "CR2" },
  { id: "cr3", label: "CR3" },
  { id: "arw", label: "ARW" },
  { id: "nef", label: "NEF" },
  { id: "raf", label: "RAF" },
  { id: "dng", label: "DNG" },
  { id: "orf", label: "ORF" },
  { id: "rw2", label: "RW2" },
  { id: "jpg", label: "JPG" },
] as const;

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
  const inheritExtensionEnabled = useAppStore((s) => s.inheritExtensionEnabled);
  const setInheritExtensionEnabled = useAppStore((s) => s.setInheritExtensionEnabled);
  const inheritedExtensions = useAppStore((s) => s.inheritedExtensions);
  const toggleInheritedExtension = useAppStore((s) => s.toggleInheritedExtension);
  const pickerMode = useAppStore((s) => s.pickerMode);
  const autoFindEnabled = useAppStore((s) => s.autoFindEnabled);
  const isAutoFinding = useAppStore((s) => s.isAutoFinding);
  const autoFindStatus = useAppStore((s) => s.autoFindStatus);
  const setAutoFindStatus = useAppStore((s) => s.setAutoFindStatus);
  const selectedInputFolders = useAppStore((s) => s.selectedInputFolders);
  const inputFolders = useAppStore((s) => s.inputFolders);
  const codeLineFocusRequest = useAppStore((s) => s.codeLineFocusRequest);
  const clearCodeLineFocusRequest = useAppStore((s) => s.clearCodeLineFocusRequest);
  const [isParsingDebounced, setIsParsingDebounced] = useState(false);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [flashingLine, setFlashingLine] = useState<{ lineIndices: number[]; key: number } | null>(null);
  const [errorCycleIndex, setErrorCycleIndex] = useState(0);
  const { t, tr } = useTranslation();
  const { handleScanAndMatch } = useScanAndMatch();

  const handleToggleScanOption = useCallback(
    (patch: Partial<import("@/core/types").ScanOptions>) => {
      setScanOptions(patch);
      const st = useAppStore.getState();
      const effectiveFolders =
        st.selectedInputFolders.length > 0 ? st.selectedInputFolders : st.inputFolders;
      if (
        effectiveFolders.length > 0 &&
        (st.scannedFiles.length > 0 || st.matchResult !== null || st.rawCodeInput.trim().length > 0) &&
        st.phase !== "scanning" &&
        st.phase !== "copying"
      ) {
        void handleScanAndMatch();
      }
    },
    [setScanOptions, handleScanAndMatch]
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropTrackRef = useRef<HTMLDivElement>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandledFocusIdRef = useRef<number | null>(null);
  const activeCustomerFolder = selectedInputFolders[0] || inputFolders[0] || "";

  const lineAnalysis = useMemo(
    () =>
      analyzeCodeInputLines(
        rawCodeInput,
        matchResult,
        inheritExtensionEnabled ? inheritedExtensions : null
      ),
    [rawCodeInput, matchResult, inheritExtensionEnabled, inheritedExtensions]
  );

  // Clear any temporary flash animation whenever codes or matchResult change
  useEffect(() => {
    setFlashingLine(null);
  }, [rawCodeInput, matchResult]);

  const syncBackdropScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (backdropTrackRef.current) {
      backdropTrackRef.current.style.transform = `translate3d(0, -${textarea.scrollTop}px, 0)`;
    }
    setScrollLeft((prev) => (prev !== textarea.scrollLeft ? textarea.scrollLeft : prev));
  }, []);

  useEffect(() => {
    syncBackdropScroll();
  }, [rawCodeInput, syncBackdropScroll]);

  const jumpToCodeLine = useCallback(
    (lineIndex: number) => {
      const targetLine = lineAnalysis.lines[lineIndex];
      const textarea = textareaRef.current;
      if (!targetLine || !textarea) return;

      const lineTop = CODE_PAD_VERTICAL_PX + lineIndex * CODE_LINE_HEIGHT_PX;
      const viewportHeight = textarea.clientHeight;
      const targetScrollTop = Math.max(
        0,
        lineTop - viewportHeight / 2 + CODE_LINE_HEIGHT_PX / 2
      );

      textarea.scrollTop = targetScrollTop;
      syncBackdropScroll();

      textarea.focus({ preventScroll: true });
      try {
        textarea.setSelectionRange(targetLine.charStart, targetLine.charEnd);
      } catch {
        // Ignore selection errors if disabled
      }

      // Flash the target line AND any peer duplicate lines together so both duplicate lines flash in unison
      const peerIndices = (targetLine.peerDuplicateLineNumbers ?? []).map((ln) => ln - 1);
      const flashIndices = Array.from(new Set([lineIndex, ...peerIndices]));

      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
      setFlashingLine({ lineIndices: flashIndices, key: Date.now() });
      flashTimeoutRef.current = setTimeout(() => {
        setFlashingLine(null);
      }, 2200);
    },
    [lineAnalysis.lines, syncBackdropScroll]
  );

  useEffect(() => {
    if (!codeLineFocusRequest) return;
    if (lastHandledFocusIdRef.current === codeLineFocusRequest.id) return;
    lastHandledFocusIdRef.current = codeLineFocusRequest.id;
    const targetIdx = codeLineFocusRequest.lineIndex;
    clearCodeLineFocusRequest();
    if (targetIdx >= 0) {
      jumpToCodeLine(targetIdx);
    }
  }, [codeLineFocusRequest, clearCodeLineFocusRequest, jumpToCodeLine]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  const handleCycleMissingLines = useCallback(() => {
    const missingLines = lineAnalysis.errorLines.filter((l) => l.primaryStatus === "Missing");
    if (missingLines.length === 0) return;
    const nextIdx = errorCycleIndex % missingLines.length;
    setErrorCycleIndex((prev) => prev + 1);
    jumpToCodeLine(missingLines[nextIdx].lineIndex);
  }, [lineAnalysis.errorLines, errorCycleIndex, jumpToCodeLine]);

  const handleCycleDuplicateLines = useCallback(() => {
    const dupLines = lineAnalysis.errorLines.filter(
      (l) => l.primaryStatus === "InputDuplicate" || l.primaryStatus === "Duplicate"
    );
    if (dupLines.length === 0) return;
    const nextIdx = errorCycleIndex % dupLines.length;
    setErrorCycleIndex((prev) => prev + 1);
    jumpToCodeLine(dupLines[nextIdx].lineIndex);
  }, [lineAnalysis.errorLines, errorCycleIndex, jumpToCodeLine]);

  // Always keep Auto Find synchronized whenever the active customer changes in multi-customer mode
  // (e.g. clicking another customer/checkbox, manually deleting the active customer so the queue jumps
  // to the next customer, restoring a customer from trash, or filtering via Check TT).
  useEffect(() => {
    if (pickerMode !== "multi" || !autoFindEnabled) {
      autoFindService.resetActiveTarget();
      return;
    }
    if (!activeCustomerFolder) {
      autoFindService.resetActiveTarget();
      const st = useAppStore.getState();
      st.setAutoFindStatus(null);
      st.setRawCodeInput("");
      st.setParsedCodes([]);
      return;
    }
    if (autoFindService.getActiveTargetFolder() !== activeCustomerFolder) {
      const folderName =
        activeCustomerFolder.split(/[/\\]+/).filter(Boolean).pop() || activeCustomerFolder;
      void autoFindService.fetchAndApplyCodesForCustomer(activeCustomerFolder, folderName);
    }
  }, [pickerMode, autoFindEnabled, activeCustomerFolder]);

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

  // Debounced parsing + automatic in-memory re-matching when folder is already scanned
  const lastParsedInputRef = useRef<string | null>(null);
  const parseInput = useCallback(
    async (input: string, extEnabled: boolean, extList: string[]) => {
      const parseSig = `${input}::${extEnabled ? extList.join(",") : "off"}`;
      if (lastParsedInputRef.current === parseSig) {
        return;
      }
      if (!input.trim()) {
        lastParsedInputRef.current = parseSig;
        setParsedCodes([]);
        const st = useAppStore.getState();
        if (st.matchResult && st.phase !== "scanning" && st.phase !== "copying") {
          st.setMatchResult(null);
          if (st.scannedFiles.length > 0) {
            st.setPhase("scanned");
          }
        }
        return;
      }
      setIsParsingDebounced(true);
      try {
        const codes = await invoke<CustomerCode[]>("parse_customer_codes", {
          input,
          allowedExtensions: extEnabled ? extList : null,
        });
        // Ignore if user already typed newer text while IPC was in flight
        const curSt = useAppStore.getState();
        const curSig = `${curSt.rawCodeInput}::${
          curSt.inheritExtensionEnabled ? curSt.inheritedExtensions.join(",") : "off"
        }`;
        if (curSig !== parseSig) {
          return;
        }
        lastParsedInputRef.current = parseSig;
        setParsedCodes(codes);

        // If current folder has already been scanned with current options, re-match in RAM immediately (<1ms)
        const st = useAppStore.getState();
        const effectiveFolders =
          st.selectedInputFolders.length > 0 ? st.selectedInputFolders : st.inputFolders;
        const currentSig = buildScanSignature(effectiveFolders, st.scanOptions);

        if (
          st.scannedFiles.length > 0 &&
          st.lastScanSignature === currentSig &&
          st.phase !== "scanning" &&
          st.phase !== "copying"
        ) {
          if (codes.length > 0) {
            const result = await invoke<MatchResult>("match_photos", {
              codes,
              files: st.scannedFiles,
              mode: st.matchMode,
              regexPattern: st.matchMode === "Regex" ? st.regexPattern : null,
              folderCount: effectiveFolders.length,
              allowedExtensions: extEnabled ? extList : null,
            });
            if (useAppStore.getState().rawCodeInput === input) {
              st.setMatchResult(result);
              st.setPhase("matched");
            }
          } else {
            st.setMatchResult(null);
            st.setPhase("scanned");
          }
        }
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
      void parseInput(rawCodeInput, inheritExtensionEnabled, inheritedExtensions);
    }, 120);
    return () => clearTimeout(timer);
  }, [rawCodeInput, inheritExtensionEnabled, inheritedExtensions, parseInput]);

  // Re-match in RAM immediately if user switches matchMode or regexPattern while folder is already scanned
  useEffect(() => {
    const st = useAppStore.getState();
    const effectiveFolders =
      st.selectedInputFolders.length > 0 ? st.selectedInputFolders : st.inputFolders;
    const currentSig = buildScanSignature(effectiveFolders, st.scanOptions);

    if (
      st.scannedFiles.length > 0 &&
      st.lastScanSignature === currentSig &&
      st.parsedCodes.length > 0 &&
      st.phase !== "scanning" &&
      st.phase !== "copying"
    ) {
      invoke<MatchResult>("match_photos", {
        codes: st.parsedCodes,
        files: st.scannedFiles,
        mode: matchMode,
        regexPattern: matchMode === "Regex" ? regexPattern : null,
        folderCount: effectiveFolders.length,
        allowedExtensions: st.inheritExtensionEnabled ? st.inheritedExtensions : null,
      })
        .then((result) => {
          const cur = useAppStore.getState();
          if (cur.matchMode === matchMode && cur.scannedFiles.length > 0) {
            cur.setMatchResult(result);
            cur.setPhase("matched");
          }
        })
        .catch(() => {});
    }
  }, [matchMode, regexPattern]);

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
    <div className="panel flex-1 min-w-[300px] flex flex-col min-h-0 animate-fade-in">
      {/* === TOP HALF: Customer Codes === */}
      <div className="flex-1 flex flex-col min-h-0">
        <div
          className="panel-header py-2.5 px-3.5 flex flex-wrap items-center justify-start gap-1.5 min-w-0"
          style={{ justifyContent: "flex-start" }}
        >
          <span className="panel-title flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0 mr-0.5">
            <Code2 size={13} className="text-muted-foreground shrink-0" />
            <span>{t("customer_codes")}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setSheetModalInitialTab("extract");
              setIsSheetModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all select-none bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            title={tr("Truy xuất mã chọn của khách từ Google Sheet", "Extract customer selection codes from Google Sheet")}
          >
            <FileSpreadsheet
              size={12}
              strokeWidth={1.75}
              className="text-white shrink-0"
            />
            <span>{tr("Truy xuất trang tính", "Sheet Extract")}</span>
          </button>

          {/* Check TT Button: Only shown in multi-folder mode as requested */}
          {pickerMode === "multi" && (
            <button
              type="button"
              onClick={() => {
                setIsCheckStatusModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors select-none glass-pill hover:bg-foreground/[0.08] text-foreground cursor-pointer whitespace-nowrap shrink-0"
              title={tr("Kiểm tra đối soát trạng thái Chưa lọc trên Google Sheet để giữ lại khách cần lọc", "Check Google Sheet filter status to keep customers pending culling")}
            >
              <Filter
                size={12}
                strokeWidth={1.75}
                className="text-muted-foreground shrink-0"
              />
              <span>{tr("Check TT", "Status Check")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSheetModalInitialTab("config");
              setIsSheetModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors select-none glass-pill hover:bg-foreground/[0.08] text-foreground cursor-pointer whitespace-nowrap shrink-0"
            title={tr("Cấu hình cột và Tab Google Sheet cho ứng dụng Lọc ảnh", "Configure Google Sheet tabs and columns for Photo Picker")}
          >
            <Settings2
              size={12}
              strokeWidth={1.75}
              className="text-muted-foreground shrink-0"
            />
            <span>{tr("Cấu hình Sheet", "Sheet Config")}</span>
          </button>

          {isParsingDebounced && (
            <span className="text-[10px] text-muted-foreground animate-pulse whitespace-nowrap shrink-0">
              {tr("Đang tách mã...", "Parsing...")}
            </span>
          )}
          {lineAnalysis.missingLineCount > 0 && (
            <button
              type="button"
              onClick={handleCycleMissingLines}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium glass-pill hover:bg-foreground/[0.08] text-foreground tabular-nums cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title={tr(
                "Bấm để nhảy lần lượt tới từng dòng bị sai mã trong khung nhập",
                "Click to jump through missing code lines in the editor"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <span>
                {tr(
                  `${lineAnalysis.missingLineCount} dòng sai`,
                  `${lineAnalysis.missingLineCount} missing`
                )}
              </span>
            </button>
          )}
          {lineAnalysis.duplicateLineCount > 0 && (
            <button
              type="button"
              onClick={handleCycleDuplicateLines}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium glass-pill hover:bg-foreground/[0.08] text-foreground tabular-nums cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title={tr(
                "Bấm để nhảy lần lượt tới từng dòng bị trùng mã trong khung nhập",
                "Click to jump through duplicate code lines in the editor"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>
                {tr(
                  `${lineAnalysis.duplicateLineCount} dòng trùng`,
                  `${lineAnalysis.duplicateLineCount} duplicate`
                )}
              </span>
            </button>
          )}
          <span className="inline-flex items-center h-7 px-2.5 rounded-lg text-[11px] font-medium glass-pill text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
            {parsedCodes.length} {t("codes_count")}
          </span>
          <button
            type="button"
            onClick={() => setIsHelpModalOpen(true)}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg glass-pill text-muted-foreground hover:text-foreground hover:bg-foreground/[0.08] transition-colors cursor-pointer shrink-0"
            title={tr("Hướng dẫn cú pháp & xử lý trùng tiền tố", "Syntax guide & prefix conflict resolution")} aria-label={tr("Hướng dẫn cú pháp & xử lý trùng tiền tố", "Syntax guide & prefix conflict resolution")}
          >
            <HelpCircle size={13} strokeWidth={1.75} />
          </button>
        </div>

        {/* Match Mode Selector & Auto Find Toggle */}
        <div className="px-4 pt-2.5 flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span id="match-mode-label" className="text-[11px] font-medium text-muted-foreground whitespace-nowrap shrink-0">{t("mode")}:</span>
            <div role="radiogroup" aria-labelledby="match-mode-label" className="flex items-center gap-0.5 bg-foreground/[0.04] rounded-[10px] p-0.5 border border-border">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={matchMode === mode.id}
                  onClick={() => setMatchMode(mode.id)}
                  className={`flex items-center gap-1.5 px-2.5 h-6.5 rounded-[8px] text-[11.5px] transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                    matchMode === mode.id
                      ? "glass-pill text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={matchMode === mode.id ? "text-primary" : ""}>{mode.icon}</span>
                  <span>{mode.id === "ExactNumber" ? t("exact") : mode.id === "Contains" ? t("contains") : t("regex")}</span>
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
                  {tr(
                    `Auto Find: Chưa thể nạp mã cho ${autoFindStatus.targetCustomerName || "khách này"}`,
                    `Auto Find: Unable to load codes for ${autoFindStatus.targetCustomerName || "this customer"}`
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {autoFindStatus.message}
                </p>
              </div>
              <button
                type="button"
                aria-label={tr("Đóng thông báo", "Dismiss")}
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
                  title={tr("Bỏ qua khách này và chuyển ngay sang khách tiếp theo", "Skip this customer and advance to the next one")}
                >
                  <SkipForward size={11} />
                  <span>{tr("Bỏ qua sang khách tiếp", "Skip to next customer")}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRetryAutoFind}
                className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <RotateCcw size={11} />
                <span>{tr("Thử lại", "Retry")}</span>
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
                <span>{tr("Mở Truy xuất trang tính", "Open Sheet Extractor")}</span>
              </button>
            </div>
          </div>
        )}

        {autoFindStatus?.state === "success" && (
          <div className="mx-4 mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs animate-fade-in shadow-2xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">
                {tr("Đã nạp", "Loaded")} <strong>{tr(`${autoFindStatus.codeCount} mã`, `${autoFindStatus.codeCount} code(s)`)}</strong>{" "}
                {tr("cho", "for")} <strong>{autoFindStatus.targetCustomerName}</strong>. {tr("Hãy bấm", "Click")} <strong>{t("scan_match")}</strong>!
              </span>
            </div>
            <button
              type="button"
              aria-label={tr("Đóng", "Close")}
              onClick={() => setAutoFindStatus(null)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer shrink-0 ml-2"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Code Input Textarea with Synchronized Line-Level Error Highlighting */}
        <div className="flex-1 px-4 py-3 min-h-0 flex flex-col relative">
          <div
            className={`relative w-full h-full rounded-lg bg-muted/20 border transition-colors overflow-hidden ${
              lineAnalysis.missingLineCount > 0
                ? "border-red-500/45 focus-within:border-red-500/70 focus-within:ring-2 focus-within:ring-red-500/25"
                : lineAnalysis.duplicateLineCount > 0
                  ? "border-amber-500/45 focus-within:border-amber-500/70 focus-within:ring-2 focus-within:ring-amber-500/25"
                  : "border-border/60 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/40"
            }`}
          >
            {/* Left Line-Number Gutter Background Strip */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-muted/25 border-r border-border/40 pointer-events-none select-none z-0"
              style={{ width: `${CODE_GUTTER_WIDTH_PX}px` }}
            />

            {/* Synchronized Backdrop Overlay for Line Numbers, Pulsing Error Highlights & Inline Diagnostic Badges */}
            <div
              aria-hidden="true"
              className="absolute inset-0 overflow-hidden pointer-events-none select-none z-10"
            >
              <div
                ref={backdropTrackRef}
                className="w-full will-change-transform"
                style={{
                  paddingTop: `${CODE_PAD_VERTICAL_PX}px`,
                  paddingBottom: `${CODE_PAD_VERTICAL_PX}px`,
                }}
              >
                {lineAnalysis.lines.map((line) => {
                  const isMissing = line.primaryStatus === "Missing";
                  const isInputDup = line.primaryStatus === "InputDuplicate";
                  const isFileDup = line.primaryStatus === "Duplicate";
                  const isDup = isInputDup || isFileDup;
                  const isFound = line.primaryStatus === "Found";
                  const isCommand = line.primaryStatus === "Command";
                  const isFlashing = Boolean(
                    (isMissing || isDup) &&
                      flashingLine?.lineIndices.includes(line.lineIndex)
                  );
                  const peerLinesLabel =
                    line.peerDuplicateLineNumbers && line.peerDuplicateLineNumbers.length > 0
                      ? line.peerDuplicateLineNumbers.join(", ")
                      : line.duplicateOfLineNumber
                        ? String(line.duplicateOfLineNumber)
                        : "";

                  return (
                    <div
                      key={isFlashing && flashingLine ? `${line.lineIndex}-flash-${flashingLine.key}` : line.lineIndex}
                      data-code-line={line.lineNumber}
                      data-line-status={line.primaryStatus}
                      className={`relative flex items-center w-full transition-colors ${
                        isMissing
                          ? "code-line-missing-glow"
                          : isDup
                            ? "code-line-duplicate-glow"
                            : ""
                      } ${isFlashing ? "code-line-target-flash" : ""}`}
                      style={{
                        height: `${CODE_LINE_HEIGHT_PX}px`,
                        lineHeight: `${CODE_LINE_HEIGHT_PX}px`,
                      }}
                    >
                      {/* Line Number Gutter */}
                      <div
                        className={`shrink-0 pr-2 text-right font-mono text-[10px] tabular-nums select-none ${
                          isMissing
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : isDup
                              ? "text-amber-600 dark:text-amber-400 font-bold"
                              : isFound
                                ? "text-emerald-600/80 dark:text-emerald-400/80 font-medium"
                                : "text-muted-foreground/45"
                        }`}
                        style={{
                          width: `${CODE_GUTTER_WIDTH_PX}px`,
                          lineHeight: `${CODE_LINE_HEIGHT_PX}px`,
                        }}
                      >
                        {line.lineNumber}
                      </div>

                      {/* Code Mirror Text (100% pixel-aligned with textarea) */}
                      {rawCodeInput.length > 0 && (
                        <div
                          className="flex-1 min-w-0 overflow-hidden"
                          style={{
                            paddingLeft: `${CODE_TEXT_PAD_LEFT_PX}px`,
                            paddingRight: "14px",
                          }}
                        >
                          <div
                            className="whitespace-pre font-mono font-normal tracking-normal"
                            style={{
                              fontSize: "13px",
                              lineHeight: `${CODE_LINE_HEIGHT_PX}px`,
                              fontFeatureSettings: '"zero" 1, "ss01" 1',
                              tabSize: 4,
                              transform:
                                scrollLeft > 0 ? `translate3d(-${scrollLeft}px, 0, 0)` : undefined,
                            }}
                          >
                            <span
                              className={
                                isMissing
                                  ? "text-red-600 dark:text-red-300 underline decoration-wavy decoration-red-500/80 underline-offset-4"
                                  : isDup
                                    ? "text-amber-700 dark:text-amber-300 underline decoration-dashed decoration-amber-500/80 underline-offset-4"
                                    : isCommand
                                      ? "text-cyan-600 dark:text-cyan-400"
                                      : "text-foreground"
                              }
                            >
                              {line.rawText || " "}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Right-Side Inline Error / Duplicate Diagnostic Badge */}
                      {isMissing && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-none font-semibold bg-red-500/20 text-red-700 dark:text-red-200 border border-red-500/45 shadow-2xs backdrop-blur-xs">
                            <XCircle size={10} className="text-red-500 shrink-0" />
                            <span>
                              {line.missingCountOnLine > 1
                                ? tr(`Sai ${line.missingCountOnLine} mã`, `${line.missingCountOnLine} missing`)
                                : tr("Sai mã", "Missing")}
                            </span>
                          </span>
                        </div>
                      )}

                      {isInputDup && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-none font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/45 shadow-2xs backdrop-blur-xs">
                            <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                            <span>
                              {peerLinesLabel
                                ? tr(
                                    `Trùng mã (dòng ${peerLinesLabel})`,
                                    `Duplicate (line ${peerLinesLabel})`
                                  )
                                : tr("Trùng mã", "Duplicate")}
                            </span>
                          </span>
                        </div>
                      )}

                      {isFileDup && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-none font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/45 shadow-2xs backdrop-blur-xs">
                            <AlertTriangle size={10} className="text-amber-500 shrink-0" />
                            <span>
                              {tr(
                                `Trùng (${line.fileMatchCount ?? 2} file)`,
                                `Multi (${line.fileMatchCount ?? 2} files)`
                              )}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Native Textarea */}
            <textarea
              ref={textareaRef}
              aria-label={t("customer_codes")}
              wrap="off"
              className={`relative z-20 w-full h-full resize-none font-mono font-normal tracking-normal bg-transparent border-0 rounded-lg focus:outline-none placeholder:text-muted-foreground/80 disabled:opacity-60 ${
                rawCodeInput.length > 0
                  ? "text-transparent caret-foreground selection:bg-primary/25 selection:text-transparent"
                  : "text-foreground"
              }`}
              style={{
                fontSize: "13px",
                lineHeight: `${CODE_LINE_HEIGHT_PX}px`,
                paddingTop: `${CODE_PAD_VERTICAL_PX}px`,
                paddingBottom: `${CODE_PAD_VERTICAL_PX}px`,
                paddingLeft: `${CODE_TEXTAREA_PAD_LEFT_PX}px`,
                paddingRight: "14px",
                fontFeatureSettings: '"zero" 1, "ss01" 1',
                tabSize: 4,
                scrollbarWidth: "thin",
              }}
              placeholder={t("paste_codes_here")}
              value={rawCodeInput}
              onChange={(e) => setRawCodeInput(e.target.value)}
              onScroll={syncBackdropScroll}
              onPaste={handlePaste}
              spellCheck={false}
              disabled={phase === "scanning" || phase === "copying" || isAutoFinding}
            />
          </div>

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
                <span>{tr("Đang tự động nạp mã từ Google Sheet...", "Auto-loading customer codes from Google Sheet...")}</span>
              </h4>

              <p className="text-xs text-muted-foreground mt-1 max-w-sm font-mono">
                {autoFindStatus?.targetCustomerName
                  ? tr(`Khách: ${autoFindStatus.targetCustomerName}`, `Customer: ${autoFindStatus.targetCustomerName}`)
                  : tr("Đang đối chiếu dữ liệu bảng tính...", "Matching spreadsheet rows...")}
              </p>

              <span className="text-[10px] text-muted-foreground/80 mt-2 px-2.5 py-0.5 rounded-full bg-muted/60 border border-border/50">
                {tr("Chờ nạp xong để bấm Quét file", "Wait for codes to load, then click Scan & Match")}
              </span>
            </div>
          )}
        </div>

        {/* Scan Options */}
        <div className="flex flex-col items-center gap-2 pb-3 px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={scanOptions.filter_raw}
                onChange={(e) => handleToggleScanOption({ filter_raw: e.target.checked })}
                disabled={phase === "scanning" || phase === "copying"}
                className="rounded border-border accent-primary cursor-pointer disabled:opacity-50 w-3.5 h-3.5"
              />
              <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>{tr("Lọc Raw", "Filter RAW")}</span>
            </label>
            
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={scanOptions.filter_jpg}
                onChange={(e) => handleToggleScanOption({ filter_jpg: e.target.checked })}
                disabled={phase === "scanning" || phase === "copying"}
                className="rounded border-border accent-primary cursor-pointer disabled:opacity-50 w-3.5 h-3.5"
              />
              <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>{tr("Lọc JPG", "Filter JPG")}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!scanOptions.recursive}
                onChange={(e) => handleToggleScanOption({ recursive: !e.target.checked })}
                disabled={phase === "scanning" || phase === "copying"}
                className="rounded border-border accent-primary cursor-pointer disabled:opacity-50 w-3.5 h-3.5"
              />
              <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>{tr("Chỉ thư mục chọn", "Selected folder only")}</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={scanOptions.recursive}
                onChange={(e) => handleToggleScanOption({ recursive: e.target.checked })}
                disabled={phase === "scanning" || phase === "copying"}
                className="rounded border-border accent-primary cursor-pointer disabled:opacity-50 w-3.5 h-3.5"
              />
              <span className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} text-muted-foreground`}>{tr("Lọc tất cả thư mục con", "All subfolders")}</span>
            </label>

            <label
              className="flex items-center gap-1.5 cursor-pointer"
              title={tr(
                "Khi bật: nếu gắn đuôi file (ví dụ .CR2, .CR3) vào mã đầu tiên thì các mã bên dưới sẽ ăn theo đuôi đó để phân biệt trùng mã khác đuôi. Khi tắt: lọc theo mã số như bình thường (khách gửi .JPG vẫn lọc được file RAW).",
                "When enabled: appending an extension (e.g. .CR2, .CR3) to the first code cascades it to subsequent codes. When disabled: standard matching ignores input extensions so .JPG codes still match RAW files."
              )}
            >
              <input
                type="checkbox"
                checked={inheritExtensionEnabled}
                onChange={(e) => setInheritExtensionEnabled(e.target.checked)}
                disabled={phase === "scanning" || phase === "copying"}
                className="rounded border-border accent-primary cursor-pointer disabled:opacity-50 w-3.5 h-3.5"
              />
              <span
                className={`${phase === "scanning" || phase === "copying" ? "opacity-50" : ""} ${
                  inheritExtensionEnabled ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {tr("Kế thừa hậu tố đuôi file", "Inherit file extension")}
              </span>
            </label>
          </div>

          {/* Branch Extension Choices — only shown when "Kế thừa hậu tố đuôi file" is checked */}
          {inheritExtensionEnabled && (
            <div className="flex flex-wrap items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/[0.03] border border-border/60 animate-fade-in">
              <span className="text-[10.5px] text-muted-foreground mr-1 whitespace-nowrap">
                {tr("Đuôi kế thừa:", "Extensions:")}
              </span>
              {EXTENSION_BRANCH_OPTIONS.map((opt) => {
                const isChecked = inheritedExtensions.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-mono cursor-pointer select-none border transition-colors whitespace-nowrap ${
                      isChecked
                        ? "glass-pill text-foreground font-semibold border-primary/40"
                        : "border-transparent text-muted-foreground hover:text-foreground bg-foreground/[0.03]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleInheritedExtension(opt.id)}
                      disabled={phase === "scanning" || phase === "copying"}
                      className="rounded border-border accent-primary cursor-pointer w-3 h-3"
                    />
                    <span>.{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}
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
