import { relaunch } from '@tauri-apps/plugin-process';

/**
 * Relaunches the application to apply the installed update.
 */
export async function installAndRestart(): Promise<void> {
  try {
    await relaunch();
  } catch (error) {
    console.error('Failed to relaunch application:', error);
    throw error;
  }
}
