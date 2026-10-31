import { create } from "zustand";

export interface UrgentCustomerItem {
  row: number;
  tabTitle: string;
  customerName: string;
  actualStatus: string;
  photoCode1: string;
  dueDate: string;
}

export interface AppNotification {
  id: string;
  timestamp: number;
  dateFormatted: string;
  title: string;
  body: string;
  urgentCount?: number;
  type: "urgent" | "test" | "info";
  isRead: boolean;
  customers?: UrgentCustomerItem[];
}

interface NotificationStore {
  notifications: AppNotification[];
  addNotification: (
    item: Omit<AppNotification, "id" | "timestamp" | "dateFormatted" | "isRead"> & {
      customers?: UrgentCustomerItem[];
    }
  ) => AppNotification;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  reloadFromStorage: () => void;
  getUnreadCount: () => number;
}

const STORAGE_KEY = "dh_app_notification_history";

function notifyStoreChanged() {
  if (typeof window !== "undefined") {
    import("@tauri-apps/api/event").then(({ emit }) => {
      emit("notifications-store-updated", {}).catch(() => {});
    }).catch(() => {});
  }
}

function loadSavedNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Failed to load notifications from storage:", err);
  }
  return [];
}

function saveNotifications(items: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
  } catch (err) {
    console.warn("Failed to save notifications to storage:", err);
  }
}

function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} - ${d}/${m}/${y}`;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: loadSavedNotifications(),

  addNotification: (item) => {
    const now = new Date();
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now.getTime(),
      dateFormatted: formatDate(now),
      title: item.title,
      body: item.body,
      urgentCount: item.urgentCount,
      type: item.type || "info",
      isRead: false,
      customers: item.customers,
    };

    set((state) => {
      const updated = [newNotif, ...state.notifications].slice(0, 100);
      saveNotifications(updated);
      notifyStoreChanged();
      return { notifications: updated };
    });

    return newNotif;
  },

  markAsRead: (id: string) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      saveNotifications(updated);
      notifyStoreChanged();
      return { notifications: updated };
    });
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.notifications.map((n) => ({ ...n, isRead: true }));
      saveNotifications(updated);
      notifyStoreChanged();
      return { notifications: updated };
    });
  },

  removeNotification: (id: string) => {
    set((state) => {
      const updated = state.notifications.filter((n) => n.id !== id);
      saveNotifications(updated);
      notifyStoreChanged();
      return { notifications: updated };
    });
  },

  clearAllNotifications: () => {
    set(() => {
      saveNotifications([]);
      notifyStoreChanged();
      return { notifications: [] };
    });
  },

  reloadFromStorage: () => {
    set({ notifications: loadSavedNotifications() });
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.isRead).length;
  },
}));

// Lắng nghe cập nhật chéo giữa cửa sổ App chính và cửa sổ Tray Overview
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      useNotificationStore.getState().reloadFromStorage();
    }
  });

  import("@tauri-apps/api/event").then(({ listen }) => {
    listen("notifications-store-updated", () => {
      useNotificationStore.getState().reloadFromStorage();
    });
  }).catch(() => {});
}
