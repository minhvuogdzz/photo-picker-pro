import React from "react";
import {
  AlertTriangle,
  Table,
  Link,
  FunctionSquare,
  Heading,
} from "lucide-react";
import type { TabAnalysisResult } from "../types";
import { useTranslation } from "@/core/lib/i18n";

interface Props {
  analysis: TabAnalysisResult;
  onConfirmHeader: (row: number) => void;
  selectedHeaderRow: number;
}

export function AnalysisReportCard({ analysis, onConfirmHeader, selectedHeaderRow }: Props) {
  const { tr } = useTranslation();
  const { tab, headerCandidates, columns, hasImportRangeRefErrors, refErrorColumns } = analysis;

  const formulaCols = columns.filter((c) => c.hasFormulas);
  const dropdownCols = columns.filter((c) => c.dropdownOptions && c.dropdownOptions.length > 0);
  const linkCols = columns.filter((c) => c.isHyperlinkField);

  return (
    <div className="flex flex-col gap-3.5 bg-card border border-border rounded-2xl p-4 shadow-xs w-full min-w-0 max-w-full overflow-hidden">
      {/* Header Info */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-foreground/[0.05] border border-border flex items-center justify-center text-foreground shrink-0">
            <Table size={15} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-foreground truncate">
              {tr("Kết quả khảo sát tab:", "Tab Inspection Result:")} {tab.title}
            </h3>
            <p className="text-[11.5px] text-muted-foreground">
              {tr("Kích thước:", "Size:")} {tab.rowCount.toLocaleString()} {tr("hàng ×", "rows ×")} {tab.columnCount} {tr("cột (dò mẫu 40 hàng đầu)", "columns (sampled first 40 rows)")}
            </p>
          </div>
        </div>

        {hasImportRangeRefErrors ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-[11.5px] font-medium max-w-full truncate">
            <AlertTriangle size={13} className="shrink-0" />
            <span className="truncate">{tr("Lỗi #REF! tại cột", "#REF! error at column(s)")} {refErrorColumns.join(", ")}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-foreground/[0.04] text-foreground border border-border text-[11.5px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            <span>{tr("Dữ liệu nguồn sẵn sàng", "Source data ready")}</span>
          </div>
        )}
      </div>

      {hasImportRangeRefErrors && (
        <div className="p-3 bg-foreground/[0.03] border border-border rounded-xl text-[11.5px] text-muted-foreground leading-relaxed w-full min-w-0">
          <span className="font-medium text-foreground">{tr("Lưu ý IMPORTRANGE:", "IMPORTRANGE Note:")}</span> {tr("Một số cột nguồn đang hiển thị lỗi", "Some source columns show")} <code>#REF!</code> {tr("trên Google Sheets. Hệ thống tự động khóa ghi trên các cột này để bảo vệ dữ liệu.", "on Google Sheets. Write access on these columns is locked automatically to protect data.")}
        </div>
      )}

      {/* Metric Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-[12px] w-full min-w-0">
        <div className="p-3 rounded-xl bg-background/50 border border-border flex flex-col gap-0.5 min-w-0 overflow-hidden">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <FunctionSquare size={12.5} className="shrink-0" /> {tr("Cột công thức", "Formula columns")}
          </span>
          <span className="font-semibold text-foreground text-[13px] mt-0.5">
            {formulaCols.length} {tr("cột", "col(s)")}
          </span>
          <span className="text-[11px] text-muted-foreground truncate" title={formulaCols.map((c) => c.letter).join(", ")}>
            {formulaCols.length > 0 ? formulaCols.map((c) => c.letter).join(", ") : tr("Không có", "None")}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-background/50 border border-border flex flex-col gap-0.5 min-w-0 overflow-hidden">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Table size={12.5} className="shrink-0" /> {tr("Cột Dropdown", "Dropdown columns")}
          </span>
          <span className="font-semibold text-foreground text-[13px] mt-0.5">
            {dropdownCols.length} {tr("cột", "col(s)")}
          </span>
          <span className="text-[11px] text-muted-foreground truncate" title={dropdownCols.map((c) => c.headerName).join(", ")}>
            {dropdownCols.length > 0 ? dropdownCols.map((c) => c.headerName).join(", ") : tr("Không có", "None")}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-background/50 border border-border flex flex-col gap-0.5 min-w-0 overflow-hidden">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Link size={12.5} className="shrink-0" /> {tr("Cột Link Drive", "Drive Link columns")}
          </span>
          <span className="font-semibold text-foreground text-[13px] mt-0.5">
            {linkCols.length} {tr("cột", "col(s)")}
          </span>
          <span className="text-[11px] text-muted-foreground truncate" title={linkCols.map((c) => c.headerName).join(", ")}>
            {linkCols.length > 0 ? linkCols.map((c) => c.headerName).join(", ") : tr("Không có", "None")}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-background/50 border border-border flex flex-col gap-0.5 min-w-0 overflow-hidden">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Heading size={12.5} className="shrink-0" /> {tr("Hàng tiêu đề", "Header Row")}
          </span>
          <span className="font-semibold text-foreground text-[13px] mt-0.5">
            {tr("Hàng", "Row")} {selectedHeaderRow}
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            {tr("Tự động nhận diện", "Auto-detected")}
          </span>
        </div>
      </div>

      {/* Header Row Selection */}
      <div className="p-3 bg-background/40 border border-border rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full min-w-0">
        <div>
          <span className="text-[12px] font-medium text-foreground block">
            {tr("Xác nhận hàng tiêu đề (Header Row)", "Confirm Header Row")}
          </span>
          <p className="text-[11px] text-muted-foreground">
            {tr("Các hàng phía trên hàng tiêu đề sẽ được bỏ qua khi đối soát dữ liệu.", "Rows above the header row are ignored during matching.")}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {headerCandidates.slice(0, 3).map((candidate) => (
            <button
              type="button"
              key={candidate.row}
              onClick={() => onConfirmHeader(candidate.row)}
              className={`h-7 px-3 rounded-lg text-[11.5px] font-medium transition-colors cursor-pointer border ${
                selectedHeaderRow === candidate.row
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-foreground/[0.04] hover:bg-foreground/[0.08] text-muted-foreground hover:text-foreground border-border"
              }`}
            >
              {tr("Hàng", "Row")} {candidate.row} {candidate.row === 3 && tr("(Khuyến nghị)", "(Recommended)")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
