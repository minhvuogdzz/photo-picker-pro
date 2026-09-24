import { create } from "zustand";
import type {
  AppPhase,
  CustomerCode,
  MatchResult,
  PhotoFile,
  MainTab,
  CopyResult,
  ProgressEvent,
  PickerMode,
  CustomerFolderItem,
} from "@/core/types";

interface AppState {
  // Navigation
  readonly activeTab: MainTab;
  setActiveTab: (tab: MainTab) => void;

  readonly activeModule: string;
  setActiveModule: (module: string) => void;

  readonly hasSeenWelcome: boolean;
  setHasSeenWelcome: (val: boolean) => void;

  // App Transition
  readonly sidebarCollapsed: boolean;
  setSidebarCollapsed: (val: boolean) => void;

  readonly lastClickPos: { x: number; y: number } | null;
  setLastClickPos: (pos: { x: number; y: number } | null) => void;

  // Drag and Drop Zone
  readonly activeDropZone: "input" | "sync" | null;
  setActiveDropZone: (zone: "input" | "sync" | null) => void;

  // Sync folders
  readonly syncFolders: string[];
  addSyncFolders: (folders: string[]) => void;
  removeSyncFolder: (folder: string) => void;
  clearSyncFolders: () => void;

  // Mode: Single customer vs Multi-customer batch queue
  readonly pickerMode: PickerMode;
  setPickerMode: (mode: PickerMode) => void;

  // Input folders & Batch Customer Queue
  readonly inputFolders: string[];
  readonly selectedInputFolders: string[];
  readonly batchCustomerFolders: CustomerFolderItem[];
  addInputFolder: (folder: string) => void;
  addBatchInputFolders: (items: (CustomerFolderItem | string)[]) => void;
  selectSingleInputFolder: (folder: string) => void;
  removeInputFolder: (folder: string) => void;
  clearInputFolders: () => void;
  toggleInputFolderSelection: (folder: string) => void;
  setBatchCustomerFolders: (folders: CustomerFolderItem[]) => void;

  // Post-filter completion removal prompt
  readonly dontAskRemoveCompleted: boolean;
  setDontAskRemoveCompleted: (val: boolean) => void;
  readonly completedCustomerPendingRemoval: { folderPath: string; folderName: string } | null;
  setCompletedCustomerPendingRemoval: (item: { folderPath: string; folderName: string } | null) => void;

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
  readonly outputMode: import("@/core/types").OutputMode;
  setOutputFolder: (folder: string) => void;
  setStudioOutputFolder: (folder: string) => void;
  setOutputMode: (mode: import("@/core/types").OutputMode) => void;

  // App phase
  readonly phase: AppPhase;
  setPhase: (phase: AppPhase) => void;

  // Progress
  readonly progress: ProgressEvent | null;
  setProgress: (progress: ProgressEvent | null) => void;

  // Scan Options
  readonly scanOptions: import("@/core/types").ScanOptions;
  setScanOptions: (options: Partial<import("@/core/types").ScanOptions>) => void;

  // Match mode
  readonly matchMode: string;
  setMatchMode: (mode: string) => void;

  // Regex pattern
  readonly regexPattern: string;
  setRegexPattern: (pattern: string) => void;

  // Google Sheets Auto-Update on Filter Complete
  readonly sheetFilterContext: SheetFilterContext | null;
  setSheetFilterContext: (ctx: SheetFilterContext | null) => void;
  readonly sheetUpdateStatus: SheetUpdateStatus | null;
  setSheetUpdateStatus: (status: SheetUpdateStatus | null) => void;

  // Donate modal
  readonly isDonateModalOpen: boolean;
  setIsDonateModalOpen: (open: boolean) => void;

  // Reset
  resetAll: () => void;
}

export interface SheetFilterContext {
  profileId: string;
  spreadsheetId: string;
  tabTitle: string;
  matchedRow: number;
  jobName: string;
  folderName: string;
  statusColumnLetter?: string;
  statusValue?: string;
  autoUpdateOnFilterComplete?: boolean;
}

export interface SheetUpdateStatus {
  state: "idle" | "updating" | "success" | "error";
  message?: string;
  updatedAt?: string;
}

const loadStoredDontAsk = (): boolean => {
  try {
    return localStorage.getItem("mvd_picker_dont_ask_remove_completed") === "true";
  } catch {
    return false;
  }
};

const loadStoredPickerMode = (): PickerMode => {
  try {
    const val = localStorage.getItem("mvd_picker_mode");
    return val === "multi" ? "multi" : "single";
  } catch {
    return "single";
  }
};

