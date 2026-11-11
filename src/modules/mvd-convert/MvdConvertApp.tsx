import {
  useConvertStore,
  type ConvertBatchReport,
  type ExifCorrectionScope,
  type ExifDateSource,
  type ExifScanSummary,
  type FileTimestampKind,
  type ReferencePhotoExifResult,
} from "@/core/stores/useConvertStore";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  UploadCloud,
  FolderOpen,
  Play,
  FileDown,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  FileImage,
  Layers,
  Settings2,
  FolderDown,
  ScrollText,
  CalendarClock,
  RefreshCw,
  StopCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/core/lib/i18n";

export default function MvdConvertApp() {
  const { t } = useTranslation();
  const store = useConvertStore();
  const [isHovering, setIsHovering] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showSampleAnomalies, setShowSampleAnomalies] = useState(false);

  const formats = ["JPG", "PNG", "WEBP", "TIFF", "BMP"];

  // Run fast header-only EXIF batch scan whenever EXIF correction is ON and inputs/settings change
  const triggerExifScan = useCallback(async () => {
    if (!store.fixExifDate || store.inputFolders.length === 0) {
      store.setExifScanSummary(null);
      return;
    }
    store.setIsScanningExif(true);
    try {
      const summary = await invoke<ExifScanSummary>("scan_exif_batch", {
        inputs: store.inputFolders,
        targetFormat: store.targetFormat,
        exportJpg2048: store.exportJpg2048,
        exifOptions: {
          enabled: store.fixExifDate,
          dateSource: store.exifDateSource,
          fileTimestampKind: store.fileTimestampKind,
          customDateTime: store.customDateTime,
          keepOriginalTimeOfDay: store.keepOriginalTimeOfDay,
          referencePhotoPath: store.referencePhotoPath || null,
          scope: store.exifScope,
          includeMissing: store.includeMissingExif,
          minReasonableYear: store.minReasonableYear,
        },
      });
      store.setExifScanSummary(summary);
    } catch (err) {
      console.warn("EXIF scan warning:", err);
    } finally {
      store.setIsScanningExif(false);
    }
  }, [
    store.fixExifDate,
    store.inputFolders,
    store.targetFormat,
    store.exportJpg2048,
    store.exifDateSource,
    store.fileTimestampKind,
    store.customDateTime,
    store.keepOriginalTimeOfDay,
    store.referencePhotoPath,
    store.exifScope,
    store.includeMissingExif,
    store.minReasonableYear,
  ]);

  useEffect(() => {
    triggerExifScan();
  }, [triggerExifScan]);

  // Handle Drag & Drop & Progress
  useEffect(() => {
    let unlistenDragEnter: () => void;
    let unlistenDragDrop: () => void;
    let unlistenProgress: () => void;
    let unlistenLog: () => void;

    async function setupListeners() {
      unlistenDragEnter = await listen("tauri://drag-enter", () => {
        setIsHovering(true);
      });

      unlistenDragDrop = await listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
        setIsHovering(false);
        if (event.payload.paths && event.payload.paths.length > 0) {
          store.addInputFolders(event.payload.paths);
        }
      });

      unlistenProgress = await listen<any>("convert-progress", (event) => {
        store.setProgress(event.payload);
      });

      unlistenLog = await listen<string>("convert-log", (event) => {
        store.addLog(event.payload);
      });
    }

    setupListeners();
    return () => {
      if (unlistenDragEnter) unlistenDragEnter();
      if (unlistenDragDrop) unlistenDragDrop();
      if (unlistenProgress) unlistenProgress();
      if (unlistenLog) unlistenLog();
    };
  }, []);

  const handleSelectInput = async () => {
    const selected = await open({
      directory: true,
      multiple: true,
      title: "Chọn thư mục đầu vào",
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      store.addInputFolders(paths);
    }
  };

  const handleSelectOutput = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Chọn thư mục xuất ảnh",
    });
    if (selected && typeof selected === "string") {
      store.setOutputFolder(selected);
    }
  };

  const handleSelectReferencePhoto = async () => {
    const selected = await open({
      directory: false,
      multiple: false,
      title: "Chọn ảnh tham chiếu để lấy ngày chụp EXIF",
      filters: [
        {
          name: "Images",
          extensions: [
            "jpg",
            "jpeg",
            "png",
            "webp",
            "tiff",
            "tif",
            "heic",
            "heif",
            "cr2",
            "cr3",
            "arw",
            "nef",
            "dng",
            "orf",
            "raf",
            "rw2",
          ],
        },
      ],
    });
    if (selected && typeof selected === "string") {
      try {
        const info = await invoke<ReferencePhotoExifResult>("read_reference_photo_exif", {
          filePath: selected,
        });
        store.setReferencePhoto(selected, info);
      } catch (e) {
        alert("Không đọc được ngày chụp EXIF từ ảnh tham chiếu: " + e);
      }
    }
  };

  const handleCancelConvert = async () => {
    try {
      await invoke("cancel_convert_batch");
      store.addLog("Đã gửi yêu cầu dừng tiến trình xử lý...");
    } catch (err) {
      console.warn("Cancel error:", err);
    }
  };

  const handleStartConvert = async () => {
    if (store.inputFolders.length === 0) {
      alert("Vui lòng thêm ảnh hoặc thư mục vào trước!");
      return;
    }
    if (!store.outputFolder) {
      alert("Vui lòng chọn thư mục xuất ảnh!");
      return;
    }
    if (store.fixExifDate) {
      if (store.exifDateSource === "custom" && !store.customDateTime.trim()) {
        alert("Vui lòng nhập ngày giờ tùy chỉnh (ví dụ: 2026-11-11 14:30:00)!");
        return;
      }
      if (store.exifDateSource === "reference_photo" && !store.referencePhotoPath) {
        alert("Vui lòng chọn ảnh tham chiếu để lấy ngày chụp!");
        return;
      }
    }

    store.setIsConverting(true);
    store.setProgress(null);
    store.setLastBatchReport(null);
    store.clearLogs();
    try {
      const report = await invoke<ConvertBatchReport>("run_convert_batch", {
        inputs: store.inputFolders,
        outputFolder: store.outputFolder,
        targetFormat: store.targetFormat,
        quality: store.quality,
        exportJpg2048: store.exportJpg2048,
        exifOptions: {
          enabled: store.fixExifDate,
          dateSource: store.exifDateSource,
          fileTimestampKind: store.fileTimestampKind,
          customDateTime: store.customDateTime,
          keepOriginalTimeOfDay: store.keepOriginalTimeOfDay,
          referencePhotoPath: store.referencePhotoPath || null,
          scope: store.exifScope,
          includeMissing: store.includeMissingExif,
          minReasonableYear: store.minReasonableYear,
        },
      });
      if (report && report.totalProcessed > 0) {
        store.setLastBatchReport(report);
      }
    } catch (e) {
      alert("Có lỗi xảy ra: " + e);
    } finally {
      store.setIsConverting(false);
    }
  };

  const scan = store.exifScanSummary;
  const report = store.lastBatchReport;

  return (
    <div className="w-full h-full flex flex-col bg-card/90 backdrop-blur-md rounded-xl border border-border overflow-hidden relative animate-fade-in text-foreground select-none">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex justify-between items-center shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary">
            <FileImage size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              {t("convert_file") || "Chuyển đổi file"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Chuyển đổi đa luồng hàng loạt · Giữ nguyên Color Profile & EXIF Metadata
            </p>
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="flex-1 flex flex-row w-full overflow-hidden relative z-10 divide-x divide-border">
        {/* COLUMN 1: INPUT */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/30">
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2">
            <FolderOpen size={13} className="text-primary" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Nguồn đầu vào
            </h3>
          </div>

          <div className="p-4 flex flex-col h-full overflow-hidden gap-3">
            <div
              className={`shrink-0 p-5 rounded-xl border border-dashed flex flex-col items-center justify-center transition-colors text-center relative group ${
                isHovering
                  ? "border-primary bg-primary/10"
                  : "border-border/80 bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2 bg-primary/10 text-primary">
                <UploadCloud size={20} />
              </div>
              <p className="text-xs font-semibold text-foreground mb-0.5">
                Kéo thả ảnh hoặc thư mục vào đây
              </p>
              <p className="text-[10px] text-muted-foreground mb-3">
                Hỗ trợ CR2, CR3, ARW, NEF, HEIC, JPG, PNG...
              </p>
              <button
                onClick={handleSelectInput}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg transition-colors border border-border cursor-pointer shadow-sm"
              >
                Chọn từ máy tính
              </button>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden rounded-xl border border-border bg-muted/10">
              <div className="px-3 py-2 border-b border-border flex justify-between items-center bg-muted/20">
                <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={12} className="text-primary" /> Danh sách chờ (
                  {store.inputFolders.length})
                </span>
                {store.inputFolders.length > 0 && (
                  <button
                    onClick={() => store.clearInputFolders()}
                    className="text-[10px] text-destructive hover:underline font-medium transition-colors cursor-pointer"
                  >
                    Xóa tất cả
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {store.inputFolders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/80 gap-1.5 py-8">
                    <FileImage size={24} className="opacity-40" />
                    <span className="text-[11px]">Chưa có thư mục nào được chọn</span>
                  </div>
                ) : (
                  store.inputFolders.map((f) => (
                    <div
                      key={f}
                      className="flex justify-between items-center text-[11px] bg-card p-2 rounded-lg border border-border/60 hover:border-primary/30 transition-colors group"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileImage size={13} className="text-primary shrink-0" />
                        <span className="truncate text-foreground/90 font-medium">
                          {f.split(/[\\/]/).pop()}
                        </span>
                      </div>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground cursor-pointer"
                        onClick={() => store.removeInputFolder(f)}
                        title="Xóa"
                        aria-label="Xóa"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: SETTINGS */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/20">
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2">
            <Settings2 size={13} className="text-primary" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Cấu hình xuất
            </h3>
          </div>

          <div className="p-4 flex flex-col gap-3 overflow-y-auto h-full custom-scrollbar">
            {/* Format Setting */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-border bg-card/60 shrink-0">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileDown size={12} className="text-primary" /> Định dạng đích
              </label>
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/70 border border-border rounded-lg text-xs font-semibold text-foreground transition-colors cursor-pointer"
                >
                  <span className="text-primary">{store.targetFormat}</span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-card border border-border rounded-lg shadow-lg z-20 py-1 overflow-hidden animate-fade-in">
                      {formats.map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            store.setTargetFormat(f);
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-center px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                            store.targetFormat === f
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground/80 hover:bg-muted"
                          }`}
                        >
                          {store.targetFormat === f && (
                            <CheckCircle2 size={12} className="mr-1.5" />
                          )}
                          {f}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quality Slider */}
            <div className="flex flex-col gap-2.5 p-3.5 rounded-xl border border-border bg-card/60 shrink-0">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 size={12} className="text-primary" /> Chất lượng xuất
                </label>
                <span className="text-[11px] font-semibold text-primary font-mono">
                  {store.quality === 4
                    ? "MAX (100%)"
                    : store.quality === 3
                    ? "Cao (80%)"
                    : store.quality === 2
                    ? "TB (60%)"
                    : "Thấp (40%)"}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={store.quality}
                onChange={(e) => store.setQuality(Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-0.5">
                <span>40%</span>
                <span>60%</span>
                <span>80%</span>
                <span>100%</span>
              </div>
            </div>

            {/* JPG 2048 Toggle */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-card/60 shrink-0">
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={store.exportJpg2048}
                  onChange={(e) => store.setExportJpg2048(e.target.checked)}
                />
                <div className="w-8 h-4 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary border border-border"></div>
              </label>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">
                  Xuất JPG 2048 (Chỉ RAW)
                </span>
                <span className="text-[10px] text-muted-foreground leading-relaxed">
                  Tự động chuyển file RAW sang JPG cạnh dài 2048px (nhẹ để gửi xem trước).
                </span>
              </div>
            </div>

            {/* EXIF Date Correction Toggle & Configuration */}
            <div className="flex flex-col gap-3 p-3.5 rounded-xl border border-border bg-card/60 shrink-0">
              <div className="flex items-start gap-3">
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={store.fixExifDate}
                    onChange={(e) => store.setFixExifDate(e.target.checked)}
                  />
                  <div className="w-8 h-4 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary border border-border"></div>
                </label>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <CalendarClock size={13} className="text-primary shrink-0" />
                      Sửa ngày chụp
                    </span>
                    {store.fixExifDate && store.inputFolders.length > 0 && (
                      <button
                        type="button"
                        onClick={triggerExifScan}
                        disabled={store.isScanningExif}
                        className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        title="Quét lại metadata ngày chụp"
                      >
                        <RefreshCw
                          size={10}
                          className={store.isScanningExif ? "animate-spin" : ""}
                        />
                        {store.isScanningExif ? "Đang quét..." : "Quét lại"}
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-relaxed">
                    Phát hiện và sửa metadata ngày giờ chụp ảnh bất thường.
                  </span>
                </div>
              </div>

              {store.fixExifDate && (
                <div className="pt-2.5 border-t border-border/70 flex flex-col gap-2.5 animate-fade-in">
                  {/* Live Metadata Scan Classification Summary */}
                  {scan && scan.totalFiles > 0 && (
                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/70 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-foreground">
                          Phân loại EXIF ({scan.totalFiles} ảnh · {scan.scanDurationMs}ms)
                        </span>
                        <span className="font-semibold text-primary">
                          Sẽ sửa: {scan.fixableCount}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <div className="px-2 py-1 rounded bg-background/60 border border-border/60 flex justify-between">
                          <span className="text-muted-foreground">Hợp lệ:</span>
                          <span className="font-mono font-semibold text-foreground">
                            {scan.validCount}
                          </span>
                        </div>
                        <div className="px-2 py-1 rounded bg-background/60 border border-border/60 flex justify-between">
                          <span className="text-muted-foreground">Bất thường:</span>
                          <span className="font-mono font-semibold text-amber-500">
                            {scan.abnormalCount}
                          </span>
                        </div>
                        <div className="px-2 py-1 rounded bg-background/60 border border-border/60 flex justify-between">
                          <span className="text-muted-foreground">Thiếu EXIF:</span>
                          <span className="font-mono font-semibold text-foreground">
                            {scan.missingCount}
                          </span>
                        </div>
                        <div className="px-2 py-1 rounded bg-background/60 border border-border/60 flex justify-between">
                          <span className="text-muted-foreground">Không hỗ trợ:</span>
                          <span className="font-mono font-semibold text-muted-foreground">
                            {scan.unsupportedCount}
                          </span>
                        </div>
                      </div>
                      {scan.sampleItems.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowSampleAnomalies(!showSampleAnomalies)}
                            className="text-[10px] text-primary hover:underline cursor-pointer"
                          >
                            {showSampleAnomalies
                              ? "Ẩn chi tiết ảnh bất thường"
                              : `Xem ${scan.sampleItems.length} mẫu phát hiện bất thường / thiếu EXIF`}
                          </button>
                          {showSampleAnomalies && (
                            <div className="mt-1.5 max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                              {scan.sampleItems.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="text-[10px] px-2 py-1 rounded bg-background/70 border border-border/50 flex flex-col"
                                >
                                  <div className="flex justify-between gap-2 font-medium text-foreground">
                                    <span className="truncate">{item.fileName}</span>
                                    <span className="font-mono text-muted-foreground shrink-0">
                                      {item.detectedDate || "Trống"}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-muted-foreground">
                                    {item.reasonText}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {store.targetFormat === "BMP" && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-500 leading-relaxed">
                      Định dạng đích BMP không hỗ trợ chuẩn EXIF (Unsupported Metadata). Ảnh vẫn được chuyển đổi bình thường nhưng không ghi metadata.
                    </div>
                  )}

                  {/* Replacement Date Source */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Nguồn ngày giờ thay thế
                    </label>
                    <select
                      value={store.exifDateSource}
                      onChange={(e) =>
                        store.setExifDateSource(e.target.value as ExifDateSource)
                      }
                      className="w-full px-2.5 py-1.5 bg-muted/40 hover:bg-muted/70 border border-border rounded-lg text-xs font-medium text-foreground outline-none cursor-pointer"
                    >
                      <option value="current">1. Ngày hiện tại (Giờ hệ thống)</option>
                      <option value="file_created">2. Ngày tạo file (Filesystem)</option>
                      <option value="custom">3. Ngày tùy chỉnh</option>
                      <option value="reference_photo">4. Ngày từ ảnh tham chiếu</option>
                    </select>
                  </div>

                  {/* Sub-options for File Created */}
                  {store.exifDateSource === "file_created" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted-foreground">
                        Trường thời gian từ hệ thống file:
                      </label>
                      <select
                        value={store.fileTimestampKind}
                        onChange={(e) =>
                          store.setFileTimestampKind(e.target.value as FileTimestampKind)
                        }
                        className="w-full px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-[11px] text-foreground outline-none cursor-pointer"
                      >
                        <option value="created">
                          File Creation Time (Ngày tạo file gốc)
                        </option>
                        <option value="modified">
                          File Modification Time (Ngày sửa đổi file)
                        </option>
                      </select>
                    </div>
                  )}

                  {/* Sub-options for Custom Date */}
                  {store.exifDateSource === "custom" && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-muted-foreground">
                          Nhập ngày giờ (YYYY-MM-DD HH:mm:ss):
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const pad = (n: number) => String(n).padStart(2, "0");
                            store.setCustomDateTime(
                              `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
                                now.getDate()
                              )} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
                                now.getSeconds()
                              )}`
                            );
                          }}
                          className="text-[10px] text-primary hover:underline cursor-pointer"
                        >
                          Giờ hiện tại
                        </button>
                      </div>
                      <input
                        type="text"
                        value={store.customDateTime}
                        onChange={(e) => store.setCustomDateTime(e.target.value)}
                        placeholder="2026-11-11 14:30:00"
                        className="w-full px-2.5 py-1.5 bg-background/70 border border-border rounded-lg text-xs font-mono text-foreground outline-none focus:border-primary"
                      />
                      <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={store.keepOriginalTimeOfDay}
                          onChange={(e) =>
                            store.setKeepOriginalTimeOfDay(e.target.checked)
                          }
                          className="rounded border-border accent-primary cursor-pointer"
                        />
                        <span>Giữ nguyên giờ:phút:giây gốc của ảnh (chỉ đổi ngày)</span>
                      </label>
                    </div>
                  )}

                  {/* Sub-options for Reference Photo */}
                  {store.exifDateSource === "reference_photo" && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          Ảnh mẫu tham chiếu:
                        </span>
                        <button
                          type="button"
                          onClick={handleSelectReferencePhoto}
                          className="px-2 py-1 bg-muted hover:bg-muted/80 border border-border rounded text-[10px] font-medium text-foreground cursor-pointer"
                        >
                          Chọn ảnh mẫu
                        </button>
                      </div>
                      {store.referencePhotoInfo ? (
                        <div className="px-2.5 py-1.5 rounded-lg bg-background/60 border border-border text-[10px] flex flex-col gap-0.5">
                          <span className="font-medium text-foreground truncate">
                            {store.referencePhotoInfo.fileName}
                          </span>
                          <span className="font-mono text-primary">
                            EXIF: {store.referencePhotoInfo.exifDatetime}{" "}
                            {store.referencePhotoInfo.exifOffset}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-amber-500">
                          Chưa chọn ảnh tham chiếu
                        </span>
                      )}
                    </div>
                  )}

                  {/* Scope Selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Phạm vi áp dụng
                    </label>
                    <select
                      value={store.exifScope}
                      onChange={(e) =>
                        store.setExifScope(e.target.value as ExifCorrectionScope)
                      }
                      className="w-full px-2.5 py-1.5 bg-muted/40 hover:bg-muted/70 border border-border rounded-lg text-xs font-medium text-foreground outline-none cursor-pointer"
                    >
                      <option value="abnormal_only">
                        Chỉ sửa ảnh bất thường (Giữ nguyên ảnh hợp lệ)
                      </option>
                      <option value="all_files">
                        Đồng bộ toàn bộ ảnh trong danh sách
                      </option>
                    </select>
                  </div>

                  {/* Include Missing Metadata Toggle */}
                  {store.exifScope === "abnormal_only" && (
                    <label className="flex items-center gap-2 text-[11px] text-foreground/90 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={store.includeMissingExif}
                        onChange={(e) => store.setIncludeMissingExif(e.target.checked)}
                        className="rounded border-border accent-primary cursor-pointer"
                      />
                      <span>Sửa cả ảnh không có metadata ngày chụp</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 3: OUTPUT & ACTION */}
        <div className="flex-1 flex flex-col min-w-0 bg-background/30">
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center gap-2">
            <FolderDown size={13} className="text-primary" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Xử lý & Xuất file
            </h3>
          </div>

          <div className="p-4 flex flex-col h-full overflow-hidden gap-3">
            {/* Output Selector */}
            <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card/60 shrink-0">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Thư mục lưu trữ
                </label>
                <button
                  onClick={handleSelectOutput}
                  className="flex items-center gap-1 px-2.5 py-1 bg-muted hover:bg-muted/80 text-foreground text-[10px] font-medium rounded-md transition-colors border border-border cursor-pointer"
                >
                  <FolderOpen size={11} /> Chọn folder
                </button>
              </div>

              {store.outputFolder ? (
                <div
                  className="text-[11px] text-foreground truncate bg-muted/30 px-3 py-2 rounded-lg border border-border font-mono flex items-center gap-2"
                  title={store.outputFolder}
                >
                  <CheckCircle2 size={13} className="text-primary shrink-0" />
                  <span className="truncate">{store.outputFolder}</span>
                </div>
              ) : (
                <div className="text-[11px] text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20 flex items-center gap-2 font-medium">
                  <AlertCircle size={13} /> Chưa thiết lập thư mục xuất
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="p-3 rounded-xl border border-border bg-card/60 flex flex-col gap-2 shrink-0">
              <div className="flex justify-between items-end">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-foreground font-mono">
                    {store.progress ? store.progress.percentage : 0}%
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase">
                    Đã xử lý: {store.progress ? store.progress.current : 0} /{" "}
                    {store.progress ? store.progress.total : 0}
                  </span>
                </div>
                {store.isConverting && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelConvert}
                      className="px-2 py-0.5 rounded bg-destructive/15 hover:bg-destructive/25 text-destructive text-[10px] font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <StopCircle size={11} /> Dừng
                    </button>
                    <div className="animate-spin text-primary">
                      <Play size={14} />
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{
                    width: `${store.progress ? store.progress.percentage : 0}%`,
                  }}
                />
              </div>

              <div className="text-[10px] text-muted-foreground truncate h-3.5">
                {store.progress?.currentFile
                  ? `Đang convert: ${store.progress.currentFile.split(/[\\/]/).pop()}`
                  : "Sẵn sàng hoạt động"}
              </div>
            </div>

            {/* Batch Result Summary (when available) */}
            {report && (
              <div className="p-2.5 rounded-xl border border-border bg-card/60 flex flex-col gap-1.5 shrink-0 text-[10px]">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>Báo cáo kết quả ({report.totalDurationMs}ms)</span>
                  <span className="font-mono text-primary">
                    {report.throughputFilesPerSec} files/s
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div className="px-2 py-1 rounded bg-muted/30 border border-border/60 flex justify-between">
                    <span className="text-muted-foreground">Convert:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {report.convertedSuccess}/{report.totalProcessed}
                    </span>
                  </div>
                  <div className="px-2 py-1 rounded bg-muted/30 border border-border/60 flex justify-between">
                    <span className="text-muted-foreground">Đã sửa EXIF:</span>
                    <span className="font-mono font-semibold text-primary">
                      {report.metadataFixed}
                    </span>
                  </div>
                  <div className="px-2 py-1 rounded bg-muted/30 border border-border/60 flex justify-between">
                    <span className="text-muted-foreground">Giữ nguyên:</span>
                    <span className="font-mono font-semibold text-foreground">
                      {report.metadataKept}
                    </span>
                  </div>
                </div>
                {(report.metadataUnsupported > 0 || report.failedCount > 0) && (
                  <div className="flex items-center justify-between text-[10px] pt-0.5 text-muted-foreground">
                    <span>Không hỗ trợ EXIF: {report.metadataUnsupported}</span>
                    <span
                      className={
                        report.failedCount > 0 ? "text-destructive font-semibold" : ""
                      }
                    >
                      Thất bại: {report.failedCount}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Logs */}
            <div className="flex-1 bg-background/60 rounded-xl border border-border p-2.5 flex flex-col overflow-hidden">
              <div className="h-full overflow-y-auto custom-scrollbar space-y-1">
                {store.logs.map((log, i) => (
                  <div
                    key={i}
                    className="text-[10px] font-mono text-muted-foreground break-all leading-relaxed"
                  >
                    <span className="text-primary/70 mr-1.5 select-none">
                      [{new Date().toLocaleTimeString()}]
                    </span>
                    {log}
                  </div>
                ))}
                {store.logs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/70 gap-1">
                    <ScrollText size={18} className="opacity-30" />
                    <span className="text-[10px]">Nhật ký xử lý sẽ hiển thị tại đây</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="shrink-0">
              <button
                onClick={handleStartConvert}
                disabled={store.isConverting || store.inputFolders.length === 0}
                className={`w-full py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  store.isConverting
                    ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                    : store.inputFolders.length === 0
                    ? "bg-muted text-muted-foreground/70 cursor-not-allowed border border-border"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                }`}
              >
                {store.isConverting ? (
                  <>Đang xử lý dữ liệu...</>
                ) : (
                  <>
                    <FileDown size={14} /> Bắt đầu chuyển đổi
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
