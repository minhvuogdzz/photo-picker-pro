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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5 text-amber-400">
            <AlertCircle size={20} />
            <h3 className="font-extrabold text-sm text-foreground">
              Xử lý xung đột ô {fieldName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          <p className="text-muted-foreground">
            Job <span className="font-bold text-foreground">{job.jobFolderName}</span> (Hàng {job.targetSheetRow}) đã có sẵn nội dung trong ô <b>{fieldName}</b>. Vui lòng chọn cách cập nhật:
          </p>

          {/* Current Cell Content Box */}
          <div className="bg-background/80 border border-border rounded-xl p-3 flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
              <FileText size={13} /> Nội dung hiện tại trên Sheet:
            </span>
            <div className="p-2 bg-muted/30 rounded-lg font-mono text-[11px] text-foreground max-h-24 overflow-y-auto whitespace-pre-wrap break-all custom-scrollbar">
              {existingValue || "(Trống)"}
            </div>
          </div>

          {/* Proposed Value Box */}
          <div className="bg-background/80 border border-teal-500/30 rounded-xl p-3 flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-teal-400 flex items-center gap-1">
              <Link size={13} /> Giá trị mới cần cập nhật:
            </span>
            <div className="p-2 bg-teal-500/10 rounded-lg font-mono text-[11px] text-teal-300 break-all whitespace-pre-wrap">
              {proposedValue}
            </div>
          </div>

          {/* Conflict Resolution Options */}
          <div className="flex flex-col gap-2 pt-1">
            {allowedPolicies.includes("APPEND") && (
              <label
                onClick={() => setSelectedPolicy("APPEND")}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPolicy === "APPEND"
                    ? "bg-primary/10 border-primary text-foreground shadow-sm"
                    : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground">
                    Nối tiếp vào dòng mới (Khuyến nghị)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Bảo toàn ghi chú & link cũ, tự động thêm giá trị mới xuống dòng dưới.
                  </span>
                </div>
                <input
                  type="radio"
                  name="conflict_policy"
                  checked={selectedPolicy === "APPEND"}
                  onChange={() => setSelectedPolicy("APPEND")}
                  className="text-primary focus:ring-primary h-4 w-4"
                />
              </label>
            )}

            {allowedPolicies.includes("OVERWRITE") && (
              <label
                onClick={() => setSelectedPolicy("OVERWRITE")}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPolicy === "OVERWRITE"
                    ? "bg-primary/10 border-primary text-foreground shadow-sm"
                    : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground">
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
                  className="text-primary focus:ring-primary h-4 w-4"
                />
              </label>
            )}

            {allowedPolicies.includes("SKIP") && (
              <label
                onClick={() => setSelectedPolicy("SKIP")}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  selectedPolicy === "SKIP"
                    ? "bg-primary/10 border-primary text-foreground shadow-sm"
                    : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground">
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
                  className="text-primary focus:ring-primary h-4 w-4"
                />
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-muted/20">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-semibold cursor-pointer"
          >
            Hủy
          </button>
          <button
            onClick={() => onResolve(selectedPolicy)}
            className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>Xác nhận & Chuyển sang Sẵn sàng</span>
          </button>
        </div>
      </div>
    </div>
  );
}
