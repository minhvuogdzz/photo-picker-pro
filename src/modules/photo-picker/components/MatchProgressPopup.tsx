import { useAppStore } from "@/core/stores/useAppStore";
import { Loader2 } from "lucide-react";

export function MatchProgressPopup() {
  const phase = useAppStore((s) => s.phase);
  const progress = useAppStore((s) => s.progress);

  if (phase !== "copying") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-80 rounded-2xl p-6 shadow-2xl border border-border/50 animate-scale-up flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">
              {progress?.message || "Đang xử lý file..."}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vui lòng chờ trong giây lát
            </p>
          </div>
        </div>

        <div className="space-y-1.5 mt-2">
          <div className="flex justify-between text-xs">
            <span className="font-medium text-primary">
              {progress ? progress.percentage.toFixed(0) : 0}%
            </span>
            <span className="text-muted-foreground font-mono">
              {progress ? `${progress.current.toLocaleString()}/${progress.total.toLocaleString()}` : ""}
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-info transition-all duration-200 ease-out"
              style={{ width: `${progress ? Math.min(progress.percentage, 100) : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
