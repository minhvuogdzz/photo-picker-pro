import React, { useState } from "react";
import { AlertCircle, FileText, Link, Check, X } from "lucide-react";
import type { DiscoveredJob } from "../types";

interface Props {
  job: DiscoveredJob;
  onResolve: (policy: "OVERWRITE" | "APPEND" | "SKIP") => void;
  onClose: () => void;
}

export function ConflictResolverDialog({ job, onResolve, onClose }: Props) {
  const fieldName = job.conflictDetails?.field || "Link Edit";
  const allowedPolicies = job.conflictDetails?.allowedPolicies || ["APPEND", "OVERWRITE", "SKIP"];
  const [selectedPolicy, setSelectedPolicy] = useState<"OVERWRITE" | "APPEND" | "SKIP">(
    allowedPolicies.includes("APPEND") ? "APPEND" : "OVERWRITE"
  );
  const existingValue = job.conflictDetails?.existingValue || "";
  const proposedValue = job.conflictDetails?.proposedValue || job.driveWebLink || "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-ConflictResolverDialog-1"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
    >
      <div className="bg-card border border-border/80 shadow-xl rounded-xl w-full max-w-lg overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between bg-muted/15">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500" />
            <h3 id="dlg-ConflictResolverDialog-1" className="font-semibold text-xs text-foreground">
              Xử lý xung đột ô {fieldName}
            </h3>
          </div>
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3.5 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            Job <span className="font-semibold text-foreground">{job.jobFolderName}</span>
            {job.targetTabTitle ? (
              <> (Tab <span className="font-medium text-foreground">{job.targetTabTitle}</span>, Hàng {job.targetSheetRow})</>
            ) : (
              <> (Hàng {job.targetSheetRow})</>
            )}{" "}
            đã có sẵn nội dung trong ô <span className="font-medium text-foreground">{fieldName}</span>. Chọn phương thức cập nhật:
          </p>

          {/* Current Cell Content Box */}
          <div className="bg-background/60 border border-border/60 rounded-lg p-3 flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText size={12} /> Nội dung hiện tại trên Sheet:
            </span>
            <div className="p-2 bg-muted/20 rounded-md font-mono text-[11px] text-foreground max-h-24 overflow-y-auto whitespace-pre-wrap break-all custom-scrollbar">
              {existingValue || "(Trống)"}
            </div>
          </div>

          {/* Proposed Value Box */}
          <div className="bg-background/60 border border-border/60 rounded-lg p-3 flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
              <Link size={12} /> Giá trị mới cần cập nhật:
            </span>
            <div className="p-2 bg-muted/20 rounded-md font-mono text-[11px] text-foreground break-all whitespace-pre-wrap">
              {proposedValue}
            </div>
          </div>

          {/* Conflict Resolution Options */}
          <div className="flex flex-col gap-2 pt-0.5">
            {allowedPolicies.includes("APPEND") && (
              <label
                onClick={() => setSelectedPolicy("APPEND")}
                className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPolicy === "APPEND"
                    ? "bg-primary/8 border-primary/40 text-foreground"
                    : "bg-muted/15 border-border/60 text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-xs text-foreground">
                    Nối tiếp vào dòng mới (Khuyến nghị)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Bảo toàn ghi chú và link cũ, thêm giá trị mới xuống dòng dưới.
                  </span>
                </div>
                <input
                  type="radio"
                  name="conflict_policy"
                  checked={selectedPolicy === "APPEND"}
                  onChange={() => setSelectedPolicy("APPEND")}
                  className="text-primary focus:ring-primary h-3.5 w-3.5"
                />
              </label>
            )}

            {allowedPolicies.includes("OVERWRITE") && (
              <label
                onClick={() => setSelectedPolicy("OVERWRITE")}
                className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPolicy === "OVERWRITE"
                    ? "bg-primary/8 border-primary/40 text-foreground"
                    : "bg-muted/15 border-border/60 text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-xs text-foreground">
                    Ghi đè hoàn toàn
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Xóa nội dung cũ trong ô và thay thế bằng giá trị mới.
                  </span>
                </div>
                <input
                  type="radio"
                  name="conflict_policy"
                  checked={selectedPolicy === "OVERWRITE"}
                  onChange={() => setSelectedPolicy("OVERWRITE")}
                  className="text-primary focus:ring-primary h-3.5 w-3.5"
                />
              </label>
            )}

            {allowedPolicies.includes("SKIP") && (
              <label
                onClick={() => setSelectedPolicy("SKIP")}
                className={`p-3 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPolicy === "SKIP"
                    ? "bg-primary/8 border-primary/40 text-foreground"
                    : "bg-muted/15 border-border/60 text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-xs text-foreground">
                    Bỏ qua ô này
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Giữ nguyên giá trị cũ trên Sheet, không cập nhật ô này.
                  </span>
                </div>
                <input
                  type="radio"
                  name="conflict_policy"
                  checked={selectedPolicy === "SKIP"}
                  onChange={() => setSelectedPolicy("SKIP")}
                  className="text-primary focus:ring-primary h-3.5 w-3.5"
                />
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/60 flex items-center justify-end gap-2 bg-muted/15">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={() => onResolve(selectedPolicy)}
            className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check size={13} />
            <span>Xác nhận</span>
          </button>
        </div>
      </div>
    </div>
  );
}
