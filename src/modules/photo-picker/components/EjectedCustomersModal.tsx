import React from "react";
import { Trash2, RotateCcw, X, FolderCheck, ShieldCheck, Clock, Image } from "lucide-react";
import { useAppStore } from "@/core/stores/useAppStore";

export function EjectedCustomersModal() {
  const isTrashModalOpen = useAppStore((s) => s.isTrashModalOpen);
  const setIsTrashModalOpen = useAppStore((s) => s.setIsTrashModalOpen);
  const ejectedCustomers = useAppStore((s) => s.ejectedCustomers);
  const restoreEjectedCustomer = useAppStore((s) => s.restoreEjectedCustomer);
  const clearEjectedCustomers = useAppStore((s) => s.clearEjectedCustomers);

  if (!isTrashModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlg-trash-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Trash2 size={16} />
            </div>
            <div>
              <h3 id="dlg-trash-title" className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Thùng rác khách đã xong</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-semibold border border-emerald-500/30">
                  {ejectedCustomers.length}
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Danh sách khách đã lọc và được đưa ra khỏi hàng đợi chờ
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setIsTrashModalOpen(false)}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Safety Banner */}
        <div className="px-5 py-2.5 bg-emerald-500/8 border-b border-emerald-500/20 flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300">
          <ShieldCheck size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            <strong>An toàn tuyệt đối:</strong> Các thư mục ở đây chỉ bị loại khỏi hàng đợi trong app. Toàn bộ file gốc trên ổ cứng không hề bị xóa.
          </span>
        </div>

        {/* List of Ejected Customers */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ scrollbarWidth: "thin" }}>
          {ejectedCustomers.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 border border-border/60 flex items-center justify-center mb-2.5 text-muted-foreground/60">
                <Trash2 size={22} />
              </div>
              <p className="text-xs font-semibold text-foreground/80">Thùng rác trống</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[240px]">
                Khi bạn lọc xong một khách, khách đó sẽ được vo gọn vào đây để dọn sạch hàng đợi.
              </p>
            </div>
          ) : (
            ejectedCustomers.map((cust) => (
              <div
                key={cust.id}
                className="p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/20 hover:border-border transition-all flex items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <FolderCheck size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate" title={cust.folderName}>
                      {cust.folderName}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {cust.completedAt}
                      </span>
                      {typeof cust.copyCount === "number" && cust.copyCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Image size={10} />
                            {cust.copyCount} file đã lọc
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Restore Button */}
                <button
                  type="button"
                  onClick={() => {
                    restoreEjectedCustomer(cust.folderPath);
                    setIsTrashModalOpen(false);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 hover:border-primary/40 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                  title="Đưa khách này quay trở lại hàng đợi lọc ảnh"
                >
                  <RotateCcw size={12} />
                  <span>Khôi phục</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          {ejectedCustomers.length > 0 ? (
            <button
              type="button"
              onClick={clearEjectedCustomers}
              className="text-[11px] text-destructive hover:underline cursor-pointer flex items-center gap-1"
            >
              <Trash2 size={12} />
              <span>Dọn sạch lịch sử thùng rác</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={() => setIsTrashModalOpen(false)}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-card hover:bg-muted border border-border text-foreground transition-colors cursor-pointer shadow-2xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
