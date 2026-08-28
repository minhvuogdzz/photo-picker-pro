import { useAppStore } from "@/core/stores/useAppStore";
import { modules } from "@/registry";
import { SafeLink } from "@/SafeLink";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

export function EcosystemSidebar() {
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const isCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setIsCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  return (
    <div 
      className={`${isCollapsed ? 'w-[72px]' : 'w-[230px]'} shrink-0 bg-card/85 backdrop-blur-2xl rounded-2xl border border-border flex flex-col overflow-hidden shadow-lg transition-all duration-300 ease-in-out relative text-foreground`}
    >
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute top-4 z-50 w-6 h-6 bg-muted/80 hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground rounded-full flex items-center justify-center transition-all duration-200 border border-border shadow-sm cursor-pointer ${
          isCollapsed ? 'right-[23px]' : 'right-3'
        }`}
        title={isCollapsed ? "Mở rộng" : "Thu gọn"}
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* FIXED WIDTH INNER WRAPPER */}
      <div className="w-[230px] flex flex-col h-full shrink-0">
        
        {/* Ecosystem Banner / Info */}
        <div className="py-4 pl-4 pr-3 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-b border-border relative overflow-hidden group flex items-center shrink-0 h-[68px]">
          <div className="absolute right-0 top-0 text-primary/10 transition-transform group-hover:scale-110 group-hover:rotate-12 duration-500 pointer-events-none">
            <Sparkles size={60} />
          </div>
          
          <div className={`flex flex-col relative z-10 transition-opacity duration-200 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-100'}`}>
            <h2 className="font-extrabold text-xs leading-tight text-foreground tracking-wider uppercase">Ecosystem</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">MVD Photoshop Academy</p>
          </div>
        </div>

        {/* App List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-1.5 custom-scrollbar">
          <div className={`text-[9px] font-bold text-muted-foreground uppercase tracking-widest pl-2.5 py-1 mt-0.5 whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-100'}`}>
            Không gian làm việc
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
                className={`flex items-center pl-3 pr-3 py-2.5 gap-2.5 rounded-xl transition-all duration-200 relative overflow-hidden group shrink-0 ${
                  isActive 
                    ? "bg-primary/15 text-primary shadow-sm border border-primary/30" 
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                }`}
                title={isCollapsed ? mod.name : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r-full shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                )}
                
                <div className={`shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'bg-transparent group-hover:bg-muted'}`}>
                  <Icon size={15} className={isActive ? "drop-shadow-sm" : ""} />
                </div>
                
                <div className={`flex flex-col min-w-0 transition-opacity duration-200 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-100'}`}>
                  <span className={`text-xs whitespace-nowrap leading-none ${isActive ? "font-bold text-foreground" : "font-semibold"}`}>
                    {mod.shortName || mod.name}
                  </span>
                  {mod.badge && (
                    <span className="text-[8px] font-bold text-muted-foreground/80 mt-1 uppercase tracking-wider">
                      {mod.badge}
                    </span>
                  )}
                </div>

                {/* Glowing hover effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:translate-x-full" />
              </SafeLink>
            );
          })}
        </div>
        
        {/* Footer info */}
        <div className="p-3 border-t border-border bg-muted/20 shrink-0">
          <p className={`text-[9px] text-center text-muted-foreground/70 font-medium whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-100'}`}>
            MVD Pro v1.0.0
          </p>
        </div>

      </div>
    </div>
  );
}
