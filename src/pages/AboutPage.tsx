import { Camera, Heart, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";

export function AboutPage() {
  const [version, setVersion] = useState("1.0.0");

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 animate-fade-in flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain drop-shadow-2xl" />
          <div>
            <h1 className="text-2xl font-bold text-gradient">MVD PHOTOSHOP ACADEMY</h1>
            <p className="text-sm text-muted-foreground mt-1">Version {version}</p>
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

        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          Made with <Heart size={10} className="text-destructive fill-destructive" /> for photographers
        </p>
      </div>
    </div>
  );
}
