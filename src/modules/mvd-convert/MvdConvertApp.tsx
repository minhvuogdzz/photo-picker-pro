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
import { useTranslation, localizeBackendMessage } from "@/core/lib/i18n";

export default function MvdConvertApp() {
  const { t, tr, lang } = useTranslation();
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
      title: tr("Chọn thư mục đầu vào", "Select input folder(s)"),
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
      title: tr("Chọn thư mục xuất ảnh", "Select output folder"),
    });
    if (selected && typeof selected === "string") {
      store.setOutputFolder(selected);
    }
  };

  const handleSelectReferencePhoto = async () => {
    const selected = await open({
      directory: false,
      multiple: false,
      title: tr("Chọn ảnh tham chiếu để lấy ngày chụp EXIF", "Select reference photo for EXIF capture date"),
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
        alert(tr("Không đọc được ngày chụp EXIF từ ảnh tham chiếu: ", "Could not read EXIF date from reference photo: ") + e);
      }
    }
  };

  const handleCancelConvert = async () => {
    try {
      await invoke("cancel_convert_batch");
      store.addLog(tr("Đã gửi yêu cầu dừng tiến trình xử lý...", "Requested stop for batch conversion..."));
    } catch (err) {
      console.warn("Cancel error:", err);
    }
  };

  const handleStartConvert = async () => {
    if (store.inputFolders.length === 0) {
      alert(tr("Vui lòng thêm ảnh hoặc thư mục vào trước!", "Please add photos or folders first!"));
      return;
    }
    if (!store.outputFolder) {
      alert(tr("Vui lòng chọn thư mục xuất ảnh!", "Please select an output folder!"));
      return;
    }
    if (store.fixExifDate) {
      if (store.exifDateSource === "custom" && !store.customDateTime.trim()) {
        alert(tr("Vui lòng nhập ngày giờ tùy chỉnh (ví dụ: 2026-11-11 14:30:00)!", "Please enter custom date/time (e.g., 2026-11-11 14:30:00)!"));
        return;
      }
      if (store.exifDateSource === "reference_photo" && !store.referencePhotoPath) {
        alert(tr("Vui lòng chọn ảnh tham chiếu để lấy ngày chụp!", "Please select a reference photo for capture date!"));
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
      alert(tr("Có lỗi xảy ra: ", "An error occurred: ") + e);
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
              {t("convert_file") || tr("Chuyển đổi file", "File Converter")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {tr("Chuyển đổi đa luồng hàng loạt · Giữ nguyên Color Profile & EXIF Metadata", "Multi-threaded batch conversion · Preserves Color Profile & EXIF Metadata")}
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
              {tr("Nguồn đầu vào", "Input Source")}
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
                {tr("Kéo thả ảnh hoặc thư mục vào đây", "Drag & drop photos or folders here")}
              </p>
              <p className="text-[10px] text-muted-foreground mb-3">
                {tr("Hỗ trợ CR2, CR3, ARW, NEF, HEIC, JPG, PNG...", "Supports CR2, CR3, ARW, NEF, HEIC, JPG, PNG...")}
              </p>
              <button
                onClick={handleSelectInput}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg transition-colors border border-border cursor-pointer shadow-sm"
              >
                {tr("Chọn từ máy tính", "Choose from Computer")}
              </button>
            </div>

            <div className="flex flex-col flex-1 overflow-hidden rounded-xl border border-border bg-muted/10">
              <div className="px-3 py-2 border-b border-border flex justify-between items-center bg-muted/20">
                <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={12} className="text-primary" /> {tr("Danh sách chờ (", "Queue (")}
                  {store.inputFolders.length})
                </span>
                {store.inputFolders.length > 0 && (
                  <button
                    onClick={() => store.clearInputFolders()}
                    className="text-[10px] text-destructive hover:underline font-medium transition-colors cursor-pointer"
                  >
                    {tr("Xóa tất cả", "Clear All")}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {store.inputFolders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/80 gap-1.5 py-8">
                    <FileImage size={24} className="opacity-40" />
                    <span className="text-[11px]">{tr("Chưa có thư mục nào được chọn", "No folders selected yet")}</span>
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
                        title={tr("Xóa", "Remove")}
                        aria-label={tr("Xóa", "Remove")}
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
              {tr("Cấu hình xuất", "Export Settings")}
            </h3>
          </div>

          <div className="p-4 flex flex-col gap-3 overflow-y-auto h-full custom-scrollbar">
            {/* Format Setting */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-border bg-card/60 shrink-0">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileDown size={12} className="text-primary" /> {tr("Định dạng đích", "Target Format")}
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
                  <Settings2 size={12} className="text-primary" /> {tr("Chất lượng xuất", "Export Quality")}
                </label>
                <span className="text-[11px] font-semibold text-primary font-mono">
                  {store.quality === 4
                    ? "MAX (100%)"
                    : store.quality === 3
                    ? tr("Cao (80%)", "High (80%)")
                    : store.quality === 2
                    ? tr("TB (60%)", "Med (60%)")
                    : tr("Thấp (40%)", "Low (40%)")}
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
                  {tr("Xuất JPG 2048 (Chỉ RAW)", "Export JPG 2048 (RAW Only)")}
                </span>
                <span className="text-[10px] text-muted-foreground leading-relaxed">
                  {tr("Tự động chuyển file RAW sang JPG cạnh dài 2048px (nhẹ để gửi xem trước).", "Auto-converts RAW files to 2048px long-edge JPG (lightweight preview).")}
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
                      {tr("Sửa ngày chụp", "Fix Capture Date")}
                    </span>
                    {store.fixExifDate && store.inputFolders.length > 0 && (
                      <button
                        type="button"
                        onClick={triggerExifScan}
                        disabled={store.isScanningExif}
                        className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        title={tr("Quét lại metadata ngày chụp", "Rescan EXIF date metadata")}
                      >
                        <RefreshCw
                          size={10}
                          className={store.isScanningExif ? "animate-spin" : ""}
                        />
                        {store.isScanningExif ? tr("Đang quét...", "Scanning...") : tr("Quét lại", "Rescan")}
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground leading-relaxed">
                    {tr("Phát hiện và sửa metadata ngày giờ chụp ảnh bất thường.", "Detect and fix abnormal EXIF capture timestamps.")}
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
                          {tr("Phân loại EXIF (", "EXIF Breakdown (")}{scan.totalFiles} {tr("ảnh ·", "photos ·")} {scan.scanDurationMs}ms)
                        </span>
                        <span className="font-semibold text-primary">
                          {tr("Sẽ sửa:", "Will fix:")} {scan.fixableCount}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <div className="px-2 py-1 rounded bg-background/60 border border-border/60 flex justify-between">
                          <span className="text-muted-foreground">{tr("Hợp lệ:", "Valid:")}</span>
                          <span className="font-mono font-semibold text-foreground">
                            {scan.validCount}
                          </span>
                        </div>
                        <div className="px-2 py-1 rounded bg-background/60 border border-border/60 flex justify-between">
                          <span className="text-muted-foreground">{tr("Bất thường:", "Abnormal:")}</span>
                          <span className="font-mono font-semibold text-amber-500">
                            {scan.abnormalCount}
                          </span>
                        </div>
                        <div className="px-2 py-1 rounded bg-background/60 border border-border/60 flex justify-between">
                          <span className="text-muted-foreground">{tr("Thiếu EXIF:", "Missing EXIF:")}</span>
                          <span className="font-mono font-semibold text-foreground">
                            {scan.missingCount}
                          </span>
                        </div>
                        <div className="px-2 py-1 rounded bg-background/60 border border-border/60 flex justify-between">
                          <span className="text-muted-foreground">{tr("Không hỗ trợ:", "Unsupported:")}</span>
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
                              ? tr("Ẩn chi tiết ảnh bất thường", "Hide anomalous photo details")
                              : tr(`Xem ${scan.sampleItems.length} mẫu phát hiện bất thường / thiếu EXIF`, `Show ${scan.sampleItems.length} abnormal / missing EXIF sample(s)`)}
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
                                      {item.detectedDate || tr("Trống", "Empty")}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-muted-foreground">
                                    {localizeBackendMessage(item.reasonText, lang)}
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
                      {tr(
                        "Định dạng đích BMP không hỗ trợ chuẩn EXIF (Unsupported Metadata). Ảnh vẫn được chuyển đổi bình thường nhưng không ghi metadata.",
                        "BMP output format does not support EXIF metadata. Images still convert normally without EXIF embedded."
                      )}
                    </div>
                  )}

                  {/* Replacement Date Source */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {tr("Nguồn ngày giờ thay thế", "Replacement Date Source")}
                    </label>
                    <select
                      value={store.exifDateSource}
                      onChange={(e) =>
                        store.setExifDateSource(e.target.value as ExifDateSource)
                      }
                      className="w-full px-2.5 py-1.5 bg-muted/40 hover:bg-muted/70 border border-border rounded-lg text-xs font-medium text-foreground outline-none cursor-pointer"
                    >
                      <option value="current">{tr("1. Ngày hiện tại (Giờ hệ thống)", "1. Current date (System time)")}</option>
                      <option value="file_created">{tr("2. Ngày tạo file (Filesystem)", "2. File timestamp (Filesystem)")}</option>
                      <option value="custom">{tr("3. Ngày tùy chỉnh", "3. Custom date")}</option>
                      <option value="reference_photo">{tr("4. Ngày từ ảnh tham chiếu", "4. From reference photo")}</option>
                    </select>
                  </div>

                  {/* Sub-options for File Created */}
                  {store.exifDateSource === "file_created" && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-muted-foreground">
                        {tr("Trường thời gian từ hệ thống file:", "Filesystem timestamp field:")}
                      </label>
                      <select
                        value={store.fileTimestampKind}
                        onChange={(e) =>
                          store.setFileTimestampKind(e.target.value as FileTimestampKind)
                        }
                        className="w-full px-2.5 py-1.5 bg-muted/40 border border-border rounded-lg text-[11px] text-foreground outline-none cursor-pointer"
                      >
                        <option value="created">
                          {tr("File Creation Time (Ngày tạo file gốc)", "File Creation Time")}
                        </option>
                        <option value="modified">
                          {tr("File Modification Time (Ngày sửa đổi file)", "File Modification Time")}
                        </option>
                      </select>
                    </div>
                  )}

                  {/* Sub-options for Custom Date */}
                  {store.exifDateSource === "custom" && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-muted-foreground">
                          {tr("Nhập ngày giờ (YYYY-MM-DD HH:mm:ss):", "Enter date & time (YYYY-MM-DD HH:mm:ss):")}
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
                          {tr("Giờ hiện tại", "Current time")}
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
                        <span>{tr("Giữ nguyên giờ:phút:giây gốc của ảnh (chỉ đổi ngày)", "Keep photo's original time of day (change date only)")}</span>
                      </label>
                    </div>
                  )}

                  {/* Sub-options for Reference Photo */}
                  {store.exifDateSource === "reference_photo" && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {tr("Ảnh mẫu tham chiếu:", "Reference sample photo:")}
                        </span>
                        <button
                          type="button"
                          onClick={handleSelectReferencePhoto}
                          className="px-2 py-1 bg-muted hover:bg-muted/80 border border-border rounded text-[10px] font-medium text-foreground cursor-pointer"
                        >
                          {tr("Chọn ảnh mẫu", "Choose sample photo")}
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
                          {tr("Chưa chọn ảnh tham chiếu", "No reference photo selected")}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Scope Selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {tr("Phạm vi áp dụng", "Correction Scope")}
                    </label>
                    <select
                      value={store.exifScope}
                      onChange={(e) =>
                        store.setExifScope(e.target.value as ExifCorrectionScope)
                      }
                      className="w-full px-2.5 py-1.5 bg-muted/40 hover:bg-muted/70 border border-border rounded-lg text-xs font-medium text-foreground outline-none cursor-pointer"
                    >
                      <option value="abnormal_only">
                        {tr("Chỉ sửa ảnh bất thường (Giữ nguyên ảnh hợp lệ)", "Fix abnormal photos only (keep valid photos)")}
                      </option>
                      <option value="all_files">
                        {tr("Đồng bộ toàn bộ ảnh trong danh sách", "Sync all photos in the list")}
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
                      <span>{tr("Sửa cả ảnh không có metadata ngày chụp", "Also fix photos missing capture date metadata")}</span>
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
              {tr("Xử lý & Xuất file", "Process & Export")}
            </h3>
          </div>

          <div className="p-4 flex flex-col h-full overflow-hidden gap-3">
            {/* Output Selector */}
            <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card/60 shrink-0">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {tr("Thư mục lưu trữ", "Output Directory")}
                </label>
                <button
                  onClick={handleSelectOutput}
                  className="flex items-center gap-1 px-2.5 py-1 bg-muted hover:bg-muted/80 text-foreground text-[10px] font-medium rounded-md transition-colors border border-border cursor-pointer"
                >
                  <FolderOpen size={11} /> {tr("Chọn folder", "Choose folder")}
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
                  <AlertCircle size={13} /> {tr("Chưa thiết lập thư mục xuất", "Output folder not set")}
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
                    {tr("Đã xử lý:", "Processed:")} {store.progress ? store.progress.current : 0} /{" "}
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
                      <StopCircle size={11} /> {tr("Dừng", "Stop")}
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
                  ? `${tr("Đang convert:", "Converting:")} ${store.progress.currentFile.split(/[\\/]/).pop()}`
                  : tr("Sẵn sàng hoạt động", "Ready")}
              </div>
            </div>

            {/* Batch Result Summary (when available) */}
            {report && (
              <div className="p-2.5 rounded-xl border border-border bg-card/60 flex flex-col gap-1.5 shrink-0 text-[10px]">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>{tr("Báo cáo kết quả", "Result Summary")} ({report.totalDurationMs}ms)</span>
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
                    <span className="text-muted-foreground">{tr("Đã sửa EXIF:", "EXIF Fixed:")}</span>
                    <span className="font-mono font-semibold text-primary">
                      {report.metadataFixed}
                    </span>
                  </div>
                  <div className="px-2 py-1 rounded bg-muted/30 border border-border/60 flex justify-between">
                    <span className="text-muted-foreground">{tr("Giữ nguyên:", "Unchanged:")}</span>
                    <span className="font-mono font-semibold text-foreground">
                      {report.metadataKept}
                    </span>
                  </div>
                </div>
                {(report.metadataUnsupported > 0 || report.failedCount > 0) && (
                  <div className="flex items-center justify-between text-[10px] pt-0.5 text-muted-foreground">
                    <span>{tr("Không hỗ trợ EXIF:", "EXIF Unsupported:")} {report.metadataUnsupported}</span>
                    <span
                      className={
                        report.failedCount > 0 ? "text-destructive font-semibold" : ""
                      }
                    >
                      {tr("Thất bại:", "Failed:")} {report.failedCount}
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
                    {localizeBackendMessage(log, lang)}
                  </div>
                ))}
                {store.logs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/70 gap-1">
                    <ScrollText size={18} className="opacity-30" />
                    <span className="text-[10px]">{tr("Nhật ký xử lý sẽ hiển thị tại đây", "Processing logs will appear here")}</span>
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
                  <>{tr("Đang xử lý dữ liệu...", "Processing...")}</>
                ) : (
                  <>
                    <FileDown size={14} /> {tr("Bắt đầu chuyển đổi", "Start Conversion")}
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
