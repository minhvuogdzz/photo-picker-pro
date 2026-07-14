import { create } from "zustand";
import type { AppSettings } from "@/types";

interface SettingsState {
  readonly settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  addFavoriteFolder: (folder: string) => void;
  removeFavoriteFolder: (folder: string) => void;
}

const defaultSettings: AppSettings = {
  theme: "dark",
  language: "vi",
  default_match_mode: "ExactNumber",
  default_output: "",
  default_duplicate_policy: "CopyFirst",
  default_preserve_folder: false,
  favorite_folders: [],
  auto_check_updates: true,
  auto_download_updates: true,
  install_on_exit: true,
  beta_channel: false,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,

  setSettings: (settings) => set({ settings }),

  updateSetting: (key, value) =>
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    })),

  addFavoriteFolder: (folder) =>
    set((state) => {
      if (state.settings.favorite_folders.includes(folder)) return state;
      return {
        settings: {
          ...state.settings,
          favorite_folders: [...state.settings.favorite_folders, folder],
        },
      };
    }),

  removeFavoriteFolder: (folder) =>
    set((state) => ({
      settings: {
        ...state.settings,
        favorite_folders: state.settings.favorite_folders.filter((f) => f !== folder),
      },
    })),
}));
