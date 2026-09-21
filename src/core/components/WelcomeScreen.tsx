import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { ArrowRight } from "lucide-react";

interface WelcomeConfig {
  viSubtitle?: string;
  enSubtitle?: string;
  title?: string;
}

export function WelcomeScreen() {
  const [phase, setPhase] = useState<"vi" | "en" | "done">("vi");
  const setHasSeenWelcome = useAppStore((s) => s.setHasSeenWelcome);

  const [config] = useState<WelcomeConfig>(() => {
    try {
      const saved = localStorage.getItem("mvd_welcome_config");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const canSkip = phase === "en";

  const handleSkip = useCallback(() => {
    // Only allow skipping once Vietnamese phase has finished and English phase is active
    if (phase !== "en") return;
    setPhase("done");
    setTimeout(() => setHasSeenWelcome(true), 400);
  }, [phase, setHasSeenWelcome]);

  useEffect(() => {
    // 1. VI phase runs first (2.8s) — user cannot skip
    const viTimer = setTimeout(() => {
      setPhase("en");
    }, 2800);

    // 2. EN phase runs (3.2s after VI, total 6.0s) then auto-finishes
    const enTimer = setTimeout(() => {
      setPhase("done");
      setTimeout(() => setHasSeenWelcome(true), 400);
    }, 6000);

    return () => {
      clearTimeout(viTimer);
      clearTimeout(enTimer);
    };
  }, [setHasSeenWelcome]);

  useEffect(() => {
    const handleKeyDown = () => {
      if (phase === "en") {
        handleSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, handleSkip]);

  const viSubtitle = config.viSubtitle || "Chào mừng bạn đến với hệ sinh thái";
  const enSubtitle = config.enSubtitle || "Welcome to the ecosystem of";
  const title = config.title || "MVD Photoshop Academy";

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-700 select-none overflow-hidden ${
        canSkip ? "cursor-pointer" : "cursor-default"
      } ${
        phase === "done" ? "opacity-0 pointer-events-none backdrop-blur-none" : "opacity-100"
      }`}
    >
      {/* Frosted glass backdrop allowing subtle workspace depth */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl" />

      {/* Gentle center spotlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[480px] bg-white/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* AI Thinking Border Container */}
      <div className="relative z-10 max-w-2xl w-full mx-6 group">
        
        {/* Soft Ambient Chromatic Glow behind container */}
        <div
          className="absolute -inset-2 rounded-[34px] opacity-40 blur-2xl pointer-events-none transition-all duration-700"
          style={{
            background: "conic-gradient(from 0deg, #00f2fe, #4facfe, #7000ff, #ff007f, #ff9900, #00f2fe)",
            animation: "ai-spin 6s linear infinite, ai-aura-pulse 4s ease-in-out infinite alternate",
          }}
        />

        {/* Rounded border beam frame */}
        <div className="relative p-[1.5px] rounded-[30px] overflow-hidden shadow-[0_30px_70px_-15px_rgba(0,0,0,0.85)] border border-white/5">
          
          {/* Revolving sRGB AI Thinking Conic Beam */}
          <div
            className="absolute -inset-[150%] pointer-events-none"
            style={{
              background: "conic-gradient(from 0deg at 50% 50%, transparent 0%, #00f2fe 15%, #4facfe 30%, #7000ff 50%, #ff007f 70%, #ff9900 85%, transparent 100%)",
              animation: "ai-spin 4s linear infinite",
            }}
          />

          {/* Inner Frosted Glass Card */}
          <div className="relative rounded-[28px] bg-[#090d16]/85 backdrop-blur-3xl px-8 py-10 md:px-12 md:py-12 flex flex-col items-center text-center overflow-hidden">
            
            {/* Specular top highlight */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

            {/* Logo */}
            <div className="mb-6">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt={title}
                  className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                />
              </div>
            </div>

            {/* Dynamic Titles with Soft Animated sRGB Gradient */}
            <div className="min-h-[85px] flex flex-col items-center justify-center">
              {phase === "vi" && (
                <div key="vi" className="animate-fade-in flex flex-col items-center gap-2.5">
                  <span className="text-[12px] font-medium tracking-[0.22em] text-white/55 uppercase">
                    {viSubtitle}
                  </span>
                  <h1 className="studio-title-text text-3xl md:text-4xl lg:text-5xl whitespace-nowrap">
                    {title}
                  </h1>
                </div>
              )}

              {phase === "en" && (
                <div key="en" className="animate-fade-in flex flex-col items-center gap-2.5">
                  <span className="text-[12px] font-medium tracking-[0.22em] text-white/55 uppercase">
                    {enSubtitle}
                  </span>
                  <h1 className="studio-title-text text-3xl md:text-4xl lg:text-5xl whitespace-nowrap">
                    {title}
                  </h1>
                </div>
              )}
            </div>

            {/* Phase Status & Skip Prompt */}
            <div className="mt-8 flex items-center justify-center min-h-[28px]">
              {phase === "vi" && (
                <div className="flex items-center gap-2 text-[11px] tracking-wider text-white/40 uppercase font-medium select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>Đang khởi động hệ sinh thái</span>
                </div>
              )}

              {phase === "en" && (
                <div className="animate-fade-in flex items-center gap-2 text-[11px] tracking-wider text-white/70 hover:text-white uppercase font-medium transition-all">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-r from-cyan-400 to-emerald-400" />
                  </span>
                  <span className="text-emerald-400 font-semibold">Sẵn sàng</span>
                  <span className="text-white/25">·</span>
                  <span className="normal-case text-white/85 flex items-center gap-1.5">
                    <span>Nhấn phím bất kỳ hoặc click để tiếp tục</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/70 animate-pulse" />
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}





