import { useEffect, useState } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { useTranslation } from "@/core/lib/i18n";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import {
  FolderPlus,
  Trash2,
  Star,
  StarOff,
  Folder,
  FolderOpen,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { getFolderName } from "@/core/lib/utils";

export function LeftPanel() {
  const inputFolders = useAppStore((s) => s.inputFolders);
  const selectedInputFolders = useAppStore((s) => s.selectedInputFolders);
  const addInputFolder = useAppStore((s) => s.addInputFolder);
  const addSyncFolders = useAppStore((s) => s.addSyncFolders);
  const setActiveDropZone = useAppStore((s) => s.setActiveDropZone);
  const phase = useAppStore((s) => s.phase);
  const matchResult = useAppStore((s) => s.matchResult);
  const favoriteFolders = useSettingsStore((s) => s.settings.favorite_folders);
  const addFavoriteFolder = useSettingsStore((s) => s.addFavoriteFolder);
  const removeFavoriteFolder = useSettingsStore((s) => s.removeFavoriteFolder);
  const { t } = useTranslation();

  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

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

  if (isCollapsed) {
    return (
      <div className="w-14 flex flex-col items-center py-5 bg-card/60 backdrop-blur-xl border border-border/40 shadow-lg rounded-2xl transition-all duration-300">
        <button 
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-primary/10 text-primary rounded-xl transition-all mb-6 cursor-pointer hover:scale-110"
          title="Mở bảng điều khiển"
        >
          <Menu size={20} />
        </button>
        
        <div className="flex flex-col gap-6 w-full items-center">
          <div className="relative group cursor-pointer" onClick={() => setIsCollapsed(false)} title={t("input_folders")}>
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl group-hover:bg-primary/20 transition-all">
              <FolderOpen size={18} />
            </div>
            {inputFolders.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 bg-primary text-[9px] font-bold text-primary-foreground rounded-full flex items-center justify-center shadow-sm">
                {inputFolders.length}
              </span>
            )}
          </div>
          
          <div className="w-6 h-px bg-border/50"></div>
          
          <div className="relative group cursor-pointer" onClick={() => setIsCollapsed(false)} title="Đã tìm thấy">
            <div className="p-2.5 bg-success/10 text-success rounded-xl group-hover:bg-success/20 transition-all">
              <CheckCircle size={18} />
            </div>
            {matchResult && matchResult.found_count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 bg-success text-[9px] font-bold text-success-foreground rounded-full flex items-center justify-center shadow-sm">
                {matchResult.found_count}
              </span>
            )}
          </div>

          <div className="relative group cursor-pointer" onClick={() => setIsCollapsed(false)} title="Các file lỗi">
            <div className="p-2.5 bg-destructive/10 text-destructive rounded-xl group-hover:bg-destructive/20 transition-all">
              <AlertTriangle size={18} />
            </div>
            {matchResult && (matchResult.missing_count > 0 || matchResult.duplicate_count > 0) && (
              <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 bg-destructive text-[9px] font-bold text-destructive-foreground rounded-full flex items-center justify-center shadow-sm">
                {matchResult.missing_count + matchResult.duplicate_count}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[320px] shrink-0 flex flex-col min-h-0 animate-fade-in gap-4 relative transition-all duration-300">
      <button 
        onClick={() => setIsCollapsed(true)}
        className="absolute -right-4 top-4 z-10 p-1.5 bg-card border border-border shadow-md rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer hover:scale-110"
        title="Thu gọn"
      >
        <ChevronLeft size={16} />
      </button>

      {/* SECTION 1: Input Folders */}
      <div className="flex flex-col flex-shrink-0 max-h-[40%] bg-card/80 backdrop-blur-md border border-border/40 shadow-lg rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/30">
        <div className="py-3 px-4 pr-10 flex justify-between items-center bg-muted/30 border-b border-border/30">
          <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-foreground uppercase">
            <FolderOpen size={14} className="text-primary" />
            {t("input_folders")}
            <span className="bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px] ml-1 shadow-sm">{inputFolders.length}</span>
          </span>
          <button 
            onClick={handleAddFolder} 
            className="text-primary/70 hover:text-primary hover:bg-primary/10 transition-all p-1.5 rounded-lg cursor-pointer" 
            title={t("add_folder")}
          >
            <FolderPlus size={16} />
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setActiveDropZone("input");
          }}
          onDragLeave={() => setActiveDropZone(null)}
          className={`flex-1 overflow-y-auto p-3 space-y-2 transition-all ${
            isDragging ? "bg-primary/5 ring-2 ring-primary/50 ring-inset" : ""
          }`}
          style={{
            scrollbarWidth: 'thin',
          }}
        >
          {inputFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center border-2 border-dashed border-border/50 rounded-xl bg-muted/10 transition-colors hover:border-primary/40 hover:bg-primary/5">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 shadow-inner">
                <FolderPlus size={20} className="text-primary" />
              </div>
              <p className="text-xs font-semibold text-foreground/80">{t("no_folders_added")}</p>
              <p className="text-[10px] mt-1.5 text-muted-foreground max-w-[180px] leading-relaxed">
                Bấm nút thêm ở góc trên hoặc kéo thả thư mục vào đây
              </p>
            </div>
          ) : (
            inputFolders.map((folder, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border bg-background/50 border-border/50 shadow-sm hover:border-primary/40 transition-colors group"
              >
                <div className="p-1.5 rounded-md bg-primary/10 text-primary shadow-inner">
                  <FolderOpen size={14} className="group-hover:scale-110 transition-transform" />
                </div>
                <div
                  className="flex-1 truncate text-xs font-medium text-foreground/90"
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
              <div className="pt-3 pb-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Star size={10} className="text-warning" />
                  {t("favorites")}
                </span>
              </div>
              <div className="space-y-1.5">
                {favoriteFolders
                  .filter((f) => !inputFolders.includes(f))
                  .map((folder) => (
                    <button
                      key={folder}
                      onClick={() => addInputFolder(folder)}
                      className="w-full text-left opacity-70 hover:opacity-100 cursor-pointer border border-transparent hover:border-warning/30 hover:bg-warning/5 rounded-xl p-2 flex items-center gap-2.5 transition-all group"
                      title={`Click to add: ${folder}`}
                    >
                      <Star size={14} className="text-warning fill-warning/20 group-hover:fill-warning shrink-0 transition-colors" />
                      <span className="flex-1 text-xs truncate font-medium">
                        {getFolderName(folder)}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* SECTION 2: Found Files */}
      <div className="flex flex-col flex-1 min-h-[160px] bg-gradient-to-br from-success/5 via-success/10 to-success/5 border border-success/20 shadow-lg rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-success/10 hover:border-success/40">
        <div className="py-3 px-4 flex justify-between items-center border-b border-success/20 bg-success/10 backdrop-blur-md">
          <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-success uppercase">
            <CheckCircle size={14} className="drop-shadow-sm" />
            Đã tìm thấy
            <span className="bg-success text-success-foreground px-2 py-0.5 rounded-full text-[10px] ml-1 shadow-sm font-bold">
              {matchResult?.found_count ?? 0}
            </span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
          {(!matchResult || matchResult.found_count === 0) ? (
            <div className="flex h-full items-center justify-center text-xs text-success/40 font-medium">
              Chưa có file nào
            </div>
          ) : (
            matchResult.matches.filter(m => m.status === "Found").map((match, idx) => (
              <div key={idx} className="flex flex-col gap-1 p-2.5 rounded-xl border border-success/30 bg-background/60 shadow-sm hover:bg-success/5 transition-colors">
                <span className="font-mono text-[11px] text-success font-bold tracking-wide">{match.code}</span>
                <span className="text-[10px] text-foreground/70 truncate" title={match.photo?.filename}>
                  {match.photo?.filename}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 3: Error Files */}
      <div className="flex flex-col flex-1 min-h-[160px] bg-gradient-to-br from-destructive/5 via-destructive/10 to-destructive/5 border border-destructive/20 shadow-lg rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-destructive/10 hover:border-destructive/40">
        <div className="py-3 px-4 flex justify-between items-center border-b border-destructive/20 bg-destructive/10 backdrop-blur-md">
          <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-destructive uppercase">
            <AlertTriangle size={14} className="drop-shadow-sm" />
            Các file lỗi
            <span className="bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full text-[10px] ml-1 shadow-sm font-bold">
              {(matchResult?.missing_count ?? 0) + (matchResult?.duplicate_count ?? 0)}
            </span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
          {(!matchResult || (matchResult.missing_count === 0 && matchResult.duplicate_count === 0)) ? (
            <div className="flex h-full items-center justify-center text-xs text-destructive/40 font-medium">
              Không có lỗi
            </div>
          ) : (
            matchResult.matches.filter(m => m.status === "Missing" || m.status === "Duplicate" || m.status === "InputDuplicate").map((match, idx) => (
              <div key={idx} className={`flex flex-col gap-1 p-2.5 rounded-xl border bg-background/60 shadow-sm transition-colors ${match.status === "Missing" ? "border-destructive/30 hover:bg-destructive/5" : "border-warning/30 hover:bg-warning/5"}`}>
                <div className="flex justify-between items-center">
                  <span className={`font-mono text-[11px] font-bold tracking-wide ${match.status === "Missing" ? "text-destructive" : "text-warning"}`}>
                    {match.code}
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm ${match.status === "Missing" ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>
                    {match.status === "Missing" ? "Thiếu" : (match.status === "InputDuplicate" ? "Trùng mã nhập" : `Trùng (${match.all_matches.length})`)}
                  </span>
                </div>
                {match.status === "Duplicate" && match.photo && (
                  <span className="text-[10px] text-foreground/70 truncate mt-0.5" title={match.photo.filename}>
                    {match.photo.filename}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
