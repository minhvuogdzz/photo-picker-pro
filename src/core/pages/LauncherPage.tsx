import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { modules, AppModule } from "@/registry";
import {
  ArrowRight,
  Shield,
  Layers,
  Zap,
  Sliders,
  BookOpen,
  Palette,
  Sparkles,
  Crown,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";

type CategoryFilter = "all" | "workflow" | "retouch";

export function LauncherPage() {
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const setLastClickPos = useAppStore((s) => s.setLastClickPos);
  const session = useAuthStore((s) => s.session);

  const [version, setVersion] = useState("2.0.0");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);

  // Separate pinned resources module from other apps
  const resourceModule = useMemo(() => {
    return modules.find((m) => m.id === "resources");
  }, []);

  const coreModules = useMemo(() => {
    return modules.filter((m) => m.id !== "resources");
  }, []);

  const filteredModules = useMemo(() => {
    if (selectedCategory === "all") return coreModules;
    return coreModules.filter((m) => m.category === selectedCategory);
  }, [coreModules, selectedCategory]);

  const handleLaunch = (modId: string, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setLastClickPos({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setActiveModule(modId);
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-y-auto overflow-x-hidden p-6 md:p-8 animate-fade-in custom-scrollbar text-foreground">
      
      {/* Ecosystem Header */}
      <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary w-fit mb-2.5 shadow-sm backdrop-blur-md">
            <Zap size={13} className="animate-pulse" />
            <span className="text-[10px] font-bold tracking-wider">
              Xin chào, {session?.name || session?.email || "Quý khách"} 👋
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent leading-tight drop-shadow-sm">
            Hệ sinh thái MVD Photoshop Academy
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Nền tảng All-in-one chuyên nghiệp dành cho Photographer & Retoucher. Chọn một công cụ để khởi chạy.
          </p>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-card/85 backdrop-blur-2xl border border-border rounded-2xl shrink-0 shadow-sm">
          {[
            { id: "all", label: "Tất cả công cụ" },
            { id: "workflow", label: "Lọc ảnh & File" },
            { id: "retouch", label: "Retouch & PS" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id as CategoryFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === tab.id
                  ? "bg-primary/15 text-primary shadow-sm border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* PINNED HERO CARD: Kho Tài Nguyên Mini-App */}
      {resourceModule && (
        <div className="w-full max-w-6xl mx-auto mb-6 relative z-10">
          <div
            onClick={(e) => handleLaunch("resources", e)}
            className="group cursor-pointer rounded-3xl p-5 md:p-6 bg-card/85 hover:bg-card backdrop-blur-3xl border border-amber-500/35 hover:border-amber-400 shadow-lg shadow-amber-500/5 hover:shadow-amber-500/15 transition-all duration-300 relative overflow-hidden"
          >
            {/* Ambient Background Aura */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent rounded-full blur-[60px] pointer-events-none group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute -left-10 -bottom-10 w-52 h-52 bg-amber-500/10 rounded-full blur-[50px] pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
              
              {/* Left Content */}
              <div className="flex items-start gap-4 max-w-2xl">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 shrink-0 shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Layers size={24} className="drop-shadow-sm" />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-500 border border-amber-500/40 uppercase tracking-wide flex items-center gap-1">
                      <Crown size={11} className="text-amber-500" /> VIP Premium Vault
                    </span>
                    <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-1">
                      <Sparkles size={11} className="animate-pulse" /> Tuyển chọn độc quyền
                    </span>
                  </div>

                  <h2 className="text-base md:text-lg font-bold text-foreground group-hover:text-amber-500 transition-colors tracking-tight drop-shadow-sm">
                    Kho Tài Nguyên Thiết Kế, Retouch & Photoshop
                  </h2>

                  <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                    Chia sẻ độc quyền cho cộng đồng: Tuyển tập Photoshop Actions tự động, Tone màu Presets/LUTs, Brushes vẽ tóc, Overlays ánh sáng 6K và tài liệu kỹ thuật Retouch chuyên sâu.
                  </p>

                  {/* Resource Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {[
                      { label: "Photoshop Actions D&B", icon: Sparkles },
                      { label: "120+ Presets & LUTs", icon: Sliders },
                      { label: "Brushes Vẽ Tóc & Da", icon: Palette },
                      { label: "Overlays Tia Nắng 6K", icon: Layers },
                      { label: "Giáo Trình Edit Màu", icon: BookOpen },
                    ].map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted/70 border border-border text-foreground group-hover:border-amber-500/40 transition-colors"
                        >
                          <Icon size={10} className="text-amber-500" />
                          {item.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right CTA Button */}
              <div className="flex md:flex-col items-center md:items-end justify-between gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                <button className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-extrabold text-xs shadow-lg shadow-amber-500/25 group-hover:shadow-amber-500/40 transition-all flex items-center gap-1.5 cursor-pointer">
                  Khám phá Kho Tài Nguyên
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Cập nhật liên tục
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CORE APPS GRID */}
      <div className="w-full max-w-6xl mx-auto mb-8 relative z-10">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Zap size={13} className="text-primary" /> Ứng dụng công cụ làm việc
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {filteredModules.length} ứng dụng sẵn sàng
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredModules.map((mod) => {
            const Icon = mod.icon;
            const accent = mod.accentColor;

            return (
              <div
                key={mod.id}
                onClick={(e) => handleLaunch(mod.id, e)}
                className={`group cursor-pointer rounded-3xl p-5 transition-all duration-300 relative overflow-hidden bg-card/80 hover:bg-card backdrop-blur-2xl border border-border hover:border-primary/40 flex flex-col justify-between shadow-sm hover:shadow-xl`}
                style={{ willChange: "transform, box-shadow" }}
              >
                {/* Glow Overlay */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${accent.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                />

                <div className="relative z-10">
                  {/* Card Header: Icon + Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className={`w-11 h-11 bg-gradient-to-br ${accent.iconBg} rounded-2xl flex items-center justify-center shadow-sm border border-border group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon size={22} className={`${accent.primary} drop-shadow-sm`} />
                    </div>

                    {mod.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border group-hover:border-primary/30 group-hover:text-foreground transition-colors">
                        {mod.badge}
                      </span>
                    )}
                  </div>

                  {/* App Title */}
                  <h4 className={`text-sm font-bold text-foreground group-hover:text-primary transition-colors tracking-tight mb-1.5`}>
                    {mod.name}
                  </h4>

                  {/* App Description */}
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-4">
                    {mod.description}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-semibold relative z-10">
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {mod.category === "workflow" ? "Tự động hóa" : "Photoshop Retouch"}
                  </span>
                  
                  <div className={`flex items-center gap-1 ${accent.primary} text-xs font-bold group-hover:translate-x-1 transition-transform`}>
                    <span>Khởi chạy</span>
                    <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER & SYSTEM STATUS */}
      <div className="w-full max-w-6xl mx-auto mt-auto pt-4 border-t border-border relative z-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground py-2">
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-foreground">Server Sync: Online</span>
            </div>
            
            <div className="flex items-center gap-1 text-[11px]">
              <Shield size={12} className="text-primary" />
              <span>MVD Ecosystem v{version}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Bấm <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px] text-foreground">⌘K</kbd> để tìm kiếm nhanh</span>
            <span>•</span>
            <span>© {new Date().getFullYear()} MVD Photoshop Academy</span>
          </div>
        </div>
      </div>

      {/* Ambient background glows for rich depth */}
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-5%] w-[35%] h-[35%] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
    </div>
  );
}
