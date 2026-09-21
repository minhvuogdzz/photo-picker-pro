import { useState, useEffect, useMemo } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { useAuthStore } from "@/core/stores/useAuthStore";
import { LicenseManager } from "@/core/license/LicenseManager";
import { socketService } from "@/core/services/socketService";
import { apiRequest, API_BASE_URL } from "@/core/services/apiClient";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  Layers,
  Search,
  Download,
  ArrowLeft,
  Loader2,
  X,
  Sparkles,
  Sliders,
  Palette,
  FileCode,
  BookOpen,
  CheckCircle2,
  FolderOpen,
  ExternalLink,
  HardDrive,
  Crown,
} from "lucide-react";

export interface ResourceItem {
  id: string;
  category: string;
  title: string;
  description: string;
  hashtags: string[];
  isVip: boolean;
  isHot: boolean;
  fileFormat: string;
  rating: number;
  size: string;
  downloadType: "DIRECT" | "DRIVE";
  downloadUrl?: string;
  fileName?: string;
  author: string;
  downloads: number;
  isActive: boolean;
  order: number;
  createdAt: string;
}

export default function ResourcesApp() {
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const session = useAuthStore((s) => s.session);
  const [showLicenseModal, setShowLicenseModal] = useState(false);

  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeItem, setActiveItem] = useState<ResourceItem | null>(null);

  // Download state & progress
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "picking" | "downloading" | "success" | "error">("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPremium = session?.subscription?.isPremium === true;

  // Fetch real resources from backend
  const fetchResources = async () => {
    if (!isPremium) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiRequest<ResourceItem[]>("/resources");
      setResources(data || []);
    } catch (error) {
      console.error("Failed to fetch resources:", error);
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isPremium) {
      fetchResources();
    }

    const handleResourceUpdated = () => {
      if (isPremium) {
        fetchResources();
      }
    };

    socketService.on("resource:updated", handleResourceUpdated);
    return () => {
      socketService.off("resource:updated", handleResourceUpdated);
    };
  }, [isPremium]);

  // Compute unique categories dynamically from DB with counts
  const categories = useMemo(() => {
    const catMap = new Map<string, number>();
    resources.forEach((r) => {
      const c = (r.category || "Tài nguyên").trim();
      if (c) {
        catMap.set(c, (catMap.get(c) || 0) + 1);
      }
    });

    const getIcon = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes("action")) return Sparkles;
      if (lower.includes("preset") || lower.includes("lut")) return Sliders;
      if (lower.includes("brush") || lower.includes("cọ")) return Palette;
      if (lower.includes("panel")) return Layers;
      if (lower.includes("overlay") || lower.includes("texture")) return FileCode;
      if (lower.includes("giáo trình") || lower.includes("ebook") || lower.includes("tài liệu")) return BookOpen;
      return Layers;
    };

    const list = [
      {
        id: "all",
        label: "Tất cả tài nguyên",
        count: resources.length,
        icon: Layers,
      },
    ];

    Array.from(catMap.entries()).forEach(([cat, count]) => {
      list.push({
        id: cat,
        label: cat,
        count,
        icon: getIcon(cat),
      });
    });

    return list;
  }, [resources]);

  // Filter resources
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      const resCat = (res.category || "").trim().toLowerCase();
      const selCat = selectedCategory.trim().toLowerCase();
      const matchCat = selCat === "all" || resCat === selCat;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCat;

      const matchText =
        res.title?.toLowerCase().includes(q) ||
        res.description?.toLowerCase().includes(q) ||
        res.fileFormat?.toLowerCase().includes(q) ||
        res.author?.toLowerCase().includes(q) ||
        res.hashtags?.some((h) => h.toLowerCase().includes(q));

      return matchCat && matchText;
    });
  }, [resources, selectedCategory, searchQuery]);

  // Reset modal state when closed or opened
  const handleOpenDetail = (item: ResourceItem) => {
    setActiveItem(item);
    setDownloadStatus("idle");
    setDownloadProgress(0);
    setSavedFilePath(null);
    setErrorMessage(null);
  };

  const handleCloseModal = () => {
    setActiveItem(null);
    setDownloadStatus("idle");
    setDownloadProgress(0);
    setSavedFilePath(null);
    setErrorMessage(null);
  };

  // Handle Download action with Folder Selection & Progress Animation
  const handleStartDownload = async (item: ResourceItem) => {
    setErrorMessage(null);

    // Case 1: Google Drive / Cloud Link
    if (item.downloadType === "DRIVE") {
      if (!item.downloadUrl) {
        setErrorMessage("Liên kết tải chưa khả dụng.");
        return;
      }
      setDownloadStatus("downloading");
      setDownloadProgress(60);
      try {
        await openUrl(item.downloadUrl);
        setDownloadProgress(100);
        setDownloadStatus("success");
      } catch {
        window.open(item.downloadUrl, "_blank");
        setDownloadProgress(100);
        setDownloadStatus("success");
      }
      return;
    }

    // Case 2: Direct File Download with Native Folder Selection Dialog
    try {
      setDownloadStatus("picking");
      
      const cleanFormat = (item.fileFormat || "ZIP").replace(/^\./, "").toLowerCase();
      const defaultFilename = item.fileName || `${item.title.replace(/[\\/:*?"<>|]/g, "_")}.${cleanFormat}`;

      // Open Native Save Dialog
      const selectedPath = await save({
        defaultPath: defaultFilename,
        title: "Chọn thư mục lưu tài nguyên",
        filters: [
          {
            name: `${cleanFormat.toUpperCase()} Files`,
            extensions: [cleanFormat, "zip"],
          },
          {
            name: "All Files",
            extensions: ["*"],
          },
        ],
      });

      // If user cancelled dialog
      if (!selectedPath) {
        setDownloadStatus("idle");
        return;
      }

      // Start Animated Download
      setDownloadStatus("downloading");
      setDownloadProgress(20);

      // Simulated initial progress
      const progressTimer = setInterval(() => {
        setDownloadProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 150);

      // Fetch file from backend
      const downloadEndpoint = `${API_BASE_URL}/resources/${item.id}/download`;
      const response = await fetch(downloadEndpoint);

      if (!response.ok) {
        clearInterval(progressTimer);
        throw new Error(`Tải tệp thất bại (HTTP ${response.status})`);
      }

      setDownloadProgress(90);
      const arrayBuffer = await response.arrayBuffer();
      clearInterval(progressTimer);

      // Write file to selected path via native Rust invoke (works with all directories)
      const uint8Array = new Uint8Array(arrayBuffer);
      await invoke("save_file_bytes", {
        filePath: selectedPath,
        bytes: Array.from(uint8Array),
      });

      setDownloadProgress(100);
      setSavedFilePath(selectedPath);
      setDownloadStatus("success");

      // Update downloads count locally
      setResources((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, downloads: (r.downloads || 0) + 1 } : r))
      );
    } catch (err: any) {
      console.error("Direct download error:", err);
      setDownloadStatus("error");
      setErrorMessage(err?.message || "Đã xảy ra lỗi trong quá trình lưu tệp.");
    }
  };

  // Open the folder containing the downloaded file
  const handleRevealFile = async () => {
    if (savedFilePath) {
      try {
        await revealItemInDir(savedFilePath);
      } catch (err) {
        console.error("Reveal error:", err);
      }
    }
  };

  // If user does not have VIP Premium
  if (!isPremium) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-card/90 backdrop-blur-md rounded-xl border border-border p-8 text-center relative overflow-hidden animate-fade-in select-none text-foreground">
        
        {/* Back Button */}
        <button
          onClick={() => setActiveModule("launcher")}
          className="absolute top-4 left-4 w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border"
          title="Quay lại Launcher"
        >
          <ArrowLeft size={14} />
        </button>

        {/* VIP Crown Box */}
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-3">
          <Crown size={22} />
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-semibold mb-2.5">
          <Sparkles size={11} />
          <span>ĐẶC QUYỀN VIP CREATIVE HUB</span>
        </div>

        <h2 className="text-base font-semibold text-foreground mb-1.5 tracking-tight">
          Kho Tài Nguyên Dành Riêng Cho VIP Premium
        </h2>

        <p className="text-xs text-muted-foreground max-w-md mb-5 leading-relaxed">
          Kho tài nguyên Actions Retouch, Presets độc quyền, Brushes và giáo trình thực chiến chỉ mở khóa cho tài khoản được cấp quyền <strong>VIP Premium</strong>.
        </p>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveModule("launcher")}
            className="h-9 px-3.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground border border-border transition-colors cursor-pointer"
          >
            Quay lại Launcher
          </button>

          <button
            onClick={() => setShowLicenseModal(true)}
            className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Crown size={13} />
            <span>Đổi quyền lợi / Đăng ký Premium</span>
          </button>
        </div>

        {showLicenseModal && (
          <LicenseManager
            onClose={() => setShowLicenseModal(false)}
            initialMode="request"
            initialIsPremium={true}
            variant="modal"
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-card/90 backdrop-blur-md rounded-xl border border-border overflow-hidden relative animate-fade-in select-none text-foreground">
      
      {/* Top Header / Navigation Bar */}
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveModule("launcher")}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border"
            title="Quay lại Launcher"
          >
            <ArrowLeft size={14} />
          </button>

          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Layers size={14} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-semibold text-foreground tracking-tight">Kho Tài Nguyên Creative</h1>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                PRO VAULT
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Kho tài nguyên tuyển chọn Actions, Presets, Brushes và tài liệu thực chiến ({resources.length} mục)
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-52">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tài nguyên, hashtag..."
            className="w-full bg-background border border-border rounded-lg pl-7 pr-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 transition-colors shadow-sm"
          />
        </div>
      </div>

      {/* Category Pills Navigation with live counts */}
      <div className="px-5 py-2 border-b border-border bg-muted/15 flex items-center gap-1 overflow-x-auto shrink-0 custom-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory.trim().toLowerCase() === cat.id.trim().toLowerCase();
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isSelected
                  ? "bg-primary/12 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
              }`}
            >
              <Icon size={12} />
              <span>{cat.label}</span>
              <span className={`text-[9px] font-mono px-1 rounded ${isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Grid Content with Smooth Scrolling */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-background/40">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Loader2 size={24} className="animate-spin text-amber-500 mb-2" />
            <p className="text-xs">Đang đồng bộ dữ liệu từ Kho Tài Nguyên...</p>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground mb-2">
              <Search size={18} />
            </div>
            <p className="text-xs font-semibold text-foreground">Không tìm thấy tài nguyên nào</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {resources.length === 0
                ? "Chưa có tài nguyên nào được tải lên từ Admin Dashboard."
                : "Thử tìm kiếm với từ khóa khác hoặc chuyển danh mục."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-6">
            {filteredResources.map((item) => (
              <div
                key={item.id}
                className="group rounded-xl p-3.5 bg-card hover:bg-card/90 border border-border hover:border-primary/30 transition-colors flex flex-col justify-between shadow-sm"
              >
                <div>
                  {/* Top Line: Category Pill + VIP/HOT + Format Tag */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      {item.category}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {item.isVip && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 border border-amber-500/25">
                          VIP
                        </span>
                      )}
                      {item.isHot && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-500 border border-rose-500/25">
                          HOT
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {item.fileFormat?.startsWith(".") ? item.fileFormat : `.${item.fileFormat}`}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1 tracking-tight">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2.5">
                    {item.description}
                  </p>

                  {/* Hashtags */}
                  {item.hashtags && item.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2.5">
                      {item.hashtags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] text-muted-foreground px-1.5 py-0.2 rounded bg-muted/60 border border-border/50"
                        >
                          #{tag.replace(/^#/, "")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Size, Rating and 'Chi tiết' Button */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2 mt-auto">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{item.size || "0 MB"}</span>
                    <span>·</span>
                    <span className="text-amber-500 font-medium">
                      ★ {Number(item.rating || 5).toFixed(1)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenDetail(item)}
                    className="h-7 flex items-center gap-1 px-2.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium text-[11px] border border-border hover:border-primary/30 transition-colors cursor-pointer"
                  >
                    <Download size={11} className="text-muted-foreground" />
                    <span>Chi tiết</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resource Detail Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-5 shadow-xl relative animate-scale-in text-foreground">
            
            {/* Top Bar inside Modal */}
            <div className="flex items-start justify-between gap-4 mb-2.5">
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                {activeItem.category}
              </span>

              <button
                onClick={handleCloseModal}
                className="w-6 h-6 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                title="Đóng"
              >
                <X size={13} />
              </button>
            </div>

            {/* Title & Description */}
            <h2 className="text-sm font-semibold text-foreground leading-snug mb-1.5">
              {activeItem.title}
            </h2>

            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              {activeItem.description}
            </p>

            {/* 3-Column Info Box */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/40 border border-border mb-4 text-center">
              <div>
                <span className="text-[10px] text-muted-foreground block mb-0.5">Định dạng</span>
                <span className="text-xs font-semibold text-foreground font-mono uppercase">
                  {activeItem.fileFormat?.startsWith(".") ? activeItem.fileFormat : `.${activeItem.fileFormat}`}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block mb-0.5">Dung lượng</span>
                <span className="text-xs font-semibold text-foreground font-mono">
                  {activeItem.size || "0 MB"}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block mb-0.5">Tác giả</span>
                <span className="text-xs font-semibold text-foreground truncate block">
                  {activeItem.author || "MVD Academy"}
                </span>
              </div>
            </div>

            {/* Dynamic Download Progress / Success State View */}
            {downloadStatus === "downloading" && (
              <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <div className="flex items-center gap-1.5">
                    <Loader2 size={13} className="animate-spin" />
                    <span>Đang tải xuống tài nguyên...</span>
                  </div>
                  <span>{downloadProgress}%</span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  Đang ghi file vào máy tính của bạn...
                </p>
              </div>
            )}

            {downloadStatus === "success" && (
              <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2 animate-scale-in">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CheckCircle2 size={14} className="text-primary shrink-0" />
                  <span>Tải về thành công!</span>
                </div>

                {savedFilePath ? (
                  <div className="text-[11px] text-muted-foreground space-y-1">
                    <span>Đã lưu tại:</span>
                    <div className="p-2 rounded-md bg-muted/50 border border-border font-mono text-[10px] text-foreground break-all select-all flex items-center gap-1.5">
                      <FolderOpen size={12} className="text-primary shrink-0" />
                      <span className="truncate">{savedFilePath}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Đã mở trang tải về Google Drive trên trình duyệt của bạn.
                  </p>
                )}
              </div>
            )}

            {downloadStatus === "error" && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <X size={14} className="shrink-0" />
                <span>{errorMessage || "Đã xảy ra lỗi trong quá trình tải về."}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              {downloadStatus === "success" && savedFilePath ? (
                <>
                  <button
                    onClick={handleRevealFile}
                    className="flex-1 h-9 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-border"
                  >
                    <FolderOpen size={13} className="text-primary" />
                    <span>Mở thư mục</span>
                  </button>

                  <button
                    onClick={handleCloseModal}
                    className="flex-1 h-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 size={13} />
                    <span>Hoàn tất</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleCloseModal}
                    className="flex-1 h-9 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium text-xs transition-colors cursor-pointer border border-border"
                  >
                    Đóng
                  </button>

                  <button
                    onClick={() => handleStartDownload(activeItem)}
                    disabled={downloadStatus === "downloading" || downloadStatus === "picking"}
                    className="flex-1 h-9 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {downloadStatus === "downloading" ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Đang tải {downloadProgress}%
                      </>
                    ) : downloadStatus === "picking" ? (
                      <>
                        <HardDrive size={13} className="animate-pulse" />
                        Đang chọn thư mục...
                      </>
                    ) : activeItem.downloadType === "DRIVE" ? (
                      <>
                        <ExternalLink size={13} />
                        Mở Google Drive
                      </>
                    ) : (
                      <>
                        <Download size={13} />
                        Tải về ngay
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
