import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Copy,
  Check,
  CheckCircle,
  FolderOpen,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { MatchedPhoto } from "@/core/types";
import { photoPreviewService } from "../services/photoPreviewService";

interface FoundPhotosPreviewModalProps {
  readonly isOpen: boolean;
  readonly photos: readonly MatchedPhoto[];
  readonly initialIndex?: number;
  readonly onClose: () => void;
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

export function FoundPhotosPreviewModal({
  isOpen,
  photos,
  initialIndex = 0,
  onClose,
}: FoundPhotosPreviewModalProps) {
  // Filter only items with a valid photo file
  const validPhotos = useMemo(() => {
    return photos.filter((p) => p.photo !== null && p.photo.full_path);
  }, [photos]);

  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(0, initialIndex), Math.max(0, validPhotos.length - 1))
  );
  const [highResThumb, setHighResThumb] = useState<string | null>(null);
  const [isLoadingThumb, setIsLoadingThumb] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [copiedPath, setCopiedPath] = useState(false);
  const [isZoomFit, setIsZoomFit] = useState(true);

  const filmstripRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement>(null);

  // Sync initialIndex when modal opens
  useEffect(() => {
    if (isOpen) {
      const idx = Math.min(Math.max(0, initialIndex), Math.max(0, validPhotos.length - 1));
      setCurrentIndex(idx);
      setHighResThumb(null);
    }
  }, [isOpen, initialIndex, validPhotos.length]);

  const currentMatch = validPhotos[currentIndex] || null;
  const currentPhoto = currentMatch?.photo || null;

  // Batch load thumbnails for the filmstrip
  useEffect(() => {
    if (!isOpen || validPhotos.length === 0) return;

    const paths = validPhotos.map((p) => p.photo!.full_path);
    photoPreviewService.getThumbnailsBatch(paths, 120).then((batch) => {
      setThumbnails((prev) => ({ ...prev, ...batch }));
    }).catch((err) => {
      console.warn("[FoundPhotosPreviewModal] Batch thumbnails error:", err);
    });
  }, [isOpen, validPhotos]);

  // Load High-Res preview for active photo
  useEffect(() => {
    if (!isOpen || !currentPhoto) {
      setHighResThumb(null);
      setIsLoadingThumb(false);
      return;
    }

    let isMounted = true;
    setIsLoadingThumb(true);
    setHighResThumb(null);

    // Fetch high quality thumbnail (1600px)
    photoPreviewService
      .getThumbnail(currentPhoto.full_path, 1600)
      .then((dataUrl) => {
        if (isMounted) {
          setHighResThumb(dataUrl);
          setIsLoadingThumb(false);
        }
      })
      .catch((err) => {
        console.warn("[FoundPhotosPreviewModal] High-res thumbnail error:", err);
        if (isMounted) {
          // Fallback to smaller cached thumbnail if available
          setHighResThumb(thumbnails[currentPhoto.full_path] || null);
          setIsLoadingThumb(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentPhoto, thumbnails]);

  // Auto-scroll filmstrip to active item
  useEffect(() => {
    if (activeThumbRef.current && filmstripRef.current) {
      activeThumbRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex]);

  const handlePrev = useCallback(() => {
    if (validPhotos.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : validPhotos.length - 1));
  }, [validPhotos.length]);

  const handleNext = useCallback(() => {
    if (validPhotos.length <= 1) return;
    setCurrentIndex((prev) => (prev < validPhotos.length - 1 ? prev + 1 : 0));
  }, [validPhotos.length]);

  // Keyboard navigation: Left/Right arrows, ESC to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        setIsZoomFit((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  const handleCopyPath = () => {
    if (!currentPhoto?.full_path) return;
    navigator.clipboard.writeText(currentPhoto.full_path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  if (!isOpen || validPhotos.length === 0) return null;

  const isRaw = currentPhoto ? RAW_EXTS.has(currentPhoto.extension.toLowerCase()) : false;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/90 backdrop-blur-xl animate-fade-in select-none"
      onClick={onClose}
    >
      {/* Background ambient lighting from photo */}
      {highResThumb && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-3xl opacity-20 pointer-events-none scale-125 transition-all duration-700"
          style={{ backgroundImage: `url(${highResThumb})` }}
        />
      )}

      {/* Main container stopping propagation */}
      <div
        className="relative z-10 flex flex-col w-full h-full text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0">
          {/* Left info */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wide shrink-0">
              <CheckCircle size={13} />
              ĐÃ TÌM THẤY
            </span>

            {currentMatch && (
              <span className="font-mono font-bold text-sm text-emerald-300 bg-emerald-950/60 border border-emerald-700/50 px-2 py-0.5 rounded-md shrink-0">
                {currentMatch.code}
              </span>
            )}

            {currentPhoto && (
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold text-xs sm:text-sm text-white/90 truncate">
                  {currentPhoto.filename}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                    isRaw
                      ? "bg-purple-950/60 text-purple-300 border-purple-500/40"
                      : "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                  }`}
                >
                  {currentPhoto.extension}
                </span>
                <span className="text-[11px] text-muted-foreground/80 font-mono hidden md:inline shrink-0">
                  {formatBytes(currentPhoto.size)}
                </span>
              </div>
            )}
          </div>

          {/* Center Counter */}
          <div className="hidden sm:flex items-center gap-1 text-xs font-mono font-semibold text-muted-foreground bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            <span className="text-emerald-400 font-bold">{currentIndex + 1}</span>
            <span>/</span>
            <span>{validPhotos.length} ảnh</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Zoom toggle */}
            <button
              type="button"
              onClick={() => setIsZoomFit((prev) => !prev)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
              title={isZoomFit ? "Phóng to 100% (Phím Space)" : "Vừa màn hình (Phím Space)"}
            >
              {isZoomFit ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
            </button>

            {/* Copy Path */}
            <button
              type="button"
              onClick={handleCopyPath}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-medium text-muted-foreground hover:text-white transition-colors cursor-pointer"
              title="Sao chép đường dẫn file ảnh"
            >
              {copiedPath ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span className="hidden md:inline">{copiedPath ? "Đã chép" : "Chép path"}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-400 border border-white/10 text-muted-foreground hover:border-red-500/30 transition-all cursor-pointer"
              title="Đóng (Phím ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MAIN PREVIEW AREA */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden p-4 sm:p-8">
          {/* Navigation Chevron Left */}
          {validPhotos.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 sm:left-6 z-20 w-11 h-11 rounded-2xl bg-black/60 hover:bg-emerald-600/80 text-white/80 hover:text-white border border-white/15 hover:border-emerald-400/50 flex items-center justify-center backdrop-blur-md shadow-2xl transition-all cursor-pointer group active:scale-95"
              title="Ảnh trước (Mũi tên Trái ←)"
            >
              <ChevronLeft size={22} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Navigation Chevron Right */}
          {validPhotos.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 sm:right-6 z-20 w-11 h-11 rounded-2xl bg-black/60 hover:bg-emerald-600/80 text-white/80 hover:text-white border border-white/15 hover:border-emerald-400/50 flex items-center justify-center backdrop-blur-md shadow-2xl transition-all cursor-pointer group active:scale-95"
              title="Ảnh tiếp theo (Mũi tên Phải →)"
            >
              <ChevronRight size={22} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Large Image Frame */}
          <div className="relative w-full h-full flex items-center justify-center">
            {isLoadingThumb && !highResThumb && (
              <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground animate-fade-in">
                <Loader2 size={36} className="text-emerald-400 animate-spin" />
                <span className="text-xs font-medium">Đang trích xuất ảnh xem trước HD...</span>
              </div>
            )}

            {highResThumb ? (
              <img
                src={highResThumb}
                alt={currentPhoto?.filename || "Preview"}
                className={`transition-all duration-200 select-none shadow-2xl rounded-xl ${
                  isZoomFit
                    ? "max-w-full max-h-full object-contain"
                    : "max-w-none scale-125 object-contain cursor-grab"
                }`}
                draggable={false}
              />
            ) : !isLoadingThumb && (
              <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
                <ImageIcon size={48} />
                <span className="text-xs">Không thể tạo ảnh xem trước</span>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM FILMSTRIP & METADATA BAR */}
        <div className="border-t border-white/10 bg-black/60 backdrop-blur-xl p-3 shrink-0 flex flex-col gap-2">
          {/* File path info */}
          {currentPhoto && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 px-2">
              <span className="flex items-center gap-1.5 truncate">
                <FolderOpen size={12} className="text-emerald-400 shrink-0" />
                <span className="truncate font-mono">{currentPhoto.folder}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10 ml-3">
                {currentPhoto.normalized_number ? `Mã số: ${currentPhoto.normalized_number}` : ""}
              </span>
            </div>
          )}

          {/* Filmstrip thumbnails */}
          <div
            ref={filmstripRef}
            className="flex items-center gap-2 overflow-x-auto py-1 px-1 scrollbar-thin"
            style={{ scrollbarWidth: "thin" }}
          >
            {validPhotos.map((match, idx) => {
              const photo = match.photo!;
              const isActive = idx === currentIndex;
              const thumbUrl = thumbnails[photo.full_path];

              return (
                <button
                  key={photo.full_path}
                  ref={isActive ? activeThumbRef : null}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`group relative flex flex-col items-center justify-center shrink-0 w-20 h-16 rounded-xl border overflow-hidden transition-all cursor-pointer ${
                    isActive
                      ? "border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20 scale-105"
                      : "border-white/15 opacity-60 hover:opacity-100 hover:border-white/40 bg-white/5"
                  }`}
                  title={`${match.code} — ${photo.filename}`}
                >
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={photo.filename}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black/40 text-[9px] font-mono text-muted-foreground">
                      <ImageIcon size={16} />
                    </div>
                  )}

                  {/* Code overlay pill */}
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 backdrop-blur-xs py-0.5 px-1 text-center truncate">
                    <span
                      className={`text-[9px] font-mono font-bold block truncate ${
                        isActive ? "text-emerald-300" : "text-white/80"
                      }`}
                    >
                      {match.code}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
