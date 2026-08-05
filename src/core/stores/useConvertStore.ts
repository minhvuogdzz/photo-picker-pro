import { create } from "zustand";

export interface ConvertProgress {
  total: number;
  current: number;
  percentage: number;
  currentFile: string;
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
  resetAll: () => void;
}

const initialState = {
  inputFolders: [],
  outputFolder: "",
  targetFormat: "JPG",
  quality: 4,
  exportJpg2048: false,
  isConverting: false,
  progress: null,
  logs: [],
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

  clearInputFolders: () => set({ inputFolders: [] }),

  setOutputFolder: (folder) => set({ outputFolder: folder }),

  setTargetFormat: (format) => set({ targetFormat: format }),

  setQuality: (quality) => set({ quality }),

  setExportJpg2048: (val) => set({ exportJpg2048: val }),

  setIsConverting: (converting) => set({ isConverting: converting }),

  setProgress: (progress) => set({ progress }),

  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),

  clearLogs: () => set({ logs: [] }),

  resetAll: () => set(initialState),
}));
