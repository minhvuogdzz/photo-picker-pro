import React, { useState } from "react";
import { Eye, X, CheckCircle2, ShieldAlert, Copy, Check } from "lucide-react";
import type { DiscoveredJob, UpdatePlan } from "../types";

interface Props {
  job: DiscoveredJob;
  plan?: UpdatePlan;
  onClose: () => void;
}

export function PreviewPlanModal({ job, plan, onClose }: Props) {
  const writes = plan?.writes || [];
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopy = async (value: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500);
    } catch (err) {
      console.warn("Copy failed:", err);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-PreviewPlanModal-1"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
    >
      <div className="bg-card border border-border/80 shadow-xl rounded-xl w-full max-w-xl overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between bg-muted/15">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-center text-foreground">
              <Eye size={14} />
            </div>
            <div>
              <h3 id="dlg-PreviewPlanModal-1" className="font-semibold text-xs text-foreground">
                Xem trước thay đổi (Preview Plan)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Job: <span className="font-medium text-foreground">{job.jobFolderName}</span>
                {job.targetTabTitle && (
                  <> · Tab: <span className="font-medium text-foreground">{job.targetTabTitle}</span></>
                )}
                {" "}· Hàng: <span className="font-mono font-medium text-foreground">#{job.targetSheetRow}</span>
              </p>
            </div>
          </div>
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Table */}
        <div className="p-5 flex flex-col gap-3 text-xs max-h-[70vh] overflow-y-auto custom-scrollbar">
          {writes.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Không có ô nào được phép ghi cho job này.
            </div>
          ) : (
            writes.map((w, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-lg border flex flex-col gap-2 transition-all ${
                  w.allowed
                    ? "bg-muted/15 border-border/60"
                    : "bg-destructive/8 border-destructive/20 text-destructive"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-foreground px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 text-[10px]">
                      Cột {w.columnLetter}
                    </span>
                    <span className="font-medium text-xs text-foreground">
                      {w.field}
                    </span>
                  </div>

                  {w.allowed ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                      <CheckCircle2 size={12} className="text-emerald-500" /> Được phép ghi
                    </span>
                  ) : w.oldValue.trim().toLowerCase() === w.newValue.trim().toLowerCase() &&
                    w.oldValue.trim().length > 0 ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      <CheckCircle2 size={12} className="text-primary" /> Đã khớp sẵn
                    </span>
                  ) : w.blockedReason === "EXISTING_VALUE_CONFLICT" ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                      <ShieldAlert size={12} className="text-amber-500" /> Giữ ô cũ (Đã có nội dung)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                      <ShieldAlert size={12} /> Chặn:{" "}
                      {w.blockedReason === "FORMULA_CELL"
                        ? "Bảo vệ công thức"
                        : w.blockedReason === "OUTSIDE_ROW_SCOPE"
                        ? "Ngoài phạm vi dòng"
                        : w.blockedReason === "FIELD_READ_ONLY"
                        ? "Cột chỉ đọc"
                        : w.blockedReason}
                    </span>
                  )}
                </div>

                {/* Diff View */}
                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  <div className="p-2.5 bg-background/60 border border-border/60 rounded-md flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Giá trị hiện tại
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground break-all whitespace-pre-wrap">
                      {w.oldValue ? w.oldValue : "(Trống)"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-md flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-primary font-medium">
                        Giá trị mới
                      </span>
                      {w.newValue && (
                        <button
                          onClick={() => handleCopy(w.newValue, idx)}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          title="Sao chép giá trị mới"
                        >
                          {copiedIdx === idx ? <Check size={10} /> : <Copy size={10} />}
                          <span>{copiedIdx === idx ? "Đã chép" : "Sao chép"}</span>
                        </button>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-foreground font-medium break-all whitespace-pre-wrap">
                      {w.newValue ? w.newValue : "(Trống)"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Warnings note */}
          <div className="p-3 bg-muted/15 border border-border/50 rounded-lg text-[11px] text-muted-foreground flex flex-col gap-1">
            <span className="font-medium text-foreground">Nguyên tắc bảo vệ dữ liệu:</span>
            <span>• Các cột khác (Tên khách, Ngày, Giờ, Mã ảnh, Công thức) được bảo vệ chỉ đọc (READ_ONLY).</span>
            <span>• Hệ thống tự động kiểm tra lại hàng trên Sheet trước khi ghi để tránh ghi đè nhầm.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/60 flex items-center justify-end bg-muted/15">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-95 transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
