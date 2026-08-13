/** Represents a photo file discovered during scanning */
export interface PhotoFile {
  readonly full_path: string;
  readonly filename: string;
  readonly extension: string;
  readonly folder: string;
  readonly size: number;
  readonly normalized_number: string;
}

/** A customer code parsed from user input */
export interface CustomerCode {
  readonly raw: string;
  readonly normalized: string;
}

/** The matching mode */
export type MatchMode = "ExactNumber" | "Contains" | "Regex";

/** The status of a matched photo */
export type MatchStatus = "Found" | "Missing" | "Duplicate" | "InputDuplicate";

/** A matched photo result */
export interface MatchedPhoto {
  readonly code: string;
  readonly photo: PhotoFile | null;
  readonly status: MatchStatus;
  readonly all_matches: readonly PhotoFile[];
}

/** Result of the matching operation */
export interface MatchResult {
  readonly matches: readonly MatchedPhoto[];
  readonly found_count: number;
  readonly missing_count: number;
  readonly duplicate_count: number;
  readonly total_codes: number;
}

/** Policy for handling duplicate matches */
export type DuplicatePolicy = "CopyFirst" | "CopyAll" | "RenameAutomatically" | "Skip";

/** How the output folder structure should be organized */
export type FolderStructure = "Flat" | "Preserve";

/** The file operation to perform */
export type FileOperation = "Copy" | "Move" | "HardLink" | "SymbolicLink";

/** How the output destination is determined */
export type OutputMode = "Folder" | "SameAsOriginal" | "Studio";

/** Options for scanning */
export interface ScanOptions {
  readonly filter_raw: boolean;
  readonly filter_jpg: boolean;
  readonly recursive: boolean;
}

/** Options for the copy/move operation */
export interface CopyOptions {
  readonly operation: FileOperation;
  readonly output_mode: OutputMode;
  readonly output_folder: string;
  readonly duplicate_policy: DuplicatePolicy;
  readonly folder_structure: FolderStructure;
  readonly prefix: string | null;
  readonly suffix: string | null;
  readonly input_folders: readonly string[];
}

/** Progress event from Rust backend */
export interface ProgressEvent {
  readonly current: number;
  readonly total: number;
  readonly percentage: number;
  readonly message: string;
  readonly eta_seconds: number | null;
  readonly speed: string | null;
}

/** Result of a copy/move operation */
export interface CopyResult {
  readonly success_count: number;
  readonly error_count: number;
  readonly skipped_count: number;
  readonly errors: readonly string[];
}

/** Scan result from Rust backend */
export interface ScanResult {
  readonly files: readonly PhotoFile[];
  readonly total_files: number;
  readonly total_folders: number;
  readonly elapsed_ms: number;
}

/** Export format for logs */
export type ExportFormat = "txt" | "csv" | "json";

/** Application settings */
export interface AppSettings {
  theme: string;
  language: string;
  default_match_mode: string;
  default_output: string;
  default_duplicate_policy: string;
  default_preserve_folder: boolean;
  favorite_folders: string[];
  auto_check_updates: boolean;
  auto_download_updates: boolean;
  install_on_exit: boolean;
  beta_channel: boolean;
}

/** A history entry recording a past operation */
export interface HistoryEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly input_folders: readonly string[];
  readonly output_folder: string;
  readonly codes_count: number;
  readonly found_count: number;
  readonly missing_count: number;
  readonly operation: string;
}

/** Application workflow state */
export type AppPhase = "idle" | "scanning" | "scanned" | "matching" | "matched" | "copying" | "done";

/** Tab for the main view */
export type MainTab = "home" | "settings" | "history" | "about";
