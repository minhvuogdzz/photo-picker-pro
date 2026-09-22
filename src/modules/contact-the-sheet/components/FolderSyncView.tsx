import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import {
  FolderSync,
  FolderOpen,
  Trash2,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  FolderCheck,
  Sparkles,
  Layers,
} from "lucide-react";
import { getFolderName } from "@/core/lib/utils";

interface FolderItem {
  path: string;
  name: string;
  status: "idle" | "syncing" | "success" | "error";
  message?: string;
}

interface Props {
  onGoToBatch?: (paths?: string[]) => void;
}

export function FolderSyncView({ onGoToBatch }: Props) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; currentName: string } | null>(null);
  const [syncSummary, setSyncSummary] = useState<{ success: number; errors: number; details: string[] } | null>(null);

  // Add folder paths avoiding duplicates
  const addFolders = useCallback((paths: string[]) => {
    setFolders((prev) => {
      const existing = new Set(prev.map((f) => f.path));
      const newItems: FolderItem[] = [];
      for (const p of paths) {
        if (p && !existing.has(p)) {
          existing.add(p);
          newItems.push({
            path: p,
            name: getFolderName(p),
            status: "idle",
          });
        }
      }
      return [...prev, ...newItems];
    });
    setSyncSummary(null);
  }, []);

  const handlePickFolders = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Chọn các thư mục cần đồng bộ tên con",
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        addFolders(paths);
      }
    } catch (err) {
      console.error("Open folder dialog error:", err);
    }
  };

  const removeFolder = (pathToRemove: string) => {
    setFolders((prev) => prev.filter((f) => f.path !== pathToRemove));
  };

  const clearAllFolders = () => {
    setFolders([]);
    setSyncSummary(null);
    setSyncProgress(null);
  };

  // Tauri Native Drag-and-Drop Listener
  useEffect(() => {
    let unlistenDrop: (() => void) | undefined;
    let unlistenHover: (() => void) | undefined;
    let unlistenCancel: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        unlistenDrop = await listen<any>("tauri://drag-drop", (event) => {
          setIsDragging(false);
          const paths = event.payload?.paths;
          if (Array.isArray(paths) && paths.length > 0) {
            addFolders(paths);
          }
        });

        unlistenHover = await listen("tauri://drag-over", () => {
          setIsDragging(true);
        });

        unlistenCancel = await listen("tauri://drag-leave", () => {
          setIsDragging(false);
        });
      } catch (e) {
        console.warn("Tauri drag-drop events not supported in this runtime:", e);
      }
    };

    setupListeners();

    return () => {
      if (unlistenDrop) unlistenDrop();
      if (unlistenHover) unlistenHover();
      if (unlistenCancel) unlistenCancel();
    };
  }, [addFolders]);

  const handleExecuteSync = async (mode: "all" | "last") => {
    if (folders.length === 0 || isSyncing) return;

    setIsSyncing(true);
    setSyncSummary(null);

    let successCount = 0;
    let errorCount = 0;
    const errorDetails: string[] = [];

    // Reset all folder statuses to syncing
    setFolders((prev) =>
      prev.map((f) => ({ ...f, status: "idle", message: undefined }))
    );

    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      setSyncProgress({
        current: i + 1,
        total: folders.length,
        currentName: folder.name,
      });

      // Update current folder status to syncing
      setFolders((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "syncing" } : f))
      );

      try {
        const res = await invoke<string>("sync_subfolder_names", {
          folderPath: folder.path,
          mode,
        });

        successCount++;
        setFolders((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "success", message: res || "Đồng bộ thành công" } : f
          )
        );
      } catch (err: any) {
        errorCount++;
        const errMsg = String(err);
        errorDetails.push(`${folder.name}: ${errMsg}`);
        setFolders((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", message: errMsg } : f
          )
        );
      }
    }

    setSyncSummary({
      success: successCount,
      errors: errorCount,
      details: errorDetails,
    });
    setIsSyncing(false);
    setSyncProgress(null);

    // Auto-navigate and process in Batch Runner with updated folder names
    if (successCount > 0 && onGoToBatch) {
      const syncedPaths = folders.map((f) => f.path);
      setTimeout(() => {
        onGoToBatch(syncedPaths);
      }, 750);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 gap-3 text-foreground custom-scrollbar select-none min-w-0">
      {/* Header Bar */}
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between p-3 sm:p-3.5 bg-card/60 border border-border/80 rounded-2xl shrink-0 backdrop-blur-md shadow-2xs gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <FolderSync size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-foreground tracking-tight truncate">
                Đồng bộ tên thư mục con
              </h2>
              <span className="px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border text-[9px] font-semibold uppercase tracking-wider shrink-0">
                Tiện ích thư mục Studio
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate max-w-xl">
              Đổi tên các thư mục con bên trong theo tên thư mục cha (mã khách/buổi chụp), chuẩn bị sẵn sàng cho quy trình batch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center flex-wrap">
          {folders.length > 0 && (
            <button
              onClick={clearAllFolders}
              disabled={isSyncing}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive font-medium rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 size={12} />
              <span>Xóa ({folders.length})</span>
            </button>
          )}

          <button
            onClick={handlePickFolders}
            disabled={isSyncing}
            className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FolderOpen size={13} />
            <span>Thêm thư mục</span>
          </button>

          {onGoToBatch && (
            <button
              onClick={() => onGoToBatch(folders.map((f) => f.path))}
              className="h-8 px-3 rounded-lg bg-muted hover:bg-accent text-xs font-semibold text-foreground border border-border transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Chuyển sang màn hình Thực thi Batch và quét các thư mục này"
            >
              <span>Thực thi Batch</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Main Drag & Drop Zone - Compact & Clean */}
      <div
        onClick={handlePickFolders}
        className={`py-4 px-4 rounded-xl border border-dashed flex flex-col items-center justify-center transition-all cursor-pointer select-none shrink-0 text-center min-w-0 ${
          isDragging
            ? "border-primary bg-primary/10 ring-2 ring-primary/20 scale-[1.002]"
            : "border-border/80 bg-card/40 hover:bg-card/70 hover:border-primary/50 shadow-2xs"
        }`}
      >
        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1.5">
          <FolderSync size={18} className={isDragging ? "animate-spin" : ""} />
        </div>
        <p className="text-xs font-bold text-foreground mb-0.5">
          Kéo thả các thư mục buổi chụp vào đây hoặc bấm để chọn thư mục
        </p>
        <p className="text-[11px] text-muted-foreground max-w-lg">
          Hỗ trợ chọn nhiều thư mục cùng lúc. Công cụ sẽ tự động rà quét và đổi tên các thư mục con lồng nhau bên trong.
        </p>
      </div>

      {/* Mode Selection & Execution Buttons - Responsive & Clean Neutral Styling */}
      <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2.5 p-3 bg-card/60 border border-border/80 rounded-xl shrink-0 backdrop-blur-md min-w-0">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="font-semibold text-muted-foreground shrink-0">Đã chọn:</span>
          <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-mono font-bold border border-border text-xs shrink-0">
            {folders.length} thư mục
          </span>
          <div className="h-3.5 w-px bg-border/80 mx-1 hidden sm:block shrink-0" />
          <span className="text-muted-foreground hidden lg:inline text-[11px] truncate">
            Chọn 1 trong 2 chế độ xử lý:
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={() => handleExecuteSync("all")}
            disabled={isSyncing || folders.length === 0}
            className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-xs font-semibold text-primary-foreground shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            title="Đồng bộ tất cả các thư mục con bên trong theo tên thư mục cha"
          >
            {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <FolderCheck size={13} />}
            <span>Đồng bộ tất cả</span>
          </button>

          <button
            onClick={() => handleExecuteSync("last")}
            disabled={isSyncing || folders.length === 0}
            className="h-8 px-3 rounded-lg bg-muted hover:bg-accent text-foreground border border-border text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            title="Chỉ đổi tên thư mục thành phẩm sâu nhất theo tên thư mục cha"
          >
            {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
            <span>Chỉ thư mục cuối</span>
          </button>
        </div>
      </div>

      {/* Progress Bar (Visible while syncing) */}
      {isSyncing && syncProgress && (
        <div className="p-3 bg-card border border-primary/30 rounded-xl shrink-0 flex flex-col gap-1.5 animate-fade-in min-w-0">
          <div className="flex items-center justify-between text-xs min-w-0">
            <span className="font-medium text-foreground flex items-center gap-2 truncate">
              <Loader2 size={12} className="animate-spin text-primary" />
              <span>Đang đồng bộ: <b className="text-foreground">{syncProgress.currentName}</b></span>
            </span>
            <span className="font-mono text-foreground font-bold shrink-0">
              {syncProgress.current} / {syncProgress.total} (
              {Math.round((syncProgress.current / syncProgress.total) * 100)}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200 rounded-full"
              style={{
                width: `${(syncProgress.current / syncProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Sync Result Summary Alert */}
      {syncSummary && (
        <div
          className={`p-3 rounded-xl border shrink-0 flex items-start justify-between gap-3 animate-fade-in min-w-0 ${
            syncSummary.errors === 0
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
              : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {syncSummary.errors === 0 ? (
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">
                {syncSummary.errors === 0
                  ? `Đã đồng bộ thành công tất cả ${syncSummary.success} thư mục!`
                  : `Đồng bộ hoàn tất: ${syncSummary.success} thành công, ${syncSummary.errors} lỗi`}
              </p>
              {syncSummary.details.length > 0 && (
                <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
                  {syncSummary.details.map((d, i) => (
                    <div key={i} className="font-mono truncate">{d}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setSyncSummary(null)}
            className="text-muted-foreground hover:text-foreground cursor-pointer p-1 shrink-0"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Folder Items List */}
      <div className="flex-1 flex flex-col min-h-0 bg-card/40 border border-border/80 rounded-xl overflow-hidden shadow-inner backdrop-blur-md min-w-0">
        <div className="px-3.5 py-2 border-b border-border/70 bg-muted/30 flex flex-wrap items-center justify-between gap-2 shrink-0 min-w-0">
          <span className="text-xs font-bold text-muted-foreground">
            Danh sách thư mục ({folders.length})
          </span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline truncate">
            Tên thư mục con sẽ được đổi khớp theo tên thư mục cha này
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar min-w-0">
          {folders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-10 h-10 rounded-xl bg-muted/40 border border-border flex items-center justify-center text-muted-foreground mb-2">
                <FolderOpen size={18} />
              </div>
              <p className="text-xs font-bold text-foreground mb-0.5">
                Chưa có thư mục nào được chọn
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mb-3">
                Kéo thả các folder khách hàng cần sửa tên con vào đây hoặc bấm nút "Thêm thư mục".
              </p>
              <div className="p-3 bg-muted/30 rounded-xl border border-border/60 max-w-md text-left text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Info size={13} className="text-muted-foreground" />
                  <span>Cơ chế hoạt động:</span>
                </div>
                <p>• <b>Đồng bộ tất cả con</b>: Đổi tên toàn bộ thư mục con từ cấp nông đến cấp sâu nhất thành tên thư mục cha.</p>
                <p>• <b>Chỉ thư mục cuối</b>: Chỉ đổi tên thư mục thành phẩm sâu nhất (nơi chứa ảnh xuất JPG/Final) theo tên thư mục cha.</p>
              </div>
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.path}
                className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border/70 hover:border-primary/40 hover:bg-card/80 transition-all group shadow-2xs min-w-0 gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-muted text-muted-foreground border border-border/60 flex items-center justify-center shrink-0">
                    <FolderOpen size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {folder.name}
                      </span>
                      {folder.status === "syncing" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-0.2 rounded-full font-medium">
                          <Loader2 size={10} className="animate-spin" /> Đang xử lý
                        </span>
                      )}
                      {folder.status === "success" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.2 rounded-full font-medium">
                          <CheckCircle2 size={10} /> Đã đồng bộ
                        </span>
                      )}
                      {folder.status === "error" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-2 py-0.2 rounded-full font-medium">
                          <AlertTriangle size={10} /> Lỗi
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate" title={folder.path}>
                      {folder.path}
                    </p>
                    {folder.message && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">
                        {folder.message}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => removeFolder(folder.path)}
                  disabled={isSyncing}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                  title="Xóa khỏi danh sách"
                >
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
