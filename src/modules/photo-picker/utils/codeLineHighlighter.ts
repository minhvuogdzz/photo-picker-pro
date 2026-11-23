import type { MatchedPhoto, MatchResult, MatchStatus } from "../../../core/types/index.ts";

const VALID_EXTENSIONS_LIST = [
  "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp",
  "heic", "heif", "raw", "cr2", "cr3", "nef", "arw", "orf",
  "rw2", "dng", "raf", "pef", "srw", "x3f", "psd",
];

const VALID_EXTENSIONS_SET = new Set(VALID_EXTENSIONS_LIST);
const MAX_RANGE_SPAN = 500;

function canonicalize(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function normalizeUnicodeZeros(input: string): string {
  return input
    .replace(/[\uFF10\u{1D7F6}\u{1D7CE}\u{1D7D8}\u{1D7E2}\u{1D7EC}\u3007]/gu, "0");
}

function hasCodeDigits(token: string): boolean {
  return token.split(/[^0-9]+/).some((run) => run.length >= 3);
}

function leadingToken(s: string): string {
  const m = s.match(/^[A-Za-z0-9_]+/);
  return m ? m[0] : "";
}

function trailingToken(s: string): string {
  const m = s.match(/[A-Za-z0-9_]+$/);
  return m ? m[0] : "";
}

function stripLeadingSeparator(s: string): string | null {
  if (s.startsWith("..")) {
    return s.replace(/^\.+/, "");
  }
  if (s.startsWith("~")) {
    return s.slice(1);
  }
  const rest = s.replace(/^[-–—]+/, "");
  return rest.length !== s.length ? rest : null;
}

function stripTrailingSeparator(s: string): string | null {
  if (s.endsWith("..")) {
    return s.replace(/\.+$/, "");
  }
  if (s.endsWith("~")) {
    return s.slice(0, -1);
  }
  const rest = s.replace(/[-–—]+$/, "");
  return rest.length !== s.length ? rest : null;
}

function continuesWithCode(after: string): boolean {
  if (after.startsWith(".") && !after.startsWith("..")) {
    return hasCodeDigits(leadingToken(after.slice(1)));
  }
  const stripped = stripLeadingSeparator(after.replace(/^[ \t]+/, ""));
  if (stripped === null) return false;
  return hasCodeDigits(leadingToken(stripped.replace(/^[ \t]+/, "")));
}

function precededByCode(before: string): boolean {
  if (before.endsWith(".") && !before.endsWith("..")) {
    return hasCodeDigits(trailingToken(before.slice(0, -1)));
  }
  const stripped = stripTrailingSeparator(before.replace(/[ \t]+$/, ""));
  if (stripped === null) return false;
  return hasCodeDigits(trailingToken(stripped.replace(/[ \t]+$/, "")));
}

function expandCodeRangesInLine(input: string): string {
  const reRange =
    /([A-Za-z_]*[A-Za-z][A-Za-z_]*)?(\d{3,})[ \t]*(?:\.{2,3}|~|[-–—]+)[ \t]*([A-Za-z_]*[A-Za-z][A-Za-z_]*)?(\d{3,})/g;

  return input.replace(
    reRange,
    (whole, lp: string | undefined, a: string, rp: string | undefined, b: string, offset: number) => {
      const before = input.slice(0, offset);
      const after = input.slice(offset + whole.length);

      const isGlued = (c: string | undefined) => Boolean(c && /[A-Za-z0-9_]/.test(c));
      if (isGlued(before[before.length - 1]) || isGlued(after[0])) {
        return whole;
      }
      if (precededByCode(before) || continuesWithCode(after)) {
        return whole;
      }

      if (rp !== undefined) {
        if (!lp) return whole;
        const cleanL = lp.replace(/^_+|_+$/g, "").toLowerCase();
        const cleanR = rp.replace(/^_+|_+$/g, "").toLowerCase();
        if (cleanL !== cleanR) return whole;
      }

      const start = Number.parseInt(a, 10);
      const end = Number.parseInt(b, 10);
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        a.length !== b.length ||
        end <= start ||
        end - start + 1 > MAX_RANGE_SPAN
      ) {
        return whole;
      }

      const prefix = lp ?? "";
      const width = a.length;
      const expanded: string[] = [];
      for (let n = start; n <= end; n++) {
        expanded.push(`${prefix}${String(n).padStart(width, "0")}`);
      }
      return `\n${expanded.join("\n")}\n`;
    }
  );
}

