import { useAppStore } from "@/core/stores/useAppStore";
import { modules } from "@/registry";
import { LayoutGrid, ArrowRight, Zap, Cloud, Shield } from "lucide-react";

export function LauncherPage() {
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const setLastClickPos = useAppStore((s) => s.setLastClickPos);

  const getCardStyle = (id: string) => {
    switch (id) {
      case 'photo-picker':
        return {
          bgGlow: 'from-blue-500/20 via-blue-400/5 to-transparent',
          iconBg: 'from-blue-500/20 to-cyan-500/5 border-blue-500/30',
          iconColor: 'text-blue-400',
          hoverText: 'group-hover:text-blue-400',
          hoverBorder: 'hover:border-blue-400/50 hover:shadow-[0_0_25px_rgba(59,130,246,0.4)]',
        };
      case 'retouch':
        return {
          bgGlow: 'from-purple-500/20 via-purple-400/5 to-transparent',
          iconBg: 'from-purple-500/20 to-fuchsia-500/5 border-purple-500/30',
          iconColor: 'text-purple-400',
          hoverText: 'group-hover:text-purple-400',
          hoverBorder: 'hover:border-purple-400/50 hover:shadow-[0_0_25px_rgba(168,85,247,0.4)]',
        };
      case 'client-gallery':
        return {
          bgGlow: 'from-orange-500/20 via-orange-400/5 to-transparent',
          iconBg: 'from-orange-500/20 to-amber-500/5 border-orange-500/30',
          iconColor: 'text-orange-400',
          hoverText: 'group-hover:text-orange-400',
          hoverBorder: 'hover:border-orange-400/50 hover:shadow-[0_0_25px_rgba(249,115,22,0.4)]',
        };
      default:
        return {
          bgGlow: 'from-primary/20 via-primary/5 to-transparent',
          iconBg: 'from-primary/20 to-primary/5 border-primary/30',
          iconColor: 'text-primary',
          hoverText: 'group-hover:text-primary',
          hoverBorder: 'hover:border-primary/50 hover:shadow-[0_0_25px_rgba(var(--primary),0.4)]',
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-y-auto overflow-x-hidden p-8 animate-fade-in">
      
      {/* Ecosystem Header */}
      <div className="w-full max-w-6xl mx-auto flex flex-col mb-12 relative z-10 mt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary w-fit mb-6 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
          <Zap size={14} className="animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest">MVD Super App</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-4 tahoe-glass-text leading-tight drop-shadow-2xl">
          Hệ sinh thái <br />
          MVD Photoshop Academy
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Nền tảng All-in-one chuyên nghiệp dành cho Photographer. Chọn một ứng dụng bên dưới để bắt đầu công việc của bạn.
        </p>
      </div>

      {/* App Grid */}
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 relative z-10">
        {modules.map((mod, index) => {
          const Icon = mod.icon;
          const styles = getCardStyle(mod.id);
          
          return (
            <div
              key={mod.id}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setLastClickPos({ 
                  x: rect.left + rect.width / 2, 
                  y: rect.top + rect.height / 2 
                });
                setActiveModule(mod.id);
              }}
              className={`group cursor-pointer rounded-3xl p-6 transition-all duration-300 ease-out relative overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/10 hover:bg-white/10 ${styles.hoverBorder}`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Glow effect on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${styles.bgGlow} opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out`} />
              
              <div className={`w-12 h-12 bg-gradient-to-br ${styles.iconBg} rounded-2xl flex items-center justify-center mb-5 shadow-sm border group-hover:scale-110 transition-transform duration-300 ease-out`}>
                <Icon size={24} className={`${styles.iconColor} drop-shadow-md`} />
              </div>
              
              <h3 className={`text-lg font-bold mb-2 text-white/90 ${styles.hoverText} transition-colors`}>{mod.name}</h3>
              <p className="text-xs text-white/60 mb-6 line-clamp-3 leading-relaxed">
                {mod.id === "photo-picker" && "Phần mềm lọc ảnh tự động, đồng nhất tên các thư mục và kết nối với Sheet."}
                {mod.id === "retouch" && "Hệ thống AI xử lý hậu kỳ, blend màu, nhặt mụn tự động (Coming soon)."}
                {mod.id === "client-gallery" && "Gửi ảnh cho khách hàng chọn lọc nhanh chóng (Coming soon)."}
              </p>
              
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${styles.iconColor} opacity-70 group-hover:opacity-100 transition-opacity duration-300 ease-out`}>
                Khởi chạy <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300 ease-out" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Ecosystem Stats/Info Footer */}
      <div className="w-full max-w-6xl mx-auto mt-auto pt-16 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 border-t border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground">
              <Cloud size={18} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Trạng thái server</p>
              <p className="text-sm font-semibold text-green-500">Online & Đồng bộ</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground">
              <Shield size={18} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phiên bản</p>
              <p className="text-sm font-semibold">1.3.4 (Cập nhật mới nhất)</p>
            </div>
          </div>
        </div>

        {/* Copyright Section */}
        <div className="mt-12 text-center text-white/40 text-xs font-medium tracking-wide">
          <p>© {new Date().getFullYear()} MVD Photoshop Academy All rights reserved.</p>
          <p className="mt-1 opacity-70">Nếu thấy hay hãy mua bản quyền ủng hộ tác giả nhé.</p>
        </div>
      </div>
      
      {/* Ambient Background Effects */}
      <div className="fixed top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
    </div>
  );
}
