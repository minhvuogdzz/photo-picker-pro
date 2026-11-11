import { create } from "zustand";

export interface ConvertProgress {
  total: number;
  current: number;
  percentage: number;
  currentFile: string;
}

export type ExifDateSource = "current" | "file_created" | "custom" | "reference_photo";
export type FileTimestampKind = "created" | "modified";
export type ExifCorrectionScope = "abnormal_only" | "all_files";
export type ExifStatusCategory = "valid" | "abnormal" | "missing" | "unknown";

export interface FileMetadataAnalysis {
  filePath: string;
  fileName: string;
  category: ExifStatusCategory;
  reason: string;
  reasonText: string;
  detectedDate: string | null;
  targetSupported: boolean;
}

export interface ExifScanSummary {
  totalFiles: number;
  validCount: number;
  abnormalCount: number;
  missingCount: number;
  unknownCount: number;
  fixableCount: number;
  unsupportedCount: number;
  scanDurationMs: number;
  sampleItems: FileMetadataAnalysis[];
}

export interface ReferencePhotoExifResult {
  filePath: string;
  fileName: string;
  exifDatetime: string;
  exifOffset: string;
  cameraModel: string | null;
}

export interface FileErrorDetail {
  fileName: string;
  stage: string;
  message: string;
}

export interface ConvertBatchReport {
  totalProcessed: number;
  convertedSuccess: number;
  metadataFixed: number;
  metadataKept: number;
  metadataUnsupported: number;
  failedCount: number;
  errors: FileErrorDetail[];
  scanDurationMs: number;
  convertDurationMs: number;
  exifFixDurationMs: number;
  totalDurationMs: number;
  throughputFilesPerSec: number;
  outputDir: string;
  scanSummary: ExifScanSummary;
}

function getDefaultCustomDateTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

interface ConvertState {
  inputFolders: string[];
  outputFolder: string;
  targetFormat: string;
  quality: number; // 1-4 scale
  exportJpg2048: boolean;
  isConverting: boolean;
  progress: ConvertProgress | null;
  logs: string[];

  // EXIF Date Correction state
  fixExifDate: boolean;
  exifDateSource: ExifDateSource;
  fileTimestampKind: FileTimestampKind;
  customDateTime: string;
  keepOriginalTimeOfDay: boolean;
  referencePhotoPath: string;
  referencePhotoInfo: ReferencePhotoExifResult | null;
  exifScope: ExifCorrectionScope;
  includeMissingExif: boolean;
  minReasonableYear: number;
  exifScanSummary: ExifScanSummary | null;
  isScanningExif: boolean;
  lastBatchReport: ConvertBatchReport | null;

  addInputFolders: (folders: string[]) => void;
  removeInputFolder: (folder: string) => void;
  clearInputFolders: () => void;
  setOutputFolder: (folder: string) => void;
  setTargetFormat: (format: string) => void;
  setQuality: (quality: number) => void;
  setExportJpg2048: (val: boolean) => void;
  setIsConverting: (converting: boolean) => void;
  setProgress: (progress: ConvertProgress | null) => void;
  addLog: (log: string) => void;
  clearLogs: () => void;

  setFixExifDate: (val: boolean) => void;
  setExifDateSource: (source: ExifDateSource) => void;
  setFileTimestampKind: (kind: FileTimestampKind) => void;
  setCustomDateTime: (val: string) => void;
  setKeepOriginalTimeOfDay: (val: boolean) => void;
  setReferencePhoto: (path: string, info: ReferencePhotoExifResult | null) => void;
  setExifScope: (scope: ExifCorrectionScope) => void;
  setIncludeMissingExif: (val: boolean) => void;
  setMinReasonableYear: (year: number) => void;
  setExifScanSummary: (summary: ExifScanSummary | null) => void;
  setIsScanningExif: (scanning: boolean) => void;
  setLastBatchReport: (report: ConvertBatchReport | null) => void;
  resetAll: () => void;
}

const initialState = {
  inputFolders: [] as string[],
  outputFolder: "",
  targetFormat: "JPG",
  quality: 4,
  exportJpg2048: false,
  isConverting: false,
  progress: null as ConvertProgress | null,
  logs: [] as string[],

  fixExifDate: false,
  exifDateSource: "current" as ExifDateSource,
  fileTimestampKind: "created" as FileTimestampKind,
  customDateTime: getDefaultCustomDateTime(),
  keepOriginalTimeOfDay: false,
  referencePhotoPath: "",
  referencePhotoInfo: null as ReferencePhotoExifResult | null,
  exifScope: "abnormal_only" as ExifCorrectionScope,
  includeMissingExif: false,
  minReasonableYear: 1995,
  exifScanSummary: null as ExifScanSummary | null,
  isScanningExif: false,
  lastBatchReport: null as ConvertBatchReport | null,
};

export const useConvertStore = create<ConvertState>((set) => ({
  ...initialState,

  addInputFolders: (folders) =>
    set((state) => {
      const newFolders = folders.filter((p) => !state.inputFolders.includes(p));
      return { inputFolders: [...state.inputFolders, ...newFolders] };
    }),

  removeInputFolder: (folder) =>
    set((state) => ({ inputFolders: state.inputFolders.filter((f) => f !== folder) })),

  clearInputFolders: () => set({ inputFolders: [], exifScanSummary: null }),

  setOutputFolder: (folder) => set({ outputFolder: folder }),

  setTargetFormat: (format) => set({ targetFormat: format }),

  setQuality: (quality) => set({ quality }),

  setExportJpg2048: (val) => set({ exportJpg2048: val }),

  setIsConverting: (converting) => set({ isConverting: converting }),

  setProgress: (progress) => set({ progress }),

  addLog: (log) =>
    set((state) => {
      const next = [...state.logs, log];
      return { logs: next.length > 500 ? next.slice(next.length - 500) : next };
    }),

  clearLogs: () => set({ logs: [] }),

  setFixExifDate: (val) => set({ fixExifDate: val }),

  setExifDateSource: (exifDateSource) => set({ exifDateSource }),

  setFileTimestampKind: (fileTimestampKind) => set({ fileTimestampKind }),

  setCustomDateTime: (customDateTime) => set({ customDateTime }),

  setKeepOriginalTimeOfDay: (keepOriginalTimeOfDay) => set({ keepOriginalTimeOfDay }),

  setReferencePhoto: (referencePhotoPath, referencePhotoInfo) =>
    set({ referencePhotoPath, referencePhotoInfo }),

  setExifScope: (exifScope) => set({ exifScope }),

  setIncludeMissingExif: (includeMissingExif) => set({ includeMissingExif }),

  setMinReasonableYear: (minReasonableYear) => set({ minReasonableYear }),

  setExifScanSummary: (exifScanSummary) => set({ exifScanSummary }),

  setIsScanningExif: (isScanningExif) => set({ isScanningExif }),

  setLastBatchReport: (lastBatchReport) => set({ lastBatchReport }),

  resetAll: () => set({ ...initialState, customDateTime: getDefaultCustomDateTime() }),
}));