function cleanTokenRustParity(token: string): string {
  let s = token.trim();
  if (!s) return "";

  // 1. Strip leading non-alphanumeric characters (keep leading '_' only if followed by ASCII alpha)
  while (s.length > 0) {
    const first = s[0];
    if (/[A-Za-z0-9]/.test(first)) break;
    if (first === "_" && s.length > 1 && /[A-Za-z]/.test(s[1])) break;
    s = s.slice(1);
  }

  // 2. Strip trailing non-alphanumeric chars
  s = s.replace(/[^A-Za-z0-9]+$/, "");

  const lower = s.toLowerCase();
  const hasExt = VALID_EXTENSIONS_LIST.some((ext) => lower.endsWith(`.${ext}`));
  if (!hasExt) {
    s = s.replace(/[._-]+$/, "");
  }

  return s.trim();
}

function removeExtension(s: string): string {
  const lower = s.toLowerCase();
  for (const ext of VALID_EXTENSIONS_LIST) {
    const suffix = `.${ext}`;
    if (lower.endsWith(suffix)) {
      return s.slice(0, s.length - suffix.length);
    }
  }
  return s;
}

export function extractExtension(s: string): string | null {
  const lower = s.toLowerCase();
  for (const ext of VALID_EXTENSIONS_LIST) {
    const suffix = `.${ext}`;
    if (lower.endsWith(suffix) && lower.length > suffix.length) {
      return ext;
    }
  }
  return null;
}

export function extractExtensionCommand(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const kw of ["@ext", "#ext", "@suffix", "#suffix"]) {
    if (lower.startsWith(kw)) {
      const rest = lower.slice(kw.length).trim().replace(/^[:=. ]+|[:=. ]+$/g, "");
      if (VALID_EXTENSIONS_SET.has(rest)) {
        return rest;
      }
    }
  }
  const stripped = lower.replace(/^[.:\- ]+|[.:\- ]+$/g, "");
  if (VALID_EXTENSIONS_SET.has(stripped)) {
    return stripped;
  }
  return null;
}

