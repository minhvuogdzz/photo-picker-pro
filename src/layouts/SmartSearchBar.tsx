import { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { modules } from "@/registry";
import { apiRequest } from "@/core/services/apiClient";
import { socketService } from "@/core/services/socketService";
import {
  Search,
  ArrowRight,
  Sparkles,
  Settings,
  Layers,
  X,
  History,
  FolderSync,
  BarChart3,
} from "lucide-react";

interface SearchableItem {
  id: string;
  moduleId: string;
  name: string;
  subName?: string;
  description: string;
  category: "app" | "resource" | "system";
  categoryName: string;
  icon: any;
  tags: string[];
  badge?: string;
  action: () => void;
}

export function SmartSearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveResources, setLiveResources] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  // Fetch real resources dynamically for search indexing
  const fetchLiveResources = async () => {
    try {
      const data = await apiRequest<any[]>("/resources");
      setLiveResources(data || []);
    } catch {
      setLiveResources([]);
    }
  };

  useEffect(() => {
    fetchLiveResources();

    const handleSync = () => {
      fetchLiveResources();
    };

    socketService.on("resource:updated", handleSync);
    return () => {
      socketService.off("resource:updated", handleSync);
    };
  }, []);

  // Global Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Build searchable items index
  const allItems: SearchableItem[] = useMemo(() => {
    const list: SearchableItem[] = [];

    // Core Modules / Apps
    modules.forEach((mod) => {
      list.push({
        id: `mod-${mod.id}`,
        moduleId: mod.id,
        name: mod.name,
        subName: mod.shortName,
        description: mod.description,
        category: mod.id === "resources" ? "resource" : "app",
        categoryName: mod.id === "resources" ? "Kho Tài Nguyên" : "Ứng dụng",
        icon: mod.icon,
        tags: mod.tags,
        badge: mod.badge,
        action: () => {
          setActiveModule(mod.id);
          setIsOpen(false);
          setQuery("");
        },
      });
    });

    // Sub-features / Specific tools
    list.push({
      id: "feature-history",
      moduleId: "photo-picker",
      name: "Lịch sử lọc ảnh (History)",
      subName: "Nhật ký lọc ảnh",
      description: "Xem lại danh sách các phiên lọc ảnh và xuất mã khách hàng đã thực hiện.",
      category: "app",
      categoryName: "Photo Picker Pro",
      icon: History,
      tags: ["lịch sử", "history", "đã lọc", "nhật ký"],
      action: () => {
        setActiveModule("photo-picker");
        setActiveTab("history");
        setIsOpen(false);
        setQuery("");
      },
    });

    list.push({
      id: "feature-settings",
      moduleId: "system",
      name: "Cài đặt hệ thống & Giao diện",
      subName: "Cấu hình chung",
      description: "Tùy chỉnh giao diện Dark/Light mode, tự động cập nhật và ngôn ngữ.",
      category: "system",
      categoryName: "Hệ thống",
      icon: Settings,
      tags: ["cài đặt", "settings", "giao diện", "theme", "dark mode", "ngôn ngữ"],
      action: () => {
        setActiveModule("system");
        setIsOpen(false);
        setQuery("");
      },
    });

    list.push({
      id: "feature-photo-counter",
      moduleId: "photo-counter",
      name: "Thống kê",
      subName: "Sản lượng & Tiến độ Studio",
      description: "Thống kê số lượng ảnh hoàn thiện theo ngày, bóc tách thư mục sâu nhất và tổng hợp sản lượng.",
      category: "app",
      categoryName: "Công cụ Studio",
      icon: BarChart3,
      tags: ["thống kê", "sản lượng", "kpi", "đếm ảnh", "tháng", "tiến độ"],
      badge: "VIP Pro",
      action: () => {
        setActiveModule("photo-counter");
        setIsOpen(false);
        setQuery("");
      },
    });

    // Real-time Resources from Database
    liveResources.forEach((res) => {
      list.push({
        id: `live-res-${res.id}`,
        moduleId: "resources",
        name: res.title,
        subName: res.category,
        description: res.description,
        category: "resource",
        categoryName: res.category || "Kho Tài Nguyên",
        icon: Sparkles,
        tags: [
          res.category,
          res.fileFormat,
          res.author,
          ...(res.hashtags || []),
        ].filter(Boolean),
        badge: res.isVip ? "VIP" : res.isHot ? "HOT" : res.fileFormat || undefined,
        action: () => {
          setActiveModule("resources");
          setIsOpen(false);
          setQuery("");
        },
      });
    });

    return list;
  }, [liveResources, setActiveModule, setActiveTab]);

  // Filter items
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;

    return allItems.filter((item) => {
      const matchName = item.name.toLowerCase().includes(q);
      const matchSub = item.subName?.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
      const matchCategory = item.categoryName.toLowerCase().includes(q);
      return matchName || matchSub || matchDesc || matchTags || matchCategory;
    });
  }, [query, allItems]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      setIsOpen(true);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input in TopBar */}
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/40 hover:bg-muted/60 border transition-all duration-200 w-56 md:w-64 text-left shadow-xs ${
          isOpen ? "border-primary/50 ring-2 ring-primary/20 shadow-sm" : "border-border/80 hover:border-border"
        }`}
      >
        <Search size={13} className={`shrink-0 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Tìm app, công cụ... (⌘K)"
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
        />

        {query ? (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="w-4 h-4 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground flex items-center justify-center text-[10px] cursor-pointer"
          >
            <X size={10} />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1 py-0.2 text-[9px] font-medium font-mono text-muted-foreground bg-muted border border-border rounded">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Anchored Suggestions Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[460px] max-w-[92vw] bg-card/98 backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col z-50 animate-slide-up"
          style={{ maxHeight: "70vh" }}
        >
          {/* Quick Filter Tag Hints Bar */}
          <div className="px-4 py-2.5 border-b border-border/70 bg-muted/30 flex items-center gap-2 overflow-x-auto text-xs text-muted-foreground shrink-0 custom-scrollbar">
            <span className="font-semibold text-foreground/80 text-[11px] shrink-0">Gợi ý:</span>
            {[
              { label: "Photo Picker", q: "lọc ảnh" },
              { label: "Contact Sheet", q: "contact" },
              { label: "Convert RAW", q: "convert" },
              { label: "Kho Tài Nguyên", q: "tài nguyên" },
              { label: "Cài đặt", q: "cài đặt" },
            ].map((hint, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(hint.q);
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-primary/15 hover:text-primary text-muted-foreground border border-border/70 hover:border-primary/30 text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer shrink-0"
              >
                {hint.label}
              </button>
            ))}
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-xs font-medium text-foreground/80">Không tìm thấy kết quả cho "{query}"</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  Thử tìm "lọc ảnh", "contact sheet", "convert", "tài nguyên"
                </p>
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;

                return (
                  <div
                    key={item.id}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? "bg-primary/10 text-foreground border border-primary/20 shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                          ? "bg-primary/20 border-primary/35 text-primary shadow-xs"
                          : "bg-muted/70 border-border text-muted-foreground"
                      }`}
                    >
                      <Icon size={16} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-semibold truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-mono uppercase">
                            {item.badge}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/70 ml-auto shrink-0 font-medium">
                          {item.categoryName}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 leading-normal">
                        {item.description}
                      </p>
                    </div>

                    <ArrowRight
                      size={14}
                      className={`shrink-0 transition-transform ${
                        isSelected ? "text-primary translate-x-1 opacity-100" : "opacity-0"
                      }`}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Footer hints */}
          <div className="px-4 py-2 border-t border-border/70 bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[9px]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[9px]">↓</kbd> di chuyển</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[9px]">↵</kbd> chọn</span>
            </div>
            <span className="text-muted-foreground/70">MVD Photoshop Academy</span>
          </div>
        </div>
      )}
    </div>
  );
}
