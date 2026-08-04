import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/core/stores/useAppStore";
import { Clock, Trash2, FolderInput, FolderOutput } from "lucide-react";
import type { HistoryEntry } from "@/core/types";
import { getFolderName } from "@/core/lib/utils";

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const addInputFolder = useAppStore((s) => s.addInputFolder);
  const setOutputFolder = useAppStore((s) => s.setOutputFolder);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await invoke<HistoryEntry[]>("load_history");
        setHistory(data);
      } catch (error) {
        console.error("Failed to load history:", error);
      }
    };
    loadHistory();
  }, []);

  const handleClearHistory = async () => {
    try {
      await invoke("clear_history");
      setHistory([]);
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const handleRestoreSession = (entry: HistoryEntry) => {
    for (const folder of entry.input_folders) {
      addInputFolder(folder);
    }
    if (entry.output_folder) {
      setOutputFolder(entry.output_folder);
    }
    setActiveTab("home");
  };

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in flex items-center justify-center">
      <div className="max-w-3xl w-full space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock size={18} />
            History
          </h2>
          {history.length > 0 && (
            <button onClick={handleClearHistory} className="btn-ghost text-xs text-destructive">
              <Trash2 size={12} />
              Clear All
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="panel p-12 text-center text-muted-foreground">
            <Clock size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No history yet</p>
            <p className="text-xs mt-1 opacity-60">
              Your recent operations will appear here
            </p>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className="panel p-4 space-y-3 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => handleRestoreSession(entry)}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
                <span className="badge-info text-xs">{entry.operation}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FolderInput size={10} /> Input
                  </span>
                  {entry.input_folders.map((f, i) => (
                    <p key={i} className="text-xs truncate">{getFolderName(f)}</p>
                  ))}
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <FolderOutput size={10} /> Output
                  </span>
                  <p className="text-xs truncate">{entry.output_folder ? getFolderName(entry.output_folder) : "N/A"}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
