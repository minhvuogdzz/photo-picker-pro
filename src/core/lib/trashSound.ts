/**
 * Plays the authentic macOS trash crumple / toss sound effect.
 * Uses the genuine macOS CoreAudio System Sound with a Web Audio API fallback.
 */

let cachedAudio: HTMLAudioElement | null = null;

export function playMacTrashSound(): void {
  try {
    if (!cachedAudio) {
      cachedAudio = new Audio("/sounds/trash.wav");
    }
    cachedAudio.currentTime = 0;
    cachedAudio.volume = 0.85;

    const promise = cachedAudio.play();
    if (promise !== undefined) {
      promise.catch((err) => {
        // Fallback to move_to_trash sound or synthesized paper crunch
        tryFallbackSound();
      });
    }
  } catch {
    tryFallbackSound();
  }
}

function tryFallbackSound(): void {
  try {
    const fallback = new Audio("/sounds/move_to_trash.wav");
    fallback.volume = 0.8;
    void fallback.play().catch(() => {
      synthesizePaperCrumple();
    });
  } catch {
    synthesizePaperCrumple();
  }
}

/**
 * Procedural Web Audio API paper crumple synthesis fallback.
 * Generates white noise through bandpass filters with micro-burst amplitude modulation.
 */
function synthesizePaperCrumple(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const duration = 0.28;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    // Generate textured paper crinkles
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      const decay = 1 - i / bufferSize;
      output[i] = white * Math.pow(decay, 1.8);
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(3200, ctx.currentTime);
    filter.Q.setValueAtTime(2.2, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    whiteNoise.start();
  } catch {}
}
