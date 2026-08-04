import { useEffect, useState } from "react";
import { useAppStore } from "@/core/stores/useAppStore";

export function WelcomeScreen() {
  const [phase, setPhase] = useState<"vi" | "en" | "done">("vi");
  const setHasSeenWelcome = useAppStore((s) => s.setHasSeenWelcome);

  const skipWelcome = () => {
    setPhase("done");
    setTimeout(() => setHasSeenWelcome(true), 1000); // Wait for transition
  };

  useEffect(() => {
    // VI text shows for 4.5s, then EN text for 4.5s, then done
    const viTimer = setTimeout(() => {
      setPhase("en");
    }, 4500);

    const enTimer = setTimeout(() => {
      skipWelcome();
    }, 9000);

    const handleKeyDown = () => skipWelcome();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(viTimer);
      clearTimeout(enTimer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [setHasSeenWelcome]);

  return (
    <div 
      onClick={skipWelcome}
      className={`fixed inset-0 z-[100] flex items-center justify-center cursor-pointer transition-opacity duration-1000 ${phase === "done" ? "opacity-0 pointer-events-none" : "opacity-100"}`}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-3xl" />
      
      <div className="relative z-10 text-center max-w-5xl px-8 w-full flex items-center justify-center">
        {phase === "vi" && (
          <div className="absolute w-full mx-auto flex flex-col items-center justify-center gap-3" style={{ animation: 'fade-in-out 4.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}>
            <p className="text-xl md:text-2xl font-semibold text-white/70 tracking-[0.15em] uppercase drop-shadow-md">
              Chào mừng bạn đến với hệ sinh thái
            </p>
            <h1 className="text-6xl md:text-7xl lg:text-8xl text-center tracking-tight tahoe-glass-text leading-tight">
              MVD Photoshop Academy
            </h1>
          </div>
        )}

        {phase === "en" && (
          <div className="absolute w-full mx-auto flex flex-col items-center justify-center gap-3" style={{ animation: 'fade-in-out 4.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}>
            <p className="text-xl md:text-2xl font-semibold text-white/70 tracking-[0.15em] uppercase drop-shadow-md">
              Welcome to the ecosystem of
            </p>
            <h1 className="text-6xl md:text-7xl lg:text-8xl text-center tracking-tight tahoe-glass-text leading-tight">
              MVD Photoshop Academy
            </h1>
          </div>
        )}
      </div>
    </div>
  );
}
