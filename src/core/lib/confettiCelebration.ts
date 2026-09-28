import confetti from "canvas-confetti";

/**
 * Play an optional, gentle celebratory chime using Web Audio API
 * (Synthesized in real-time, zero external asset dependencies, zero lag).
 */
export function playCelebrationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Major triad fanfare)
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0, now + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.95);
    });

    // Close audio context after playback
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 2000);
  } catch {
    // Audio autoplay restrictions or errors safely ignored
  }
}

/**
 * Premium celebratory confetti cannon sequence for Payment & Activation Success.
 * Fires multi-directional cannons (Center burst, Left cannon, Right cannon, and golden rain).
 */
export function triggerPaymentSuccessConfetti() {
  // Play chime
  playCelebrationSound();

  const colors = [
    "#10b981", // Emerald
    "#06b6d4", // Cyan
    "#f59e0b", // Amber gold
    "#8b5cf6", // Purple
    "#3b82f6", // Royal blue
    "#ec4899", // Rose pink
    "#ffd700", // Pure gold
    "#ffffff", // Silver white
  ];

  // Stage 1: Big Center Explosion
  confetti({
    particleCount: 90,
    spread: 100,
    origin: { y: 0.55, x: 0.5 },
    colors,
    ticks: 350,
    gravity: 0.9,
    scalar: 1.15,
    startVelocity: 45,
    zIndex: 99999,
  });

  // Stage 2: Left Cannon (Shooting towards upper right)
  setTimeout(() => {
    confetti({
      particleCount: 65,
      angle: 60,
      spread: 60,
      origin: { x: 0.05, y: 0.75 },
      colors,
      ticks: 300,
      gravity: 0.95,
      scalar: 1.1,
      startVelocity: 55,
      zIndex: 99999,
    });
  }, 220);

  // Stage 3: Right Cannon (Shooting towards upper left)
  setTimeout(() => {
    confetti({
      particleCount: 65,
      angle: 120,
      spread: 60,
      origin: { x: 0.95, y: 0.75 },
      colors,
      ticks: 300,
      gravity: 0.95,
      scalar: 1.1,
      startVelocity: 55,
      zIndex: 99999,
    });
  }, 440);

  // Stage 4: Cascading Golden Shower from top
  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 140,
      origin: { x: 0.5, y: 0.15 },
      colors: ["#ffd700", "#f59e0b", "#10b981", "#ffffff"],
      ticks: 400,
      gravity: 0.7,
      scalar: 1.25,
      shapes: ["circle", "square"],
      startVelocity: 30,
      zIndex: 99999,
    });
  }, 800);

  // Stage 5: Final Double Starburst (Left + Right simultaneous finale)
  setTimeout(() => {
    confetti({
      particleCount: 45,
      angle: 70,
      spread: 70,
      origin: { x: 0.15, y: 0.65 },
      colors,
      ticks: 280,
      gravity: 1,
      startVelocity: 48,
      zIndex: 99999,
    });
    confetti({
      particleCount: 45,
      angle: 110,
      spread: 70,
      origin: { x: 0.85, y: 0.65 },
      colors,
      ticks: 280,
      gravity: 1,
      startVelocity: 48,
      zIndex: 99999,
    });
  }, 1200);
}

/**
 * Quick single celebratory burst (e.g. for re-trigger button click)
 */
export function triggerMiniConfetti() {
  playCelebrationSound();
  confetti({
    particleCount: 70,
    spread: 80,
    origin: { y: 0.6, x: 0.5 },
    colors: ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6", "#ffd700"],
    ticks: 260,
    gravity: 0.9,
    scalar: 1.1,
    startVelocity: 40,
    zIndex: 99999,
  });
}
