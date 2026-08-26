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
  Copy,
  XCircle,
  Clipboard,
  ClipboardCheck,
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
  const [copiedDuplicates, setCopiedDuplicates] = useState(false);
  const [copiedMissing, setCopiedMissing] = useState(false);

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

  // Collect duplicate and missing codes for the error section
  const duplicateCodes = matchResult
    ? matchResult.matches
        .filter((m) => m.status === "InputDuplicate")
        .map((m) => m.code)
    : [];

  const missingCodes = matchResult
    ? matchResult.matches
        .filter((m) => m.status === "Missing")
        .map((m) => m.code)
    : [];

  const fileDuplicates = matchResult
    ? matchResult.matches.filter((m) => m.status === "Duplicate")
    : [];

  const handleCopyDuplicateCodes = async () => {
    if (duplicateCodes.length === 0) return;
    const text = `Trùng mã: ${duplicateCodes.join(", ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDuplicates(true);
      setTimeout(() => setCopiedDuplicates(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyMissingCodes = async () => {
    if (missingCodes.length === 0) return;
    const text = `Thiếu mã: ${missingCodes.join(", ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMissing(true);
      setTimeout(() => setCopiedMissing(false), 2000);
    } catch {
      // fallback
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 flex flex-col items-center py-4 bg-card/60 backdrop-blur-md border border-border/30 shadow-sm rounded-xl transition-all duration-300">
        <button 
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all mb-4 cursor-pointer"
          title="Mở bảng điều khiển"
        >
          <Menu size={16} />
        </button>
        
        <div className="flex flex-col gap-4 w-full items-center">
          <div className="relative group cursor-pointer" onClick={() => setIsCollapsed(false)} title={t("input_folders")}>
            <div className="p-2 text-muted-foreground group-hover:text-foreground rounded-lg transition-all">
              <FolderOpen size={16} />
            </div>
            {inputFolders.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 bg-foreground/80 text-[8px] font-semibold text-background rounded-full flex items-center justify-center">
                {inputFolders.length}
              </span>
            )}
          </div>
          
          <div className="w-5 h-px bg-border/40"></div>
          
          <div className="relative group cursor-pointer" onClick={() => setIsCollapsed(false)} title="Đã tìm thấy">
            <div className="p-2 text-emerald-600/60 dark:text-emerald-400/60 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 rounded-lg transition-all">
              <CheckCircle size={16} />
            </div>
            {matchResult && matchResult.found_count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 bg-emerald-600 dark:bg-emerald-500 text-[8px] font-semibold text-white rounded-full flex items-center justify-center">
                {matchResult.found_count}
              </span>
            )}
          </div>

          <div className="relative group cursor-pointer" onClick={() => setIsCollapsed(false)} title="Các file lỗi">
            <div className="p-2 text-red-500/60 group-hover:text-red-500 rounded-lg transition-all">
              <AlertTriangle size={16} />
            </div>
            {matchResult && (matchResult.missing_count > 0 || matchResult.duplicate_count > 0) && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 bg-red-500 text-[8px] font-semibold text-white rounded-full flex items-center justify-center">
                {matchResult.missing_count + matchResult.duplicate_count}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[300px] shrink-0 flex flex-col min-h-0 animate-fade-in gap-3 transition-all duration-300">

      {/* SECTION 1: Input Folders */}
      <div className="flex flex-col flex-shrink-0 max-h-[35%] bg-card/80 backdrop-blur-md border border-border/30 shadow-sm rounded-xl overflow-hidden transition-all duration-300">
        <div className="py-2.5 px-3 flex justify-between items-center border-b border-border/30">
          <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-foreground uppercase">
            <FolderOpen size={13} className="text-muted-foreground" />
            {t("input_folders")}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground border border-border/30">{inputFolders.length}</span>
          </span>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleAddFolder} 
              className="text-muted-foreground hover:text-foreground transition-all p-1 rounded-md hover:bg-muted/50 cursor-pointer" 
              title={t("add_folder")}
            >
              <FolderPlus size={14} />
            </button>
            <button 
              onClick={() => setIsCollapsed(true)}
              className="text-muted-foreground hover:text-foreground transition-all p-1 rounded-md hover:bg-muted/50 cursor-pointer"
              title="Thu gọn"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setActiveDropZone("input");
          }}
          onDragLeave={() => setActiveDropZone(null)}
          className={`flex-1 overflow-y-auto p-2.5 space-y-1.5 transition-all ${
            isDragging ? "bg-primary/5 ring-1 ring-primary/30 ring-inset" : ""
          }`}
          style={{
            scrollbarWidth: 'thin',
          }}
        >
          {inputFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-5 px-3 text-center border border-dashed border-border/40 rounded-lg">
              <FolderPlus size={18} className="text-muted-foreground/40 mb-2" />
              <p className="text-[11px] text-foreground/60">{t("no_folders_added")}</p>
              <p className="text-[10px] mt-1 text-muted-foreground max-w-[160px] leading-relaxed">
                Bấm nút thêm ở góc trên hoặc kéo thả thư mục vào đây
              </p>
            </div>
          ) : (
            inputFolders.map((folder, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-lg border bg-background/50 border-border/30 hover:border-border/60 transition-colors group"
              >
                <FolderOpen size={13} className="text-muted-foreground shrink-0" />
                <div
                  className="flex-1 truncate text-[11px] text-foreground/80"
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
              <div className="pt-2 pb-1">
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <Star size={9} className="text-amber-400" />
                  {t("favorites")}
                </span>
              </div>
              <div className="space-y-1">
                {favoriteFolders
                  .filter((f) => !inputFolders.includes(f))
                  .map((folder) => (
                    <button
                      key={folder}
                      onClick={() => addInputFolder(folder)}
                      className="w-full text-left opacity-60 hover:opacity-100 cursor-pointer border border-transparent hover:border-border/40 hover:bg-muted/30 rounded-lg p-2 flex items-center gap-2 transition-all group"
                      title={`Click to add: ${folder}`}
                    >
                      <Star size={12} className="text-amber-400 shrink-0" />
                      <span className="flex-1 text-[11px] truncate">
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
      <div className="flex flex-col flex-1 min-h-[140px] bg-card/80 border border-border/30 shadow-sm rounded-xl overflow-hidden transition-all duration-300">
        <div className="py-2.5 px-3 flex justify-between items-center border-b border-border/30">
          <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-foreground uppercase">
            <CheckCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
            Đã tìm thấy
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {matchResult?.found_count ?? 0}
            </span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1" style={{ scrollbarWidth: 'thin' }}>
          {(!matchResult || matchResult.found_count === 0) ? (
            <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/40">
              Chưa có file nào
            </div>
          ) : (
            matchResult.matches.filter(m => m.status === "Found").map((match, idx) => (
              <div key={idx} className="flex flex-col gap-0.5 p-2 rounded-lg border border-border/30 bg-background/50 hover:bg-muted/20 transition-colors">
                <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">{match.code}</span>
                <span className="text-[10px] text-muted-foreground truncate" title={match.photo?.filename}>
                  {match.photo?.filename}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 3: Error Files — with copy buttons for duplicate & missing */}
      <div className="flex flex-col flex-1 min-h-[140px] bg-card/80 border border-border/30 shadow-sm rounded-xl overflow-hidden transition-all duration-300">
        <div className="py-2.5 px-3 flex justify-between items-center border-b border-border/30">
          <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-foreground uppercase">
            <AlertTriangle size={13} className="text-red-500" />
            Các file lỗi
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
              {(matchResult?.missing_count ?? 0) + (matchResult?.duplicate_count ?? 0)}
            </span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5" style={{ scrollbarWidth: 'thin' }}>
          {(!matchResult || (matchResult.missing_count === 0 && matchResult.duplicate_count === 0)) ? (
            <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/40">
              Không có lỗi
            </div>
          ) : (
            <>
              {/* Duplicate codes summary with copy button */}
              {duplicateCodes.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Copy size={10} />
                      Trùng mã ({duplicateCodes.length})
                    </span>
                    <button
                      onClick={handleCopyDuplicateCodes}
                      className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                    >
                      {copiedDuplicates ? <ClipboardCheck size={9} /> : <Clipboard size={9} />}
                      {copiedDuplicates ? "Đã sao chép" : "Sao chép"}
                    </button>
                  </div>
                  <p className="text-[9px] text-amber-700/70 dark:text-amber-300/60 font-mono leading-relaxed break-all">
                    {duplicateCodes.join(", ")}
                  </p>
                </div>
              )}

              {/* Missing codes summary with copy button */}
              {missingCodes.length > 0 && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                      <XCircle size={10} />
                      Thiếu mã ({missingCodes.length})
                    </span>
                    <button
                      onClick={handleCopyMissingCodes}
                      className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                    >
                      {copiedMissing ? <ClipboardCheck size={9} /> : <Clipboard size={9} />}
                      {copiedMissing ? "Đã sao chép" : "Sao chép"}
                    </button>
                  </div>
                  <p className="text-[9px] text-red-700/70 dark:text-red-300/60 font-mono leading-relaxed break-all">
                    {missingCodes.join(", ")}
                  </p>
                </div>
              )}

              {/* Individual error items */}
              {matchResult.matches.filter(m => m.status === "Missing" || m.status === "Duplicate" || m.status === "InputDuplicate").map((match, idx) => (
                <div key={idx} className={`flex flex-col gap-0.5 p-2 rounded-lg border bg-background/50 transition-colors ${match.status === "Missing" ? "border-red-500/20 hover:bg-red-500/5" : "border-amber-500/20 hover:bg-amber-500/5"}`}>
                  <div className="flex justify-between items-center">
                    <span className={`font-mono text-[11px] font-medium ${match.status === "Missing" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {match.code}
                    </span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${match.status === "Missing" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
                      {match.status === "Missing" ? "Thiếu" : (match.status === "InputDuplicate" ? "Trùng mã" : `Trùng (${match.all_matches.length})`)}
                    </span>
                  </div>
                  {match.status === "Duplicate" && match.photo && (
                    <span className="text-[10px] text-muted-foreground truncate" title={match.photo.filename}>
                      {match.photo.filename}
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
