import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useSettingsStore } from "./useSettingsStore";
import { useContactSheetStore } from "@/modules/contact-the-sheet/stores/useContactSheetStore";

export interface NotificationConfigState {
  profileId: string;
  selectedTabs: string[];
  statusColumn: string;
  targetStatusValue: string;
  dueDateColumn: string;
  linkEditColumn: string;
  systemNotificationsEnabled: boolean;
  urgentScannerEnabled: boolean;
  activeTab: "history" | "config";
  configSubTab: "sheet" | "system";

  setProfileId: (id: string) => void;
  setSelectedTabs: (tabs: string[]) => void;
  toggleTab: (tab: string) => void;
  selectAllTabs: (tabs: string[]) => void;
  deselectAllTabs: () => void;
  setStatusColumn: (col: string) => void;
  setTargetStatusValue: (val: string) => void;
  setDueDateColumn: (col: string) => void;
  setLinkEditColumn: (col: string) => void;
  setSystemNotificationsEnabled: (enabled: boolean) => void;
  setUrgentScannerEnabled: (enabled: boolean) => void;
  setActiveTab: (tab: "history" | "config") => void;
  setConfigSubTab: (subTab: "sheet" | "system") => void;
  saveAll: () => Promise<boolean>;
}

function getInitialConfig() {
  let profileId = "";
  let selectedTabs: string[] = [];
  let statusColumn = "M";
  let targetStatusValue = "Chưa lọc";
  let dueDateColumn = "L";
  let linkEditColumn = "O";

  if (typeof window !== "undefined") {
    profileId = localStorage.getItem("mvd_urgent_profile_id") || "";
    try {
      const savedTabs = JSON.parse(localStorage.getItem("mvd_check_selected_tabs") || "[]");
      if (Array.isArray(savedTabs)) selectedTabs = savedTabs;
    } catch {}
    statusColumn = localStorage.getItem("mvd_check_status_column") || "M";
    targetStatusValue = localStorage.getItem("mvd_check_status_value") || "Chưa lọc";
    dueDateColumn = localStorage.getItem("mvd_check_due_date_column") || "L";
    linkEditColumn = localStorage.getItem("mvd_check_link_edit_column") || "O";
  }

  return {
    profileId,
    selectedTabs,
    statusColumn,
    targetStatusValue,
    dueDateColumn,
    linkEditColumn,
    systemNotificationsEnabled: true,
    urgentScannerEnabled: true,
    activeTab: "history" as const,
    configSubTab: "sheet" as const,
  };
}

const initial = getInitialConfig();

export const useNotificationConfigStore = create<NotificationConfigState>()(
  persist(
    (set, get) => ({
      ...initial,

      setProfileId: (id) => {
        set({ profileId: id });
        try {
          localStorage.setItem("mvd_urgent_profile_id", id);
        } catch {}
      },

      setSelectedTabs: (tabs) => {
        set({ selectedTabs: tabs });
        try {
          localStorage.setItem("mvd_check_selected_tabs", JSON.stringify(tabs));
        } catch {}
      },

      toggleTab: (tab) => {
        const cur = get().selectedTabs;
        const next = cur.includes(tab) ? cur.filter((t) => t !== tab) : [...cur, tab];
        set({ selectedTabs: next });
        try {
          localStorage.setItem("mvd_check_selected_tabs", JSON.stringify(next));
        } catch {}
      },

      selectAllTabs: (allTabs) => {
        set({ selectedTabs: [...allTabs] });
        try {
          localStorage.setItem("mvd_check_selected_tabs", JSON.stringify(allTabs));
        } catch {}
      },

      deselectAllTabs: () => {
        set({ selectedTabs: [] });
        try {
          localStorage.setItem("mvd_check_selected_tabs", "[]");
        } catch {}
      },

      setStatusColumn: (col) => {
        set({ statusColumn: col });
        try {
          localStorage.setItem("mvd_check_status_column", col);
        } catch {}
      },

      setTargetStatusValue: (val) => {
        set({ targetStatusValue: val });
        try {
          localStorage.setItem("mvd_check_status_value", val);
        } catch {}
      },

      setDueDateColumn: (col) => {
        set({ dueDateColumn: col });
        try {
          localStorage.setItem("mvd_check_due_date_column", col);
        } catch {}
      },

      setLinkEditColumn: (col) => {
        set({ linkEditColumn: col });
        try {
          localStorage.setItem("mvd_check_link_edit_column", col);
        } catch {}
      },

      setSystemNotificationsEnabled: (enabled) => {
        set({ systemNotificationsEnabled: enabled });
        useSettingsStore.getState().updateSetting("system_notifications_enabled", enabled);
      },

      setUrgentScannerEnabled: (enabled) => {
        set({ urgentScannerEnabled: enabled });
        useSettingsStore.getState().updateSetting("urgent_scanner_enabled", enabled);
      },

      setActiveTab: (tab) => set({ activeTab: tab }),
      setConfigSubTab: (subTab) => set({ configSubTab: subTab }),

      saveAll: async () => {
        const s = get();
        try {
          // 1. Persist legacy localStorage keys
          localStorage.setItem("mvd_urgent_profile_id", s.profileId);
          localStorage.setItem("mvd_check_status_column", s.statusColumn);
          localStorage.setItem("mvd_check_status_value", s.targetStatusValue.trim());
          localStorage.setItem("mvd_check_due_date_column", s.dueDateColumn);
          localStorage.setItem("mvd_check_link_edit_column", s.linkEditColumn);
          localStorage.setItem("mvd_check_selected_tabs", JSON.stringify(s.selectedTabs));

          // 2. Sync active profile in Contact Sheet if valid
          if (s.profileId) {
            useContactSheetStore.getState().setActiveProfile(s.profileId);
          }

          // 3. Sync to useSettingsStore and backend
          const settingsStore = useSettingsStore.getState();
          settingsStore.updateSetting("system_notifications_enabled", s.systemNotificationsEnabled);
          settingsStore.updateSetting("urgent_scanner_enabled", s.urgentScannerEnabled);

          return true;
        } catch (err) {
          console.error("Failed to save notification config:", err);
          return false;
        }
      },
    }),
    {
      name: "mvd_notification_config_store",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
