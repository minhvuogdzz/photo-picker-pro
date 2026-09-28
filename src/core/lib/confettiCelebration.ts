import confetti from "canvas-confetti";

/**
 * Explosive celebratory party cannon & fanfare sound using Web Audio API.
 * High-impact "POP/BOOM" explosion blast + sparkling victory fanfare.
 * Volume tuned to be punchy, clear, and audible at normal speaker volume.
 */
export function playCelebrationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Helper: create a punchy cannon blast (mortar thump + crackle pop)
    const fireCannonPop = (startTime: number, volume: number = 0.85, pitch: number = 240) => {
      // 1. Low-end punchy thump (simulates the pressure chamber release)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();

      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(pitch, startTime);
      subOsc.frequency.exponentialRampToValueAtTime(32, startTime + 0.18);

      subGain.gain.setValueAtTime(volume * 0.9, startTime);
      subGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);

      subOsc.start(startTime);
      subOsc.stop(startTime + 0.25);

      // 2. High-energy burst noise (simulates the party popper crack / explosion)
      const bufferSize = Math.floor(ctx.sampleRate * 0.12); // 120ms burst
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.035));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, startTime);
      filter.Q.setValueAtTime(1.8, startTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(volume * 0.75, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(startTime);
      noise.stop(startTime + 0.14);
    };

    // Fire main explosion blast instantly
    fireCannonPop(now, 0.95, 260);

    // Fire two follow-up satellite cannon pops (for multi-directional cannons)
    fireCannonPop(now + 0.08, 0.65, 220);
    fireCannonPop(now + 0.16, 0.55, 280);

    // 3. Rich, bright victory fanfare chord (triumphant brass/chime timbre)
    // Notes: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.5)
    const fanfareNotes = [523.25, 659.25, 783.99, 1046.5];
    const fanfareStart = now + 0.06;

    fanfareNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      // Triangle wave has rich odd harmonics that sound much fuller and louder than pure sine
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, fanfareStart + idx * 0.07);

      const noteStart = fanfareStart + idx * 0.07;
      oscGain.gain.setValueAtTime(0, noteStart);
      oscGain.gain.linearRampToValueAtTime(0.45, noteStart + 0.03);
      oscGain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.85);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + 0.9);
    });

    // Close audio context after playback
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 2500);
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
