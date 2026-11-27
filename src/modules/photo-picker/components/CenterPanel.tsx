import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileSpreadsheet,
  Settings2,
  HelpCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  SkipForward,
  X,
  SlidersHorizontal,
  ChevronDown,
  ListChecks,
} from "lucide-react";
import type { CustomerCode, MatchResult } from "@/core/types";
import { useTranslation } from "@/core/lib/i18n";
import { listen } from "@tauri-apps/api/event";
import { SheetCodeExtractorModal } from "./SheetCodeExtractorModal";
import { CheckFilterStatusModal } from "./CheckFilterStatusModal";
import { FilterSyntaxHelpModal } from "./FilterSyntaxHelpModal";
import { AutoFindToggle } from "./AutoFindToggle";
import { usePersistentOpen } from "./CollapsibleSection";
import { autoFindService } from "../services/autoFindService";
import { buildScanRequest, useScanAndMatch } from "../features/scanner/hooks/useScanAndMatch";
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

const TOOLBAR_BUTTON_CLASS =
  "btn-macos inline-flex items-center gap-1.5 h-7.5 px-2.5 rounded-lg text-xs whitespace-nowrap shrink-0";
const ICON_BUTTON_CLASS =
  "btn-macos inline-flex items-center justify-center w-7.5 h-7.5 rounded-lg text-muted-foreground hover:text-foreground shrink-0";
const STATUS_CHIP_CLASS =
  "inline-flex items-center gap-1.5 h-7 px-2 rounded-lg text-xs font-medium text-foreground/85 hover:text-foreground hover:bg-foreground/[0.06] tabular-nums transition-colors whitespace-nowrap shrink-0";
const SEGMENTED_CLASS =
  "macos-segmented inline-flex items-center gap-0.5 p-0.5 rounded-[9px]";

function segmentClass(active: boolean): string {
  return `h-6.5 px-2.5 rounded-[6.5px] text-xs whitespace-nowrap transition-all disabled:opacity-50 ${
    active
      ? "macos-segment-active"
      : "text-foreground/75 hover:text-foreground font-medium"
  }`;
}

function toggleChipClass(active: boolean): string {
  return `h-6.5 px-2.5 rounded-md text-xs whitespace-nowrap disabled:opacity-50 ${
    active ? "chip-macos-active" : "chip-macos"
  }`;
}

