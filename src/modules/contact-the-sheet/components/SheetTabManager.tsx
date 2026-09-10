import React, { useState } from "react";
import {
  Table,
  LayoutGrid,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
} from "lucide-react";
import type { SheetTabInfo, TabConfiguration } from "../types";

interface Props {
  availableTabs: SheetTabInfo[];
  selectedTab: SheetTabInfo | null;
  tabConfigs: Record<string, TabConfiguration>;
  isAnalyzing: boolean;
  onSelectTab: (tab: SheetTabInfo) => void;
  subtitle?: string;
}

export function SheetTabManager({
  availableTabs,
  selectedTab,
  tabConfigs,
  isAnalyzing,
  onSelectTab,
  subtitle,
}: Props) {
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [isExpanded, setIsExpanded] = useState(true);

  if (availableTabs.length <= 1) return null;

  return (
    <div className="w-full min-w-0 max-w-full flex flex-col gap-3 p-4 bg-card/70 border border-border/80 rounded-2xl shadow-sm backdrop-blur-md">
      {/* Top Header & Quick Selector Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 w-full min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
            <Layers size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-foreground">
                Trang tính đang làm việc:
              </span>
              {selectedTab && (
                <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 font-extrabold text-xs border border-teal-500/30 truncate max-w-[200px]">
                  {selectedTab.title} ({selectedTab.columnCount} cột)
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {subtitle || "Mỗi trang tính có thể có thứ tự và cấu trúc cột riêng biệt."}
            </p>
          </div>
        </div>

        {/* Quick Dropdown & View Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Fast Switch Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden sm:inline">Chuyển nhanh:</span>
            <select
              value={selectedTab?.title || ""}
              onChange={(e) => {
                const target = availableTabs.find((t) => t.title === e.target.value);
                if (target) onSelectTab(target);
              }}
              disabled={isAnalyzing}
              className="bg-background border border-border/90 text-teal-400 font-bold text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary shadow-inner cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
            >
              {availableTabs.map((t) => {
                const isConfigured = !!tabConfigs[t.title];
                return (
                  <option key={t.sheetId} value={t.title}>
                    {t.title} ({t.columnCount} cột){isConfigured ? " • [Đã lưu]" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Toggle View: Table vs Grid */}
          <div className="flex items-center p-0.5 bg-background border border-border rounded-xl">
            <button
              onClick={() => {
                setViewMode("table");
                setIsExpanded(true);
              }}
              title="Xem dạng Bảng chi tiết"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                viewMode === "table" && isExpanded
                  ? "bg-teal-500/20 text-teal-300 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Table size={14} />
            </button>
            <button
              onClick={() => {
                setViewMode("grid");
                setIsExpanded(true);
              }}
              title="Xem dạng Lưới thẻ (Grid)"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                viewMode === "grid" && isExpanded
                  ? "bg-teal-500/20 text-teal-300 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          {/* Expand / Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1.5 rounded-xl border border-border bg-background/80 hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-all cursor-pointer"
          >
            <span>{isExpanded ? "Thu gọn" : `Tất cả (${availableTabs.length})`}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded Content: Table or Grid */}
      {isExpanded && (
        <div className="w-full min-w-0 pt-1">
          {viewMode === "table" ? (
            /* TAB TABLE VIEW */
            <div className="w-full min-w-0 max-w-full bg-background/50 border border-border rounded-xl overflow-hidden shadow-inner">
              <div className="max-h-56 overflow-y-auto overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-muted-foreground font-bold sticky top-0 backdrop-blur-md z-10">
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">Tên Trang tính (Sheet Tab)</th>
                      <th className="py-2 px-3">Kích thước</th>
                      <th className="py-2 px-3">Cấu hình theo Tab</th>
                      <th className="py-2 px-3 text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {availableTabs.map((t, idx) => {
                      const isSelected = selectedTab?.sheetId === t.sheetId;
                      const isConfigured = !!tabConfigs[t.title];
                      return (
                        <tr
                          key={t.sheetId}
                          className={`transition-colors ${
                            isSelected
                              ? "bg-teal-500/15 font-semibold text-teal-300"
                              : "hover:bg-muted/30 text-foreground"
                          }`}
                        >
                          <td className="py-2 px-3 text-center text-muted-foreground text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <Table
                                size={14}
                                className={isSelected ? "text-teal-400 shrink-0" : "text-muted-foreground shrink-0"}
                              />
                              <span className="truncate max-w-[240px] font-medium" title={t.title}>
                                {t.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-[11px]">
                            {t.columnCount} cột × {t.rowCount.toLocaleString()} hàng
                          </td>
                          <td className="py-2 px-3">
                            {isConfigured ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                                <CheckCircle2 size={11} /> Đã có cấu hình riêng
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[10px] italic">
                                Dùng cấu hình chuẩn
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {isSelected ? (
                              <span className="px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 text-[11px] font-bold border border-teal-500/40 inline-flex items-center gap-1">
                                <Sparkles size={11} /> Đang chọn
                              </span>
                            ) : (
                              <button
                                onClick={() => onSelectTab(t)}
                                disabled={isAnalyzing}
                                className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-teal-500 hover:text-white text-muted-foreground text-[11px] font-semibold border border-border transition-all cursor-pointer disabled:opacity-50"
                              >
                                Khảo sát tab này
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* TAB GRID VIEW (Responsive Wrapping) */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 w-full min-w-0 max-h-56 overflow-y-auto p-1 custom-scrollbar">
              {availableTabs.map((t) => {
                const isSelected = selectedTab?.sheetId === t.sheetId;
                const isConfigured = !!tabConfigs[t.title];
                return (
                  <button
                    key={t.sheetId}
                    onClick={() => onSelectTab(t)}
                    disabled={isAnalyzing}
                    className={`flex flex-col gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer min-w-0 overflow-hidden ${
                      isSelected
                        ? "bg-teal-500/20 border-teal-500/50 shadow-sm text-teal-300"
                        : "bg-background/80 hover:bg-muted/50 border-border text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full min-w-0">
                      <span className="font-bold text-xs truncate" title={t.title}>
                        {t.title}
                      </span>
                      {isConfigured && (
                        <span title="Đã có cấu hình riêng" className="shrink-0 flex items-center">
                          <CheckCircle2 size={12} className="text-emerald-400" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{t.columnCount} cột</span>
                      <span>{t.rowCount.toLocaleString()} hàng</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