export function isClearToken(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  const cleaned = lower.replace(/^[:\-/#@ ,;.=]+|[:\-/#@ ,;.=]+$/g, "");
  if (cleaned === "clear" || cleaned === "none" || cleaned === "reset" || cleaned === "all") {
    return true;
  }
  if (
    lower.startsWith("@clear") ||
    lower.startsWith("@none") ||
    lower.startsWith("#clear") ||
    lower.startsWith("#none") ||
    lower.startsWith("@reset") ||
    lower.startsWith("#reset")
  ) {
    const rest = lower.replace(/^[@#]+/, "");
    const cmd = rest.split(/[ :\-;,=]/)[0] || "";
    if (cmd === "clear" || cmd === "none" || cmd === "reset" || cmd === "all") {
      return true;
    }
  }
  return false;
}

export function extractPrefixCommand(s: string): string | null {
  const trimmed = s.trim();
  const lower = trimmed.toLowerCase();
  for (const kw of ["@prefix", "#prefix", "@set", "#set"]) {
    if (lower.startsWith(kw)) {
      const rest = trimmed.slice(kw.length).trim().replace(/^[:= ]+|[:= ]+$/g, "");
      const cleaned = rest.replace(/^[^A-Za-z0-9_]+|[^A-Za-z0-9_]+$/g, "");
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
  }
  return null;
}

function splitLineIntoSubLines(line: string): string[] {
  const norm = normalizeUnicodeZeros(line);
  const rangeExpanded = expandCodeRangesInLine(norm);
  const extSeparated = rangeExpanded.replace(
    /(\.[a-zA-Z0-9]{2,4})[-+.]+([a-zA-Z0-9])/g,
    "$1\n$2"
  );
  const dotSeparated = extSeparated.replace(/\.([a-zA-Z0-9_]+)/g, (_m, afterDot: string) => {
    if (VALID_EXTENSIONS_SET.has(afterDot.toLowerCase())) {
      return `.${afterDot}`;
    }
    return `\n${afterDot}`;
  });
  let dashSeparated = dotSeparated;
  while (/(\d+)-+([a-zA-Z0-9])/.test(dashSeparated)) {
    dashSeparated = dashSeparated.replace(/(\d+)-+([a-zA-Z0-9])/g, "$1\n$2");
  }
  return dashSeparated
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export interface LineTokenMatch {
  readonly raw: string;
  readonly normalized: string;
  readonly prefix?: string;
  readonly extension?: string;
  readonly displayCode: string;
  readonly dedupKey: string;
  readonly status: MatchStatus | "Pending";
  readonly duplicateOfLineNumber?: number;
  readonly peerDuplicateLineNumbers?: readonly number[];
  readonly fileMatchCount?: number;
}

export type LinePrimaryStatus =
  | "Found"
  | "Missing"
  | "Duplicate"
  | "InputDuplicate"
  | "Command"
  | "Empty"
  | "Pending";

export interface CodeLineAnalysis {
  readonly lineIndex: number;
  readonly lineNumber: number;
  readonly rawText: string;
  readonly charStart: number;
  readonly charEnd: number;
  readonly isCommand: boolean;
  readonly tokens: readonly LineTokenMatch[];
  readonly primaryStatus: LinePrimaryStatus;
  readonly duplicateOfLineNumber?: number;
  readonly peerDuplicateLineNumbers?: readonly number[];
  readonly fileMatchCount?: number;
  readonly missingCountOnLine: number;
  readonly duplicateCountOnLine: number;
}

export interface ErrorMatchLocation {
  readonly matchIndex: number;
  readonly match: MatchedPhoto;
  readonly lineIndex: number;
  readonly lineNumber: number;
  readonly duplicateOfLineNumber?: number;
  readonly allDuplicateLineNumbers?: readonly number[];
  readonly allDuplicateLineIndices?: readonly number[];
}

export interface CodeInputAnalysisResult {
  readonly lines: readonly CodeLineAnalysis[];
  readonly errorLines: readonly CodeLineAnalysis[];
  readonly matchErrorLocations: readonly ErrorMatchLocation[];
  readonly missingLineCount: number;
  readonly duplicateLineCount: number;
}

interface RawExtractedToken {
  readonly lineIndex: number;
  readonly lineNumber: number;
  readonly raw: string;
  readonly normalized: string;
  readonly prefix?: string;
  readonly extension?: string;
  readonly displayCode: string;
  readonly dedupKey: string;
  readonly occurrenceIndex: number;
}

/**
 * Analyzes each line of `rawCodeInput` against `matchResult` so that:
 * 1. Every line knows whether it contains a Missing ("Sai mã"), InputDuplicate ("Trùng mã"),
 *    or Duplicate ("Trùng file") code.
 * 2. When a code is duplicated in the input (e.g. Line 14 and Line 15 both have `DC_05316.ARW`),
 *    BOTH lines (all occurrences of that duplicated code) highlight and pulse in Amber, and each
 *    line's badge points to the other line(s) it duplicates (e.g. Line 14 shows "Trùng mã (dòng 15)",
 *    Line 15 shows "Trùng mã (dòng 14)").
 * 3. Non-empty, non-command lines with invalid/short tokens (< 3 digits, e.g. "6") are also flagged
 *    as Missing ("Sai mã") once `matchResult` is present.
 */
export function analyzeCodeInputLines(
  rawCodeInput: string,
  matchResult: MatchResult | null
): CodeInputAnalysisResult {
  const rawLines = rawCodeInput.split("\n");

  // Pre-scan non-empty sub-lines for global @clear at start/end parity with parser.rs
  const allSubLines: { lineIndex: number; text: string }[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const subs = splitLineIntoSubLines(rawLines[i]);
    for (const sub of subs) {
      allSubLines.push({ lineIndex: i, text: sub });
    }
  }

  const hasClearAtStart =
    allSubLines.length > 0 && isClearToken(allSubLines[0].text);
  const hasClearAtEnd =
    allSubLines.length > 0 && isClearToken(allSubLines[allSubLines.length - 1].text);
  const hasAnyPrefixCmd = allSubLines.some((s) => extractPrefixCommand(s.text) !== null);

  let stripPrefixMode = hasClearAtStart || (hasClearAtEnd && !hasAnyPrefixCmd);
  let currentPrefix: string | undefined = undefined;
  let currentExtension: string | undefined = undefined;

  // Build lookup map of first-occurrence match results from matchResult
  const firstOccurrenceStatusByCode = new Map<
    string,
    { status: MatchStatus; fileMatchCount: number; matchIndex: number }
  >();
  const firstOccurrenceStatusByDigits = new Map<
    string,
    { status: MatchStatus; fileMatchCount: number; matchIndex: number; ambiguous: boolean }
  >();

  if (matchResult) {
    matchResult.matches.forEach((m, idx) => {
      if (m.status === "InputDuplicate") return;
      const codeKey = m.code.trim().toLowerCase();
      if (!firstOccurrenceStatusByCode.has(codeKey)) {
        firstOccurrenceStatusByCode.set(codeKey, {
          status: m.status,
          fileMatchCount: m.all_matches?.length ?? 0,
          matchIndex: idx,
        });
      }
      const digitsMatch = codeKey.match(/\d{3,}/);
      if (digitsMatch) {
        const dKey = digitsMatch[0];
        const existing = firstOccurrenceStatusByDigits.get(dKey);
        if (!existing) {
          firstOccurrenceStatusByDigits.set(dKey, {
            status: m.status,
            fileMatchCount: m.all_matches?.length ?? 0,
            matchIndex: idx,
            ambiguous: false,
          });
        } else if (existing.status !== m.status) {
          existing.ambiguous = true;
        }
      }
    });
  }

  // Pass 1: Extract raw tokens per line and group all line numbers per dedupKey
  const occurrenceCountByDedupKey = new Map<string, number>();
  const lineNumbersByDedupKey = new Map<string, number[]>();
  const lineIndicesByDedupKey = new Map<string, number[]>();
  const rawTokensByLine: RawExtractedToken[][] = Array.from(
    { length: rawLines.length },
    () => []
  );
  const commandByLine: boolean[] = Array.from({ length: rawLines.length }, () => false);

  const reDigits = /\d{3,}/g;

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const lineNumber = lineIdx + 1;
    const subLines = splitLineIntoSubLines(rawLines[lineIdx]);

    for (const sub of subLines) {
      if (isClearToken(sub)) {
        currentPrefix = undefined;
        currentExtension = undefined;
        stripPrefixMode = true;
        commandByLine[lineIdx] = true;
        continue;
      }

      const prefixCmd = extractPrefixCommand(sub);
      if (prefixCmd !== null) {
        currentPrefix = prefixCmd;
        stripPrefixMode = false;
        commandByLine[lineIdx] = true;
        continue;
      }

      const extCmd = extractExtensionCommand(sub);
      if (extCmd !== null) {
        currentExtension = extCmd;
        commandByLine[lineIdx] = true;
        continue;
      }

      const parts = sub.split(/[,;\t|/\\+: ]+/);
      for (const part of parts) {
        const partTrimmed = part.trim();
        if (!partTrimmed) continue;

        if (isClearToken(partTrimmed)) {
          currentPrefix = undefined;
          currentExtension = undefined;
          stripPrefixMode = true;
          commandByLine[lineIdx] = true;
          continue;
        }

        const partPrefixCmd = extractPrefixCommand(partTrimmed);
        if (partPrefixCmd !== null) {
          currentPrefix = partPrefixCmd;
          stripPrefixMode = false;
          commandByLine[lineIdx] = true;
          continue;
        }

        const partExtCmd = extractExtensionCommand(partTrimmed);
        if (partExtCmd !== null) {
          currentExtension = partExtCmd;
          commandByLine[lineIdx] = true;
          continue;
        }

        const cleaned = cleanTokenRustParity(partTrimmed);
        if (!cleaned) continue;

        const explicitExt = extractExtension(cleaned);
        if (explicitExt !== null) {
          currentExtension = explicitExt;
        }

        const withoutExt = removeExtension(cleaned);
        reDigits.lastIndex = 0;
        let mat: RegExpExecArray | null;

        while ((mat = reDigits.exec(withoutExt)) !== null) {
          const normalized = mat[0];
          const beforeDigits = withoutExt.slice(0, mat.index);
          const hasAlphaPrefix = /[A-Za-z]/.test(beforeDigits);

          let prefix: string | undefined;
          let raw: string;

          if (stripPrefixMode) {
            prefix = undefined;
            raw = normalized;
          } else if (hasAlphaPrefix) {
            const p = beforeDigits
              .replace(/^[^A-Za-z0-9_]+|[^A-Za-z0-9_]+$/g, "")
              .replace(/_+$/, "");
            if (p.length > 0) {
              currentPrefix = p;
              prefix = p;
              raw = cleaned;
            } else {
              prefix = currentPrefix;
              raw = cleaned;
            }
          } else {
            prefix = currentPrefix;
            raw = cleaned;
          }

          const extension = explicitExt ?? currentExtension;
          const rawTrimmed = raw.trim();
          const rawWithoutExt = removeExtension(rawTrimmed);

          const baseDedupKey =
            prefix && prefix.length > 0
              ? `${canonicalize(prefix)}:${normalized}`
              : rawWithoutExt.toLowerCase();
          const dedupKey =
            extension && extension.length > 0
              ? `${baseDedupKey}.${extension.toLowerCase()}`
              : baseDedupKey;

          const baseDisplay =
            prefix && prefix.length > 0 && !/[A-Za-z]/.test(rawWithoutExt)
              ? `${prefix}${rawWithoutExt}`
              : rawTrimmed;
          const displayCode =
            extension && extension.length > 0 && extractExtension(baseDisplay) === null
              ? `${baseDisplay}.${extension.toUpperCase()}`
              : baseDisplay;

          const occIdx = occurrenceCountByDedupKey.get(dedupKey) ?? 0;
          occurrenceCountByDedupKey.set(dedupKey, occIdx + 1);

          const numList = lineNumbersByDedupKey.get(dedupKey) ?? [];
          if (!numList.includes(lineNumber)) {
            numList.push(lineNumber);
          }
          lineNumbersByDedupKey.set(dedupKey, numList);

          const idxList = lineIndicesByDedupKey.get(dedupKey) ?? [];
          if (!idxList.includes(lineIdx)) {
            idxList.push(lineIdx);
          }
          lineIndicesByDedupKey.set(dedupKey, idxList);

          rawTokensByLine[lineIdx].push({
            lineIndex: lineIdx,
            lineNumber,
            raw: rawTrimmed,
            normalized,
            prefix,
            extension,
            displayCode,
            dedupKey,
            occurrenceIndex: occIdx,
          });
        }
      }
    }
  }

  // Pass 2: Resolve final status for each token (both 1st and 2nd+ occurrences of a duplicate get InputDuplicate!)
  const tokensByLine: LineTokenMatch[][] = Array.from({ length: rawLines.length }, () => []);
  const firstOccurrenceLineByCode = new Map<string, { lineIndex: number; lineNumber: number }>();
  const duplicateLinesByCode = new Map<
    string,
    {
      lineIndex: number;
      lineNumber: number;
      duplicateOfLineNumber: number;
      allDuplicateLineNumbers: number[];
      allDuplicateLineIndices: number[];
      consumed: boolean;
    }[]
  >();

  for (let lineIdx = 0; lineIdx < rawLines.length; lineIdx++) {
    const lineNumber = lineIdx + 1;
    for (const rawTk of rawTokensByLine[lineIdx]) {
      const totalOccurrences = occurrenceCountByDedupKey.get(rawTk.dedupKey) ?? 1;
      const allLinesForKey = lineNumbersByDedupKey.get(rawTk.dedupKey) ?? [lineNumber];
      const allIndicesForKey = lineIndicesByDedupKey.get(rawTk.dedupKey) ?? [lineIdx];
      const peerLines = allLinesForKey.filter((ln) => ln !== lineNumber);

      // Register first occurrence for Missing / File-Duplicate lookup
      if (rawTk.occurrenceIndex === 0) {
        firstOccurrenceLineByCode.set(rawTk.displayCode.toLowerCase(), {
          lineIndex: lineIdx,
          lineNumber,
        });
        firstOccurrenceLineByCode.set(rawTk.raw.toLowerCase(), {
          lineIndex: lineIdx,
          lineNumber,
        });
        if (!firstOccurrenceLineByCode.has(rawTk.normalized)) {
          firstOccurrenceLineByCode.set(rawTk.normalized, {
            lineIndex: lineIdx,
            lineNumber,
          });
        }
      } else {
        const firstLineNumber = allLinesForKey[0] ?? lineNumber;
        const registerDupKey = (k: string) => {
          const list = duplicateLinesByCode.get(k) ?? [];
          list.push({
            lineIndex: lineIdx,
            lineNumber,
            duplicateOfLineNumber: firstLineNumber,
            allDuplicateLineNumbers: allLinesForKey,
            allDuplicateLineIndices: allIndicesForKey,
            consumed: false,
          });
          duplicateLinesByCode.set(k, list);
        };
        registerDupKey(rawTk.raw.toLowerCase());
        if (rawTk.displayCode.toLowerCase() !== rawTk.raw.toLowerCase()) {
          registerDupKey(rawTk.displayCode.toLowerCase());
        }
        registerDupKey(rawTk.normalized);
      }

      // Look up whether the base code exists in matchResult
      const hasExplicitLetters = /[A-Za-z]/.test(removeExtension(rawTk.raw));
      const matchedEntry = matchResult
        ? (firstOccurrenceStatusByCode.get(rawTk.displayCode.toLowerCase()) ??
          firstOccurrenceStatusByCode.get(rawTk.raw.toLowerCase()) ??
          (!hasExplicitLetters && !rawTk.extension
            ? (() => {
                const byDigits = firstOccurrenceStatusByDigits.get(rawTk.normalized);
                return byDigits && !byDigits.ambiguous ? byDigits : undefined;
              })()
            : undefined))
        : undefined;

      let status: MatchStatus | "Pending" = "Pending";
      let duplicateOfLineNumber: number | undefined = undefined;
      let peerDuplicateLineNumbers: readonly number[] | undefined = undefined;
      let fileMatchCount: number | undefined = undefined;

      if (totalOccurrences > 1 && matchResult) {
        // Highlight ALL occurrences (both the 1st and 2nd+ lines!) so the user immediately sees both duplicate lines
        status = "InputDuplicate";
        peerDuplicateLineNumbers = peerLines.length > 0 ? peerLines : [lineNumber];
        duplicateOfLineNumber = peerDuplicateLineNumbers[0];
      } else if (matchedEntry) {
        status = matchedEntry.status;
        if (matchedEntry.status === "Duplicate") {
          fileMatchCount = matchedEntry.fileMatchCount;
        }
      }

      tokensByLine[lineIdx].push({
        raw: rawTk.raw,
        normalized: rawTk.normalized,
        prefix: rawTk.prefix,
        extension: rawTk.extension,
        displayCode: rawTk.displayCode,
        dedupKey: rawTk.dedupKey,
        status,
        duplicateOfLineNumber,
        peerDuplicateLineNumbers,
        fileMatchCount,
      });
    }
  }

  const lines: CodeLineAnalysis[] = [];
  const errorLines: CodeLineAnalysis[] = [];
  let missingLineCount = 0;
  let duplicateLineCount = 0;
  let runningOffset = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const rawText = rawLines[i];
    const charStart = runningOffset;
    const charEnd = runningOffset + rawText.length;
    runningOffset = charEnd + 1; // +1 for '\n'

    const tokens = tokensByLine[i];
    const isCommand = commandByLine[i] && tokens.length === 0;

    let primaryStatus: LinePrimaryStatus = "Empty";
    let duplicateOfLineNumber: number | undefined = undefined;
    let peerDuplicateLineNumbers: readonly number[] | undefined = undefined;
    let fileMatchCount: number | undefined = undefined;
    let missingCountOnLine = 0;
    let duplicateCountOnLine = 0;

    if (rawText.trim().length === 0) {
      primaryStatus = "Empty";
    } else if (isCommand) {
      primaryStatus = "Command";
    } else if (tokens.length === 0) {
      // Letters standing alone on a line without any digits (e.g. "Dc", "MG", "Máy 1" header without photo number)
      // should NOT be flagged as Missing. Only lines containing digits (< 3 digits, e.g. "6" or "DC_05") are flagged.
      const hasAnyDigits = /\d/.test(rawText);
      if (matchResult && hasAnyDigits) {
        primaryStatus = "Missing";
        missingCountOnLine = 1;
      } else {
        primaryStatus = "Pending";
      }
    } else {
      for (const tk of tokens) {
        if (tk.status === "Missing") {
          missingCountOnLine++;
        } else if (tk.status === "InputDuplicate" || tk.status === "Duplicate") {
          duplicateCountOnLine++;
        }
      }

      const missingToken = tokens.find((tk) => tk.status === "Missing");
      const inputDupToken = tokens.find((tk) => tk.status === "InputDuplicate");
      const fileDupToken = tokens.find((tk) => tk.status === "Duplicate");
      const foundToken = tokens.find((tk) => tk.status === "Found");

      if (missingToken) {
        primaryStatus = "Missing";
      } else if (inputDupToken) {
        primaryStatus = "InputDuplicate";
        duplicateOfLineNumber = inputDupToken.duplicateOfLineNumber;
        peerDuplicateLineNumbers = inputDupToken.peerDuplicateLineNumbers;
      } else if (fileDupToken) {
        primaryStatus = "Duplicate";
        fileMatchCount = fileDupToken.fileMatchCount;
      } else if (foundToken) {
        primaryStatus = "Found";
      } else {
        primaryStatus = "Pending";
      }
    }

    const analysis: CodeLineAnalysis = {
      lineIndex: i,
      lineNumber: i + 1,
      rawText,
      charStart,
      charEnd,
      isCommand,
      tokens,
      primaryStatus,
      duplicateOfLineNumber,
      peerDuplicateLineNumbers,
      fileMatchCount,
      missingCountOnLine,
      duplicateCountOnLine,
    };

    lines.push(analysis);

    if (primaryStatus === "Missing") {
      errorLines.push(analysis);
      missingLineCount++;
    } else if (primaryStatus === "InputDuplicate" || primaryStatus === "Duplicate") {
      errorLines.push(analysis);
      duplicateLineCount++;
    }
  }

  // Map matchResult error items to their exact line numbers for LeftPanel click-to-jump
  const matchErrorLocations: ErrorMatchLocation[] = [];
  if (matchResult) {
    matchResult.matches.forEach((m, idx) => {
      if (
        m.status !== "Missing" &&
        m.status !== "InputDuplicate" &&
        m.status !== "Duplicate"
      ) {
        return;
      }

      const codeKey = m.code.trim().toLowerCase();
      const digits = codeKey.match(/\d{3,}/)?.[0] ?? codeKey;

      if (m.status === "InputDuplicate") {
        const dupCandidates =
          duplicateLinesByCode.get(codeKey) ?? duplicateLinesByCode.get(digits) ?? [];
        const nextUnconsumed =
          dupCandidates.find((c) => !c.consumed) ?? dupCandidates[0];
        if (nextUnconsumed) {
          nextUnconsumed.consumed = true;
          matchErrorLocations.push({
            matchIndex: idx,
            match: m,
            lineIndex: nextUnconsumed.lineIndex,
            lineNumber: nextUnconsumed.lineNumber,
            duplicateOfLineNumber: nextUnconsumed.duplicateOfLineNumber,
            allDuplicateLineNumbers: nextUnconsumed.allDuplicateLineNumbers,
            allDuplicateLineIndices: nextUnconsumed.allDuplicateLineIndices,
          });
          return;
        }
      }

      const firstLoc =
        firstOccurrenceLineByCode.get(codeKey) ?? firstOccurrenceLineByCode.get(digits);
      matchErrorLocations.push({
        matchIndex: idx,
        match: m,
        lineIndex: firstLoc ? firstLoc.lineIndex : -1,
        lineNumber: firstLoc ? firstLoc.lineNumber : 0,
      });
    });
  }

  return {
    lines,
    errorLines,
    matchErrorLocations,
    missingLineCount,
    duplicateLineCount,
  };
}
