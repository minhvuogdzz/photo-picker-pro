import { Update, DownloadEvent } from '@tauri-apps/plugin-updater';

export type DownloadProgressCallback = (
  contentLength: number | undefined,
  downloaded: number,
  speedStr: string,
  etaSeconds: number | null
) => void;

/**
 * Executes the download and install process using Tauri's updater.
 */
export async function downloadAndInstallUpdate(
  update: Update,
  onProgress: DownloadProgressCallback
): Promise<void> {
  let downloadedBytes = 0;
  let totalLength: number | undefined = undefined;
  const startTime = Date.now();

  try {
    await update.downloadAndInstall((event: DownloadEvent) => {
      switch (event.event) {
        case 'Started':
          totalLength = event.data.contentLength;
          downloadedBytes = 0;
          break;
        case 'Progress':
          downloadedBytes += event.data.chunkLength;
          
          const elapsedSec = (Date.now() - startTime) / 1000;
          let speedStr = "0 MB/s";
          let etaSeconds: number | null = null;
          
          if (elapsedSec > 0) {
            const bytesPerSec = downloadedBytes / elapsedSec;
            speedStr = (bytesPerSec / (1024 * 1024)).toFixed(1) + " MB/s";
            
            if (totalLength && bytesPerSec > 0) {
              const remainingBytes = totalLength - downloadedBytes;
              etaSeconds = remainingBytes / bytesPerSec;
            }
          }
          
          onProgress(totalLength, downloadedBytes, speedStr, etaSeconds);
          break;
        case 'Finished':
          break;
      }
    });
  } catch (error) {
    console.error('Failed to download and install update:', error);
    throw error;
  }
}
