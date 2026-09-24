import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Heart } from "lucide-react";
import qrImage from "@/assets/qr_donate.jpg";
import { useAppStore } from "@/core/stores/useAppStore";
import { CoffeeSteamIcon } from "./CoffeeSteamIcon";

export function DonateModal() {
  const isOpen = useAppStore((s) => s.isDonateModalOpen);
  const onClose = () => useAppStore.getState().setIsDonateModalOpen(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="bg-card text-foreground border border-amber-500/35 shadow-2xl shadow-amber-500/10 rounded-2xl w-full max-w-[340px] flex flex-col overflow-hidden my-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border/80 flex items-center justify-between bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-500 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-xs">
              <CoffeeSteamIcon size={16} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground leading-tight flex items-center gap-1">
                <span>Ủng hộ tác giả</span>
                <span className="text-amber-500">· Donate Cafe ☕</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                MVD Photoshop Academy & Studio Tools
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            title="Đóng (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-3 custom-scrollbar text-xs">
          {/* Slogan Banner */}
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 relative overflow-hidden">
            <div className="flex items-start gap-2">
              <Sparkles size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 dark:text-amber-200 italic font-medium leading-relaxed">
                "Sự ủng hộ của bạn sẽ góp phần vào sự phát triển công nghệ mới của tôi - Vuong Dev"
              </p>
            </div>
          </div>

          {/* QR Image Card — Compact, high-res & self-contained */}
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-muted/40 border border-border/70">
            <div className="relative group overflow-hidden rounded-lg border border-border/80 shadow-md bg-white p-1.5 transition-transform duration-200 hover:scale-[1.01]">
              <img
                src={qrImage}
                alt="Mã VietQR Napas 247 Ủng Hộ Tác Giả"
                className="w-[260px] h-auto object-contain rounded"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/qr_donate.jpg";
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2 font-medium">
              Quét mã bằng app ngân hàng bất kỳ (Napas 24/7)
            </p>
          </div>

          {/* Gratitude note */}
          <div className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 pt-0.5">
            <Heart size={12} className="text-rose-500 fill-rose-500/30 shrink-0 animate-pulse" />
            <span>Trân trọng cảm ơn sự đồng hành từ bạn!</span>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2 border-t border-border/70 flex items-center justify-end bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
