import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Bell, X, AlertTriangle } from "lucide-react";
import { BrandLogo } from "@/core/components/BrandLogo";

interface NotificationPayload {
  title: string;
  body: string;
  timestamp: number;
}

export function InAppNotificationBanner() {
  const [currentNotification, setCurrentNotification] = useState<NotificationPayload | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<NotificationPayload>("native-os-notification-fired", (event) => {
      setCurrentNotification(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    if (!currentNotification) return;
    const timer = setTimeout(() => {
      setCurrentNotification(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [currentNotification]);

  if (!currentNotification) return null;

  const isUrgent =
    currentNotification.title.toLowerCase().includes("khẩn cấp") ||
    currentNotification.title.toLowerCase().includes("urgent");

  return (
    <div className="fixed top-4 right-4 z-[999999] max-w-sm w-full animate-slide-down pointer-events-auto">
      <div
        className={`relative flex items-start gap-3 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all ${
          isUrgent
            ? "bg-amber-500/15 border-amber-500/40 text-foreground"
            : "bg-card/90 border-border text-foreground"
        }`}
        style={{
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        }}
      >
        <div className="shrink-0 mt-0.5">
          {isUrgent ? (
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-xs">
              <AlertTriangle size={18} />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shadow-xs">
              <BrandLogo variant="icon" className="w-5 h-5 object-contain" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              DH STUDIO PRO
            </span>
            <span className="text-[10px] text-muted-foreground/60">• Vừa xong</span>
          </div>
          <h4 className="text-xs font-bold text-foreground truncate mt-0.5">
            {currentNotification.title}
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-3">
            {currentNotification.body}
          </p>
        </div>

        <button
          onClick={() => setCurrentNotification(null)}
          className="shrink-0 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
