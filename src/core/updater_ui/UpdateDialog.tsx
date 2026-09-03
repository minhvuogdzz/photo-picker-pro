import React from 'react';
import { DownloadCloud, X, Zap, CheckCircle2, AlertCircle, Bug, Loader2, Clock } from 'lucide-react';
import { useUpdaterStore } from '@/core/stores/useUpdaterStore';
import { UpdateCheckResult } from '@/core/updater';

interface UpdateDialogProps {
  updateResult?: UpdateCheckResult | null;
  onClose?: () => void;
  onSkip?: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  updateResult: propUpdateResult,
  onClose: propOnClose,
  onSkip: propOnSkip,
}) => {
  const storeUpdateResult = useUpdaterStore((s) => s.updateResult);
  const showModal = useUpdaterStore((s) => s.showModal);
  const isDownloading = useUpdaterStore((s) => s.isDownloading);
  const downloadProgress = useUpdaterStore((s) => s.downloadProgress);
  const isReadyToRestart = useUpdaterStore((s) => s.isReadyToRestart);
  const error = useUpdaterStore((s) => s.error);
  const startDownload = useUpdaterStore((s) => s.startDownload);
  const applyAndRestart = useUpdaterStore((s) => s.applyAndRestart);
  const closeModal = useUpdaterStore((s) => s.closeModal);
  const remindMeLater = useUpdaterStore((s) => s.remindMeLater);

  // If props are passed explicitly, use them; otherwise use store state
  const activeUpdate = propUpdateResult !== undefined ? propUpdateResult : storeUpdateResult;
  const isVisible = propUpdateResult !== undefined ? !!propUpdateResult : showModal;

  if (!isVisible || !activeUpdate || !activeUpdate.hasUpdate || !activeUpdate.rawUpdate) {
    return null;
  }

  const { version, date, notes } = activeUpdate;

  const handleClose = () => {
    if (propOnClose) {
      propOnClose();
    } else {
      closeModal();
    }
  };

  const handleRemindLater = () => {
    if (propOnSkip) {
      propOnSkip();
    } else {
      remindMeLater();
    }
  };

  const handleUpdate = () => {
    startDownload();
  };

  const handleRestart = () => {
    applyAndRestart();
  };

  const renderSection = (title: string, items: string[], icon: React.ReactNode, colorClass: string) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="mb-4">
        <h4 className={`text-sm font-semibold flex items-center gap-1.5 mb-2 ${colorClass}`}>
          {icon} {title}
        </h4>
        <ul className="space-y-1.5 ml-1">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#16181d] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-blue-50/80 dark:bg-blue-950/30 px-6 py-5 border-b border-blue-100 dark:border-blue-900/30 flex justify-between items-start">
          <div className="flex gap-3.5 items-center">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0 shadow-sm border border-blue-200 dark:border-blue-700/50">
              <DownloadCloud size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Bản cập nhật mới có sẵn
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono font-semibold border border-blue-200 dark:border-blue-700/50">
                  v{version}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {date ? `Phát hành: ${date.split(' ')[0]}` : 'Phiên bản chính thức mới nhất'}
              </p>
            </div>
          </div>
          {!isDownloading && !isReadyToRestart && (
            <button
              onClick={handleRemindLater}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              title="Đóng và nhắc tôi sau"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto custom-scrollbar flex-1">
          {error ? (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm border border-red-200 dark:border-red-800/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Cập nhật thất bại</p>
                <p className="opacity-90 text-xs">{error}</p>
              </div>
            </div>
          ) : isReadyToRestart ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mx-auto mb-4 border border-green-200 dark:border-green-800/40 shadow-sm">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">Đã tải xong bản cập nhật</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Ứng dụng đã sẵn sàng áp dụng phiên bản mới. Nhấn khởi động lại ngay để hoàn tất việc cập nhật.
              </p>
            </div>
          ) : isDownloading ? (
            <div className="py-5">
              <div className="flex justify-between text-sm mb-2 text-slate-700 dark:text-slate-300">
                <span className="font-medium text-xs">Đang tải xuống bản cập nhật...</span>
                <span className="font-bold text-primary font-mono text-xs">{downloadProgress.percentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-2 mb-3 overflow-hidden border border-border/30">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-indigo-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${downloadProgress.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span>Tốc độ: {downloadProgress.speed || "0 MB/s"}</span>
                <span>
                  {downloadProgress.eta !== null 
                    ? `Còn lại khoảng ${Math.ceil(downloadProgress.eta)} giây` 
                    : 'Đang tải gói dữ liệu...'}
                </span>
              </div>
            </div>
          ) : notes ? (
            <div className="space-y-3">
              {renderSection("Tính năng mới", notes.features, <Zap size={15} />, "text-amber-500 dark:text-amber-400")}
              {renderSection("Cải thiện", notes.improvements, <CheckCircle2 size={15} />, "text-emerald-500 dark:text-emerald-400")}
              {renderSection("Sửa lỗi", notes.bugFixes, <Bug size={15} />, "text-red-500 dark:text-red-400")}
              {renderSection("Lỗi đã biết", notes.knownIssues, <AlertCircle size={15} />, "text-orange-500 dark:text-orange-400")}
              
              {!notes.features.length && !notes.improvements.length && !notes.bugFixes.length && (
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  <p className="font-semibold mb-2 text-foreground">Chi tiết bản cập nhật:</p>
                  <pre className="whitespace-pre-wrap font-sans bg-slate-50 dark:bg-black/30 p-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs leading-relaxed">
                    {notes.raw || "Phiên bản tối ưu hóa hiệu suất và sửa lỗi hệ thống."}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400">Bản cập nhật bao gồm các cải tiến hiệu năng và ổn định hệ thống.</p>
          )}
        </div>

        {/* Footer: 2 lựa chọn duy nhất "Cập nhật ngay" và "Nhắc tôi sau" */}
        <div className="bg-slate-50 dark:bg-white/[0.02] px-6 py-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2.5">
          {error ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-all cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={handleUpdate}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <DownloadCloud size={14} /> Thử lại
              </button>
            </>
          ) : isReadyToRestart ? (
            <button
              onClick={handleRestart}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Zap size={15} /> Khởi động lại ngay
            </button>
          ) : isDownloading ? (
            <button
              disabled
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-primary/40 text-primary-foreground/70 flex items-center gap-2 cursor-not-allowed"
            >
              <Loader2 size={14} className="animate-spin" /> Đang tải bản cập nhật...
            </button>
          ) : (
            <>
              <button
                onClick={handleRemindLater}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 cursor-pointer border border-border/50"
              >
                <Clock size={13} />
                Nhắc tôi sau
              </button>
              <button
                onClick={handleUpdate}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-blue-400/30"
              >
                <DownloadCloud size={14} />
                Cập nhật ngay
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
