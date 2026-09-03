import { create } from 'zustand';
import { checkForUpdates, downloadAndInstallUpdate, installAndRestart, UpdateCheckResult } from '@/core/updater';
import { useSettingsStore } from './useSettingsStore';

export interface DownloadProgress {
  downloaded: number;
  total: number;
  speed: string;
  eta: number | null;
  percentage: number;
}

interface UpdaterState {
  updateResult: UpdateCheckResult | null;
  showModal: boolean;
  dismissedForSession: boolean;
  isChecking: boolean;
  isDownloading: boolean;
  isReadyToRestart: boolean;
  downloadProgress: DownloadProgress;
  error: string | null;

  checkForUpdates: (options?: { isStartup?: boolean; isManual?: boolean }) => Promise<UpdateCheckResult | null>;
  startDownload: () => Promise<void>;
  applyAndRestart: () => Promise<void>;
  openModal: () => void;
  closeModal: () => void;
  remindMeLater: () => void;
  resetError: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  updateResult: null,
  showModal: false,
  dismissedForSession: false,
  isChecking: false,
  isDownloading: false,
  isReadyToRestart: false,
  downloadProgress: {
    downloaded: 0,
    total: 0,
    speed: '',
    eta: null,
    percentage: 0,
  },
  error: null,

  checkForUpdates: async (options = {}) => {
    const { isStartup = false, isManual = false } = options;
    const settings = useSettingsStore.getState().settings;

    // If auto_check_updates is disabled and this is an automatic check, don't check
    if (!isManual && !settings.auto_check_updates) {
      return null;
    }

    set({ isChecking: true, error: null });

    try {
      const result = await checkForUpdates();
      if (result.hasUpdate && result.rawUpdate) {
        set({ updateResult: result });

        if (isManual) {
          // Manual check from Settings: always open modal
          set({ showModal: true });
        } else if (isStartup) {
          // Startup check (cold start)
          if (settings.auto_download_updates) {
            // Auto update enabled in settings: automatically open modal and trigger download
            set({ showModal: true });
            get().startDownload();
          } else if (!get().dismissedForSession) {
            // Ask user with modal if not dismissed
            set({ showModal: true });
          }
        } else {
          // Periodic / background / online check while user is working
          // Never download automatically when user is working.
          // Only pop up if not previously dismissed for session.
          if (!get().dismissedForSession) {
            set({ showModal: true });
          }
        }
        return result;
      } else {
        set({ updateResult: null });
        return result;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Check for updates error:', err);
      if (isManual) {
        set({ error: errMsg });
      }
      return null;
    } finally {
      set({ isChecking: false });
    }
  },

  startDownload: async () => {
    const { updateResult, isDownloading, isReadyToRestart } = get();
    if (!updateResult?.rawUpdate || isDownloading || isReadyToRestart) {
      return;
    }

    set({
      isDownloading: true,
      error: null,
      downloadProgress: {
        downloaded: 0,
        total: 0,
        speed: '',
        eta: null,
        percentage: 0,
      },
    });

    try {
      await downloadAndInstallUpdate(
        updateResult.rawUpdate,
        (contentLength, downloaded, speedStr, etaSeconds) => {
          set({
            downloadProgress: {
              total: contentLength || 0,
              downloaded,
              speed: speedStr,
              eta: etaSeconds,
              percentage: contentLength ? (downloaded / contentLength) * 100 : 0,
            },
          });
        }
      );

      set({ isReadyToRestart: true, isDownloading: false });
    } catch (err) {
      console.error('Download update error:', err);
      set({
        error: err instanceof Error ? err.message : String(err),
        isDownloading: false,
      });
    }
  },

  applyAndRestart: async () => {
    try {
      await installAndRestart();
    } catch (err) {
      console.error('Restart app error:', err);
      set({
        error: 'Không thể khởi động lại ứng dụng tự động. Vui lòng tắt và mở lại app thủ công.',
      });
    }
  },

  openModal: () => set({ showModal: true }),
  closeModal: () => set({ showModal: false }),
  remindMeLater: () => set({ showModal: false, dismissedForSession: true }),
  resetError: () => set({ error: null }),
}));

