import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTranslation } from "@/lib/i18n";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import {
  FolderPlus,
  Trash2,
  Star,
  StarOff,
  Folder,
  FolderOpen,
} from "lucide-react";
import { getFolderName } from "@/lib/utils";

export function LeftPanel() {
  const inputFolders = useAppStore((s) => s.inputFolders);
  const selectedInputFolders = useAppStore((s) => s.selectedInputFolders);
  const addInputFolder = useAppStore((s) => s.addInputFolder);
  const phase = useAppStore((s) => s.phase);
  const favoriteFolders = useSettingsStore((s) => s.settings.favorite_folders);
  const addFavoriteFolder = useSettingsStore((s) => s.addFavoriteFolder);
  const removeFavoriteFolder = useSettingsStore((s) => s.removeFavoriteFolder);
  const { t } = useTranslation();
  
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let unlistenFileDrop: () => void;
    let unlistenDragDrop: () => void;
    let unlistenHover: () => void;
    let unlistenCancel: () => void;
    
    const handleDropPaths = (paths: string[]) => {
      setIsDragging(false);
      if (paths && paths.length > 0) {
        for (const path of paths) {
          if (path) addInputFolder(path);
        }
      }
    };

    const handleDropPayload = (event: any) => {
      setIsDragging(false);
      const payload = event.payload;
      
      let paths: string[] = [];
      if (Array.isArray(payload)) {
        paths = payload;
      } else if (payload && Array.isArray(payload.paths)) {
        paths = payload.paths;
      } else if (payload && payload.type === 'drop' && Array.isArray(payload.paths)) {
        paths = payload.paths; // Tauri v2 onDragDropEvent
      }
      
      handleDropPaths(paths);
    };

    const setupDragDrop = async () => {
      try {
        // Try the modern Tauri v2 window API if available
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          unlistenDragDrop = await getCurrentWindow().onDragDropEvent((event) => {
            if (event.payload.type === 'over') {
              setIsDragging(true);
            } else if (event.payload.type === 'drop') {
              handleDropPaths(event.payload.paths as string[]);
            } else {
              setIsDragging(false);
            }
          });
        } catch (e) {
          console.warn("Tauri v2 window API not available, falling back to events");
          // Fallback to global events
          unlistenFileDrop = await listen<any>("tauri://file-drop", handleDropPayload);
          unlistenHover = await listen("tauri://file-drop-hover", () => setIsDragging(true));
          unlistenCancel = await listen("tauri://file-drop-cancelled", () => setIsDragging(false));
          await listen("tauri://drag-enter", () => setIsDragging(true));
          await listen("tauri://drag-leave", () => setIsDragging(false));
        }
      } catch (err) {
        console.error("Failed to setup drag and drop", err);
      }
    };
    
    setupDragDrop();
    
    return () => {
      if (unlistenFileDrop) unlistenFileDrop();
      if (unlistenDragDrop) unlistenDragDrop();
      if (unlistenHover) unlistenHover();
      if (unlistenCancel) unlistenCancel();
    };
  }, [addInputFolder]);

  const handleAddFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select Input Folders",
      });

      if (selected) {
        const folders = Array.isArray(selected) ? selected : [selected];
        for (const folder of folders) {
          if (folder) addInputFolder(folder);
        }
      }
    } catch (error) {
      console.error("Failed to open folder dialog:", error);
    }
  };

  const isFavorite = (folder: string) => favoriteFolders.includes(folder);

  const toggleFavorite = (folder: string) => {
    if (isFavorite(folder)) {
      removeFavoriteFolder(folder);
    } else {
      addFavoriteFolder(folder);
    }
  };

  return (
    <div className="panel w-72 flex flex-col min-h-0 animate-fade-in relative">
      <div className="panel-header">
        <span className="panel-title flex items-center gap-2">
          <FolderOpen size={16} className="text-primary" />
          {t("input_folders")}
        </span>
        <span className="badge badge-info">
          {inputFolders.length}
        </span>
      </div>

      <div
        className={`flex-1 overflow-y-auto panel-body space-y-2 transition-all ${
          isDragging ? "bg-primary/5 ring-2 ring-primary ring-inset rounded-lg m-2" : ""
        }`}
      >
        {inputFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-border rounded-xl">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <FolderPlus size={24} className="text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">{t("no_folders_added")}</p>
            <p className="text-xs mt-2 text-muted-foreground">
              {t("click_add_folder")}
            </p>
          </div>
        ) : (
          inputFolders.map((folder, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-md border bg-card border-primary/30 shadow-sm"
              >
                <FolderOpen size={16} className="text-primary flex-shrink-0" />
                <div
                  className="flex-1 truncate text-xs font-medium"
                  title={folder}
                  dir="rtl"
                >
                  &lrm;{getFolderName(folder)}
                </div>
              </div>
          ))
        )}

        {/* Favorite folders section */}
        {favoriteFolders.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Star size={12} className="text-warning" />
                {t("favorites")}
              </span>
            </div>
            <div className="space-y-2">
              {favoriteFolders
                .filter((f) => !inputFolders.includes(f))
                .map((folder) => (
                  <button
                    key={folder}
                    onClick={() => addInputFolder(folder)}
                    className="folder-item w-full text-left opacity-70 hover:opacity-100 cursor-pointer border border-transparent hover:border-border rounded-lg p-2 flex items-center gap-2 transition-all"
                    title={`Click to add: ${folder}`}
                  >
                    <Star size={14} className="text-warning fill-warning shrink-0" />
                    <span className="flex-1 text-sm truncate">
                      {getFolderName(folder)}
                    </span>
                  </button>
                ))}
            </div>
          </>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <button
          onClick={handleAddFolder}
          className="btn-outline w-full text-sm py-2.5 font-medium"
        >
          <FolderPlus size={16} />
          {t("add_folder")}
        </button>
      </div>
    </div>
  );
}
