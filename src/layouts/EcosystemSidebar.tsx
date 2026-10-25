import { useAppStore } from "@/core/stores/useAppStore";
import { modules } from "@/registry";
import { SafeLink } from "@/SafeLink";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function EcosystemSidebar() {
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const isCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setIsCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  return (
    <div 
      className={`${isCollapsed ? 'w-[56px]' : 'w-[200px]'} shrink-0 bg-card rounded-xl border border-border flex flex-col overflow-hidden transition-all duration-250 ease-in-out relative text-foreground`}
    >
      {/* Toggle Button */}
      <button 
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute top-3 z-50 w-6 h-6 bg-muted hover:bg-accent text-muted-foreground hover:text-foreground rounded-md flex items-center justify-center transition-colors duration-150 border border-border cursor-pointer ${
          isCollapsed ? 'right-[15px]' : 'right-2.5'
        }`}
        title={isCollapsed ? "Mở rộng" : "Thu gọn"}
        aria-label={isCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? <ChevronRight size={13} aria-hidden="true" /> : <ChevronLeft size={13} aria-hidden="true" />}
      </button>

      {/* FIXED WIDTH INNER WRAPPER */}
      <nav aria-label="Ứng dụng" className="w-[200px] flex flex-col h-full shrink-0">
        
        {/* Sidebar Header — flat, subtle */}
        <div className="py-3 pl-3 pr-2.5 border-b border-border flex items-center shrink-0 h-[52px]">
          <div className={`flex flex-col relative z-10 transition-opacity duration-150 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-75'}`}>
            <h2 className="font-semibold text-[11px] leading-tight text-foreground tracking-wider uppercase">Workspace</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium truncate max-w-[150px]">DH Studio Pro</p>
          </div>
        </div>

        {/* App List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 flex flex-col gap-0.5 custom-scrollbar">
          <div className={`text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-2 py-1 mt-0.5 whitespace-nowrap transition-opacity duration-150 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-75'}`}>
            Ứng dụng
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
                aria-current={isActive ? "page" : undefined}
                aria-label={isCollapsed ? mod.name : undefined}
                className={`group flex items-center pl-2.5 pr-2 py-2 gap-2 rounded-lg transition-colors duration-150 relative overflow-hidden shrink-0 ${
                  isActive 
                    ? "bg-primary/10 text-foreground" 
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
                title={isCollapsed ? mod.name : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-[2.5px] bg-primary rounded-r-full" />
                )}
                
                <div className={`shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-md transition-colors ${
                  isActive 
                    ? `${mod.accentColor.primary} bg-card border border-border/80 shadow-xs` 
                    : `${mod.accentColor.primary} opacity-80 group-hover:opacity-100 bg-card/40`
                }`}>
                  <Icon size={14} />
                </div>
                
                <div className={`flex flex-col min-w-0 transition-opacity duration-150 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-75'}`}>
                  <span className={`text-xs whitespace-nowrap leading-none ${isActive ? "font-semibold text-foreground" : "font-medium"}`}>
                    {mod.shortName || mod.name}
                  </span>
                </div>
              </SafeLink>
            );
          })}
        </div>
        
        {/* Footer */}
        <div className="p-2 border-t border-border shrink-0">
          <p className={`text-[10px] text-center text-muted-foreground font-medium whitespace-nowrap transition-opacity duration-150 ${isCollapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-75'}`}>
            DevHouse Software
          </p>
        </div>

      </nav>
    </div>
  );
}
