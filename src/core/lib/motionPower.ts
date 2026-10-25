/**
 * Keeps idle CPU near zero by pausing looping animations when nobody is looking.
 *
 * Every frame of an infinite CSS animation makes WebKit repaint and recomposite, and the
 * large blur / backdrop-blur layers behind them make each frame expensive: an idle launcher
 * cost ~10% CPU. Two states are set on <html>, and index.css pauses the matching animations:
 *
 * - `motion-idle`: no mouse/keyboard input for IDLE_AFTER_MS → decorative loops pause
 *   (pulse dots, coffee steam, gradient text...). Spinners keep running so progress stays visible.
 * - `motion-background`: the window is hidden or not focused → spinners pause too.
 *
 * One-shot animations (fade-in, slide-up...) are never paused, so nothing can freeze half-shown.
 * Any input resumes everything immediately.
 */

const IDLE_AFTER_MS = 8000;

let lastActivityAt = Date.now();
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let isIdle = false;

function setRootClass(name: string, on: boolean): void {
  document.documentElement.classList.toggle(name, on);
}

function scheduleIdleCheck(delay: number): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    idleTimer = null;
    const quietFor = Date.now() - lastActivityAt;
    if (quietFor >= IDLE_AFTER_MS) {
      isIdle = true;
      setRootClass("motion-idle", true);
    } else {
      scheduleIdleCheck(IDLE_AFTER_MS - quietFor);
    }
  }, delay);
}

// Runs on every pointer move, so it only records a timestamp; the single pending timer
// re-checks it instead of being reset on each event.
function onActivity(): void {
  lastActivityAt = Date.now();
  if (isIdle) {
    isIdle = false;
    setRootClass("motion-idle", false);
  }
  if (!idleTimer) scheduleIdleCheck(IDLE_AFTER_MS);
}

function updateBackgroundState(): void {
  const background = document.visibilityState !== "visible" || !document.hasFocus();
  setRootClass("motion-background", background);
  if (!background) onActivity();
}

let started = false;

export function startMotionPowerSaver(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  const passive = { passive: true, capture: true } as const;
  for (const type of ["pointermove", "pointerdown", "wheel", "keydown", "touchstart"]) {
    window.addEventListener(type, onActivity, passive);
  }
  window.addEventListener("focus", updateBackgroundState);
  window.addEventListener("blur", updateBackgroundState);
  document.addEventListener("visibilitychange", updateBackgroundState);

  updateBackgroundState();
  scheduleIdleCheck(IDLE_AFTER_MS);
}
