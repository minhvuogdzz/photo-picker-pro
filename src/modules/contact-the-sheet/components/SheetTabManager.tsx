import React, { useState } from "react";
import {
  Table,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Layers,
  Copy,
  Check,
  RotateCcw,
  Plus,
  X,
} from "lucide-react";
import type { SheetTabInfo, TabConfiguration } from "../types";

interface Props {
  availableTabs: SheetTabInfo[];
  selectedTab: SheetTabInfo | null;
  tabConfigs: Record<string, TabConfiguration>;
  isAnalyzing: boolean;
  onSelectTab: (tab: SheetTabInfo) => void;
  onCopyConfigToAllTabs?: () => void;
  onUndoCopyAllTabs?: () => void;
  onToggleTabConfig?: (tab: SheetTabInfo) => void;
  canUndoCopyAll?: boolean;
  subtitle?: string;
}

export function SheetTabManager({
  availableTabs,
  selectedTab,
  tabConfigs,
  isAnalyzing,
  onSelectTab,
  onCopyConfigToAllTabs,
  onUndoCopyAllTabs,
  onToggleTabConfig,
  canUndoCopyAll,
  subtitle,
}: Props) {
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [isExpanded, setIsExpanded] = useState(false);

  if (availableTabs.length <= 1) return null;

  const configuredCount = Object.keys(tabConfigs).length;

  return (
    <div className="w-full min-w-0 max-w-full flex flex-col gap-3 p-4 bg-card border border-border rounded-2xl shadow-xs">
      {/* Top Header & Quick Selector Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 w-full min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-foreground/[0.05] border border-border flex items-center justify-center text-foreground shrink-0">
            <Layers size={15} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12.5px] font-semibold text-foreground">
                Trang tính đang làm việc:
              </span>
              {selectedTab && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium text-[11.5px] border border-primary/20 truncate max-w-[200px]">
                  {selectedTab.title} ({selectedTab.columnCount} cột)
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">
                · Đã áp dụng Batch: <span className="font-medium text-foreground">{configuredCount || 1}</span>/{availableTabs.length} tab
              </span>
            </div>
            <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
              {subtitle || "Chỉ những tab được áp dụng cấu hình tại đây mới hiển thị ở phần Thực thi Batch."}
            </p>
          </div>
        </div>

        {/* Quick Dropdown & Actions */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-muted-foreground hidden sm:inline">Chuyển tab:</span>
            <select
              value={selectedTab?.title || ""}
              onChange={(e) => {
                const target = availableTabs.find((t) => t.title === e.target.value);
                if (target) onSelectTab(target);
              }}
              disabled={isAnalyzing}
              className="h-8 bg-background border border-border text-foreground font-medium text-[11.5px] rounded-lg px-2.5 focus:outline-none focus:border-primary cursor-pointer max-w-[180px] sm:max-w-[220px] truncate"
            >
              {availableTabs.map((t) => {
                const isConfigured = !!tabConfigs[t.title];
                return (
                  <option key={t.sheetId} value={t.title}>
                    {t.title} ({t.columnCount} cột){isConfigured ? " · Đã áp dụng" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Toggle View: Table vs Grid */}
          <div className="flex items-center p-0.5 bg-foreground/[0.04] border border-border rounded-lg h-8">
            <button
              type="button"
              onClick={() => {
                setViewMode("table");
                setIsExpanded(true);
              }}
              title="Xem dạng Bảng"
              aria-label="Xem dạng Bảng"
              className={`px-2 h-full rounded-md text-[11.5px] transition-colors cursor-pointer flex items-center ${
                viewMode === "table" && isExpanded
                  ? "glass-pill text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Table size={13} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("grid");
                setIsExpanded(true);
              }}
              title="Xem dạng Lưới"
              aria-label="Xem dạng Lưới"
              className={`px-2 h-full rounded-md text-[11.5px] transition-colors cursor-pointer flex items-center ${
                viewMode === "grid" && isExpanded
                  ? "glass-pill text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={13} strokeWidth={1.75} />
            </button>
          </div>

          {/* Copy Config to All Tabs Button */}
          {onCopyConfigToAllTabs && (
            <button
              type="button"
              onClick={onCopyConfigToAllTabs}
              title="Sao chép cấu hình từ tab hiện tại sang tất cả các tab khác"
              className="h-8 px-2.5 rounded-lg border border-border bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy size={12.5} strokeWidth={1.75} />
              <span className="hidden sm:inline">Áp dụng tất cả</span>
            </button>
          )}

          {/* Undo / Reset to Current Tab Button */}
          {onUndoCopyAllTabs && (canUndoCopyAll || configuredCount > 1) && (
            <button
              type="button"
              onClick={onUndoCopyAllTabs}
              title="Hoàn tác áp dụng tất cả — chỉ giữ lại cấu hình cho tab đang chọn"
              className="h-8 px-2.5 rounded-lg border border-primary/25 bg-primary/10 hover:bg-primary/15 text-primary text-[11.5px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw size={12.5} strokeWidth={1.75} />
              <span>Hoàn tác ({configuredCount} → 1 tab)</span>
            </button>
          )}

          {/* Expand / Collapse Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 px-2.5 rounded-lg border border-border bg-foreground/[0.04] hover:bg-foreground/[0.08] text-[11.5px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{isExpanded ? "Thu gọn" : `Chọn tab (${availableTabs.length})`}</span>
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded Content: Table or Grid */}
      {isExpanded && (
        <div className="w-full min-w-0 pt-1">
          {viewMode === "table" ? (
            <div className="w-full min-w-0 max-w-full bg-background/50 border border-border rounded-xl overflow-hidden">
              <div className="max-h-56 overflow-y-auto overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-[12px] border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-foreground/[0.03] text-muted-foreground font-medium sticky top-0 backdrop-blur-md z-10">
                      <th className="py-2 px-3 w-10 text-center font-medium">#</th>
                      <th className="py-2 px-3 font-medium">Tên Trang tính (Sheet Tab)</th>
                      <th className="py-2 px-3 font-medium">Kích thước</th>
                      <th className="py-2 px-3 font-medium">Hiển thị ở Thực thi Batch</th>
                      <th className="py-2 px-3 text-right font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {availableTabs.map((t, idx) => {
                      const isSelected = selectedTab?.sheetId === t.sheetId;
                      const isConfigured = !!tabConfigs[t.title];
                      return (
                        <tr
                          key={t.sheetId}
                          className={`transition-colors ${
                            isSelected ? "bg-primary/[0.06]" : "hover:bg-foreground/[0.02]"
                          }`}
                        >
                          <td className="py-2 px-3 text-center text-muted-foreground text-[11px] tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <Table
                                size={13.5}
                                strokeWidth={1.75}
                                className={isSelected ? "text-primary shrink-0" : "text-muted-foreground shrink-0"}
                              />
                              <span
                                className={`truncate max-w-[240px] ${
                                  isSelected ? "font-semibold text-foreground" : "font-medium text-foreground"
                                }`}
                                title={t.title}
                              >
                                {t.title}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground text-[11px] tabular-nums">
                            {t.columnCount} cột × {t.rowCount.toLocaleString()} hàng
                          </td>
                          <td className="py-2 px-3">
                            {onToggleTabConfig ? (
                              <button
                                type="button"
                                onClick={() => onToggleTabConfig(t)}
                                className={`h-6 px-2 rounded-md text-[11px] font-medium inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                                  isConfigured
                                    ? "bg-primary/10 border-primary/25 text-primary hover:bg-destructive/10 hover:border-destructive/25 hover:text-destructive"
                                    : "bg-foreground/[0.04] border-border text-muted-foreground hover:text-foreground"
                                }`}
                                title={
                                  isConfigured
                                    ? "Đang hiển thị ở phần Thực thi Batch — bấm để gỡ"
                                    : "Bấm để áp dụng cấu hình hiện tại cho tab này và hiển thị ở Thực thi Batch"
                                }
                              >
                                {isConfigured ? (
                                  <>
                                    <Check size={11} />
                                    <span>Đã áp dụng (Bấm để gỡ)</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus size={11} />
                                    <span>Áp dụng cho tab này</span>
                                  </>
                                )}
                              </button>
                            ) : isConfigured ? (
                              <span className="text-[11px] text-foreground font-medium inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                                Đã áp dụng
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">
                                Chưa áp dụng
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {isSelected ? (
                              <span className="h-6 px-2.5 rounded-md bg-foreground/[0.06] text-foreground text-[11px] font-medium inline-flex items-center gap-1">
                                <Check size={11} className="text-primary" /> Đang làm việc
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSelectTab(t)}
                                disabled={isAnalyzing}
                                className="h-6 px-2.5 rounded-md bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground text-[11px] font-medium border border-border transition-colors cursor-pointer disabled:opacity-50"
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 w-full min-w-0 max-h-56 overflow-y-auto p-0.5 custom-scrollbar">
              {availableTabs.map((t) => {
                const isSelected = selectedTab?.sheetId === t.sheetId;
                const isConfigured = !!tabConfigs[t.title];
                return (
                  <div
                    key={t.sheetId}
                    onClick={() => onSelectTab(t)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectTab(t);
                      }
                    }}
                    className={`flex flex-col gap-1.5 p-2.5 rounded-xl border text-left transition-colors cursor-pointer min-w-0 overflow-hidden ${
                      isSelected
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : "bg-background/60 hover:bg-foreground/[0.04] border-border text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full min-w-0">
                      <span className="font-medium text-[12px] truncate" title={t.title}>
                        {t.title}
                      </span>
                      {onToggleTabConfig && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTabConfig(t);
                          }}
                          title={isConfigured ? "Gỡ khỏi Thực thi Batch" : "Áp dụng vào Thực thi Batch"}
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                            isConfigured
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border bg-foreground/[0.04] text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {isConfigured ? <Check size={11} strokeWidth={2.5} /> : <Plus size={11} />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10.5px] text-muted-foreground tabular-nums">
                      <span>{t.columnCount} cột</span>
                      <span>{isConfigured ? "Đã áp dụng" : `${t.rowCount.toLocaleString()} hàng`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
