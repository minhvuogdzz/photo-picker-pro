import React, { useEffect, useState, useRef } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { CheckCircle2, FileText, Sparkles } from "lucide-react";
import { playMacTrashSound } from "@/core/lib/trashSound";

interface FlyingBall {
  id: number;
  folderName: string;
}

interface TrailPoint {
  x: number;
  y: number;
  opacity: number;
  scale: number;
}

interface Particle {
  id: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
}

export function CrumpledPaperTossAnimation() {
  const tossAnimationTrigger = useAppStore((s) => s.tossAnimationTrigger);
  const [activeBall, setActiveBall] = useState<FlyingBall | null>(null);
  const [phase, setPhase] = useState<"card" | "crumpling" | "flying" | "impact" | "done">("card");

  const [pos, setPos] = useState({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [burstParticles, setBurstParticles] = useState<Particle[]>([]);
  const [impactPos, setImpactPos] = useState<{ x: number; y: number } | null>(null);

  const animRef = useRef<number | null>(null);
  const hasPlayedSoundRef = useRef<boolean>(false);

  useEffect(() => {
    if (!tossAnimationTrigger) return;

    const ball: FlyingBall = {
      id: tossAnimationTrigger.id,
      folderName: tossAnimationTrigger.folderName,
    };
    setActiveBall(ball);
    setPhase("card");
    setTrail([]);
    setBurstParticles([]);
    setImpactPos(null);
    hasPlayedSoundRef.current = false;

    // Start position: directly at the active customer item in the left queue!
    let startX: number;
    let startY: number;

    if (tossAnimationTrigger.startPos) {
      startX = tossAnimationTrigger.startPos.x;
      startY = tossAnimationTrigger.startPos.y;
    } else {
      const activeEl =
        document.getElementById("active-customer-queue-item") ||
        document.querySelector(`[data-folder-name="${tossAnimationTrigger.folderName}"]`) ||
        document.querySelector('[data-active-customer="true"]') ||
        document.getElementById("left-panel-collapsed-strip");

      if (activeEl) {
        const rect = activeEl.getBoundingClientRect();
        startX = Math.round(rect.left + rect.width / 2);
        startY = Math.round(rect.top + rect.height / 2);
      } else {
        // Fallback: Left side of workspace (where queue panel lives)
        startX = Math.round(Math.max(120, window.innerWidth * 0.12));
        startY = Math.round(window.innerHeight * 0.32);
      }
    }

    setPos({
      x: startX,
      y: startY,
      scale: 1,
      rotation: 0,
      opacity: 1,
    });

    // Step 1: Show prominent completed customer card for 180ms
    const cardTimer = setTimeout(() => {
      setPhase("crumpling");

      // Step 2: Crumple inward for 200ms
      const crumpleTimer = setTimeout(() => {
        setPhase("flying");

        // Target: find the mini trash bin anchor
        const targetEl = document.getElementById("mini-trash-bin-anchor");
        const targetRect = targetEl ? targetEl.getBoundingClientRect() : null;

        // Aim directly at the top opening (mouth) of the trash can
        const targetX = targetRect ? targetRect.left + targetRect.width / 2 - 16 : window.innerWidth - 180;
        const targetY = targetRect ? targetRect.top + 8 : window.innerHeight - 150;

        const startTime = performance.now();
        const duration = 580; // Smooth 580ms flight
        const trailHistory: TrailPoint[] = [];

        const runFlight = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Ease out curve for X
          const easeX = Math.sin((progress * Math.PI) / 2);
          const currentX = startX + (targetX - startX) * easeX;

          // High dramatic arc for Y (parabolic curve peaking high)
          const arcPeak = 160;
          const arcY = Math.sin(progress * Math.PI) * arcPeak;
          const currentY = startY + (targetY - startY) * progress - arcY;

          // Shrink towards entrance
          const currentScale = 1 - 0.65 * progress;
          const currentRotation = progress * 960;
          const currentOpacity = progress > 0.92 ? (1 - progress) / 0.08 : 1;

          setPos({
            x: currentX,
            y: currentY,
            scale: currentScale,
            rotation: currentRotation,
            opacity: currentOpacity,
          });

          // Record motion trail
          trailHistory.push({
            x: currentX,
            y: currentY,
            opacity: 0.55 * (1 - progress),
            scale: currentScale * 0.8,
          });
          if (trailHistory.length > 5) trailHistory.shift();
          setTrail([...trailHistory]);

          // Trigger macOS sound right as paper is about to land into trash can (progress ~ 0.82)
          if (progress >= 0.82 && !hasPlayedSoundRef.current) {
            hasPlayedSoundRef.current = true;
            playMacTrashSound();
          }

          if (progress < 1) {
            animRef.current = requestAnimationFrame(runFlight);
          } else {
            // Impact! Generate paper dust burst particles
            setPhase("impact");
            setTrail([]);
            setImpactPos({ x: targetX + 16, y: targetY });

            const particles: Particle[] = Array.from({ length: 8 }, (_, i) => ({
              id: i,
              dx: (Math.random() - 0.5) * 55,
              dy: -Math.random() * 45 - 15,
              size: Math.random() * 4 + 3,
              color: i % 2 === 0 ? "#10b981" : "#e4e4e7",
            }));
            setBurstParticles(particles);

            setTimeout(() => {
              setPhase("done");
              setActiveBall(null);
            }, 600);
          }
        };

        animRef.current = requestAnimationFrame(runFlight);
      }, 200);

      return () => clearTimeout(crumpleTimer);
    }, 200);

    return () => {
      clearTimeout(cardTimer);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [tossAnimationTrigger]);

  if (!activeBall || phase === "done") return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none">
      {/* Motion Trail Particles */}
      {phase === "flying" &&
        trail.map((pt, i) => (
          <div
            key={i}
            style={{
              transform: `translate3d(${pt.x + 8}px, ${pt.y + 8}px, 0) scale(${pt.scale})`,
              opacity: pt.opacity,
            }}
            className="absolute w-3 h-3 rounded-full bg-emerald-400/40 blur-[1px] will-change-transform"
          />
        ))}

      {/* Phase 1: High-Contrast Customer Card Pop */}
      {phase === "card" && (
        <div
          style={{
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(1)`,
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all animate-scale-in"
        >
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-card border-2 border-emerald-500 shadow-[0_10px_35px_rgba(16,185,129,0.45)] text-foreground max-w-[280px]">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-bounce">
              <CheckCircle2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block tracking-wider leading-tight">
                ✓ Lọc xong · Bỏ vào thùng rác
              </span>
              <p className="text-[11px] font-bold text-foreground truncate mt-0.5">
                {activeBall.folderName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: Crumpling Paper Animation */}
      {phase === "crumpling" && (
        <div
          style={{
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(0.7) rotate(25deg)`,
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-200"
        >
          <div className="w-14 h-14 rounded-[40%_60%_70%_30%/50%_60%_40%_50%] bg-gradient-to-br from-white via-zinc-200 to-zinc-400 dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-500 shadow-2xl border-2 border-emerald-500/90 flex items-center justify-center relative overflow-hidden animate-pulse">
            <div className="w-6 h-0.5 bg-zinc-600/60 rotate-45 rounded-full" />
            <div className="w-5 h-0.5 bg-zinc-500/50 -rotate-30 rounded-full" />
          </div>
        </div>
      )}

      {/* Phase 3: Parabolic Flight of 3D Wrinkled Paper Ball */}
      {phase === "flying" && (
        <div
          style={{
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${pos.scale}) rotate(${pos.rotation}deg)`,
            opacity: pos.opacity,
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 will-change-transform"
        >
          {/* Detailed 3D Crumpled Paper Ball */}
          <div className="relative w-9 h-9 rounded-[45%_55%_65%_35%/50%_60%_40%_50%] bg-gradient-to-br from-white via-zinc-200 to-zinc-400 dark:from-zinc-100 dark:via-zinc-200 dark:to-zinc-400 shadow-[0_6px_20px_rgba(0,0,0,0.35)] border border-zinc-400/80 flex items-center justify-center overflow-hidden">
            {/* Paper wrinkles / creases */}
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#52525b_1px,transparent_1px)] [background-size:3px_3px]" />
            <div className="w-5 h-[1.5px] bg-zinc-600/70 rotate-45 rounded-full" />
            <div className="w-4 h-[1px] bg-zinc-700/60 -rotate-35 rounded-full" />
            <div className="w-3 h-[1px] bg-zinc-600/50 rotate-12 rounded-full" />
          </div>
        </div>
      )}

      {/* Phase 4: Impact Poof Sparkles & +1 Indicator */}
      {phase === "impact" && impactPos && (
        <div
          style={{
            left: impactPos.x,
            top: impactPos.y,
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2"
        >
          {/* Floating +1 Pill floating upwards */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-mono font-bold text-[11px] shadow-lg animate-[slideUp_0.5s_ease-out_forwards] flex items-center gap-1 whitespace-nowrap">
            <Sparkles size={11} />
            <span>+1 Đã đá ra thùng rác</span>
          </div>

          {/* Burst Particles */}
          {burstParticles.map((p) => (
            <div
              key={p.id}
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                transform: `translate(${p.dx}px, ${p.dy}px)`,
                transition: "all 0.5s cubic-bezier(0.25, 1, 0.5, 1)",
                opacity: 0,
              }}
              className="absolute rounded-full shadow-sm"
            />
          ))}
        </div>
      )}
    </div>
  );
}
