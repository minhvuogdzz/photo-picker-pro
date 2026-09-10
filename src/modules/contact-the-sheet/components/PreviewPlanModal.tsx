import React from "react";
import { Eye, X, CheckCircle2, ShieldAlert, ArrowRight } from "lucide-react";
import type { DiscoveredJob, UpdatePlan } from "../types";

interface Props {
  job: DiscoveredJob;
  plan?: UpdatePlan;
  onClose: () => void;
}

export function PreviewPlanModal({ job, plan, onClose }: Props) {
  const writes = plan?.writes || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-xl overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Eye size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-foreground">
                Xem trước thay đổi (Preview Plan)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Job: <span className="font-bold text-foreground">{job.jobFolderName}</span> — Hàng mục tiêu: <b>{job.targetSheetRow}</b>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
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
                className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
                  w.allowed
                    ? "bg-muted/15 border-border/80"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground px-2 py-0.5 rounded-md bg-muted text-[11px]">
                      Cột {w.columnLetter}
                    </span>
                    <span className="font-semibold text-xs text-foreground">
                      {w.field}
                    </span>
                  </div>

                  {w.allowed ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <CheckCircle2 size={13} /> Được phép ghi
                    </span>
                  ) : w.oldValue.trim().toLowerCase() === w.newValue.trim().toLowerCase() && w.oldValue.trim().length > 0 ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-400">
                      <CheckCircle2 size={13} /> Đã có sẵn giá trị này (Không cần ghi đè)
                    </span>
                  ) : w.blockedReason === "EXISTING_VALUE_CONFLICT" ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                      <ShieldAlert size={13} /> Bảo tồn ô cũ: Ô đã có nội dung (Chỉ ghi nếu trống)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-destructive">
                      <ShieldAlert size={13} /> Chặn: {
                        w.blockedReason === "FORMULA_CELL"
                          ? "Bảo vệ công thức ô tính"
                          : w.blockedReason === "OUTSIDE_ROW_SCOPE"
                          ? "Ngoài phạm vi dòng"
                          : w.blockedReason === "FIELD_READ_ONLY"
                          ? "Cột chỉ đọc"
                          : w.blockedReason
                      }
                    </span>
                  )}
                </div>

                {/* Diff View */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div className="p-2 bg-background/80 border border-border rounded-lg flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                      Giá trị hiện tại:
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground break-all whitespace-pre-wrap">
                      {w.oldValue ? w.oldValue : "(Trống)"}
                    </span>
                  </div>

                  <div className="p-2 bg-teal-500/10 border border-teal-500/30 rounded-lg flex flex-col gap-0.5">
                    <span className="text-[10px] text-teal-400 font-semibold uppercase">
                      Giá trị mới sẽ cập nhật:
                    </span>
                    <span className="font-mono text-[11px] text-teal-300 font-medium break-all whitespace-pre-wrap">
                      {w.newValue ? w.newValue : "(Trống)"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Warnings note */}
          <div className="p-3 bg-muted/20 border border-border rounded-xl text-[11px] text-muted-foreground flex flex-col gap-1">
            <span className="font-bold text-foreground">Nguyên tắc bảo vệ dữ liệu:</span>
            <span>• Tất cả các cột khác (Tên khách, Ngày, Giờ, Mã ảnh, Công thức tính thời gian) được bảo vệ READ_ONLY tuyệt đối.</span>
            <span>• Trước khi ghi chính thức, hệ thống sẽ tự động revalidate lại hàng này trên Sheet để chống ghi đè nhầm nếu người khác vừa sửa.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-end bg-muted/20">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-95 transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