function OptionRow({
  label,
  labelId,
  children,
}: {
  readonly label: string;
  readonly labelId: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span id={labelId} className="w-24 shrink-0 pt-1 text-xs text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
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
  const [optionsOpen, setOptionsOpen] = usePersistentOpen("filter_options", false);
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
        const { folders: effectiveFolders, signature: currentSig } = buildScanRequest(st);

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
    const { folders: effectiveFolders, signature: currentSig } = buildScanRequest(st);

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
    { id: "ExactNumber", label: t("exact") },
    { id: "Contains", label: t("contains") },
    { id: "Regex", label: t("regex") },
  ] as const;

  const optionsDisabled = phase === "scanning" || phase === "copying";
  const fileTypeSummary =
    scanOptions.filter_raw && scanOptions.filter_jpg
      ? "RAW + JPG"
      : scanOptions.filter_raw
        ? "RAW"
        : scanOptions.filter_jpg
          ? "JPG"
          : tr("Mọi ảnh", "All images");
  const optionsSummary = [
    modes.find((m) => m.id === matchMode)?.label ?? t("exact"),
    fileTypeSummary,
    scanOptions.recursive ? tr("Gồm thư mục con", "Include subfolders") : tr("Chỉ thư mục chọn", "Selected folder only"),
    inheritExtensionEnabled ? tr("Kế thừa đuôi", "Inherit ext.") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="panel flex-1 min-w-[300px] flex flex-col min-h-0 animate-fade-in">
      {/* === TOP HALF: Customer Codes === */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="panel-header min-h-11 py-1.5 px-3 gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="panel-title whitespace-nowrap">{t("customer_codes")}</span>
            <span className="px-2 py-0.5 rounded-full bg-secondary text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
              {parsedCodes.length} {t("codes_count")}
            </span>
            {isParsingDebounced && (
              <Loader2
                size={12}
                className="animate-spin text-muted-foreground shrink-0"
                aria-label={tr("Đang tách mã...", "Parsing...")}
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-1 min-w-0 flex-wrap">
            {lineAnalysis.missingLineCount > 0 && (
              <button
                type="button"
                onClick={handleCycleMissingLines}
                className={STATUS_CHIP_CLASS}
                title={tr(
                  "Bấm để nhảy lần lượt tới từng dòng bị sai mã trong khung nhập",
                  "Click to jump through missing code lines in the editor"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
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
                className={STATUS_CHIP_CLASS}
                title={tr(
                  "Bấm để nhảy lần lượt tới từng dòng bị trùng mã trong khung nhập",
                  "Click to jump through duplicate code lines in the editor"
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                <span>
                  {tr(
                    `${lineAnalysis.duplicateLineCount} dòng trùng`,
                    `${lineAnalysis.duplicateLineCount} duplicate`
                  )}
                </span>
              </button>
            )}
            {(lineAnalysis.missingLineCount > 0 || lineAnalysis.duplicateLineCount > 0) && (
              <span className="w-px h-4 bg-border mx-1 shrink-0" aria-hidden="true" />
            )}

            <button
              type="button"
              onClick={() => {
                setSheetModalInitialTab("extract");
                setIsSheetModalOpen(true);
              }}
              className={TOOLBAR_BUTTON_CLASS}
              title={tr("Truy xuất mã chọn của khách từ Google Sheet", "Extract customer selection codes from Google Sheet")}
            >
              <FileSpreadsheet size={13} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
              <span>{tr("Truy xuất trang tính", "Sheet Extract")}</span>
            </button>

            {/* Check TT Button: Only shown in multi-folder mode */}
            {pickerMode === "multi" && (
              <button
                type="button"
                onClick={() => setIsCheckStatusModalOpen(true)}
                className={TOOLBAR_BUTTON_CLASS}
                title={tr("Kiểm tra đối soát trạng thái Chưa lọc trên Google Sheet để giữ lại khách cần lọc", "Check Google Sheet filter status to keep customers pending culling")}
              >
                <ListChecks size={13} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
                <span>{tr("Check TT", "Status Check")}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSheetModalInitialTab("config");
                setIsSheetModalOpen(true);
              }}
              className={ICON_BUTTON_CLASS}
              title={tr("Cấu hình cột và Tab Google Sheet cho ứng dụng Lọc ảnh", "Configure Google Sheet tabs and columns for Photo Picker")}
              aria-label={tr("Cấu hình Sheet", "Sheet Config")}
            >
              <Settings2 size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setIsHelpModalOpen(true)}
              className={ICON_BUTTON_CLASS}
              title={tr("Hướng dẫn cú pháp & xử lý trùng tiền tố", "Syntax guide & prefix conflict resolution")}
              aria-label={tr("Hướng dẫn cú pháp & xử lý trùng tiền tố", "Syntax guide & prefix conflict resolution")}
            >
              <HelpCircle size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Filter options (collapsible) & Auto Find */}
        <div className="px-3 pt-2.5 flex items-center justify-between gap-2 min-w-0">
          <button
            type="button"
            aria-expanded={optionsOpen}
            aria-controls="photo-picker-filter-options"
            onClick={() => setOptionsOpen((v) => !v)}
            className={`btn-macos inline-flex items-center gap-2 h-8 px-2.5 rounded-lg text-xs min-w-0 ${
              optionsOpen ? "border-primary/40" : ""
            }`}
          >
            <SlidersHorizontal size={13} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
            <span className="font-semibold text-foreground whitespace-nowrap">{tr("Tùy chọn lọc", "Filter options")}</span>
            <span className="text-muted-foreground font-normal truncate min-w-0">{optionsSummary}</span>
            <ChevronDown
              size={13}
              strokeWidth={2}
              className={`text-muted-foreground shrink-0 transition-transform duration-150 ${optionsOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AutoFindToggle />
        </div>

        {optionsOpen && (
          <div
            id="photo-picker-filter-options"
            className="mx-3 mt-2 rounded-xl border border-border bg-[#f8f9fb] dark:bg-foreground/[0.025] px-3 py-2.5 flex flex-col gap-2.5 animate-fade-in"
          >
            <OptionRow label={t("mode")} labelId="match-mode-label">
              <div role="radiogroup" aria-labelledby="match-mode-label" className={SEGMENTED_CLASS}>
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    role="radio"
                    aria-checked={matchMode === mode.id}
                    onClick={() => setMatchMode(mode.id)}
                    className={segmentClass(matchMode === mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </OptionRow>

            {matchMode === "Regex" && (
              <OptionRow label="" labelId="regex-pattern-label">
                <div className="flex flex-col gap-1 w-full">
                  <input
                    type="text"
                    aria-label={t("regex")}
                    className="input-field text-xs font-mono py-1.5"
                    placeholder={t("regex_placeholder")}
                    value={regexPattern}
                    onChange={(e) => setRegexPattern(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("regex_hint")}</p>
                </div>
              </OptionRow>
            )}

            <OptionRow label={tr("Loại file", "File types")} labelId="file-types-label">
              <div role="group" aria-labelledby="file-types-label" className="flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={scanOptions.filter_raw}
                  disabled={optionsDisabled}
                  onClick={() => handleToggleScanOption({ filter_raw: !scanOptions.filter_raw })}
                  className={toggleChipClass(scanOptions.filter_raw)}
                >
                  RAW
                </button>
                <button
                  type="button"
                  aria-pressed={scanOptions.filter_jpg}
                  disabled={optionsDisabled}
                  onClick={() => handleToggleScanOption({ filter_jpg: !scanOptions.filter_jpg })}
                  className={toggleChipClass(scanOptions.filter_jpg)}
                >
                  JPG
                </button>
                {!scanOptions.filter_raw && !scanOptions.filter_jpg && (
                  <span className="text-xs text-muted-foreground ml-1">
                    {tr("Không chọn = mọi loại ảnh", "None selected = all image types")}
                  </span>
                )}
              </div>
            </OptionRow>

            <OptionRow label={tr("Phạm vi quét", "Scan scope")} labelId="scan-scope-label">
              <div role="radiogroup" aria-labelledby="scan-scope-label" className={SEGMENTED_CLASS}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!scanOptions.recursive}
                  disabled={optionsDisabled}
                  onClick={() => handleToggleScanOption({ recursive: false })}
                  className={segmentClass(!scanOptions.recursive)}
                >
                  {tr("Chỉ thư mục chọn", "Selected folder only")}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={scanOptions.recursive}
                  disabled={optionsDisabled}
                  onClick={() => handleToggleScanOption({ recursive: true })}
                  className={segmentClass(scanOptions.recursive)}
                >
                  {tr("Gồm thư mục con", "Include subfolders")}
                </button>
              </div>
            </OptionRow>

            <OptionRow label={tr("Đuôi file", "Extensions")} labelId="inherit-ext-label">
              <div className="flex flex-col gap-2 min-w-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={inheritExtensionEnabled}
                  aria-labelledby="inherit-ext-label"
                  disabled={optionsDisabled}
                  onClick={() => setInheritExtensionEnabled(!inheritExtensionEnabled)}
                  className="inline-flex items-center gap-2 text-xs text-foreground/90 disabled:opacity-50 w-fit"
                  title={tr(
                    "Khi bật: nếu gắn đuôi file (ví dụ .CR2, .CR3) vào mã đầu tiên thì các mã bên dưới sẽ ăn theo đuôi đó để phân biệt trùng mã khác đuôi. Khi tắt: lọc theo mã số như bình thường (khách gửi .JPG vẫn lọc được file RAW).",
                    "When enabled: appending an extension (e.g. .CR2, .CR3) to the first code cascades it to subsequent codes. When disabled: standard matching ignores input extensions so .JPG codes still match RAW files."
                  )}
                >
                  <span
                    className={`relative inline-flex w-7 h-4 rounded-full transition-colors shrink-0 ${
                      inheritExtensionEnabled ? "bg-primary" : "bg-foreground/20"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-xs transition-transform ${
                        inheritExtensionEnabled ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                  <span>{tr("Kế thừa hậu tố đuôi file", "Inherit file extension")}</span>
                </button>

                {inheritExtensionEnabled && (
                  <div className="flex flex-wrap items-center gap-1 animate-fade-in">
                    {EXTENSION_BRANCH_OPTIONS.map((opt) => {
                      const isChecked = inheritedExtensions.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={isChecked}
                          disabled={optionsDisabled}
                          onClick={() => toggleInheritedExtension(opt.id)}
                          className={`${toggleChipClass(isChecked)} font-mono`}
                        >
                          .{opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </OptionRow>
          </div>
        )}

        {/* Auto Find Status Feedback Banners */}
        {autoFindStatus?.state === "error" && (
          <div className="mx-3 mt-2 p-2.5 rounded-lg bg-warning/10 border border-warning/30 text-xs text-foreground animate-fade-in flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} strokeWidth={1.75} className="text-warning shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">
                  {tr(
                    `Auto Find: Chưa thể nạp mã cho ${autoFindStatus.targetCustomerName || "khách này"}`,
                    `Auto Find: Unable to load codes for ${autoFindStatus.targetCustomerName || "this customer"}`
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {autoFindStatus.message}
                </p>
              </div>
              <button
                type="button"
                aria-label={tr("Đóng thông báo", "Dismiss")}
                onClick={() => setAutoFindStatus(null)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-foreground/[0.07] transition-colors cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 justify-end">
              {pickerMode === "multi" && inputFolders.length > 1 && (
                <button
                  type="button"
                  onClick={handleSkipAutoFind}
                  className="h-7 px-2.5 rounded-md border border-border bg-foreground/[0.03] hover:bg-foreground/[0.07] text-foreground font-medium text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  title={tr("Bỏ qua khách này và chuyển ngay sang khách tiếp theo", "Skip this customer and advance to the next one")}
                >
                  <SkipForward size={12} strokeWidth={1.75} />
                  <span>{tr("Bỏ qua sang khách tiếp", "Skip to next customer")}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleRetryAutoFind}
                className="h-7 px-2.5 rounded-md border border-warning/30 bg-warning/15 hover:bg-warning/25 text-warning font-medium text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw size={12} strokeWidth={1.75} />
                <span>{tr("Thử lại", "Retry")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetModalInitialTab("extract");
                  setIsSheetModalOpen(true);
                }}
                className="h-7 px-2.5 rounded-md border border-border bg-card hover:bg-foreground/[0.07] text-foreground font-medium text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet size={12} strokeWidth={1.75} />
                <span>{tr("Mở Truy xuất trang tính", "Open Sheet Extractor")}</span>
              </button>
            </div>
          </div>
        )}

        {autoFindStatus?.state === "success" && (
          <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/30 text-foreground flex items-center justify-between text-xs animate-fade-in">
            <div className="flex items-center gap-1.5 min-w-0">
              <CheckCircle2 size={13} strokeWidth={1.75} className="text-success shrink-0" />
              <span className="truncate">
                {tr("Đã nạp", "Loaded")} <strong className="font-semibold">{tr(`${autoFindStatus.codeCount} mã`, `${autoFindStatus.codeCount} code(s)`)}</strong>{" "}
                {tr("cho", "for")} <strong className="font-semibold">{autoFindStatus.targetCustomerName}</strong>. {tr("Hãy bấm", "Click")} <strong className="font-semibold">{t("scan_match")}</strong>!
              </span>
            </div>
            <button
              type="button"
              aria-label={tr("Đóng", "Close")}
              onClick={() => setAutoFindStatus(null)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-foreground/[0.07] transition-colors cursor-pointer shrink-0 ml-2"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Code Input Textarea with Synchronized Line-Level Error Highlighting */}
        <div className="flex-1 px-3 py-3 min-h-0 flex flex-col relative">
          <div className="relative w-full h-full rounded-xl bg-white dark:bg-foreground/[0.02] border border-border shadow-2xs transition-colors overflow-hidden focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
            {/* Left Line-Number Gutter Background Strip */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-[#fafbfc] dark:bg-muted/25 border-r border-border/60 pointer-events-none select-none z-0"
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
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] leading-none font-medium bg-card/95 border border-destructive/30 text-destructive">
                            <XCircle size={10} className="text-destructive shrink-0" />
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
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] leading-none font-medium bg-card/95 border border-warning/30 text-warning">
                            <AlertTriangle size={10} className="text-warning shrink-0" />
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
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] leading-none font-medium bg-card/95 border border-warning/30 text-warning">
                            <AlertTriangle size={10} className="text-warning shrink-0" />
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
            <div className="absolute inset-x-3 inset-y-3 z-30 rounded-lg bg-card/95 backdrop-blur-xs border border-border shadow-md flex flex-col items-center justify-center gap-2 p-5 animate-fade-in text-center">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
              <h4 className="text-sm font-medium text-foreground">
                {tr("Đang tự động nạp mã từ Google Sheet...", "Auto-loading customer codes from Google Sheet...")}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm">
                {autoFindStatus?.targetCustomerName
                  ? tr(`Khách: ${autoFindStatus.targetCustomerName}`, `Customer: ${autoFindStatus.targetCustomerName}`)
                  : tr("Đang đối chiếu dữ liệu bảng tính...", "Matching spreadsheet rows...")}
              </p>
              <span className="text-xs text-muted-foreground/80">
                {tr("Chờ nạp xong để bấm Quét file", "Wait for codes to load, then click Scan & Match")}
              </span>
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
