import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
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
  XCircle,
  Clipboard,
  ClipboardCheck,
  Search,
  Filter,
  Users,
  User,
  Loader2,
  Eye,
} from "lucide-react";
import { getFolderName } from "@/core/lib/utils";
import { batchFolderService } from "../services/batchFolderService";
import { autoFindService } from "../services/autoFindService";
import { FolderPreviewModal } from "./FolderPreviewModal";
import { FoundPhotosPreviewModal } from "./FoundPhotosPreviewModal";
import { analyzeCodeInputLines } from "../utils/codeLineHighlighter";

interface LeftPanelProps {
  readonly width?: number;
  readonly isResizing?: boolean;
  readonly isCollapsed?: boolean;
  readonly onCollapsedChange?: (collapsed: boolean) => void;
}

export function LeftPanel({
  width = 300,
  isResizing = false,
  isCollapsed: controlledCollapsed,
  onCollapsedChange,
}: LeftPanelProps = {}) {
  const inputFolders = useAppStore((s) => s.inputFolders);
  const selectedInputFolders = useAppStore((s) => s.selectedInputFolders);
  const addInputFolder = useAppStore((s) => s.addInputFolder);
  const pickerMode = useAppStore((s) => s.pickerMode);
  const setPickerMode = useAppStore((s) => s.setPickerMode);
  const batchCustomerFolders = useAppStore((s) => s.batchCustomerFolders);
  const selectSingleInputFolder = useAppStore((s) => s.selectSingleInputFolder);
  const removeInputFolder = useAppStore((s) => s.removeInputFolder);
  const clearInputFolders = useAppStore((s) => s.clearInputFolders);
  const setActiveDropZone = useAppStore((s) => s.setActiveDropZone);
  const phase = useAppStore((s) => s.phase);
  const matchResult = useAppStore((s) => s.matchResult);
  const rawCodeInput = useAppStore((s) => s.rawCodeInput);
  const inheritExtensionEnabled = useAppStore((s) => s.inheritExtensionEnabled);
  const inheritedExtensions = useAppStore((s) => s.inheritedExtensions);
  const requestCodeLineFocus = useAppStore((s) => s.requestCodeLineFocus);
  const favoriteFolders = useSettingsStore((s) => s.settings.favorite_folders);
  const addFavoriteFolder = useSettingsStore((s) => s.addFavoriteFolder);
  const removeFavoriteFolder = useSettingsStore((s) => s.removeFavoriteFolder);
  const { t, tr } = useTranslation();

  const [isDragging, setIsDragging] = useState(false);
  const [isExpandingBatch, setIsExpandingBatch] = useState(false);
  const [isCollapsedState, setIsCollapsedState] = useState(true);
  const isCollapsed = controlledCollapsed ?? isCollapsedState;
  const setIsCollapsed = (val: boolean) => {
    setIsCollapsedState(val);
    onCollapsedChange?.(val);
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);
  const [previewFolder, setPreviewFolder] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isFoundPreviewOpen, setIsFoundPreviewOpen] = useState(false);
  const [foundPreviewIndex, setFoundPreviewIndex] = useState(0);

  const foundMatches = useMemo(() => {
    if (!matchResult) return [];
    return matchResult.matches.filter((m) => m.status === "Found" && m.photo);
  }, [matchResult]);

  const lineAnalysis = useMemo(
    () =>
      analyzeCodeInputLines(
        rawCodeInput,
        matchResult,
        inheritExtensionEnabled ? inheritedExtensions : null
      ),
    [rawCodeInput, matchResult, inheritExtensionEnabled, inheritedExtensions]
  );

  const handleOpenFoundPreview = (index: number) => {
    setFoundPreviewIndex(index);
    setIsFoundPreviewOpen(true);
  };

  const handleOpenPreview = (folder: string) => {
    setPreviewFolder(folder);
    setIsPreviewOpen(true);
  };

  const handleSelectCustomer = (folder: string) => {
    const st = useAppStore.getState();
    const currentActive = st.selectedInputFolders[0] || st.inputFolders[0];
    selectSingleInputFolder(folder);
    if (st.autoFindEnabled) {
      if (
        currentActive !== folder ||
        autoFindService.getActiveTargetFolder() !== folder ||
        !st.rawCodeInput.trim()
      ) {
        const folderName = getFolderName(folder);
        void autoFindService.fetchAndApplyCodesForCustomer(folder, folderName);
      }
    }
  };

  useEffect(() => {
    let unlistenFileDrop: (() => void) | null = null;
    let unlistenDragDrop: (() => void) | null = null;
    let unlistenHover: (() => void) | null = null;
    let unlistenCancel: (() => void) | null = null;

    const handleDropPaths = async (paths: string[]) => {
      setIsDragging(false);
      if (paths && paths.length > 0) {
        if (pickerMode === "multi" || paths.length > 1) {
          if (pickerMode !== "multi") {
            setPickerMode("multi");
          }
          // Turn off Auto Find by default when dropping/adding folders into multi-customer mode
          useAppStore.getState().setAutoFindEnabled(false);
          useAppStore.getState().setAutoFindStatus(null);
          setIsExpandingBatch(true);
          try {
            await batchFolderService.expandAndIngestFolders(paths);
          } finally {
            setIsExpandingBatch(false);
          }
        } else {
          for (const path of paths) {
            if (path) addInputFolder(path);
          }
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
  }, [addInputFolder, pickerMode]);

  const handleAddFolder = async () => {
    try {
      const isMultiAllowed = pickerMode === "multi";
      const selected = await open({
        directory: true,
        multiple: isMultiAllowed,
        title: isMultiAllowed
          ? tr("Chọn thư mục Tháng, Ngày hoặc nhiều khách", "Select Month, Day, or customer folders")
          : tr("Chọn thư mục ảnh của khách", "Select customer photo folder"),
      });

      if (selected) {
        const folders = Array.isArray(selected) ? selected : [selected];
        if (pickerMode === "multi" || folders.length > 1) {
          if (pickerMode !== "multi") {
            setPickerMode("multi");
          }
          // Turn off Auto Find by default when adding folders into multi-customer mode
          useAppStore.getState().setAutoFindEnabled(false);
          useAppStore.getState().setAutoFindStatus(null);
          setIsExpandingBatch(true);
          try {
            await batchFolderService.expandAndIngestFolders(folders);
          } finally {
            setIsExpandingBatch(false);
          }
        } else {
          for (const folder of folders) {
            if (folder) addInputFolder(folder);
          }
        }
      }
    } catch (error) {
      console.error("Failed to open folder dialog:", error);
    }
  };

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return inputFolders;
    const q = searchQuery.toLowerCase().trim();
    const normQ = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return [...inputFolders].sort((a, b) => {
      const nameA = getFolderName(a).toLowerCase();
      const nameB = getFolderName(b).toLowerCase();
      const normA = nameA.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const normB = nameB.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const matchA = normA.includes(normQ);
      const matchB = normB.includes(normQ);

      if (matchA && !matchB) return -1;
      if (!matchA && matchB) return 1;
      return 0;
    }).filter((f) => {
      const name = getFolderName(f).toLowerCase();
      const norm = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return norm.includes(normQ) || f.toLowerCase().includes(q);
    });
  }, [inputFolders, searchQuery]);

  const isFavorite = (folder: string) => favoriteFolders.includes(folder);

  const toggleFavorite = (folder: string) => {
    if (isFavorite(folder)) {
      removeFavoriteFolder(folder);
    } else {
      addFavoriteFolder(folder);
    }
  };
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

  const currentFolderNames = (selectedInputFolders.length > 0 ? selectedInputFolders : inputFolders)
    .map(getFolderName)
    .filter(Boolean)
    .join(", ");

  const formatErrorText = (options?: { includeMissing?: boolean; includeDuplicates?: boolean }) => {
    const { includeMissing = true, includeDuplicates = true } = options || {};
    const parts: string[] = [];

    if (currentFolderNames) {
      parts.push(currentFolderNames);
    }

    if (includeMissing && missingCodes.length > 0) {
      parts.push(`${tr("sai mã:", "missing:")} ${missingCodes.join(", ")}`);
    }

    if (includeDuplicates && duplicateCodes.length > 0) {
      parts.push(`${tr("trùng mã:", "duplicate:")} ${duplicateCodes.join(", ")}`);
    }

    return parts.join(" ");
  };

  const handleCopyAllErrors = async () => {
    const text = formatErrorText({ includeMissing: true, includeDuplicates: true });
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // fallback
    }
  };

  if (isCollapsed) {
    return (
      <div id="left-panel-collapsed-strip" className="w-12 flex flex-col items-center py-4 bg-card border border-border shadow-sm rounded-2xl transition-all duration-300">
        <button 
          onClick={() => setIsCollapsed(false)}
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all mb-4 cursor-pointer"
          title={tr("Mở bảng điều khiển", "Expand panel")} aria-label={tr("Mở bảng điều khiển", "Expand panel")}
        >
          <Menu size={16} strokeWidth={1.75} />
        </button>
        
        <div className="flex flex-col gap-4 w-full items-center">
          <div className="relative group cursor-pointer" onClick={() => setIsCollapsed(false)} title={t("input_folders")}>
            <div className="p-2 text-muted-foreground group-hover:text-foreground rounded-lg transition-all">
              <FolderOpen size={16} strokeWidth={1.75} />
            </div>
            {inputFolders.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 bg-foreground/80 text-[10px] font-semibold text-background rounded-full flex items-center justify-center">
                {inputFolders.length}
              </span>
            )}
          </div>
          
          <div className="w-5 h-px bg-border/40"></div>
          
          <div className="relative group cursor-pointer" onClick={() => setIsCollapsed(false)} title={tr("Đã tìm thấy", "Found")}>
            <div className="p-2 text-muted-foreground group-hover:text-foreground rounded-lg transition-all">
              <CheckCircle size={16} strokeWidth={1.75} />
            </div>
            {matchResult && matchResult.found_count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 bg-foreground/80 text-[10px] font-semibold text-background rounded-full flex items-center justify-center">
                {matchResult.found_count}
              </span>
            )}
          </div>

          <div className="relative group cursor-pointer" onClick={() => setIsCollapsed(false)} title={tr("Các file lỗi", "Errors")}>
            <div className="p-2 text-muted-foreground group-hover:text-foreground rounded-lg transition-all">
              <AlertTriangle size={16} strokeWidth={1.75} />
            </div>
            {matchResult && (matchResult.missing_count > 0 || matchResult.duplicate_count > 0) && (
              <span className="absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 bg-destructive text-[10px] font-semibold text-white rounded-full flex items-center justify-center">
                {matchResult.missing_count + matchResult.duplicate_count}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ width: `${width}px` }}
      className={`shrink-0 flex flex-col min-h-0 animate-fade-in gap-3 ${
        isResizing ? "" : "transition-all duration-300"
      }`}
    >

      {/* SECTION 1: Input Folders & Batch Customer Queue */}
      <div
        className={`flex flex-col flex-shrink-0 transition-all duration-300 bg-card border border-border shadow-sm rounded-2xl overflow-hidden ${
          pickerMode === "multi" ? "max-h-[50%]" : "max-h-[35%]"
        }`}
      >
        {/* Header */}
        <div className="h-10 px-3 flex justify-between items-center border-b border-border">
          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
            <FolderOpen size={13} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
            <span>{pickerMode === "multi" ? tr("Hàng đợi khách", "Customer Queue") : t("input_folders")}</span>
            <span className="text-muted-foreground tabular-nums font-normal">
              {inputFolders.length}
            </span>
          </span>

          <div className="flex items-center gap-1">
            {pickerMode === "multi" && inputFolders.length > 0 && (
              <button
                type="button"
                onClick={clearInputFolders}
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                title={tr("Xoá tất cả khách khỏi hàng đợi", "Clear all customers from queue")} aria-label={tr("Xoá tất cả khách khỏi hàng đợi", "Clear all customers from queue")}
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            )}

            <button
              type="button"
              onClick={handleAddFolder}
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07] transition-colors cursor-pointer"
              title={pickerMode === "multi" ? tr("Thêm thư mục Tháng, Ngày hoặc Khách", "Add Month, Day, or Customer folder") : t("add_folder")} aria-label={pickerMode === "multi" ? tr("Thêm thư mục Tháng, Ngày hoặc Khách", "Add Month, Day, or Customer folder") : t("add_folder")}
            >
              <FolderPlus size={14} strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07] transition-colors cursor-pointer"
              title={tr("Thu gọn", "Collapse")} aria-label={tr("Thu gọn", "Collapse")}
            >
              <ChevronLeft size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Mode Switcher: Lọc 1 khách vs Lọc nhiều khách */}
        <div className="px-2.5 py-2 border-b border-border">
          <div className="p-0.5 rounded-md bg-foreground/[0.05] border border-border grid grid-cols-2 gap-0.5">
            <button
              type="button"
              onClick={() => setPickerMode("single")}
              className={`h-7 rounded-[5px] text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                pickerMode === "single"
                  ? "bg-background text-foreground font-medium shadow-xs dark:bg-white/[0.11]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User size={12} strokeWidth={1.75} />
              <span>{tr("Lọc 1 khách", "Single")}</span>
            </button>
            <button
              type="button"
              onClick={() => setPickerMode("multi")}
              className={`h-7 px-1 rounded-[5px] text-xs flex items-center justify-center gap-1.5 transition-colors select-none cursor-pointer ${
                pickerMode === "multi"
                  ? "bg-background text-foreground font-medium shadow-xs dark:bg-white/[0.11]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={tr("Lọc nhiều khách cùng lúc", "Batch filter multiple customers")}
            >
              <Users size={12} strokeWidth={1.75} />
              <span>{tr("Lọc nhiều khách", "Batch Queue")}</span>
            </button>
          </div>

          {/* Search Input in Multi Mode */}
          {pickerMode === "multi" && inputFolders.length > 0 && (
            <div className="relative mt-2">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder={tr("Tìm tên khách cần lọc trước...", "Search customer name...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-7 pr-7 text-xs rounded-md bg-foreground/[0.03] border border-border text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              />
              {searchQuery && (
                <button aria-label={tr("Xoá", "Clear")}
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XCircle size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Folder List */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setActiveDropZone("input");
          }}
          onDragLeave={() => setActiveDropZone(null)}
          className={`flex-1 overflow-y-auto p-2 space-y-1 transition-all ${
            isDragging ? "bg-primary/5 ring-1 ring-primary/30 ring-inset" : ""
          }`}
          style={{
            scrollbarWidth: "thin",
          }}
        >
          {isExpandingBatch && (
            <div className="p-2.5 flex items-center justify-center gap-2 text-xs text-primary bg-primary/5 rounded-lg border border-primary/20">
              <Loader2 size={14} className="animate-spin shrink-0" />
              <span>{tr("Đang quét và bóc tách thư mục khách...", "Scanning and expanding customer folders...")}</span>
            </div>
          )}

          {inputFolders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-5 px-3 text-center border border-dashed border-border rounded-lg">
              <FolderPlus size={18} strokeWidth={1.75} className="text-muted-foreground/70 mb-2" />
              <p className="text-xs text-muted-foreground">{t("no_folders_added")}</p>
              <p className="text-[11px] mt-1 text-muted-foreground/80 max-w-[200px] leading-relaxed">
                {pickerMode === "multi"
                  ? tr("Kéo thả thư mục Tháng, Ngày hoặc nhiều thư mục khách vào đây", "Drag & drop Month, Day, or customer folders here")
                  : tr("Bấm nút thêm ở góc trên hoặc kéo thả thư mục vào đây", "Click Add above or drag & drop a folder here")}
              </p>
            </div>
          ) : pickerMode === "single" ? (
            // Single Folder View
            inputFolders.map((folder, i) => {
              const isSelected = selectedInputFolders.length === 0 || selectedInputFolders.includes(folder);
              const folderName = getFolderName(folder);
              return (
                <div
                  key={i}
                  id={isSelected ? "active-customer-queue-item" : undefined}
                  data-customer-folder={folder}
                  data-folder-name={folderName}
                  data-active-customer={isSelected ? "true" : "false"}
                  onClick={() => handleOpenPreview(folder)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/50 bg-foreground/[0.02] hover:border-border-strong hover:bg-foreground/[0.05] transition-colors group cursor-pointer select-none"
                  title={tr("Bấm để mở kho ảnh xem trước", "Click to open photo gallery")}
                >
                  <FolderOpen size={13} strokeWidth={1.75} className="text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                  <div
                    className="flex-1 truncate text-xs text-foreground/85 font-medium group-hover:text-foreground"
                    title={folder}
                    dir="rtl"
                  >
                    &lrm;{folderName}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPreview(folder);
                    }}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07] transition-colors cursor-pointer shrink-0"
                    title={tr("Xem toàn bộ ảnh trong thư mục này", "Preview all photos in this folder")} aria-label={tr("Xem toàn bộ ảnh trong thư mục này", "Preview all photos in this folder")}
                  >
                    <Eye size={13} strokeWidth={1.75} />
                  </button>
                </div>
              );
            })
          ) : (
            // Multi Customer Batch Queue View
            filteredFolders.map((folder) => {
              const isSelected = selectedInputFolders.includes(folder);
              const folderName = getFolderName(folder);
              const batchMeta = batchCustomerFolders.find((b) => b.folder_path === folder);

              return (
                <div
                  key={folder}
                  id={isSelected ? "active-customer-queue-item" : undefined}
                  data-customer-folder={folder}
                  data-folder-name={folderName}
                  data-active-customer={isSelected ? "true" : "false"}
                  onClick={() => handleSelectCustomer(folder)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors cursor-pointer group select-none ${
                    isSelected
                      ? "bg-primary/10 border-primary/40"
                      : "bg-foreground/[0.02] border-border/50 hover:border-border-strong hover:bg-foreground/[0.05]"
                  }`}
                >
                  {/* Single Active Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleSelectCustomer(folder)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-border text-primary focus:ring-primary/40 cursor-pointer w-3.5 h-3.5 shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`truncate text-xs font-medium ${
                          isSelected ? "text-primary" : "text-foreground/90"
                        }`}
                        title={folder}
                      >
                        {folderName}
                      </span>
                    </div>

                    {batchMeta?.day_name && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {batchMeta.day_name}
                      </span>
                    )}
                  </div>

                  {/* Preview customer folder */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPreview(folder);
                    }}
                    className="p-1 rounded-md hover:bg-foreground/[0.07] text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                    title={tr("Xem trước ảnh của khách này", "Preview this customer's photos")} aria-label={tr("Xem trước ảnh của khách này", "Preview this customer's photos")}
                  >
                    <Eye size={13} strokeWidth={1.75} />
                  </button>

                  {/* Delete from queue */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeInputFolder(folder);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer shrink-0"
                    title={tr("Xoá khách này khỏi hàng đợi", "Remove customer from queue")} aria-label={tr("Xoá khách này khỏi hàng đợi", "Remove customer from queue")}
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </div>
              );
            })
          )}

          {/* Favorite folders section */}
          {favoriteFolders.length > 0 && (
            <>
              <div className="pt-2 pb-1 px-0.5">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Star size={11} className="text-warning shrink-0" />
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
                      className="w-full text-left opacity-70 hover:opacity-100 cursor-pointer border border-transparent hover:border-border hover:bg-foreground/[0.04] rounded-lg px-2 py-1.5 flex items-center gap-2 transition-all group"
                      title={`Click to add: ${folder}`}
                    >
                      <Star size={12} className="text-warning shrink-0" />
                      <span className="flex-1 text-xs truncate">
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
      <div className="flex flex-col flex-1 min-h-[140px] bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
        <div className="h-10 px-3 flex justify-between items-center border-b border-border">
          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            {tr("Đã tìm thấy", "Found")}
            <span className="text-muted-foreground tabular-nums font-normal">{matchResult?.found_count ?? 0}</span>
          </span>
          {foundMatches.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenFoundPreview(0)}
              className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07] transition-colors"
              title={tr("Xem trước tất cả các ảnh đã tìm thấy", "Preview all found photos")}
            >
              <Eye size={13} strokeWidth={1.75} />
              <span>{tr("Xem trước", "Preview")}</span>
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-1.5" style={{ scrollbarWidth: "thin" }}>
          {(!matchResult || matchResult.found_count === 0) ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              {tr("Chưa có file nào", "No matched files yet")}
            </div>
          ) : (
            foundMatches.map((match, idx) => (
              <div
                key={idx}
                className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/[0.04] transition-colors"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-mono text-xs text-foreground">{match.code}</span>
                  <span className="text-[10.5px] text-muted-foreground truncate" title={match.photo?.filename}>
                    {match.photo?.filename}
                  </span>
                </div>
                {match.photo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFoundPreview(idx);
                    }}
                    className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-foreground hover:bg-foreground/[0.07] transition-all shrink-0"
                    title={tr(`Xem trước ảnh ${match.photo.filename}`, `Preview ${match.photo.filename}`)}
                    aria-label={tr(`Xem trước ảnh ${match.photo.filename}`, `Preview ${match.photo.filename}`)}
                  >
                    <Eye size={14} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 3: Error Files — click a row to jump to its line (copy actions live in the dashboard) */}
      <div className="flex flex-col flex-1 min-h-[140px] bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
        <div className="h-10 px-3 flex justify-between items-center border-b border-border">
          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
            {tr("Các file lỗi", "Errors")}
            <span className="text-muted-foreground tabular-nums font-normal">
              {(matchResult?.missing_count ?? 0) + (matchResult?.duplicate_count ?? 0)}
            </span>
          </span>
          {(missingCodes.length > 0 || duplicateCodes.length > 0) && (
            <button
              type="button"
              onClick={handleCopyAllErrors}
              className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/[0.07] transition-colors"
              title={tr("Sao chép tất cả mã lỗi", "Copy all issues")}
            >
              {copiedAll ? <ClipboardCheck size={12} /> : <Clipboard size={12} />}
              {copiedAll ? tr("Đã sao chép", "Copied") : tr("Sao chép", "Copy")}
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-1.5" style={{ scrollbarWidth: "thin" }}>
          {(!matchResult || (matchResult.missing_count === 0 && matchResult.duplicate_count === 0)) ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              {tr("Không có lỗi", "No errors")}
            </div>
          ) : (
            lineAnalysis.matchErrorLocations.map((loc, idx) => {
              const {
                match,
                lineIndex,
                lineNumber,
                duplicateOfLineNumber,
                allDuplicateLineNumbers,
              } = loc;
              const isMissing = match.status === "Missing";
              const canJump = lineIndex >= 0;
              const dupLinesDisplay =
                allDuplicateLineNumbers && allDuplicateLineNumbers.length > 1
                  ? allDuplicateLineNumbers.join(" & ")
                  : duplicateOfLineNumber
                    ? `${duplicateOfLineNumber} & ${lineNumber}`
                    : "";

              return (
                <div
                  key={idx}
                  role={canJump ? "button" : undefined}
                  tabIndex={canJump ? 0 : undefined}
                  onClick={() => {
                    if (canJump) {
                      requestCodeLineFocus(lineIndex, match.code);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (canJump && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      requestCodeLineFocus(lineIndex, match.code);
                    }
                  }}
                  title={
                    canJump
                      ? tr(
                          `Bấm để nhảy tới dòng ${lineNumber} và sửa mã ${match.code}`,
                          `Click to jump to line ${lineNumber} and edit code ${match.code}`
                        )
                      : undefined
                  }
                  className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-md transition-colors ${
                    canJump ? "cursor-pointer hover:bg-foreground/[0.05]" : ""
                  }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMissing ? "bg-destructive" : "bg-warning"}`}
                      />
                      <span className="font-mono text-xs text-foreground truncate">{match.code}</span>
                      {lineNumber > 0 && (
                        <span className="text-[10.5px] text-muted-foreground shrink-0">
                          {dupLinesDisplay
                            ? tr(`Dòng ${dupLinesDisplay}`, `Line ${dupLinesDisplay}`)
                            : tr(`Dòng ${lineNumber}`, `Line ${lineNumber}`)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10.5px] text-muted-foreground shrink-0">
                      {isMissing
                        ? tr("Sai mã", "Missing")
                        : match.status === "InputDuplicate"
                          ? tr("Trùng mã", "Duplicate input")
                          : tr(
                              `Trùng (${match.all_matches.length})`,
                              `Match (${match.all_matches.length})`
                            )}
                    </span>
                  </div>
                  {match.status === "Duplicate" && match.photo && (
                    <span className="pl-3.5 text-[10.5px] text-muted-foreground truncate" title={match.photo.filename}>
                      {match.photo.filename}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Folder Photo Gallery Preview Modal */}
      <FolderPreviewModal
        isOpen={isPreviewOpen}
        folderPath={previewFolder}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewFolder(null);
        }}
      />

      {/* Found Photos Preview Modal */}
      <FoundPhotosPreviewModal
        isOpen={isFoundPreviewOpen}
        photos={foundMatches}
        initialIndex={foundPreviewIndex}
        onClose={() => setIsFoundPreviewOpen(false)}
      />
    </div>
  );
}
