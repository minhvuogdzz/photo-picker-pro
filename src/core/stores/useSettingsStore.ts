import { create } from "zustand";
import type { AppSettings } from "../types/index.ts";

interface SettingsState {
  readonly settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  setLanguageLocal: (language: string) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  addFavoriteFolder: (folder: string) => void;
  removeFavoriteFolder: (folder: string) => void;
}

function getInitialLanguage(): string {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("mvd_app_language");
      if (saved === "en" || saved === "vi") return saved;
    }
  } catch {}
  return "vi";
}

const defaultSettings: AppSettings = {
  theme: "dark",
  language: getInitialLanguage(),
  default_match_mode: "ExactNumber",
  default_output: "",
  default_duplicate_policy: "CopyFirst",
  default_preserve_folder: false,
  favorite_folders: [],
  auto_check_updates: true,
  auto_download_updates: true,
  install_on_exit: true,
  beta_channel: false,
  close_to_tray: true,
  auto_start: true,
  system_notifications_enabled: true,
  urgent_scanner_enabled: true,
  urgent_notify_phones: "",
  zalo_webhook_url: "",
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,

  setSettings: (settings) => set({ settings }),

  setLanguageLocal: (language) =>
    set((state) => {
      const normalized = language === "en" ? "en" : "vi";
      if (state.settings.language === normalized) return state;
      return { settings: { ...state.settings, language: normalized } };
    }),

  updateSetting: (key, value) =>
    set((state) => {
      const updated = { ...state.settings, [key]: value };
      import("@tauri-apps/api/core")
        .then(({ invoke }) => {
          invoke("save_settings", { settings: updated }).catch(() => {});
        })
        .catch(() => {});
      return { settings: updated };
    }),

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
