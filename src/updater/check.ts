import { check, Update } from '@tauri-apps/plugin-updater';
import { parseReleaseNotes, ReleaseNotes } from './release';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  version?: string;
  date?: string;
  notes?: ReleaseNotes;
  rawUpdate?: Update;
}

/**
 * Checks for available updates.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const update = await check();
    
    if (update) {
      return {
        hasUpdate: true,
        version: update.version,
        date: update.date,
        notes: parseReleaseNotes(update.body),
        rawUpdate: update,
      };
    }
    
    return { hasUpdate: false };
  } catch (error) {
    console.error('Failed to check for updates:', error);
    throw error;
  }
}
