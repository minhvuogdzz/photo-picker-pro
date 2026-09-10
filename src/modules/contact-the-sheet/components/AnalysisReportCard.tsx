import React from "react";
import {
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Table,
  HelpCircle,
  Sparkles,
  Link,
  FunctionSquare,
} from "lucide-react";
import type { TabAnalysisResult } from "../types";

interface Props {
  analysis: TabAnalysisResult;
  onConfirmHeader: (row: number) => void;
  selectedHeaderRow: number;
}

export function AnalysisReportCard({ analysis, onConfirmHeader, selectedHeaderRow }: Props) {
  const { tab, headerCandidates, columns, hasImportRangeRefErrors, refErrorColumns } = analysis;

  const formulaCols = columns.filter((c) => c.hasFormulas);
  const dropdownCols = columns.filter((c) => c.dropdownOptions && c.dropdownOptions.length > 0);
  const linkCols = columns.filter((c) => c.isHyperlinkField);

  return (
    <div className="flex flex-col gap-4 bg-muted/20 border border-border/80 rounded-2xl p-5 shadow-sm w-full min-w-0 max-w-full overflow-hidden">
      {/* Header Info */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
            <Table size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">
              Kết quả khảo sát tab: {tab.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              Kích thước: {tab.rowCount.toLocaleString()} hàng × {tab.columnCount} cột (Dò mẫu 40 hàng đầu)
            </p>
          </div>
        </div>

        {hasImportRangeRefErrors ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 text-xs font-semibold max-w-full truncate">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="truncate">Phát hiện lỗi #REF! (Cột {refErrorColumns.join(", ")})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>Dữ liệu nguồn sẵn sàng</span>
          </div>
        )}
      </div>

      {/* Warnings & Signals */}
      {hasImportRangeRefErrors && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 leading-relaxed w-full min-w-0 break-words">
          <span className="font-bold">Lưu ý về IMPORTRANGE:</span> Một số cột nguồn đang hiển thị lỗi <code>#REF!</code> (do chưa cấp quyền truy cập bảng tính nguồn trong Google Sheets). Contact the Sheet sẽ chặn khớp tự động trên các cột này để bảo vệ dữ liệu.
        </div>
      )}

      {/* Metric Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs w-full min-w-0">
        <div className="p-3 rounded-xl bg-background/60 border border-border flex flex-col gap-1 min-w-0 overflow-hidden">
          <span className="text-muted-foreground flex items-center gap-1">
            <FunctionSquare size={13} className="text-purple-400 shrink-0" /> Cột công thức
          </span>
          <span className="font-bold text-foreground text-sm">
            {formulaCols.length} cột
          </span>
          <span className="text-[11px] text-muted-foreground truncate" title={formulaCols.map((c) => c.letter).join(", ")}>
            {formulaCols.length > 0 ? formulaCols.map((c) => c.letter).join(", ") : "Không có"}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-background/60 border border-border flex flex-col gap-1 min-w-0 overflow-hidden">
          <span className="text-muted-foreground flex items-center gap-1">
            <Table size={13} className="text-blue-400 shrink-0" /> Cột Dropdown
          </span>
          <span className="font-bold text-foreground text-sm">
            {dropdownCols.length} cột
          </span>
          <span className="text-[11px] text-muted-foreground truncate" title={dropdownCols.map((c) => c.headerName).join(", ")}>
            {dropdownCols.length > 0 ? dropdownCols.map((c) => c.headerName).join(", ") : "Không có"}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-background/60 border border-border flex flex-col gap-1 min-w-0 overflow-hidden">
          <span className="text-muted-foreground flex items-center gap-1">
            <Link size={13} className="text-teal-400 shrink-0" /> Cột Link Drive
          </span>
          <span className="font-bold text-foreground text-sm">
            {linkCols.length} cột
          </span>
          <span className="text-[11px] text-muted-foreground truncate" title={linkCols.map((c) => c.headerName).join(", ")}>
            {linkCols.length > 0 ? linkCols.map((c) => c.headerName).join(", ") : "Không có"}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-background/60 border border-border flex flex-col gap-1 min-w-0 overflow-hidden">
          <span className="text-muted-foreground flex items-center gap-1">
            <Sparkles size={13} className="text-amber-400 shrink-0" /> Tiêu đề dò thấy
          </span>
          <span className="font-bold text-foreground text-sm">
            Hàng {selectedHeaderRow}
          </span>
          <span className="text-[11px] text-emerald-400 font-semibold truncate">
            Độ tin cậy: Cao
          </span>
        </div>
      </div>

      {/* Header Row Selection */}
      <div className="p-3 bg-background/40 border border-border rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full min-w-0">
        <div>
          <span className="text-xs font-bold text-foreground block">
            Xác nhận hàng Tiêu đề (Header Row):
          </span>
          <p className="text-[11px] text-muted-foreground">
            Các hàng phía trên hàng tiêu đề (nếu có) sẽ được coi là ghi chú hoặc phần tóm tắt.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {headerCandidates.slice(0, 3).map((candidate) => (
            <button
              key={candidate.row}
              onClick={() => onConfirmHeader(candidate.row)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedHeaderRow === candidate.row
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground border border-border"
              }`}
            >
              Hàng {candidate.row} {candidate.row === 3 && "(Khuyến nghị)"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
