import { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore } from "@/core/stores/useAppStore";
import { modules, getLocalizedModule } from "@/registry";
import { apiRequest } from "@/core/services/apiClient";
import { socketService } from "@/core/services/socketService";
import { useTranslation } from "@/core/lib/i18n";
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
  const { tr, lang } = useTranslation();

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
      const localized = getLocalizedModule(mod, lang);
      list.push({
        id: `mod-${mod.id}`,
        moduleId: mod.id,
        name: localized.name,
        subName: localized.shortName,
        description: localized.description,
        category: mod.id === "resources" ? "resource" : "app",
        categoryName: mod.id === "resources" ? tr("Kho Tài Nguyên", "Resources Hub") : tr("Ứng dụng", "App"),
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
      name: tr("Lịch sử lọc ảnh (History)", "Photo Picker History"),
      subName: tr("Nhật ký lọc ảnh", "Culling Log"),
      description: tr(
        "Xem lại danh sách các phiên lọc ảnh và xuất mã khách hàng đã thực hiện.",
        "Review past photo picking sessions and exported customer code logs."
      ),
      category: "app",
      categoryName: "Photo Picker Pro",
      icon: History,
      tags: ["lịch sử", "history", "đã lọc", "nhật ký", "log", "sessions"],
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
      name: tr("Cài đặt hệ thống & Giao diện", "System Settings & Appearance"),
      subName: tr("Cấu hình chung", "General Settings"),
      description: tr(
        "Tùy chỉnh giao diện Dark/Light mode, tự động cập nhật và ngôn ngữ.",
        "Customize Dark/Light theme, auto updates, and interface language."
      ),
      category: "system",
      categoryName: tr("Hệ thống", "System"),
      icon: Settings,
      tags: ["cài đặt", "settings", "giao diện", "theme", "dark mode", "ngôn ngữ", "language"],
      action: () => {
        setActiveModule("system");
        setIsOpen(false);
        setQuery("");
      },
    });

    list.push({
      id: "feature-photo-counter",
      moduleId: "photo-counter",
      name: tr("Thống kê", "Photo Analytics"),
      subName: tr("Sản lượng & Tiến độ Studio", "Studio Output & Progress"),
      description: tr(
        "Thống kê số lượng ảnh hoàn thiện theo ngày, bóc tách thư mục sâu nhất và tổng hợp sản lượng.",
        "Track daily finished photo counts, extract deepest folders, and summarize studio throughput."
      ),
      category: "app",
      categoryName: tr("Công cụ Studio", "Studio Tools"),
      icon: BarChart3,
      tags: ["thống kê", "sản lượng", "kpi", "đếm ảnh", "tháng", "tiến độ", "analytics", "counter"],
      badge: "PRO",
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
        categoryName: res.category || tr("Kho Tài Nguyên", "Resources Hub"),
        icon: Sparkles,
        tags: [
          res.category,
          res.fileFormat,
          res.author,
          ...(res.hashtags || []),
        ].filter(Boolean),
        badge: res.isVip ? "PRO" : res.isHot ? "HOT" : res.fileFormat || undefined,
        action: () => {
          setActiveModule("resources");
          setIsOpen(false);
          setQuery("");
        },
      });
    });

    return list;
  }, [liveResources, setActiveModule, setActiveTab, lang]);

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
        className={`glass-pill flex items-center gap-2 h-8 px-3 rounded-full transition-shadow duration-200 w-60 md:w-72 text-left ${
          isOpen ? "ring-[3px] ring-primary/20" : ""
        }`}
      >
        <Search size={14} strokeWidth={1.75} className={`shrink-0 transition-colors ${isOpen ? "text-primary" : "text-muted-foreground"}`} />
        
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
          placeholder={tr("Tìm ứng dụng, công cụ, tài nguyên", "Search apps, tools, resources")}
          className="w-full bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        {query ? (
          <button aria-label={tr("Đóng", "Clear")}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="w-4 h-4 rounded-full bg-foreground/10 hover:bg-foreground/15 text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
          >
            <X size={10} />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center px-1.5 h-[18px] text-[10.5px] font-medium text-muted-foreground bg-foreground/[0.06] rounded-md">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Anchored Suggestions Dropdown Menu */}
      {isOpen && (
        <div 
          className="liquid-glass liquid-glass-strong absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[480px] max-w-[92vw] rounded-2xl shadow-xl overflow-hidden flex flex-col z-50 animate-slide-up"
          style={{ maxHeight: "70vh" }}
        >
          {/* Quick Filter Tag Hints Bar */}
          <div className="px-3 py-2.5 border-b border-border flex items-center gap-1.5 overflow-x-auto text-xs text-muted-foreground shrink-0 custom-scrollbar">
            <span className="text-[11px] text-muted-foreground shrink-0 pl-1 pr-0.5">{tr("Gợi ý", "Quick")}</span>
            {[
              { label: "Photo Picker", q: tr("lọc ảnh", "photo picker") },
              { label: "Contact Sheet", q: "contact" },
              { label: "Convert RAW", q: "convert" },
              { label: tr("Kho Tài Nguyên", "Resources"), q: tr("tài nguyên", "resources") },
              { label: tr("Cài đặt", "Settings"), q: tr("cài đặt", "settings") },
            ].map((hint, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(hint.q);
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                className="h-6 px-2.5 rounded-full bg-foreground/[0.05] hover:bg-primary/10 hover:text-primary text-foreground/80 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer shrink-0"
              >
                {hint.label}
              </button>
            ))}
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-xs font-medium text-foreground/80">
                  {tr(`Không tìm thấy kết quả cho "${query}"`, `No results found for "${query}"`)}
                </p>
                <p className="text-[11px] text-muted-foreground/85 mt-1">
                  {tr(
                    'Thử tìm "lọc ảnh", "contact sheet", "convert", "tài nguyên"',
                    'Try searching "photo picker", "contact sheet", "convert", "resources"'
                  )}
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
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-foreground/[0.05] text-muted-foreground"
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.75} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-medium truncate text-foreground">
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-foreground/[0.06] text-muted-foreground">
                            {item.badge}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                          {item.categoryName}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 leading-normal">
                        {item.description}
                      </p>
                    </div>

                    <ArrowRight
                      size={14}
                      strokeWidth={1.75}
                      className={`shrink-0 transition-opacity ${
                        isSelected ? "text-primary opacity-100" : "opacity-0"
                      }`}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Footer hints */}
          <div className="px-4 py-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-[10px]">↓</kbd> {tr("di chuyển", "navigate")}</span>
              <span><kbd className="px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-[10px]">↵</kbd> {tr("chọn", "select")}</span>
            </div>
            <span>DH Studio Pro</span>
          </div>
        </div>
      )}
    </div>
  );
}
