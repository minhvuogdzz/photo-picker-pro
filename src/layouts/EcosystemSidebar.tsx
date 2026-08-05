import { useAppStore } from "@/core/stores/useAppStore";
import { modules } from "@/registry";
import { SafeLink } from "@/SafeLink";
import { Sparkles, Crown, ChevronLeft, ChevronRight } from "lucide-react";

export function EcosystemSidebar() {
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const isCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setIsCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  return (
    <div 
      className={`${isCollapsed ? 'w-[80px]' : 'w-[260px]'} shrink-0 glass-panel rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-lg transition-all duration-300 ease-in-out relative`}
    >
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute top-5 z-50 w-7 h-7 bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 ease-in-out border border-white/10 shadow-sm ${
          isCollapsed ? 'right-[26px]' : 'right-4'
        }`}
        title={isCollapsed ? "Mở rộng" : "Thu gọn"}
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* FIXED WIDTH INNER WRAPPER: PREVENTS LAYOUT REFLOWS/JUMPS */}
      <div className="w-[260px] flex flex-col h-full shrink-0">
        
        {/* Ecosystem Banner / Info */}
        <div className="pt-5 pb-5 pl-[20px] pr-4 bg-gradient-to-br from-primary/20 to-primary/5 border-b border-white/10 relative overflow-hidden group flex items-center shrink-0 h-[80px]">
          <div className="absolute right-0 top-0 text-primary/10 transition-transform group-hover:scale-110 group-hover:rotate-12 duration-500 pointer-events-none">
            <Sparkles size={80} />
          </div>
          
          <div className={`flex flex-col relative z-10 transition-opacity duration-200 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-100'}`}>
            <h2 className="font-bold text-[16px] leading-tight text-foreground tracking-tight whitespace-nowrap">Ecosystem</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium whitespace-nowrap">MVD Academy</p>
          </div>
        </div>

        {/* App List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-2">
          <div className={`text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-3 py-1 mt-1 mb-1 whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-100'}`}>
            Ứng dụng của bạn
          </div>
          
          {modules.map((mod) => {
            const isActive = activeModule === mod.id;
            const Icon = mod.icon;
            
            return (
              <SafeLink
                key={mod.id}
                to={mod.id}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  useAppStore.getState().setLastClickPos({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                  });
                  setActiveModule(mod.id);
                }}
                className={`flex items-center pl-[16px] pr-4 py-3 gap-3 rounded-xl transition-all duration-300 relative overflow-hidden group shrink-0 ${
                  isActive 
                    ? "bg-primary/15 text-primary shadow-inner border border-primary/20" 
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground border border-transparent"
                }`}
                title={isCollapsed ? mod.name : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary),0.8)]" />
                )}
                
                <div className={`shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-primary/20' : 'bg-transparent group-hover:bg-accent/60'}`}>
                  <Icon size={18} className={isActive ? "drop-shadow-md" : ""} />
                </div>
                
                <span className={`font-medium text-sm whitespace-nowrap transition-opacity duration-200 ${isActive ? "font-semibold" : ""} ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-100'}`}>
                  {mod.name}
                </span>

                {/* Glowing hover effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full" />
              </SafeLink>
            );
          })}
        </div>
        
        {/* Footer info (optional) */}
        <div className="p-4 border-t border-white/5 bg-black/10 shrink-0">
          <p className={`text-[10px] text-center text-muted-foreground/60 font-medium whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-100'}`}>
            MVD Super App v1.0.0
          </p>
        </div>

      </div>
    </div>
  );
}
