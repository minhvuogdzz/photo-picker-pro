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
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import {
  downloadSpreadsheetFile,
  copySpreadsheetToClipboard,
  exportDirectlyToGoogleSheets,
  type SpreadsheetExportData,
} from "../services/spreadsheetExportService";
import { useContactSheetStore } from "@/modules/contact-the-sheet/stores/useContactSheetStore";
import { useTranslation } from "@/core/lib/i18n";

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
  const { tr } = useTranslation();
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
    setGoogleProgress(tr("Bắt đầu xử lý...", "Starting export..."));

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
      setError(
        tr(
          "Không thể sao chép vào bộ nhớ tạm. Vui lòng cấp quyền clipboard.",
          "Could not copy to clipboard. Please grant clipboard permission.",
        ),
      );
    }
  };

  const dayCount = data.scanResult?.days?.length || 0;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="dlg-ExportSpreadsheetModal-1" className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="absolute inset-0" onClick={isExportingGoogle ? undefined : onClose} />

      <div className="w-full max-w-lg bg-card border border-emerald-500/30 rounded-3xl p-6 shadow-2xl relative z-10 animate-scale-in text-foreground">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isExportingGoogle}
          className="absolute right-4 top-4 w-7 h-7 rounded-full bg-muted hover:bg-muted/80 active:scale-95 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
          title={tr("Đóng", "Close")} aria-label={tr("Đóng", "Close")}
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
              <h2 id="dlg-ExportSpreadsheetModal-1" className="text-base font-bold text-foreground tracking-tight">
                {tr("Xuất Sang Trang Tính", "Export to Spreadsheet")}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {data.monthName || tr("Tháng này", "This Month")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tr("Tạo trang tính với sẵn công thức tự động tính toán như trong ứng dụng", "Create a spreadsheet pre-filled with dynamic formulas matching the app")}
            </p>
          </div>
        </div>

        {/* Overview feature pill */}
        <div className="p-3 rounded-2xl bg-muted/50 border border-border/80 mb-4 text-xs space-y-1.5">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <ListChecks size={13} className="text-emerald-500" />
            <span>{tr("Nội dung được tạo sẵn trong trang tính:", "Included in the generated spreadsheet:")}</span>
          </div>
          <ul className="text-[11px] text-muted-foreground space-y-1 pl-4 list-disc">
            <li>
              <strong>{tr("Công thức tính lương động", "Dynamic payroll formulas")}</strong>:{" "}
              {tr(
                "Tự động tính ngày công, định mức KPI, lương cơ bản theo điều kiện, thưởng vượt, thưởng hiệu suất và",
                "Auto-calculates working days, KPI quota, conditional base salary, excess pay, performance bonus, and",
              )}{" "}
              <strong>{tr("công thức tính tổng lương thực lĩnh", "net salary total formulas")}</strong>.
            </li>
            <li>
              <strong>{tr("Bảng kê chi tiết từng ngày", "Daily breakdown table")}</strong>:{" "}
              {tr(
                "Liệt kê số ảnh làm được của từng ngày trong tháng, và dòng",
                "Lists weighted photo count per day of the month, plus a",
              )}{" "}
              <strong>{tr("TỔNG CỘNG CẢ THÁNG", "MONTHLY TOTAL")}</strong>{" "}
              {tr("kèm công thức", "row with")} <code>=SUM(...)</code>.
            </li>
          </ul>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs mb-4 animate-fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">{tr("Có lỗi xảy ra:", "An error occurred:")}</p>
              <p className="text-[11px] opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Success Google Sheet Banner */}
        {googleSuccessUrl && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-foreground text-xs mb-4 animate-fade-in space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
              <CheckCircle2 size={16} />
              <span>{tr("Đã tạo Google Trang Tính thành công!", "Google Sheet created successfully!")}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {tr("Bảng tính mới đã được lưu trên Google Drive của bạn và đã mở trong trình duyệt.", "Your new spreadsheet has been saved to Google Drive and opened in the browser.")}
            </p>
            <a
              href={googleSuccessUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
            >
              <ExternalLink size={12} />
              <span>{tr("Mở lại Google Sheet trong trình duyệt", "Re-open Google Sheet in browser")}</span>
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
                    {tr("1. Xuất trực tiếp lên Google Trang tính", "1. Export directly to Google Sheets")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {isGoogleConnected
                      ? `${tr("Tài khoản Google:", "Google Account:")} ${googleConnection.accountEmail || tr("Đã kết nối", "Connected")}`
                      : tr("Tạo trang tính mới trên Google Drive & mở ngay trên trình duyệt", "Create a new spreadsheet on Google Drive & open in browser")}
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
                    <span>{googleProgress || tr("Đang tạo...", "Creating...")}</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={12} />
                    <span>{tr("Tạo Google Sheet", "Create Google Sheet")}</span>
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
                  {tr("2. Tải tệp Trang tính (.csv có công thức)", "2. Download Spreadsheet (.csv with formulas)")}
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {downloadedName
                    ? `${tr("Đã tải xuống:", "Downloaded:")} ${downloadedName}`
                    : tr("Mở trực tiếp trên Microsoft Excel, Google Sheets, LibreOffice", "Open directly in Microsoft Excel, Google Sheets, or LibreOffice")}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] border border-border text-foreground font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {downloadedName ? <Check size={12} className="text-emerald-500" /> : <Download size={12} />}
              <span>{downloadedName ? tr("Đã tải xong!", "Downloaded!") : tr("Tải tệp", "Download")}</span>
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
                  {tr("3. Sao chép dữ liệu dạng Trang tính", "3. Copy spreadsheet table data")}
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {copiedSuccess
                    ? tr("Đã sao chép! Mở Google Sheets và bấm Ctrl + V", "Copied! Open Google Sheets and press Ctrl/Cmd + V")
                    : tr("Dán trực tiếp vào bất kỳ trang tính nào có sẵn", "Paste directly into any existing spreadsheet")}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-muted/80 active:scale-[0.98] border border-border text-foreground font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {copiedSuccess ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              <span>{copiedSuccess ? tr("Đã sao chép!", "Copied!") : tr("Sao chép", "Copy")}</span>
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
            {tr("Đóng", "Close")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
