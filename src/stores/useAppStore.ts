import { create } from "zustand";
import type {
  AppPhase,
  CustomerCode,
  MatchResult,
  PhotoFile,
  MainTab,
  CopyResult,
  ProgressEvent,
} from "@/types";

interface AppState {
  // Navigation
  readonly activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;

  // Drag and Drop Zone
  readonly activeDropZone: "input" | "sync" | null;
  setActiveDropZone: (zone: "input" | "sync" | null) => void;

  // Sync folders
  readonly syncFolders: string[];
  addSyncFolders: (folders: string[]) => void;
  removeSyncFolder: (folder: string) => void;
  clearSyncFolders: () => void;

  // Input folders
  readonly inputFolders: string[];
  readonly selectedInputFolders: string[];
  addInputFolder: (folder: string) => void;
  removeInputFolder: (folder: string) => void;
  clearInputFolders: () => void;
  toggleInputFolderSelection: (folder: string) => void;

  // Customer codes
  readonly rawCodeInput: string;
  readonly parsedCodes: CustomerCode[];
  setRawCodeInput: (input: string) => void;
  setParsedCodes: (codes: CustomerCode[]) => void;

  // Scan results
  readonly scannedFiles: PhotoFile[];
  setScannedFiles: (files: PhotoFile[]) => void;

  // Match results
  readonly matchResult: MatchResult | null;
  setMatchResult: (result: MatchResult | null) => void;

  // Copy results
  readonly copyResult: CopyResult | null;
  setCopyResult: (result: CopyResult | null) => void;

  // Output folder
  readonly outputFolder: string;
  readonly studioOutputFolder: string;
  readonly outputMode: import("@/types").OutputMode;
  setOutputFolder: (folder: string) => void;
  setStudioOutputFolder: (folder: string) => void;
  setOutputMode: (mode: import("@/types").OutputMode) => void;

  // App phase
  readonly phase: AppPhase;
  setPhase: (phase: AppPhase) => void;

  // Progress
  readonly progress: ProgressEvent | null;
  setProgress: (progress: ProgressEvent | null) => void;

  // Scan Options
  readonly scanOptions: import("@/types").ScanOptions;
  setScanOptions: (options: Partial<import("@/types").ScanOptions>) => void;

  // Match mode
  readonly matchMode: string;
  setMatchMode: (mode: string) => void;

  // Regex pattern
  readonly regexPattern: string;
  setRegexPattern: (pattern: string) => void;

  // Reset
  resetAll: () => void;
}

const initialState = {
  activeTab: "home" as MainTab,
  activeDropZone: null as "input" | "sync" | null,
  syncFolders: [] as string[],
  inputFolders: [] as string[],
  selectedInputFolders: [] as string[],
  rawCodeInput: "",
  parsedCodes: [] as CustomerCode[],
  scannedFiles: [] as PhotoFile[],
  matchResult: null as MatchResult | null,
  copyResult: null as CopyResult | null,
  outputFolder: "",
  studioOutputFolder: "",
  outputMode: "Folder" as import("@/types").OutputMode,
  phase: "idle" as AppPhase,
  progress: null as ProgressEvent | null,
  matchMode: "ExactNumber",
  regexPattern: "",
  scanOptions: {
    filter_raw: true,
    filter_jpg: false,
    recursive: false,
  },
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setActiveDropZone: (zone) => set({ activeDropZone: zone }),

  addSyncFolders: (folders) =>
    set((state) => {
      const newFolders = folders.filter((p) => !state.syncFolders.includes(p));
      return { syncFolders: [...state.syncFolders, ...newFolders] };
    }),
  removeSyncFolder: (folder) =>
    set((state) => ({ syncFolders: state.syncFolders.filter((f) => f !== folder) })),
  clearSyncFolders: () => set({ syncFolders: [] }),

  addInputFolder: (folder) =>
    set((state) => {
      if (state.inputFolders.includes(folder)) return state;
      return { 
        inputFolders: [folder],
        selectedInputFolders: [folder]
      };
    }),

  removeInputFolder: (folder) =>
    set((state) => ({
      inputFolders: state.inputFolders.filter((f) => f !== folder),
      selectedInputFolders: state.selectedInputFolders.filter((f) => f !== folder),
    })),

  clearInputFolders: () => set({ inputFolders: [], selectedInputFolders: [] }),

  toggleInputFolderSelection: (folder) =>
    set((state) => {
      if (state.selectedInputFolders.includes(folder)) {
        return { selectedInputFolders: state.selectedInputFolders.filter((f) => f !== folder) };
      } else {
        return { selectedInputFolders: [...state.selectedInputFolders, folder] };
      }
    }),

  setRawCodeInput: (input) => set({ rawCodeInput: input }),
  setParsedCodes: (codes) => set({ parsedCodes: codes }),
  setScannedFiles: (files) => set({ scannedFiles: files }),
  setMatchResult: (result) => set({ matchResult: result }),
  setCopyResult: (result) => set({ copyResult: result }),
  setOutputFolder: (folder) => set({ outputFolder: folder }),
  setStudioOutputFolder: (folder) => set({ studioOutputFolder: folder }),
  setOutputMode: (mode) => set({ outputMode: mode }),
  setPhase: (phase) => set({ phase: phase }),
  setProgress: (progress) => set({ progress: progress }),
  setScanOptions: (options) => set((state) => ({ scanOptions: { ...state.scanOptions, ...options } })),
  setMatchMode: (mode) => set({ matchMode: mode }),
  setRegexPattern: (pattern) => set({ regexPattern: pattern }),

  resetAll: () => set(initialState),
}));
