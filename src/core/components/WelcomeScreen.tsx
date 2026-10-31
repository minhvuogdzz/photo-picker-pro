import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/core/components/BrandLogo";
import { apiRequest } from "@/core/services/apiClient";

interface WelcomeConfig {
  viSubtitle?: string;
  enSubtitle?: string;
  title?: string;
}

function useTypewriter(text: string, speed = 25, delay = 0) {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    setDisplayText("");
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayText(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
        }
      }, speed);
      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, speed, delay]);

  return displayText;
}

export function WelcomeScreen() {
  const [phase, setPhase] = useState<"vi" | "en" | "done">("vi");
  const setHasSeenWelcome = useAppStore((s) => s.setHasSeenWelcome);
  const theme = useSettingsStore((s) => s.settings.theme);

  // Đồng bộ theme Light / Dark chính xác theo app và hệ thống
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
      return true;
    }
    try {
      const saved = localStorage.getItem("mvd_app_theme");
      if (saved === "light") return false;
      if (saved === "dark") return true;
    } catch {}
    if (theme === "system") {
      return typeof window !== "undefined"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : true;
    }
    return theme === "dark";
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      try {
        const saved = localStorage.getItem("mvd_app_theme");
        if (saved === "light") {
          setIsDark(false);
          return;
        }
        if (saved === "dark") {
          setIsDark(true);
          return;
        }
      } catch {}
      if (theme === "system") {
        setIsDark(media.matches);
      } else {
        setIsDark(theme === "dark");
      }
    };
    updateTheme();
    media.addEventListener("change", updateTheme);

    // Lắng nghe class dark trên html
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      media.removeEventListener("change", updateTheme);
      observer.disconnect();
    };
  }, [theme]);

  const [config, setConfig] = useState<WelcomeConfig>(() => {
    try {
      const saved = localStorage.getItem("mvd_welcome_config");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Fetch dynamic welcome screen configuration from backend
  useEffect(() => {
    let isMounted = true;
    apiRequest<{ welcomeScreen?: { title?: string; viSubtitle?: string; enSubtitle?: string } }>("/config/public")
      .then((res) => {
        if (!isMounted || !res?.welcomeScreen) return;
        const ws = res.welcomeScreen;
        const newCfg: WelcomeConfig = {
          title: ws.title || undefined,
          viSubtitle: ws.viSubtitle || undefined,
          enSubtitle: ws.enSubtitle || undefined,
        };
        setConfig(newCfg);
        try {
          localStorage.setItem("mvd_welcome_config", JSON.stringify(newCfg));
        } catch {
          // ignore storage error
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const canSkip = phase === "en";

  const handleSkip = useCallback(() => {
    if (phase !== "en") return;
    setPhase("done");
    setTimeout(() => setHasSeenWelcome(true), 400);
  }, [phase, setHasSeenWelcome]);

  useEffect(() => {
    // VI phase runs first (2.8s)
    const viTimer = setTimeout(() => {
      setPhase("en");
    }, 2800);

    // EN phase runs (3.2s after VI, total 6.0s) then auto-finishes
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
  const title = config.title || "DH Studio Pro";

  const currentSubtitle = phase === "vi" ? viSubtitle : enSubtitle;
  const typedSubtitle = useTypewriter(currentSubtitle, 25, 100);
  const typedTitle = useTypewriter(title, 35, 300);

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-700 select-none overflow-hidden ${
        canSkip ? "cursor-pointer" : "cursor-default"
      } ${
        phase === "done" ? "opacity-0 pointer-events-none backdrop-blur-none" : "opacity-100"
      }`}
    >
      {/* Nền mờ đồng bộ Light / Dark, không có block hộp bọc content */}
      <div
        className={`absolute inset-0 backdrop-blur-2xl transition-colors duration-500 ${
          isDark ? "bg-black/75" : "bg-white/80"
        }`}
      />

      {/* Nội dung trực tiếp ở giữa màn hình (Không có khung block bọc) */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-xl">
        {/* Logo app đứng yên ngay ngắn, có vòng tròn xoay quanh bên ngoài kiểu loading */}
        <div className="relative mb-6 flex items-center justify-center w-28 h-28">
          {/* Vòng tròn xoay loading quanh logo */}
          <svg
            className="w-28 h-28 absolute inset-0 animate-welcome-spinner pointer-events-none"
            viewBox="0 0 100 100"
            fill="none"
          >
            {/* Vòng ray nền mờ */}
            <circle
              cx="50"
              cy="50"
              r="43"
              stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}
              strokeWidth="3.5"
            />
            {/* Cung tròn xoay phát sáng kiểu loading */}
            <circle
              cx="50"
              cy="50"
              r="43"
              stroke="url(#welcomeSpinnerGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="75 200"
            />
            <defs>
              <linearGradient id="welcomeSpinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
          </svg>

          {/* Logo đứng yên chính giữa */}
          <div className="w-16 h-16 flex items-center justify-center relative z-10">
            <BrandLogo
              variant="icon"
              forceTheme={isDark ? "dark" : "light"}
              alt={title}
              className="w-14 h-14 object-contain filter drop-shadow-sm"
            />
          </div>
        </div>

        {/* Chữ Admin custom chạy dạng đánh máy hiện từng chữ */}
        <div className="min-h-[75px] flex flex-col items-center justify-center space-y-1.5">
          <span
            className={`text-xs font-semibold tracking-[0.2em] uppercase transition-colors ${
              isDark ? "text-zinc-400" : "text-zinc-500"
            }`}
          >
            {typedSubtitle}
            {typedSubtitle.length < currentSubtitle.length && (
              <span className="inline-block w-1 h-3 bg-current ml-1 animate-pulse" />
            )}
          </span>

          <h1
            className={`text-3xl md:text-4xl font-extrabold tracking-tight transition-colors ${
              isDark ? "text-white" : "text-zinc-900"
            }`}
          >
            {typedTitle}
            {typedTitle.length < title.length && (
              <span className="inline-block w-1.5 h-6 bg-blue-500 ml-1.5 animate-pulse" />
            )}
          </h1>
        </div>

        {/* Trạng thái phía dưới */}
        <div className="mt-8 flex items-center justify-center min-h-[26px]">
          {phase === "vi" && (
            <div
              className={`flex items-center gap-2 text-xs tracking-wider uppercase font-medium select-none ${
                isDark ? "text-zinc-400" : "text-zinc-500"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Đang khởi động hệ sinh thái...</span>
            </div>
          )}

          {phase === "en" && (
            <div
              className={`animate-fade-in flex items-center gap-2 text-xs tracking-wider uppercase font-medium transition-all ${
                isDark ? "text-zinc-300 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-emerald-500 font-semibold">Sẵn sàng</span>
              <span className="opacity-40">·</span>
              <span className="normal-case flex items-center gap-1.5">
                <span>Nhấn phím bất kỳ hoặc click để tiếp tục</span>
                <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
