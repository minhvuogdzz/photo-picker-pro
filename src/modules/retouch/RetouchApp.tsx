export function RetouchApp() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-card rounded-2xl border border-border/40 shadow-sm glass-panel p-8 text-center h-full">
      <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6 border border-primary/30 relative overflow-hidden group">
        <div className="absolute inset-0 bg-primary/10 animate-pulse" />
        <span className="text-4xl relative z-10 drop-shadow-md">✨</span>
      </div>
      <h2 className="text-2xl font-bold mb-2 tracking-tight text-gradient">Hậu Kỳ (Sắp ra mắt)</h2>
      <p className="text-muted-foreground max-w-md font-medium">
        Công cụ Hậu kỳ thông minh bằng AI đang được đội ngũ phát triển. Vui lòng quay lại sau!
      </p>
    </div>
  );
}
