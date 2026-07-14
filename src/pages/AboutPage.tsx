import { Camera, Heart, Globe, Sparkles } from "lucide-react";

export function AboutPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-lg mx-auto text-center space-y-8 pt-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-xl shadow-primary/20">
            <Sparkles size={36} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gradient">Minh Vuong Devtool</h1>
            <p className="text-sm text-muted-foreground mt-1">Version 1.0.0</p>
          </div>
        </div>

        {/* Description */}
        <div className="panel p-6 text-left space-y-3">
          <p className="text-sm text-foreground/80 leading-relaxed">
            Smart photo filtering application designed for photography studios.
            Quickly filter thousands of photos based on customer code lists.
          </p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <Camera size={12} className="text-primary" />
              Built for Wedding Studios, Event Photographers & Freelancers
            </p>
            <p className="flex items-center gap-2">
              <Sparkles size={12} className="text-primary" />
              100% Offline — No data leaves your machine
            </p>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="panel p-6 text-left">
          <h3 className="text-sm font-medium mb-3">Built with</h3>
          <div className="flex flex-wrap gap-2">
            {["Tauri v2", "React 19", "TypeScript", "Rust", "TailwindCSS"].map(
              (tech) => (
                <span key={tech} className="badge-info">
                  {tech}
                </span>
              )
            )}
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline flex-1 py-2 text-sm justify-center mt-4"
          >
            <Globe size={16} />
            GitHub
          </a>
        </div>

        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          Made with <Heart size={10} className="text-destructive fill-destructive" /> for photographers
        </p>
      </div>
    </div>
  );
}
