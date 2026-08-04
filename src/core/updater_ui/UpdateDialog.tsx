import React, { useState } from 'react';
import { DownloadCloud, X, Zap, CheckCircle2, AlertCircle, Bug, Loader2 } from 'lucide-react';
import { UpdateCheckResult, downloadAndInstallUpdate, installAndRestart } from '@/core/updater';

interface UpdateDialogProps {
  updateResult: UpdateCheckResult;
  autoStartDownload?: boolean;
  onClose: () => void;
  onSkip: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({ updateResult, autoStartDownload, onClose, onSkip }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({
    downloaded: 0,
    total: 0,
    speed: '',
    eta: null as number | null,
    percentage: 0
  });
  const [isReadyToRestart, setIsReadyToRestart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!updateResult.hasUpdate || !updateResult.rawUpdate) {
    return null;
  }

  const { version, date, notes, rawUpdate } = updateResult;

  const handleUpdate = async () => {
    // Prevent multiple triggers
    if (isDownloading || isReadyToRestart) return;
    
    setIsDownloading(true);
    setError(null);
    
    try {
      await downloadAndInstallUpdate(
        rawUpdate,
        (contentLength, downloaded, speedStr, etaSeconds) => {
          setDownloadProgress({
            total: contentLength || 0,
            downloaded,
            speed: speedStr,
            eta: etaSeconds,
            percentage: contentLength ? (downloaded / contentLength) * 100 : 0
          });
        }
      );
      
      setIsReadyToRestart(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
      setIsDownloading(false);
    }
  };

  const handleRestart = async () => {
    try {
      await installAndRestart();
    } catch (err) {
      setError("Không thể khởi động lại ứng dụng. Vui lòng tắt và mở lại thủ công.");
    }
  };

  React.useEffect(() => {
    if (autoStartDownload && !isDownloading && !isReadyToRestart && !error) {
      handleUpdate();
    }
  }, [autoStartDownload]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-5 border-b border-blue-100 dark:border-blue-800/30 flex justify-between items-start">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
              <DownloadCloud size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Bản cập nhật mới có sẵn
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Phiên bản {version} {date ? `(Phát hành: ${date.split(' ')[0]})` : ''}
              </p>
            </div>
          </div>
          {!isDownloading && !isReadyToRestart && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <X size={20} />
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
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          ) : isReadyToRestart ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Đã tải xong bản cập nhật</h4>
              <p className="text-slate-500 dark:text-slate-400">Ứng dụng cần khởi động lại để hoàn tất việc cài đặt.</p>
            </div>
          ) : isDownloading ? (
            <div className="py-4">
              <div className="flex justify-between text-sm mb-2 text-slate-700 dark:text-slate-300">
                <span>Đang tải xuống bản cập nhật...</span>
                <span className="font-medium">{downloadProgress.percentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 mb-3 overflow-hidden">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${downloadProgress.percentage}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Tốc độ: {downloadProgress.speed}</span>
                <span>
                  {downloadProgress.eta !== null 
                    ? `Còn lại khoảng ${Math.ceil(downloadProgress.eta)} giây` 
                    : 'Đang tính toán...'}
                </span>
              </div>
            </div>
          ) : notes ? (
            <div className="space-y-2">
              {renderSection("Tính năng mới", notes.features, <Zap size={16} />, "text-amber-600 dark:text-amber-400")}
              {renderSection("Cải thiện", notes.improvements, <CheckCircle2 size={16} />, "text-green-600 dark:text-green-400")}
              {renderSection("Sửa lỗi", notes.bugFixes, <Bug size={16} />, "text-red-500 dark:text-red-400")}
              {renderSection("Lỗi đã biết", notes.knownIssues, <AlertCircle size={16} />, "text-orange-500 dark:text-orange-400")}
              
              {!notes.features.length && !notes.improvements.length && !notes.bugFixes.length && (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <p className="font-semibold mb-2">Chi tiết bản cập nhật:</p>
                  <pre className="whitespace-pre-wrap font-sans bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    {notes.raw || "Không có thông tin chi tiết."}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">Không có thông tin chi tiết về bản cập nhật này.</p>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          {error ? (
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors"
            >
              Đóng
            </button>
          ) : isReadyToRestart ? (
            <button
              onClick={handleRestart}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
            >
              <Zap size={16} /> Khởi động lại ngay
            </button>
          ) : isDownloading ? (
            <button
              disabled
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-blue-600/50 text-white flex items-center gap-2 cursor-not-allowed"
            >
              <Loader2 size={16} className="animate-spin" /> Đang tải...
            </button>
          ) : (
            <>
              <div className="flex-1 flex gap-3">
                <button
                  onClick={onSkip}
                  className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                  Bỏ qua phiên bản này
                </button>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors"
              >
                Để sau
              </button>
              <button
                onClick={handleUpdate}
                className="px-6 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
              >
                <DownloadCloud size={16} /> Cập nhật ngay
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