const initialState = {
  activeTab: "home" as MainTab,
  activeModule: "launcher",
  sidebarCollapsed: false,
  hasSeenWelcome: false,
  lastClickPos: null as { x: number; y: number } | null,
  activeDropZone: null as "input" | "sync" | null,
  syncFolders: [] as string[],
  pickerMode: loadStoredPickerMode(),
  inputFolders: [] as string[],
  selectedInputFolders: [] as string[],
  batchCustomerFolders: [] as CustomerFolderItem[],
  dontAskRemoveCompleted: loadStoredDontAsk(),
  completedCustomerPendingRemoval: null as { folderPath: string; folderName: string } | null,
  rawCodeInput: "",
  parsedCodes: [] as CustomerCode[],
  scannedFiles: [] as PhotoFile[],
  matchResult: null as MatchResult | null,
  copyResult: null as CopyResult | null,
  outputFolder: "",
  studioOutputFolder: "",
  outputMode: "Folder" as import("@/core/types").OutputMode,
  phase: "idle" as AppPhase,
  progress: null as ProgressEvent | null,
  matchMode: "ExactNumber",
  regexPattern: "",
  scanOptions: {
    filter_raw: true,
    filter_jpg: false,
    recursive: false,
  },
  sheetFilterContext: null as SheetFilterContext | null,
  sheetUpdateStatus: null as SheetUpdateStatus | null,
  isDonateModalOpen: false,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setIsDonateModalOpen: (open) => set({ isDonateModalOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveModule: (module) => set({ activeModule: module }),
  setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),
  setHasSeenWelcome: (val) => set({ hasSeenWelcome: val }),
  setLastClickPos: (pos) => set({ lastClickPos: pos }),

  setActiveDropZone: (zone) => set({ activeDropZone: zone }),

  addSyncFolders: (folders) =>
    set((state) => {
      const newFolders = folders.filter((p) => !state.syncFolders.includes(p));
      return { syncFolders: [...state.syncFolders, ...newFolders] };
    }),
  removeSyncFolder: (folder) =>
    set((state) => ({ syncFolders: state.syncFolders.filter((f) => f !== folder) })),
  clearSyncFolders: () => set({ syncFolders: [] }),

  setPickerMode: (mode) => {
    try {
      localStorage.setItem("mvd_picker_mode", mode);
    } catch {}
    set((state) => {
      if (mode === "single" && state.inputFolders.length > 1) {
        const keep = state.selectedInputFolders[0] || state.inputFolders[0];
        const keepItem = state.batchCustomerFolders.find((f) => f.folder_path === keep);
        return {
          pickerMode: mode,
          inputFolders: keep ? [keep] : [],
          selectedInputFolders: keep ? [keep] : [],
          batchCustomerFolders: keepItem ? [keepItem] : [],
        };
      }
      return { pickerMode: mode };
    });
  },

  setBatchCustomerFolders: (folders) => set({ batchCustomerFolders: folders }),

  addInputFolder: (folder) =>
    set((state) => {
      const folderName = folder.split(/[/\\]+/).filter(Boolean).pop() || folder;
      const newItem: CustomerFolderItem = {
        folder_path: folder,
        folder_name: folderName,
        image_count: 0,
      };

      if (state.pickerMode === "single") {
        return {
          inputFolders: [folder],
          selectedInputFolders: [folder],
          batchCustomerFolders: [newItem],
        };
      } else {
        if (state.inputFolders.includes(folder)) return state;
        const nextInputFolders = [...state.inputFolders, folder];
        const nextBatchFolders = [...state.batchCustomerFolders, newItem];
        const nextSelected = state.selectedInputFolders.length > 0 ? state.selectedInputFolders : [folder];
        return {
          inputFolders: nextInputFolders,
          batchCustomerFolders: nextBatchFolders,
          selectedInputFolders: nextSelected,
        };
      }
    }),

  addBatchInputFolders: (items) =>
    set((state) => {
      if (!items || items.length === 0) return state;

      const normalized: CustomerFolderItem[] = items.map((item) => {
        if (typeof item === "string") {
          const folderName = item.split(/[/\\]+/).filter(Boolean).pop() || item;
          return {
            folder_path: item,
            folder_name: folderName,
            image_count: 0,
          };
        }
        return item;
      });

      if (state.pickerMode === "single") {
        const first = normalized[0];
        return {
          inputFolders: [first.folder_path],
          selectedInputFolders: [first.folder_path],
          batchCustomerFolders: [first],
        };
      }

      const existingPaths = new Set(state.inputFolders);
      const newItems = normalized.filter((it) => !existingPaths.has(it.folder_path));
      if (newItems.length === 0) return state;

      const nextInputFolders = [...state.inputFolders, ...newItems.map((it) => it.folder_path)];
      const nextBatchFolders = [...state.batchCustomerFolders, ...newItems];
      const nextSelected =
        state.selectedInputFolders.length > 0 ? state.selectedInputFolders : [nextInputFolders[0]];

      return {
        inputFolders: nextInputFolders,
        batchCustomerFolders: nextBatchFolders,
        selectedInputFolders: nextSelected,
      };
    }),

  selectSingleInputFolder: (folder) =>
    set({
      selectedInputFolders: [folder],
    }),

  removeInputFolder: (folder) =>
    set((state) => {
      const nextInputFolders = state.inputFolders.filter((f) => f !== folder);
      const nextBatchFolders = state.batchCustomerFolders.filter((f) => f.folder_path !== folder);
      let nextSelected = state.selectedInputFolders.filter((f) => f !== folder);
      if (nextSelected.length === 0 && nextInputFolders.length > 0) {
        nextSelected = [nextInputFolders[0]];
      }
      return {
        inputFolders: nextInputFolders,
        batchCustomerFolders: nextBatchFolders,
        selectedInputFolders: nextSelected,
      };
    }),

  clearInputFolders: () =>
    set({
      inputFolders: [],
      selectedInputFolders: [],
      batchCustomerFolders: [],
    }),

  toggleInputFolderSelection: (folder) =>
    set((state) => {
      // In single mode or multi mode, rule is: active 1 folder at a time
      return { selectedInputFolders: [folder] };
    }),

  setDontAskRemoveCompleted: (val) => {
    try {
      localStorage.setItem("mvd_picker_dont_ask_remove_completed", String(val));
    } catch {}
    set({ dontAskRemoveCompleted: val });
  },

  setCompletedCustomerPendingRemoval: (item) =>
    set({ completedCustomerPendingRemoval: item }),

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
  setSheetFilterContext: (ctx) => set({ sheetFilterContext: ctx }),
  setSheetUpdateStatus: (status) => set({ sheetUpdateStatus: status }),

  resetAll: () => set(initialState),
}));
