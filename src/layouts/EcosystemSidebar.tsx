import { useAppStore } from "@/core/stores/useAppStore";
import { modules } from "@/registry";
import { SafeLink } from "@/SafeLink";
import { Sparkles, Crown } from "lucide-react";

export function EcosystemSidebar() {
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);

  return (
    <div className="w-[260px] shrink-0 glass-panel rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-lg">
      
      {/* Ecosystem Banner / Info */}
      <div className="p-5 bg-gradient-to-br from-primary/20 to-primary/5 border-b border-white/10 relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 text-primary/10 transition-transform group-hover:scale-110 group-hover:rotate-12 duration-500">
          <Sparkles size={100} />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center p-2 bg-primary/20 rounded-xl mb-3 border border-primary/20 backdrop-blur-md">
            <Crown size={20} className="text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
          </div>
          <h2 className="font-bold text-lg text-foreground tracking-tight">Ecosystem</h2>
          <p className="text-xs text-muted-foreground mt-1 font-medium">MVD Photoshop Academy</p>
        </div>
      </div>

      {/* App List */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1 mt-2 mb-1">
          Ứng dụng của bạn
        </div>
        
        {modules.map((mod) => {
          const isActive = activeModule === mod.id;
          const Icon = mod.icon;
          
          return (
            <SafeLink
              key={mod.id}
              to={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative overflow-hidden group ${
                isActive 
                  ? "bg-primary/15 text-primary shadow-inner border border-primary/20" 
                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary),0.8)]" />
              )}
              
              <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-primary/20' : 'bg-transparent group-hover:bg-accent/60'}`}>
                <Icon size={18} className={isActive ? "drop-shadow-md" : ""} />
              </div>
              
              <span className={`font-medium text-sm transition-all ${isActive ? "font-semibold" : ""}`}>
                {mod.name}
              </span>

              {/* Glowing hover effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full" />
            </SafeLink>
          );
        })}
      </div>
      
      {/* Footer info (optional) */}
      <div className="p-4 border-t border-white/5 bg-black/10">
        <p className="text-[10px] text-center text-muted-foreground/60 font-medium">
          MVD Super App v1.0.0
        </p>
      </div>
    </div>
  );
}
