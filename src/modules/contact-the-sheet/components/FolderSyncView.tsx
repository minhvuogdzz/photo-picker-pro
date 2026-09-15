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
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-4 text-foreground custom-scrollbar select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 bg-card/60 border border-border/80 rounded-2xl shrink-0 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0 shadow-sm">
            <FolderSync size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-foreground tracking-tight">
                Đồng bộ tên thư mục con
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 text-[10px] font-bold uppercase tracking-wider">
                Tiện ích thư mục Studio
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Đổi tên các thư mục con bên trong để đồng nhất theo tên thư mục cha (mã khách/buổi chụp), chuẩn bị sẵn sàng cho quy trình batch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {folders.length > 0 && (
            <button
              onClick={clearAllFolders}
              disabled={isSyncing}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-red-400 font-semibold rounded-xl hover:bg-red-500/10 transition-all cursor-pointer flex items-center gap-1.5 border border-transparent hover:border-red-500/20"
            >
              <Trash2 size={13} />
              <span>Xóa danh sách ({folders.length})</span>
            </button>
          )}

          <button
            onClick={handlePickFolders}
            disabled={isSyncing}
            className="h-9 px-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-xs font-bold text-primary-foreground shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <FolderOpen size={14} />
            <span>Thêm thư mục</span>
          </button>

          {onGoToBatch && (
            <button
              onClick={() => onGoToBatch(folders.map((f) => f.path))}
              className="h-9 px-3.5 rounded-xl bg-card border border-border/80 hover:bg-muted active:scale-95 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 cursor-pointer ml-1"
              title="Chuyển sang màn hình Thực thi Batch và quét các thư mục này"
            >
              <span>Thực thi Batch</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Main Drag & Drop Zone */}
      <div
        onClick={handlePickFolders}
        className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer select-none shrink-0 text-center ${
          isDragging
            ? "border-teal-400 bg-teal-500/15 shadow-lg ring-2 ring-teal-400/30 scale-[1.005]"
            : "border-border/80 bg-card/40 hover:bg-card/70 hover:border-teal-500/50 shadow-sm"
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-2">
          <FolderSync size={24} className={isDragging ? "animate-spin" : ""} />
        </div>
        <p className="text-xs font-bold text-foreground mb-1">
          Kéo thả các thư mục buổi chụp vào đây hoặc bấm để chọn thư mục
        </p>
        <p className="text-[11px] text-muted-foreground max-w-lg">
          Hỗ trợ chọn nhiều thư mục cùng lúc. Công cụ sẽ tự động rà quét và đổi tên các thư mục con lồng nhau bên trong.
        </p>
      </div>

      {/* Mode Selection & Execution Buttons */}
      <div className="flex items-center justify-between gap-4 p-4 bg-card/60 border border-border/80 rounded-2xl shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-muted-foreground">Đã chọn:</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 font-extrabold border border-teal-500/30">
            {folders.length} thư mục
          </span>
          <div className="h-3.5 w-px bg-border/80 mx-1" />
          <span className="text-muted-foreground hidden sm:inline text-[11px]">
            Chọn 1 trong 2 chế độ xử lý bên phải:
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExecuteSync("all")}
            disabled={isSyncing || folders.length === 0}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:brightness-110 active:scale-95 text-xs font-extrabold text-white shadow-md shadow-teal-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <FolderCheck size={14} />}
            <span>Đồng bộ tất cả thư mục con</span>
          </button>

          <button
            onClick={() => handleExecuteSync("last")}
            disabled={isSyncing || folders.length === 0}
            className="h-9 px-4 rounded-xl bg-card border border-teal-500/40 hover:bg-teal-500/10 active:scale-95 text-xs font-bold text-teal-300 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
            <span>Chỉ thư mục cuối (Deepest)</span>
          </button>
        </div>
      </div>

      {/* Progress Bar (Visible while syncing) */}
      {isSyncing && syncProgress && (
        <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-2xl shrink-0 flex flex-col gap-1.5 animate-fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-teal-300 flex items-center gap-2">
              <Loader2 size={13} className="animate-spin text-teal-400" />
              Đang đồng bộ: <b className="text-foreground">{syncProgress.currentName}</b>
            </span>
            <span className="font-mono text-teal-400 font-bold">
              {syncProgress.current} / {syncProgress.total} (
              {Math.round((syncProgress.current / syncProgress.total) * 100)}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-background/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-200"
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
          className={`p-3.5 rounded-2xl border shrink-0 flex items-start justify-between gap-3 animate-fade-in ${
            syncSummary.errors === 0
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {syncSummary.errors === 0 ? (
              <CheckCircle2 size={17} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={17} className="text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs font-bold text-foreground">
                {syncSummary.errors === 0
                  ? `Đã đồng bộ thành công tất cả ${syncSummary.success} thư mục!`
                  : `Đồng bộ hoàn tất: ${syncSummary.success} thành công, ${syncSummary.errors} lỗi`}
              </p>
              {syncSummary.details.length > 0 && (
                <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
                  {syncSummary.details.map((d, i) => (
                    <div key={i} className="font-mono">{d}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setSyncSummary(null)}
            className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Folder Items List */}
      <div className="flex-1 flex flex-col min-h-0 bg-card/40 border border-border/80 rounded-2xl overflow-hidden shadow-inner backdrop-blur-md">
        <div className="px-4 py-2.5 border-b border-border/70 bg-muted/40 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-muted-foreground">
            Danh sách thư mục ({folders.length})
          </span>
          <span className="text-[11px] text-muted-foreground">
            Tên thư mục con sẽ được đổi khớp theo tên thư mục cha này
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {folders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-2xl bg-muted/30 border border-border flex items-center justify-center text-muted-foreground mb-3">
                <FolderOpen size={20} />
              </div>
              <p className="text-xs font-bold text-foreground mb-1">
                Chưa có thư mục nào được chọn
              </p>
              <p className="text-[11px] text-muted-foreground max-w-sm mb-4">
                Kéo thả các folder khách hàng cần sửa tên con vào đây hoặc bấm nút "Thêm thư mục".
              </p>
              <div className="p-3 bg-muted/30 rounded-xl border border-border/60 max-w-md text-left text-[11px] text-muted-foreground space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Info size={13} className="text-teal-400" />
                  <span>Cơ chế hoạt động:</span>
                </div>
                <p>• <b>Đồng bộ tất cả</b>: Đổi tên toàn bộ thư mục con từ cấp nông đến cấp sâu nhất thành tên thư mục cha.</p>
                <p>• <b>Chỉ thư mục cuối</b>: Chỉ đổi tên thư mục thành phẩm sâu nhất (nơi chứa ảnh xuất JPG/Final) theo tên thư mục cha.</p>
              </div>
            </div>
          ) : (
            folders.map((folder, index) => (
              <div
                key={folder.path}
                className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/70 hover:border-teal-500/40 hover:bg-card/80 transition-all group shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                    <FolderOpen size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">
                        {folder.name}
                      </span>
                      {folder.status === "syncing" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-teal-400 bg-teal-500/15 px-2 py-0.5 rounded-full font-semibold">
                          <Loader2 size={10} className="animate-spin" /> Đang xử lý
                        </span>
                      )}
                      {folder.status === "success" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full font-semibold">
                          <CheckCircle2 size={10} /> Đã đồng bộ
                        </span>
                      )}
                      {folder.status === "error" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded-full font-semibold">
                          <AlertTriangle size={10} /> Lỗi
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate" title={folder.path}>
                      {folder.path}
                    </p>
                    {folder.message && (
                      <p className="text-[10px] text-teal-400/90 mt-0.5 truncate">
                        {folder.message}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => removeFolder(folder.path)}
                  disabled={isSyncing}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer shrink-0 opacity-70 group-hover:opacity-100"
                  title="Xóa khỏi danh sách"
                >
                  <X size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
