/**
 * Schema and Discovery Types for Google Sheets
 * Supports bounded cell sampling, header scoring, formula/IMPORTRANGE classification, and error detection.
 */

export type CellSourceType =
  | "DIRECT_VALUE"
  | "FORMULA"
  | "IMPORTRANGE"
  | "FORMULA_ERROR"
  | "UNKNOWN";

export type CellValueType =
  | "STRING"
  | "NUMBER"
  | "BOOLEAN"
  | "DATE"
  | "DROPDOWN"
  | "HYPERLINK"
  | "EMPTY"
  | "ERROR";

export interface CellMetadata {
  row: number; // 1-indexed
  col: number; // 0-indexed (0 = A, 1 = B, ...)
  colLetter: string; // "A", "B", ...
  formattedValue?: string;
  rawValue?: string | number | boolean;
  formulaValue?: string;
  sourceType: CellSourceType;
  valueType: CellValueType;
  hyperlink?: string;
  isError: boolean;
  errorMessage?: string; // e.g., "#REF!", "#N/A"
  validationRule?: {
    type: string;
    values?: string[];
  };
}

export interface ColumnProfile {
  index: number; // 0-indexed
  letter: string; // "A", "B", ...
  headerName: string;
  headerRow: number;
  detectedSourceType: CellSourceType;
  hasFormulas: boolean;
  formulaCount: number;
  sampleValues: string[];
  dropdownOptions?: string[];
  isHyperlinkField: boolean;
  hasErrors: boolean; // e.g. contains #REF!
  suggestedSemanticField?: string;
  suggestedConfidence?: number;
}

export interface HeaderCandidate {
  row: number; // 1-indexed
  score: number; // 0.0 - 1.0
  textRatio: number;
  formulaRatio: number;
  uniqueRatio: number;
  matchedAliases: number;
  sampleHeaders: string[];
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
  frozenRowCount?: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  locale: string;
  timeZone: string;
  tabs: SheetTabInfo[];
}

export interface TabAnalysisResult {
  tab: SheetTabInfo;
  detectedHeaderRow: number;
  headerCandidates: HeaderCandidate[];
  columns: ColumnProfile[];
  hasImportRangeRefErrors: boolean;
  refErrorColumns: string[];
  summaryRowsDetected: number[];
}
