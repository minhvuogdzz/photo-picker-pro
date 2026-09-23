import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  FileSpreadsheet,
  X,
  Download,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import {
  downloadSpreadsheetFile,
  copySpreadsheetToClipboard,
  exportDirectlyToGoogleSheets,
  type SpreadsheetExportData,
} from "../services/spreadsheetExportService";
import { useContactSheetStore } from "@/modules/contact-the-sheet/stores/useContactSheetStore";

interface ExportSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: SpreadsheetExportData;
}

export function ExportSpreadsheetModal({
  isOpen,
  onClose,
  data,
}: ExportSpreadsheetModalProps) {
  const [isExportingGoogle, setIsExportingGoogle] = useState(false);
  const [googleProgress, setGoogleProgress] = useState<string>("");
  const [googleSuccessUrl, setGoogleSuccessUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [downloadedName, setDownloadedName] = useState<string | null>(null);

  const googleConnection = useContactSheetStore((s) => s.googleConnection);
  const isGoogleConnected = googleConnection.status === "CONNECTED";

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isExportingGoogle) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isExportingGoogle]);

  if (!isOpen) return null;

  const handleExportGoogle = async () => {
    setError(null);
    setGoogleSuccessUrl(null);
    setIsExportingGoogle(true);
    setGoogleProgress("Bắt đầu xử lý...");

    try {
      const res = await exportDirectlyToGoogleSheets(data, (msg) => {
        setGoogleProgress(msg);
      });
      setGoogleSuccessUrl(res.spreadsheetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExportingGoogle(false);
    }
  };

  const handleDownload = () => {
    try {
      const fileName = downloadSpreadsheetFile(data);
      setDownloadedName(fileName);
      setTimeout(() => setDownloadedName(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCopy = async () => {
    try {
      await copySpreadsheetToClipboard(data);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    } catch {
      setError("Không thể sao chép vào bộ nhớ tạm. Vui lòng cấp quyền clipboard.");
    }
  };

  const dayCount = data.scanResult?.days?.length || 0;

  return createPortal(
    <div className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="absolute inset-0" onClick={isExportingGoogle ? undefined : onClose} />

      <div className="w-full max-w-lg bg-card border border-emerald-500/30 rounded-3xl p-6 shadow-2xl relative z-10 animate-scale-in text-foreground">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isExportingGoogle}
          className="absolute right-4 top-4 w-7 h-7 rounded-full bg-muted hover:bg-muted/80 active:scale-95 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
          title="Đóng"
        >
          <X size={14} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground tracking-tight">
                Xuất Sang Trang Tính
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {data.monthName || "Tháng này"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tạo trang tính với sẵn công thức tự động tính toán như trong ứng dụng
            </p>
          </div>
        </div>

        {/* Overview feature pill */}
        <div className="p-3 rounded-2xl bg-muted/50 border border-border/80 mb-4 text-xs space-y-1.5">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles size={13} className="text-emerald-500" />
            <span>Nội dung được tạo sẵn trong trang tính:</span>
          </div>
          <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc">
            <li>
              <strong>Công thức tính lương động</strong>: Tự động tính ngày công, định mức KPI, lương cơ bản theo điều kiện, thưởng vượt, thưởng hiệu suất và <strong>công thức tính tổng lương thực lĩnh</strong>.
            </li>
            <li>
              <strong>Bảng kê chi tiết từng ngày</strong>: Liệt kê số ảnh làm được của từng ngày trong tháng, và dòng <strong>TỔNG CỘNG CẢ THÁNG</strong> kèm công thức <code>=SUM(...)</code>.
            </li>
          </ul>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs mb-4 animate-fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Có lỗi xảy ra:</p>
              <p className="text-[11px] opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Success Google Sheet Banner */}
        {googleSuccessUrl && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-foreground text-xs mb-4 animate-fade-in space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
              <CheckCircle2 size={16} />
              <span>Đã tạo Google Trang Tính thành công!</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Bảng tính mới đã được lưu trên Google Drive của bạn và đã mở trong trình duyệt.
            </p>
            <a
              href={googleSuccessUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
            >
              <ExternalLink size={12} />
              <span>Mở lại Google Sheet trong trình duyệt</span>
            </a>
          </div>
        )}

        {/* 3 Export Action Cards */}
        <div className="space-y-2.5">
          {/* OPTION 1: GOOGLE SHEETS DIRECT */}
          <div className="p-3.5 rounded-2xl bg-card border border-border/80 hover:border-emerald-500/40 transition-all space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ExternalLink size={14} />
                </div>
                <div>
                  <span className="font-bold text-xs block text-foreground">
                    1. Xuất trực tiếp lên Google Trang tính
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {isGoogleConnected
                      ? `Tài khoản Google: ${googleConnection.accountEmail || "Đã kết nối"}`
                      : "Tạo trang tính mới trên Google Drive & mở ngay trên trình duyệt"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportGoogle}
                disabled={isExportingGoogle}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isExportingGoogle ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>{googleProgress || "Đang tạo..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={12} />
                    <span>Tạo Google Sheet</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* OPTION 2: DOWNLOAD SPREADSHEET FILE */}
          <div className="p-3.5 rounded-2xl bg-card border border-border/80 hover:border-blue-500/40 transition-all flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Download size={14} />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xs block text-foreground truncate">
                  2. Tải tệp Trang tính (.csv có công thức)
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {downloadedName ? `Đã tải xuống: ${downloadedName}` : "Mở trực tiếp trên Microsoft Excel, Google Sheets, LibreOffice"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] border border-border text-foreground font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {downloadedName ? <Check size={12} className="text-emerald-500" /> : <Download size={12} />}
              <span>{downloadedName ? "Đã tải xong!" : "Tải tệp"}</span>
            </button>
          </div>

          {/* OPTION 3: COPY TSV FOR 1-CLICK PASTE */}
          <div className="p-3.5 rounded-2xl bg-card border border-border/80 hover:border-purple-500/40 transition-all flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Copy size={14} />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xs block text-foreground truncate">
                  3. Sao chép dữ liệu dạng Trang tính
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {copiedSuccess ? "Đã sao chép! Mở Google Sheets và bấm Ctrl + V" : "Dán trực tiếp vào bất kỳ trang tính nào có sẵn"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] border border-border text-foreground font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {copiedSuccess ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              <span>{copiedSuccess ? "Đã sao chép!" : "Sao chép"}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
