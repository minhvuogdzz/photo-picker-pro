import React, { useState } from "react";
import { CheckCircle2, Trash2, ArrowRight, X } from "lucide-react";
import { useAppStore } from "@/core/stores/useAppStore";

export function RemoveCompletedCustomerDialog() {
  const completedCustomer = useAppStore((s) => s.completedCustomerPendingRemoval);
  const setCompletedCustomerPendingRemoval = useAppStore(
    (s) => s.setCompletedCustomerPendingRemoval
  );
  const removeInputFolder = useAppStore((s) => s.removeInputFolder);
  const setDontAskRemoveCompleted = useAppStore((s) => s.setDontAskRemoveCompleted);
  const inputFolders = useAppStore((s) => s.inputFolders);

  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!completedCustomer) return null;

  const handleConfirmRemove = () => {
    if (dontAskAgain) {
      setDontAskRemoveCompleted(true);
    }
    removeInputFolder(completedCustomer.folderPath);
    setCompletedCustomerPendingRemoval(null);
  };

  const handleKeep = () => {
    if (dontAskAgain) {
      setDontAskRemoveCompleted(true);
    }
    setCompletedCustomerPendingRemoval(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-2xl border border-emerald-500/40 shadow-2xl p-5 space-y-4 animate-scale-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground">Hoàn tất lọc thư mục khách!</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Đã lọc file thành công & cập nhật trạng thái Sheet thành <span className="font-semibold text-emerald-600 dark:text-emerald-400">"Đã lọc"</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={handleKeep}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Target Folder Box */}
        <div className="p-3 rounded-xl bg-muted/40 border border-border/80 text-xs">
          <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">
            Thư mục vừa hoàn tất
          </span>
          <p className="font-bold text-foreground truncate mt-0.5 text-xs">
            {completedCustomer.folderName}
          </p>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Bạn có muốn đá thư mục này ra khỏi danh sách chờ để chuyển sang khách tiếp theo không?
          </span>
        </div>

        {/* Checkbox Don't Ask Again */}
        <label className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary/40 cursor-pointer w-3.5 h-3.5"
          />
          <span>Không hỏi lại cho những lần sau (tự động loại bỏ)</span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleKeep}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-card hover:bg-muted border border-border text-foreground transition-colors cursor-pointer"
          >
            Giữ lại
          </button>

          <button
            type="button"
            onClick={handleConfirmRemove}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            <span>Đồng ý loại bỏ & Tiếp tục</span>
          </button>
        </div>
      </div>
    </div>
  );
}
