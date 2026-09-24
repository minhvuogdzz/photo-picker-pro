import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  X,
  Search,
  Grid3X3,
  Grid2X2,
  Maximize2,
  Minimize2,
  FolderOpen,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Sparkles,
  Loader2,
  ZoomIn,
  PanelRight,
  LayoutGrid,
  Star,
  StarOff,
  FolderOutput,
  Check,
  Copy,
  Send,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import type { PhotoFile } from "@/core/types";
import { photoPreviewService } from "../services/photoPreviewService";
import { getFolderName } from "@/core/lib/utils";
import { useAppStore } from "@/core/stores/useAppStore";
import { open } from "@tauri-apps/plugin-dialog";

interface FolderPreviewModalProps {
  isOpen: boolean;
  folderPath: string | null;
  onClose: () => void;
}

const RAW_EXTS = new Set([
  "cr2", "cr3", "arw", "nef", "orf", "rw2", "dng", "raf",
  "pef", "srw", "x3f", "3fr", "mef", "erf", "nrw", "rwl", "mrw"
]);

function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function FolderPreviewModal({
  isOpen,
  folderPath,
  onClose,
}: FolderPreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const setRawCodeInput = useAppStore((s) => s.setRawCodeInput);

  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & display options
  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<"all" | "raw" | "jpg">("all");
  const [ratingFilter, setRatingFilter] = useState<number | "all" | "rated" | "unrated">("all");
  const [gridSize, setGridSize] = useState<"sm" | "md" | "lg">("md");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "grid">("split");

  // Ratings State: Record<full_path, 1..5>
  const [ratings, setRatings] = useState<Record<string, number>>({});

  // Thumbnails state
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const requestedPathsRef = useRef<Set<string>>(new Set());

  // Active & Hovered Photo State
  const [hoveredPhoto, setHoveredPhoto] = useState<PhotoFile | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoFile | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{
    x: number;
    y: number;
    placeLeft: boolean;
  } | null>(null);
  const [highResThumb, setHighResThumb] = useState<string | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isKeyboardNavRef = useRef(false);

  // Full Lightbox View
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxHighRes, setLightboxHighRes] = useState<string | null>(null);
  const [isLightboxLoading, setIsLightboxLoading] = useState(false);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportRateTarget, setExportRateTarget] = useState<number | "all_rated">(1);
  const [exportDestFolder, setExportDestFolder] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Load photos & ratings when folderPath changes
  useEffect(() => {
    if (!isOpen || !folderPath) {
      setPhotos([]);
      setThumbnails({});
      requestedPathsRef.current.clear();
      setHoveredPhoto(null);
      setSelectedPhoto(null);
      setLightboxIndex(null);
      setIsExportModalOpen(false);
      return;
    }

    // Load saved ratings from localStorage
    try {
      const savedRatings = localStorage.getItem(`mvd_ratings_${folderPath}`);
      if (savedRatings) {
        setRatings(JSON.parse(savedRatings));
      } else {
        setRatings({});
      }
    } catch {
      setRatings({});
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);
    setSearchQuery("");
    setFormatFilter("all");
    setRatingFilter("all");
    setExportDestFolder("");

    photoPreviewService
      .listFolderPhotos(folderPath, false)
      .then((items) => {
        if (!isMounted) return;
        setPhotos(items);
        if (items.length > 0) {
          setSelectedPhoto(items[0]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(err?.toString() || "Không thể quét ảnh trong thư mục.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, folderPath]);

  // Save ratings to localStorage
  const handleSetRating = useCallback((photoPath: string, newRate: number) => {
    setRatings((prev) => {
      const current = prev[photoPath] || 0;
      const updated = { ...prev };
      if (current === newRate || newRate === 0) {
        delete updated[photoPath];
      } else {
        updated[photoPath] = newRate;
      }
      if (folderPath) {
        try {
          localStorage.setItem(`mvd_ratings_${folderPath}`, JSON.stringify(updated));
        } catch {
          // fallback
        }
      }
      return updated;
    });
  }, [folderPath]);

  // Statistics
  const stats = useMemo(() => {
    let rawCount = 0;
    let jpgCount = 0;
    let otherCount = 0;
    let totalSize = 0;

    const rateCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRated = 0;

    for (const p of photos) {
      totalSize += p.size;
      const ext = p.extension.toLowerCase();
      if (RAW_EXTS.has(ext)) {
        rawCount++;
      } else if (ext === "jpg" || ext === "jpeg") {
        jpgCount++;
      } else {
        otherCount++;
      }

      const r = ratings[p.full_path];
      if (r && r >= 1 && r <= 5) {
        rateCounts[r] = (rateCounts[r] || 0) + 1;
        totalRated++;
      }
    }

    return {
      total: photos.length,
      rawCount,
      jpgCount,
      otherCount,
      totalSizeFormatted: formatBytes(totalSize),
      rateCounts,
      totalRated,
      unratedCount: photos.length - totalRated,
    };
  }, [photos, ratings]);

  // Filtered photos based on Format, Rating, Search
  const filteredPhotos = useMemo(() => {
    let result = photos;

    // 1. Format Filter
    if (formatFilter === "raw") {
      result = result.filter((p) => RAW_EXTS.has(p.extension.toLowerCase()));
    } else if (formatFilter === "jpg") {
      result = result.filter((p) => {
        const ext = p.extension.toLowerCase();
        return ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp";
      });
    }

    // 2. Rating Filter
    if (typeof ratingFilter === "number") {
      result = result.filter((p) => ratings[p.full_path] === ratingFilter);
    } else if (ratingFilter === "rated") {
      result = result.filter((p) => (ratings[p.full_path] || 0) > 0);
    } else if (ratingFilter === "unrated") {
      result = result.filter((p) => !ratings[p.full_path]);
    }

    // 3. Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) =>
        p.filename.toLowerCase().includes(q) ||
        p.normalized_number.toLowerCase().includes(q)
      );
    }

    return result;
  }, [photos, formatFilter, ratingFilter, searchQuery, ratings]);

  // Active photo for the Side Panel (or hovered)
  const activeSidePhoto = useMemo(() => {
    if (hoveredPhoto) return hoveredPhoto;
    if (selectedPhoto && filteredPhotos.some((p) => p.full_path === selectedPhoto.full_path)) {
      return selectedPhoto;
    }
    return filteredPhotos.length > 0 ? filteredPhotos[0] : null;
  }, [hoveredPhoto, selectedPhoto, filteredPhotos]);

  // Fetch High-Res for Active Photo
  useEffect(() => {
    if (!activeSidePhoto) {
      setHighResThumb(null);
      return;
    }

    let isMounted = true;
    photoPreviewService
      .getThumbnail(activeSidePhoto.full_path, 800)
      .then((dataUrl) => {
        if (isMounted) setHighResThumb(dataUrl);
      })
      .catch(() => {
        if (isMounted) setHighResThumb(null);
      });

    return () => {
      isMounted = false;
    };
  }, [activeSidePhoto]);

  // Batch loader for visible items
  const loadBatchThumbnails = useCallback((pathsToLoad: string[]) => {
    const needed = pathsToLoad.filter((p) => !requestedPathsRef.current.has(p));
    if (needed.length === 0) return;

    for (const p of needed) {
      requestedPathsRef.current.add(p);
    }

    photoPreviewService.getThumbnailsBatch(needed, 340).then((newThumbs) => {
      setThumbnails((prev) => ({ ...prev, ...newThumbs }));
    });
  }, []);

  // When filtered photos change or scroll, load current batch
  useEffect(() => {
    if (filteredPhotos.length === 0) return;
    const initialBatch = filteredPhotos.slice(0, 48).map((p) => p.full_path);
    loadBatchThumbnails(initialBatch);
  }, [filteredPhotos, loadBatchThumbnails]);

  // Scroll handler to load more thumbnails as user scrolls
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const clientHeight = el.clientHeight;

    const itemHeight = gridSize === "sm" ? 140 : gridSize === "md" ? 190 : 260;
    const itemWidth = gridSize === "sm" ? 130 : gridSize === "md" ? 180 : 250;
    const itemsPerRow = Math.max(1, Math.floor(el.clientWidth / itemWidth));

    const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
    const endRow = Math.ceil((scrollTop + clientHeight) / itemHeight) + 3;

    const startIndex = Math.max(0, startRow * itemsPerRow);
    const endIndex = Math.min(filteredPhotos.length, endRow * itemsPerRow);

    const visiblePaths = filteredPhotos
      .slice(startIndex, endIndex)
      .map((p) => p.full_path);

    loadBatchThumbnails(visiblePaths);
  }, [filteredPhotos, gridSize, loadBatchThumbnails]);

  // Scroll selected card into view when changed via keyboard navigation
  useEffect(() => {
    if (!selectedPhoto || !isKeyboardNavRef.current) return;
    isKeyboardNavRef.current = false;
    const el = document.getElementById(`photo-card-${encodeURIComponent(selectedPhoto.full_path)}`);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedPhoto]);

  // Keyboard Shortcuts: Cmd/Ctrl + 1..5, 0 and Arrow navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea") {
        return;
      }

      // Check current active target photo
      const currentPhoto =
        lightboxIndex !== null && filteredPhotos[lightboxIndex]
          ? filteredPhotos[lightboxIndex]
          : activeSidePhoto;

      // 1. Rating shortcuts: Cmd+1..5, Ctrl+1..5, or single key 1..5, 0 to clear
      let targetRate: number | null = null;
      if (e.code === "Digit1" || e.code === "Numpad1" || e.key === "1") targetRate = 1;
      else if (e.code === "Digit2" || e.code === "Numpad2" || e.key === "2") targetRate = 2;
      else if (e.code === "Digit3" || e.code === "Numpad3" || e.key === "3") targetRate = 3;
      else if (e.code === "Digit4" || e.code === "Numpad4" || e.key === "4") targetRate = 4;
      else if (e.code === "Digit5" || e.code === "Numpad5" || e.key === "5") targetRate = 5;
      else if (e.code === "Digit0" || e.code === "Numpad0" || e.key === "0") targetRate = 0;

      if (targetRate !== null && currentPhoto) {
        e.preventDefault();
        handleSetRating(currentPhoto.full_path, targetRate);
        return;
      }

      // 2. Lightbox navigation with arrows
      if (lightboxIndex !== null) {
        if (e.key === "Escape") {
          setLightboxIndex(null);
        } else if (e.key === "ArrowLeft") {
          setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
        } else if (e.key === "ArrowRight") {
          setLightboxIndex((prev) =>
            prev !== null && prev < filteredPhotos.length - 1 ? prev + 1 : prev
          );
        }
        return;
      }

      // 3. Grid navigation with arrow keys (when not in Lightbox)
      if (filteredPhotos.length > 0) {
        let curIdx = selectedPhoto
          ? filteredPhotos.findIndex((p) => p.full_path === selectedPhoto.full_path)
          : -1;
        if (curIdx === -1) curIdx = 0;

        if (e.key === "ArrowRight" && curIdx < filteredPhotos.length - 1) {
          e.preventDefault();
          isKeyboardNavRef.current = true;
          setSelectedPhoto(filteredPhotos[curIdx + 1]);
        } else if (e.key === "ArrowLeft" && curIdx > 0) {
          e.preventDefault();
          isKeyboardNavRef.current = true;
          setSelectedPhoto(filteredPhotos[curIdx - 1]);
        } else if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setLightboxIndex(curIdx);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, lightboxIndex, filteredPhotos, activeSidePhoto, selectedPhoto, handleSetRating]);

  // Handle Hover over Photo Card (strictly clamped inside modal)
  const handleMouseEnterCard = (
    e: React.MouseEvent<HTMLDivElement>,
    photo: PhotoFile
  ) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

    const cardRect = e.currentTarget.getBoundingClientRect();
    const modalEl = modalRef.current;

    if (modalEl) {
      const modalRect = modalEl.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const modalCenterX = modalRect.left + modalRect.width / 2;
      const placeLeft = cardCenterX > modalCenterX;

      let x: number;
      if (placeLeft) {
        x = cardRect.left - 12;
      } else {
        x = cardRect.right + 12;
      }

      let y = cardRect.top + cardRect.height / 2;
      const minY = modalRect.top + 200;
      const maxY = modalRect.bottom - 200;
      y = Math.max(minY, Math.min(y, maxY));

      hoverTimerRef.current = setTimeout(() => {
        setHoveredPhoto(photo);
        setHoverPosition({ x, y, placeLeft });
      }, 50);
    } else {
      setHoveredPhoto(photo);
    }
  };

  const handleMouseLeaveCard = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoveredPhoto(null);
      setHoverPosition(null);
    }, 50);
  };

  // Load high-res when lightbox changes
  useEffect(() => {
    if (lightboxIndex === null || !filteredPhotos[lightboxIndex]) {
      setLightboxHighRes(null);
      return;
    }

    const currentPhoto = filteredPhotos[lightboxIndex];
    setIsLightboxLoading(true);
    setLightboxHighRes(null);

    photoPreviewService
      .getThumbnail(currentPhoto.full_path, 1400)
      .then((dataUrl) => {
        setLightboxHighRes(dataUrl);
      })
      .catch(() => {
        setLightboxHighRes(thumbnails[currentPhoto.full_path] || null);
      })
      .finally(() => {
        setIsLightboxLoading(false);
      });
  }, [lightboxIndex, filteredPhotos, thumbnails]);

  // Browse destination folder for Export
  const handleBrowseExportDest = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Chọn thư mục xuất ảnh đã lọc",
        defaultPath: folderPath || undefined,
      });
      if (selected && typeof selected === "string") {
        setExportDestFolder(selected);
      }
    } catch (e) {
      console.error("Browse failed:", e);
    }
  };

  // Start Exporting Rated Files
  const handleExecuteExport = async () => {
    // Collect file paths based on exportRateTarget
    let targetPhotos: PhotoFile[] = [];
    if (typeof exportRateTarget === "number") {
      targetPhotos = photos.filter((p) => ratings[p.full_path] === exportRateTarget);
    } else {
      targetPhotos = photos.filter((p) => (ratings[p.full_path] || 0) > 0);
    }

    if (targetPhotos.length === 0) {
      setExportMessage({ type: "error", text: "Không có bức ảnh nào trong nhóm đã chọn để xuất." });
      return;
    }

    let finalDest = exportDestFolder.trim();
    if (!finalDest && folderPath) {
      // Default subfolder: <folderPath>/Rate_<target>
      finalDest = typeof exportRateTarget === "number"
        ? `${folderPath}/Rate_${exportRateTarget}`
        : `${folderPath}/Export_Rated`;
    }

    if (!finalDest) {
      setExportMessage({ type: "error", text: "Vui lòng chọn thư mục đích để lưu ảnh." });
      return;
    }

    setIsExporting(true);
    setExportMessage(null);

    try {
      const filePaths = targetPhotos.map((p) => p.full_path);
      const res = await photoPreviewService.copyPhotos(filePaths, finalDest);
      if (res.success_count > 0) {
        setExportMessage({
          type: "success",
          text: `Đã xuất thành công ${res.success_count} ảnh vào: ${finalDest}`,
        });
      } else {
        setExportMessage({
          type: "error",
          text: `Không xuất được file nào. Lỗi: ${res.errors.join("; ")}`,
        });
      }
    } catch (err: any) {
      setExportMessage({
        type: "error",
        text: `Lỗi khi xuất ảnh: ${err?.message || err}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Push rated codes to main picker textarea
  const handleSendCodesToMainPicker = (targetRate: number | "all") => {
    let targetPhotos: PhotoFile[] = [];
    if (typeof targetRate === "number") {
      targetPhotos = photos.filter((p) => ratings[p.full_path] === targetRate);
    } else {
      targetPhotos = photos.filter((p) => (ratings[p.full_path] || 0) > 0);
    }

    if (targetPhotos.length === 0) return;

    const codes = targetPhotos.map((p) => p.normalized_number || p.filename);
    setRawCodeInput(codes.join("\n"));
    onClose();
  };

  // Copy filenames to clipboard
  const handleCopyFilenames = (targetRate: number | "all") => {
    let targetPhotos: PhotoFile[] = [];
    if (typeof targetRate === "number") {
      targetPhotos = photos.filter((p) => ratings[p.full_path] === targetRate);
    } else {
      targetPhotos = photos.filter((p) => (ratings[p.full_path] || 0) > 0);
    }

    if (targetPhotos.length === 0) return;

    const list = targetPhotos.map((p) => p.filename).join("\n");
    navigator.clipboard.writeText(list);
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  if (!isOpen || !folderPath) return null;

  const currentFolderTitle = getFolderName(folderPath);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div
        ref={modalRef}
        className={`bg-card text-card-foreground border border-border/60 shadow-2xl flex flex-col transition-all duration-300 overflow-hidden relative ${
          isFullscreen
            ? "fixed inset-0 rounded-none w-full h-full"
            : "w-[96vw] max-w-[1520px] h-[93vh] rounded-2xl"
        }`}
      >
        {/* ================= HEADER ================= */}
        <div className="px-5 py-2.5 border-b border-border/40 bg-muted/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left: Folder info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0 shadow-2xs">
              <FolderOpen size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-bold text-foreground truncate" title={currentFolderTitle}>
                  {currentFolderTitle}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0 font-semibold">
                  {stats.total.toLocaleString()} ảnh
                </span>
                {stats.totalRated > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0 flex items-center gap-1">
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    <span>Đã lọc {stats.totalRated} ảnh</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate max-w-xs xl:max-w-md mt-0.5" title={folderPath}>
                {folderPath}
              </p>
            </div>
          </div>

          {/* Center: Search & Format Filter */}
          <div className="flex items-center gap-2 flex-1 justify-center max-w-md min-w-[180px]">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Tìm tên hoặc mã số..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/60"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Format Filter */}
            <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/40 text-[11px] font-medium shrink-0">
              <button
                type="button"
                onClick={() => setFormatFilter("all")}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                  formatFilter === "all"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tất cả ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFormatFilter("raw")}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  formatFilter === "raw"
                    ? "bg-card text-purple-600 dark:text-purple-400 font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>RAW ({stats.rawCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFormatFilter("jpg")}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  formatFilter === "jpg"
                    ? "bg-card text-emerald-600 dark:text-emerald-400 font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>JPG ({stats.jpgCount})</span>
              </button>
            </div>
          </div>

          {/* Right: Controls & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Export Rated Photos Button */}
            <button
              type="button"
              onClick={() => {
                setExportDestFolder(folderPath ? `${folderPath}/Rate_1` : "");
                setIsExportModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/35 hover:border-amber-500/60 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Xuất bộ ảnh đã đánh giá theo Rate 1, 2, 3, 4, 5"
            >
              <FolderOutput size={14} className="text-amber-600 dark:text-amber-400" />
              <span>Xuất ảnh đã lọc</span>
              {stats.totalRated > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold font-mono">
                  {stats.totalRated}
                </span>
              )}
            </button>

            {/* Split View Toggle */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "split" ? "grid" : "split")}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "split"
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border/50"
              }`}
              title={viewMode === "split" ? "Chuyển sang chỉ xem dạng lưới" : "Mở khung xem ảnh chi tiết cố định bên phải"}
            >
              {viewMode === "split" ? <PanelRight size={14} /> : <LayoutGrid size={14} />}
              <span className="hidden sm:inline">
                {viewMode === "split" ? "Khung chi tiết" : "Lưới full"}
              </span>
            </button>

            {/* Grid Size Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/40 text-muted-foreground">
              <button
                type="button"
                onClick={() => setGridSize("sm")}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  gridSize === "sm" ? "bg-card text-foreground shadow-2xs" : "hover:text-foreground"
                }`}
                title="Lưới nhỏ"
              >
                <Grid3X3 size={13} />
              </button>
              <button
                type="button"
                onClick={() => setGridSize("md")}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  gridSize === "md" ? "bg-card text-foreground shadow-2xs" : "hover:text-foreground"
                }`}
                title="Lưới vừa"
              >
                <Grid2X2 size={13} />
              </button>
              <button
                type="button"
                onClick={() => setGridSize("lg")}
                className={`p-1 rounded-md transition-all cursor-pointer ${
                  gridSize === "lg" ? "bg-card text-foreground shadow-2xs" : "hover:text-foreground"
                }`}
                title="Lưới lớn"
              >
                <Layers size={13} />
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg border border-border/50 bg-background/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title={isFullscreen ? "Thu nhỏ lại" : "Mở rộng toàn màn hình"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-border/50 bg-background/60 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
              title="Đóng cửa sổ xem ảnh (ESC)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ================= 5-STAR RATING FILTER BAR (Adobe Bridge Style) ================= */}
        <div className="px-5 py-1.5 bg-card border-b border-border/40 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
          {/* Rate Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
              <Star size={12} className="text-amber-500 fill-amber-500" />
              <span>Bộ Rate:</span>
            </span>

            {/* All */}
            <button
              type="button"
              onClick={() => setRatingFilter("all")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                ratingFilter === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40"
              }`}
            >
              Tất cả ({stats.total})
            </button>

            {/* Star 1 to 5 buttons */}
            {[1, 2, 3, 4, 5].map((starNum) => {
              const count = stats.rateCounts[starNum] || 0;
              const isActive = ratingFilter === starNum;

              return (
                <button
                  key={starNum}
                  type="button"
                  onClick={() => setRatingFilter(isActive ? "all" : starNum)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 border ${
                    isActive
                      ? "bg-amber-500 text-white border-amber-600 shadow-2xs"
                      : count > 0
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                      : "bg-muted/30 text-muted-foreground/70 border-border/40 hover:text-foreground"
                  }`}
                  title={`Lọc ảnh Rate ${starNum} (Phím tắt: Cmd+${starNum} hoặc phím ${starNum})`}
                >
                  <span className="flex items-center">
                    {Array.from({ length: starNum }).map((_, i) => (
                      <Star
                        key={i}
                        size={10}
                        className={isActive ? "fill-white text-white" : "fill-amber-400 text-amber-400"}
                      />
                    ))}
                  </span>
                  <span className="font-mono text-[10px]">({count})</span>
                </button>
              );
            })}

            {/* Any Rated */}
            <button
              type="button"
              onClick={() => setRatingFilter(ratingFilter === "rated" ? "all" : "rated")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer border ${
                ratingFilter === "rated"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/40"
              }`}
              title="Xem tất cả ảnh đã được gắn sao từ 1 đến 5"
            >
              Đã đánh dấu ({stats.totalRated})
            </button>

            {/* Unrated */}
            <button
              type="button"
              onClick={() => setRatingFilter(ratingFilter === "unrated" ? "all" : "unrated")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer border ${
                ratingFilter === "unrated"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/40"
              }`}
              title="Xem các ảnh chưa được gắn sao"
            >
              Chưa đánh dấu ({stats.unratedCount})
            </button>
          </div>

          {/* Keyboard Shortcut Reminder */}
          <div className="hidden xl:flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <span className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/50">
              Cmd / Ctrl + 1..5
            </span>
            <span>đánh dấu sao</span>
            <span className="text-border">·</span>
            <span className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/50">
              0
            </span>
            <span>huỷ sao</span>
            <span className="text-border">·</span>
            <span className="px-1.5 py-0.5 rounded bg-muted/60 border border-border/50">
              ← →
            </span>
            <span>chuyển ảnh</span>
          </div>
        </div>

        {/* ================= MAIN CONTENT AREA ================= */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* LEFT: Scrollable Photo Grid */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 md:p-5"
            style={{ scrollbarWidth: "thin" }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-20 text-muted-foreground">
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm font-medium">Đang quét và bóc tách danh sách ảnh trong thư mục...</p>
              </div>
            ) : errorMsg ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-20 text-red-500">
                <p className="text-sm font-medium">{errorMsg}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground hover:bg-muted"
                >
                  Đóng
                </button>
              </div>
            ) : filteredPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 py-20 text-muted-foreground">
                <ImageIcon size={36} className="opacity-30 mb-1" />
                <p className="text-sm font-medium">Không tìm thấy ảnh nào phù hợp.</p>
                {searchQuery || ratingFilter !== "all" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setRatingFilter("all");
                    }}
                    className="text-xs text-primary hover:underline mt-1 cursor-pointer"
                  >
                    Bỏ tất cả bộ lọc để xem lại toàn bộ ảnh
                  </button>
                ) : null}
              </div>
            ) : (
              <div
                className={`grid gap-3.5 ${
                  viewMode === "split"
                    ? gridSize === "sm"
                      ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"
                      : gridSize === "md"
                      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                      : "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                    : gridSize === "sm"
                    ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
                    : gridSize === "md"
                    ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8"
                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                }`}
              >
                {filteredPhotos.map((photo, idx) => {
                  const thumb = thumbnails[photo.full_path];
                  const isRaw = RAW_EXTS.has(photo.extension.toLowerCase());
                  const isHovered = hoveredPhoto?.full_path === photo.full_path;
                  const isSelected = selectedPhoto?.full_path === photo.full_path;
                  const photoRate = ratings[photo.full_path] || 0;

                  return (
                    <div
                      key={photo.full_path}
                      id={`photo-card-${encodeURIComponent(photo.full_path)}`}
                      onClick={() => {
                        setSelectedPhoto(photo);
                        if (viewMode === "grid") {
                          setLightboxIndex(idx);
                        }
                      }}
                      onDoubleClick={() => {
                        setSelectedPhoto(photo);
                        setLightboxIndex(idx);
                      }}
                      onMouseEnter={(e) => {
                        setSelectedPhoto(photo);
                        if (viewMode === "grid") {
                          handleMouseEnterCard(e, photo);
                        } else {
                          setHoveredPhoto(photo);
                        }
                      }}
                      onMouseLeave={() => {
                        if (viewMode === "grid") {
                          handleMouseLeaveCard();
                        } else {
                          setHoveredPhoto(null);
                        }
                      }}
                      className={`group relative flex flex-col rounded-xl overflow-hidden border bg-background/70 transition-all duration-150 cursor-pointer ${
                        isSelected || isHovered
                          ? "border-primary ring-2 ring-primary/50 shadow-md scale-[1.02] z-10"
                          : photoRate > 0
                          ? "border-amber-500/40 bg-amber-500/5 shadow-2xs"
                          : "border-border/40 hover:border-border/80 hover:shadow-sm"
                      }`}
                    >
                      {/* Image Frame */}
                      <div
                        className={`relative w-full overflow-hidden bg-muted/20 flex items-center justify-center ${
                          gridSize === "sm" ? "aspect-square" : "aspect-[4/3]"
                        }`}
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={photo.filename}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30 animate-pulse bg-muted/10">
                            <ImageIcon size={20} className="mb-1" />
                            <span className="text-[9px] font-mono uppercase tracking-wider">
                              {photo.extension}
                            </span>
                          </div>
                        )}

                        {/* Top-Left: Star Rating Badge (If Rated) */}
                        {photoRate > 0 && (
                          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/80 text-amber-300 border border-amber-500/50 shadow-md backdrop-blur-xs select-none">
                            <Star size={10} className="fill-amber-400 text-amber-400" />
                            <span className="text-[10px] font-bold font-mono">{photoRate}</span>
                          </div>
                        )}

                        {/* Top-Right: Format Badge */}
                        <span
                          className={`absolute top-1.5 right-1.5 text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded shadow-xs tracking-wider border select-none ${
                            isRaw
                              ? "bg-purple-950/85 text-purple-300 border-purple-500/40 backdrop-blur-xs"
                              : "bg-emerald-950/85 text-emerald-300 border-emerald-500/40 backdrop-blur-xs"
                          }`}
                        >
                          {photo.extension}
                        </span>

                        {/* Zoom icon on hover */}
                        <div className="absolute inset-0 bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhoto(photo);
                              setLightboxIndex(idx);
                            }}
                            className="pointer-events-auto p-2 rounded-full bg-black/75 text-white hover:bg-primary hover:text-primary-foreground backdrop-blur-xs shadow-lg transition-transform hover:scale-110 cursor-pointer border border-white/20"
                            title="Phóng to toàn màn hình (Double-click hoặc Space)"
                          >
                            <ZoomIn size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Info Bar with Quick Rate Buttons */}
                      <div className="p-1.5 px-2 bg-card/95 border-t border-border/30 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[11px] font-mono font-semibold text-foreground truncate group-hover:text-primary transition-colors flex-1"
                            title={photo.filename}
                          >
                            {photo.filename}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-mono ml-1">
                            {formatBytes(photo.size)}
                          </span>
                        </div>

                        {/* Interactive 5 Stars Quick Rating Bar */}
                        <div
                          className="flex items-center justify-between pt-0.5 border-t border-border/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((starIdx) => (
                              <button
                                key={starIdx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetRating(photo.full_path, starIdx);
                                }}
                                className="p-0.5 text-muted-foreground hover:scale-125 transition-transform cursor-pointer"
                                title={`Gắn Rate ${starIdx} (Cmd+${starIdx})`}
                              >
                                <Star
                                  size={11}
                                  className={
                                    starIdx <= photoRate
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground/40 hover:text-amber-400"
                                  }
                                />
                              </button>
                            ))}
                          </div>

                          <span className="font-mono text-[9px] text-muted-foreground/70">
                            #{photo.normalized_number || "---"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: DEDICATED LIVE PREVIEW PANEL (Adobe Bridge / Lightroom Style) */}
          {viewMode === "split" && (
            <div className="w-[380px] xl:w-[440px] shrink-0 border-l border-border/40 bg-card/40 backdrop-blur-md flex flex-col p-4 gap-3 overflow-y-auto animate-fade-in">
              {activeSidePhoto ? (
                <>
                  {/* Photo Title & Badge */}
                  <div className="flex items-start justify-between gap-2 shrink-0">
                    <div className="min-w-0">
                      <span
                        className="font-mono text-xs xl:text-sm font-bold text-foreground truncate block"
                        title={activeSidePhoto.filename}
                      >
                        {activeSidePhoto.filename}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Mã: #{activeSidePhoto.normalized_number || "---"} · {formatBytes(activeSidePhoto.size)}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                        RAW_EXTS.has(activeSidePhoto.extension.toLowerCase())
                          ? "bg-purple-900/40 text-purple-600 dark:text-purple-300 border-purple-500/40"
                          : "bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 border-emerald-500/40"
                      }`}
                    >
                      {activeSidePhoto.extension}
                    </span>
                  </div>

                  {/* Main Large Preview Frame */}
                  <div
                    onClick={() => {
                      const idx = filteredPhotos.findIndex((p) => p.full_path === activeSidePhoto.full_path);
                      if (idx !== -1) setLightboxIndex(idx);
                    }}
                    className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/80 flex items-center justify-center border border-border/50 shadow-inner group cursor-pointer shrink-0"
                    title="Bấm để xem toàn màn hình (Phím Space hoặc Click)"
                  >
                    {/* Blurred ambient backdrop */}
                    {(highResThumb || thumbnails[activeSidePhoto.full_path]) && (
                      <img
                        src={highResThumb || thumbnails[activeSidePhoto.full_path]}
                        alt="bg-ambient"
                        className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110"
                      />
                    )}

                    {/* Sharp Image */}
                    {highResThumb || thumbnails[activeSidePhoto.full_path] ? (
                      <img
                        src={highResThumb || thumbnails[activeSidePhoto.full_path]}
                        alt={activeSidePhoto.filename}
                        className="relative z-10 max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-102"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                        <Loader2 size={24} className="animate-spin text-primary" />
                        <span className="text-xs">Đang tải ảnh HD...</span>
                      </div>
                    )}

                    {/* Top-Left Rating overlay on preview */}
                    {(ratings[activeSidePhoto.full_path] || 0) > 0 && (
                      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/80 text-amber-300 border border-amber-500/50 shadow-lg backdrop-blur-md">
                        <Star size={13} className="fill-amber-400 text-amber-400" />
                        <span className="text-xs font-bold font-mono">
                          Rate {ratings[activeSidePhoto.full_path]}
                        </span>
                      </div>
                    )}

                    {/* Zoom Icon Overlay */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                      <span className="px-3 py-1.5 rounded-full bg-black/70 text-white backdrop-blur-md text-xs font-medium flex items-center gap-1.5 shadow-lg">
                        <ZoomIn size={13} />
                        <span>Xem toàn màn hình</span>
                      </span>
                    </div>
                  </div>

                  {/* 5-STAR RATING SELECTOR (Interactive) */}
                  <div className="p-3 rounded-xl bg-background/60 border border-border/50 flex flex-col gap-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Star size={13} className="fill-amber-400 text-amber-400" />
                        <span>Đánh giá ảnh (1 – 5 Star):</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {(ratings[activeSidePhoto.full_path] || 0) > 0
                          ? `Đang là Rate ${ratings[activeSidePhoto.full_path]}`
                          : "Chưa đánh dấu"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border border-border/40">
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((starIdx) => {
                          const isFilled = starIdx <= (ratings[activeSidePhoto.full_path] || 0);
                          return (
                            <button
                              key={starIdx}
                              type="button"
                              onClick={() => handleSetRating(activeSidePhoto.full_path, starIdx)}
                              className="p-1 rounded-md hover:bg-amber-500/15 hover:scale-115 transition-all cursor-pointer group"
                              title={`Chọn Rate ${starIdx} (Phím: ${starIdx} hoặc Cmd+${starIdx})`}
                            >
                              <Star
                                size={18}
                                className={
                                  isFilled
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/40 group-hover:text-amber-400"
                                }
                              />
                            </button>
                          );
                        })}
                      </div>

                      {(ratings[activeSidePhoto.full_path] || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSetRating(activeSidePhoto.full_path, 0)}
                          className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-destructive/10 transition-colors cursor-pointer"
                          title="Xoá đánh giá (Phím 0)"
                        >
                          <StarOff size={11} />
                          <span>Bỏ chọn</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Details Card */}
                  <div className="flex-1 rounded-xl bg-background/50 border border-border/40 p-3 flex flex-col gap-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-border/30">
                      <span className="text-muted-foreground text-[11px]">Định dạng:</span>
                      <span className="font-mono font-semibold text-foreground uppercase">
                        {activeSidePhoto.extension} {RAW_EXTS.has(activeSidePhoto.extension.toLowerCase()) ? "(Camera RAW)" : ""}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-border/30">
                      <span className="text-muted-foreground text-[11px]">Dung lượng gốc:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {formatBytes(activeSidePhoto.size)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 py-1">
                      <span className="text-muted-foreground text-[11px]">Đường dẫn file:</span>
                      <span
                        className="font-mono text-[10px] text-foreground/80 break-all bg-muted/40 p-1.5 rounded border border-border/30 select-text"
                        title={activeSidePhoto.full_path}
                      >
                        {activeSidePhoto.full_path}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const idx = filteredPhotos.findIndex((p) => p.full_path === activeSidePhoto.full_path);
                        if (idx !== -1) setLightboxIndex(idx);
                      }}
                      className="mt-auto w-full py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <ZoomIn size={14} />
                      <span>Phóng to toàn màn hình</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <ImageIcon size={32} className="opacity-40" />
                  <span className="text-xs">Rê chuột vào ảnh để xem chi tiết</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= FLOATING HOVER PREVIEW (Only active in 'grid' viewMode) ================= */}
        {viewMode === "grid" && hoveredPhoto && hoverPosition && (
          <div
            className="fixed z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: hoverPosition.placeLeft ? undefined : `${hoverPosition.x}px`,
              right: hoverPosition.placeLeft
                ? `${window.innerWidth - hoverPosition.x}px`
                : undefined,
              top: `${hoverPosition.y}px`,
              transform: "translateY(-50%)",
              maxWidth: "min(400px, 32vw)",
            }}
          >
            <div className="rounded-2xl overflow-hidden bg-card/95 text-card-foreground border border-primary/50 shadow-2xl backdrop-blur-xl p-3 flex flex-col gap-2.5">
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/85 flex items-center justify-center border border-border/40 shadow-inner">
                {(highResThumb || thumbnails[hoveredPhoto.full_path]) && (
                  <img
                    src={highResThumb || thumbnails[hoveredPhoto.full_path]}
                    alt="blur-bg"
                    className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-110"
                  />
                )}

                {highResThumb || thumbnails[hoveredPhoto.full_path] ? (
                  <img
                    src={highResThumb || thumbnails[hoveredPhoto.full_path]}
                    alt={hoveredPhoto.filename}
                    className="relative z-10 max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-1">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <span className="text-[11px]">Đang tạo preview...</span>
                  </div>
                )}

                <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md shadow-md border ${
                      RAW_EXTS.has(hoveredPhoto.extension.toLowerCase())
                        ? "bg-purple-900/90 text-purple-200 border-purple-400/50"
                        : "bg-emerald-900/90 text-emerald-200 border-emerald-400/50"
                    }`}
                  >
                    {hoveredPhoto.extension}
                  </span>
                  {(ratings[hoveredPhoto.full_path] || 0) > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-black flex items-center gap-0.5">
                      <Star size={9} className="fill-black" />
                      <span>Rate {ratings[hoveredPhoto.full_path]}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 px-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-foreground truncate max-w-[260px]">
                    {hoveredPhoto.filename}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground font-semibold">
                    {formatBytes(hoveredPhoto.size)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-mono">Mã số: #{hoveredPhoto.normalized_number || "---"}</span>
                  <span className="text-border">·</span>
                  <span className="truncate max-w-[220px]" title={hoveredPhoto.full_path}>
                    {hoveredPhoto.folder}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= FULLSCREEN LIGHTBOX WITH 5-STAR RATING ================= */}
        {lightboxIndex !== null && filteredPhotos[lightboxIndex] && (
          <div className="fixed inset-0 z-60 bg-black/95 backdrop-blur-xl flex flex-col animate-fade-in select-none">
            {/* Lightbox Header */}
            <div className="p-4 px-6 flex items-center justify-between border-b border-white/10 shrink-0 text-white">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-white">
                  {filteredPhotos[lightboxIndex].filename}
                </span>
                <span className="text-xs text-white/60 font-mono">
                  ({lightboxIndex + 1} / {filteredPhotos.length})
                </span>
                <span
                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                    RAW_EXTS.has(filteredPhotos[lightboxIndex].extension.toLowerCase())
                      ? "bg-purple-900/80 text-purple-200 border-purple-400/50"
                      : "bg-emerald-900/80 text-emerald-200 border-emerald-400/50"
                  }`}
                >
                  {filteredPhotos[lightboxIndex].extension}
                </span>
              </div>

              {/* Lightbox Top Star Rating Bar */}
              <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-xl border border-white/15">
                {[1, 2, 3, 4, 5].map((starIdx) => {
                  const currentRate = ratings[filteredPhotos[lightboxIndex].full_path] || 0;
                  const isFilled = starIdx <= currentRate;
                  return (
                    <button
                      key={starIdx}
                      type="button"
                      onClick={() => handleSetRating(filteredPhotos[lightboxIndex].full_path, starIdx)}
                      className="p-1 hover:scale-125 transition-transform cursor-pointer"
                      title={`Đánh giá Rate ${starIdx} (Phím tắt: ${starIdx})`}
                    >
                      <Star
                        size={16}
                        className={isFilled ? "fill-amber-400 text-amber-400" : "text-white/40 hover:text-amber-400"}
                      />
                    </button>
                  );
                })}
                {(ratings[filteredPhotos[lightboxIndex].full_path] || 0) > 0 && (
                  <span className="text-xs font-mono font-bold text-amber-400 ml-1">
                    Rate {ratings[filteredPhotos[lightboxIndex].full_path]}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-white/60 font-mono">
                  {formatBytes(filteredPhotos[lightboxIndex].size)}
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxIndex(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                  title="Đóng (ESC)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Lightbox Main Image Display */}
            <div className="flex-1 relative flex items-center justify-center p-4 min-h-0">
              {lightboxIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setLightboxIndex(lightboxIndex - 1)}
                  className="absolute left-6 z-20 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer backdrop-blur-md"
                  title="Ảnh trước (Mũi tên trái)"
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              {lightboxIndex < filteredPhotos.length - 1 && (
                <button
                  type="button"
                  onClick={() => setLightboxIndex(lightboxIndex + 1)}
                  className="absolute right-6 z-20 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all cursor-pointer backdrop-blur-md"
                  title="Ảnh tiếp theo (Mũi tên phải)"
                >
                  <ChevronRight size={24} />
                </button>
              )}

              <div className="relative max-w-full max-h-full flex items-center justify-center">
                {isLightboxLoading && !lightboxHighRes && (
                  <div className="absolute inset-0 flex items-center justify-center text-white/70">
                    <Loader2 size={36} className="animate-spin text-primary" />
                  </div>
                )}
                {lightboxHighRes || thumbnails[filteredPhotos[lightboxIndex].full_path] ? (
                  <img
                    src={lightboxHighRes || thumbnails[filteredPhotos[lightboxIndex].full_path]}
                    alt={filteredPhotos[lightboxIndex].filename}
                    className="max-w-[92vw] max-h-[80vh] object-contain rounded-lg shadow-2xl transition-all"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-white/50 gap-2">
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <span className="text-xs">Đang tải ảnh HD...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Lightbox Footer Bar with Keyboard Helper */}
            <div className="p-3 px-6 bg-black/60 border-t border-white/10 flex items-center justify-between text-xs text-white/70">
              <span className="font-mono text-[11px] truncate max-w-md" title={filteredPhotos[lightboxIndex].full_path}>
                {filteredPhotos[lightboxIndex].full_path}
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span>Phím <strong>1..5</strong>: Đánh dấu sao</span>
                <span>·</span>
                <span>Phím <strong>← / →</strong>: Chuyển ảnh</span>
                <span>·</span>
                <span>Phím <strong>ESC</strong>: Đóng</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= EXPORT RATED PHOTOS MODAL ================= */}
        {isExportModalOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
            <div className="w-full max-w-lg rounded-2xl bg-card text-card-foreground border border-border/70 shadow-2xl p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <FolderOutput size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Xuất bộ ảnh đã lọc (Rate)</h3>
                    <p className="text-[11px] text-muted-foreground">Sao chép ảnh theo phân loại sao vào thư mục riêng</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Choose Which Rating to Export */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <span>Chọn nhóm ảnh muốn xuất:</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5].map((starNum) => {
                    const count = stats.rateCounts[starNum] || 0;
                    const isSelected = exportRateTarget === starNum;
                    return (
                      <button
                        key={starNum}
                        type="button"
                        onClick={() => {
                          setExportRateTarget(starNum);
                          if (folderPath) {
                            setExportDestFolder(`${folderPath}/Rate_${starNum}`);
                          }
                        }}
                        className={`p-2 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-200 ring-2 ring-amber-500/30 font-semibold"
                            : count > 0
                            ? "bg-muted/40 hover:bg-muted border-border/50 text-foreground"
                            : "bg-muted/20 border-border/30 text-muted-foreground/60 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-1 text-xs">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          <span>Rate {starNum}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {count} ảnh
                        </span>
                      </button>
                    );
                  })}

                  {/* All Rated */}
                  <button
                    type="button"
                    onClick={() => {
                      setExportRateTarget("all_rated");
                      if (folderPath) {
                        setExportDestFolder(`${folderPath}/Export_Rated`);
                      }
                    }}
                    className={`p-2 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      exportRateTarget === "all_rated"
                        ? "bg-primary/15 border-primary text-primary ring-2 ring-primary/30 font-semibold"
                        : "bg-muted/40 hover:bg-muted border-border/50 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <span>Tất cả đã chọn</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {stats.totalRated} ảnh
                    </span>
                  </button>
                </div>
              </div>

              {/* Destination Folder Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Thư mục đích lưu ảnh xuất:</span>
                  <button
                    type="button"
                    onClick={handleBrowseExportDest}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-normal"
                  >
                    <span>Thay đổi thư mục...</span>
                  </button>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={exportDestFolder}
                    onChange={(e) => setExportDestFolder(e.target.value)}
                    placeholder="Chọn đường dẫn thư mục lưu ảnh..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-background border border-border/60 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseExportDest}
                    className="px-3 py-1.5 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted text-xs font-medium text-foreground cursor-pointer"
                  >
                    Duyệt...
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  💡 Thư mục sẽ tự động được tạo nếu chưa tồn tại. Không ghi đè ảnh gốc.
                </p>
              </div>

              {/* Status Message */}
              {exportMessage && (
                <div
                  className={`p-2.5 rounded-lg text-xs leading-relaxed border ${
                    exportMessage.type === "success"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                  }`}
                >
                  {exportMessage.text}
                </div>
              )}

              {/* Action Buttons & Secondary Tools */}
              <div className="pt-2 border-t border-border/40 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Copy Codes Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyFilenames(exportRateTarget === "all_rated" ? "all" : exportRateTarget)}
                      className="px-2.5 py-1.5 rounded-lg border border-border/60 bg-background hover:bg-muted text-[11px] text-foreground font-medium flex items-center gap-1.5 cursor-pointer"
                      title="Sao chép danh sách tên file vào clipboard"
                    >
                      {copiedCodes ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      <span>{copiedCodes ? "Đã sao chép!" : "Copy tên file"}</span>
                    </button>

                    {/* Send to Main Picker Button */}
                    <button
                      type="button"
                      onClick={() => handleSendCodesToMainPicker(exportRateTarget === "all_rated" ? "all" : exportRateTarget)}
                      className="px-2.5 py-1.5 rounded-lg border border-border/60 bg-background hover:bg-muted text-[11px] text-foreground font-medium flex items-center gap-1.5 cursor-pointer"
                      title="Chuyển toàn bộ mã ảnh này vào ô nhập mã của màn hình chính"
                    >
                      <Send size={12} className="text-primary" />
                      <span>Đưa vào ô lọc chính</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsExportModalOpen(false)}
                      className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs text-foreground font-medium cursor-pointer"
                    >
                      Đóng
                    </button>

                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={handleExecuteExport}
                      className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all disabled:opacity-50"
                    >
                      {isExporting ? <Loader2 size={13} className="animate-spin" /> : <FolderOutput size={13} />}
                      <span>{isExporting ? "Đang sao chép..." : "Bắt đầu xuất ảnh"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
