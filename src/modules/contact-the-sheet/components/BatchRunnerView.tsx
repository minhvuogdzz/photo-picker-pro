import React, { useState, useEffect } from "react";
import {
  FolderPlus,
  Play,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  Settings2,
  Layers,
  Sparkles,
  Check,
  FolderSync,
  X,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useContactSheetStore } from "../stores/useContactSheetStore";
import { folderScannerService } from "../services/folderScannerService";
import { batchPlannerService } from "../services/batchPlannerService";
import { sheetUpdateService } from "../services/sheetUpdateService";
import { sheetDiscoveryService } from "../services/sheetDiscoveryService";
import { PreviewPlanModal } from "./PreviewPlanModal";
import { ConflictResolverDialog } from "./ConflictResolverDialog";
import type { DiscoveredJob } from "../types";

export function BatchRunnerView() {
  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const discoveredJobs = useContactSheetStore((s) => s.discoveredJobs);
  const setDiscoveredJobs = useContactSheetStore((s) => s.setDiscoveredJobs);
  const updateJob = useContactSheetStore((s) => s.updateJob);
  const clearJobs = useContactSheetStore((s) => s.clearJobs);
  const isScanning = useContactSheetStore((s) => s.isScanning);
  const setIsScanning = useContactSheetStore((s) => s.setIsScanning);
  const scanProgress = useContactSheetStore((s) => s.scanProgress);
  const setScanProgress = useContactSheetStore((s) => s.setScanProgress);
  const updatePlans = useContactSheetStore((s) => s.updatePlans);
  const setUpdatePlan = useContactSheetStore((s) => s.setUpdatePlan);
  const isExecutingBatch = useContactSheetStore((s) => s.isExecutingBatch);
  const setIsExecutingBatch = useContactSheetStore((s) => s.setIsExecutingBatch);
  const batchProgress = useContactSheetStore((s) => s.batchProgress);
  const setBatchProgress = useContactSheetStore((s) => s.setBatchProgress);
  const switchActiveTab = useContactSheetStore((s) => s.switchActiveTab);
  const googleConnection = useContactSheetStore((s) => s.googleConnection);

  const [isDragging, setIsDragging] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [inspectingJob, setInspectingJob] = useState<DiscoveredJob | null>(null);
  const [resolvingConflictJob, setResolvingConflictJob] = useState<DiscoveredJob | null>(null);
  const [assigningRowJob, setAssigningRowJob] = useState<DiscoveredJob | null>(null);
  const [reviewingJob, setReviewingJob] = useState<DiscoveredJob | null>(null);
  const [manualRowInput, setManualRowInput] = useState<string>("");

  // Setup drag & drop listener from native Tauri window
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupDrop = async () => {
      try {
        unlisten = await getCurrentWindow().onDragDropEvent((event) => {
          if (event.payload.type === "enter" || event.payload.type === "over") {
            setIsDragging(true);
          } else if (event.payload.type === "leave") {
            setIsDragging(false);
          } else if (event.payload.type === "drop") {
            setIsDragging(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              handleProcessFolderPaths(paths);
            }
          }
        });
      } catch (err) {
        console.warn("Native drag & drop setup error:", err);
      }
    };
    setupDrop();
    return () => {
      if (unlisten) unlisten();
    };
  }, [activeProfile]);

  const handlePickFolders = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Chọn thư mục chứa các job hoàn thành của ngày",
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        await handleProcessFolderPaths(paths);
      }
    } catch (err) {
      console.error("Open folder dialog error:", err);
    }
  };

  const handleProcessFolderPaths = async (paths: string[]) => {
    if (!activeProfile) return;
    setIsScanning(true);
    setScanProgress({ current: 0, total: 100, message: "Đang phân tích cây thư mục..." });

    try {
      // Determine if sandbox mode should be used
      // If user has connected Google, prioritize live Google Sheets API for the tab
      const isSandbox = activeProfile.isMockSandbox && googleConnection.status !== "CONNECTED";

      setScanProgress({
        current: 20,
        total: 100,
        message: isSandbox
          ? "Đang nạp dữ liệu bảng tính mẫu..."
          : `Đang tải dữ liệu từ Google Sheet tab "${activeProfile.selectedTabTitle}"...`,
      });

      const sampleRows = await sheetDiscoveryService.fetchSheetRowsForMatching(
        activeProfile.spreadsheetId,
        activeProfile.selectedTabTitle,
        activeProfile.rowScope.startRow,
        1000,
        isSandbox
      );

      setScanProgress({
        current: 50,
        total: 100,
        message: "Đang quét thư mục thành phẩm sâu nhất & trích xuất tên khách hàng...",
      });

      const jobs = await folderScannerService.scanAndDiscoverJobs(
        paths,
        activeProfile,
        sampleRows,
        isSandbox,
        (msg) => setScanProgress({ current: 65, total: 100, message: msg })
      );

      setScanProgress({
        current: 85,
        total: 100,
        message: "Đang dóng hàng ngang và lập kế hoạch cập nhật bảng tính...",
      });

      // Plan batch and assign plans
      const planSummary = batchPlannerService.planBatch(jobs, activeProfile);
      Object.entries(planSummary.plans).forEach(([id, p]) => setUpdatePlan(id, p));

      const finalJobs = [
        ...planSummary.readyJobs,
        ...planSummary.conflictJobs,
        ...planSummary.needsReviewJobs,
        ...planSummary.errorJobs,
      ];
      setDiscoveredJobs(finalJobs);
    } catch (err: any) {
      console.error("Scan & discover jobs error:", err);
      alert(`Lỗi khi quét và khớp dữ liệu: ${err?.message || String(err)}`);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const handleExecuteUpdate = async () => {
    if (!activeProfile) return;
    const readyJobs = discoveredJobs.filter((j) => j.status === "READY");
    if (readyJobs.length === 0) return;

    setIsExecutingBatch(true);
    setBatchProgress({ current: 0, total: readyJobs.length });

    try {
      const summary = await sheetUpdateService.executeBatchUpdates(
        readyJobs,
        updatePlans,
        activeProfile,
        (current, total) => setBatchProgress({ current, total })
      );

      // Update local job statuses
      const updated = discoveredJobs.map((j) => {
        if (j.status === "READY") {
          return { ...j, status: "COMPLETED" as const };
        }
        return j;
      });
      setDiscoveredJobs(updated);

      alert(`Hoàn tất cập nhật!\n- Thành công: ${summary.successCount} jobs\n- Xung đột: ${summary.conflictCount}\n- Lỗi: ${summary.failedCount}`);
    } catch (err) {
      console.error("Execute batch error:", err);
      alert(`Lỗi thực thi cập nhật: ${err}`);
    } finally {
      setIsExecutingBatch(false);
      setBatchProgress(null);
    }
  };

  const handleResolveConflict = (policy: "OVERWRITE" | "APPEND" | "SKIP") => {
    if (!resolvingConflictJob || !activeProfile) return;

    const updatedJob: DiscoveredJob = {
      ...resolvingConflictJob,
      conflictDetails: resolvingConflictJob.conflictDetails
        ? { ...resolvingConflictJob.conflictDetails, resolvedPolicy: policy }
        : undefined,
      status: policy === "SKIP" ? "SKIPPED" : "READY",
    };

    const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(updatedJob, activeProfile);
    setUpdatePlan(plannedJob.id, plan);
    updateJob(plannedJob.id, plannedJob);
    setResolvingConflictJob(null);
  };

  const handleBulkResolveConflict = (policy: "OVERWRITE" | "APPEND" | "SKIP") => {
    if (!activeProfile) return;
    const conflicts = discoveredJobs.filter((j) => j.status === "CONFLICT");
    for (const job of conflicts) {
      const allowed = job.conflictDetails?.allowedPolicies || ["OVERWRITE", "SKIP"];
      const effectivePolicy = policy === "APPEND" && !allowed.includes("APPEND") ? "OVERWRITE" : policy;

      const updatedJob: DiscoveredJob = {
        ...job,
        conflictDetails: job.conflictDetails
          ? { ...job.conflictDetails, resolvedPolicy: effectivePolicy }
          : undefined,
        status: effectivePolicy === "SKIP" ? "SKIPPED" : "READY",
      };

      const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(updatedJob, activeProfile);
      setUpdatePlan(plannedJob.id, plan);
      updateJob(plannedJob.id, plannedJob);
    }
  };

  const handleManualAssignRow = (job: DiscoveredJob, rowNumber: number) => {
    if (!activeProfile || rowNumber <= 0) return;

    const updatedJob: DiscoveredJob = {
      ...job,
      targetSheetRow: rowNumber,
      statusReason: undefined,
    };

    const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(updatedJob, activeProfile);
    setUpdatePlan(job.id, plan);
    updateJob(job.id, plannedJob);
    setAssigningRowJob(null);
    setManualRowInput("");
  };

  const handleSelectCandidateRow = (job: DiscoveredJob, rowNumber: number, rowSnapshot?: Record<string, string>) => {
    if (!activeProfile || rowNumber <= 0) return;

    const updatedJob: DiscoveredJob = {
      ...job,
      targetSheetRow: rowNumber,
      targetRowSnapshot: rowSnapshot || job.targetRowSnapshot,
      statusReason: undefined,
    };

    const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(updatedJob, activeProfile);
    setUpdatePlan(job.id, plan);
    updateJob(job.id, plannedJob);
    setReviewingJob(null);
  };

  // Status Counts
  const readyCount = discoveredJobs.filter((j) => j.status === "READY").length;
  const conflictCount = discoveredJobs.filter((j) => j.status === "CONFLICT").length;
  const needsReviewCount = discoveredJobs.filter((j) => j.status === "NEEDS_REVIEW").length;
  const errorCount = discoveredJobs.filter((j) => j.status === "ERROR").length;
  const completedCount = discoveredJobs.filter((j) => j.status === "COMPLETED").length;

  const filteredJobs = discoveredJobs.filter((j) => {
    if (filterStatus === "ALL") return true;
    return j.status === filterStatus;
  });

  const availableTabTitles = activeProfile?.tabConfigurations
    ? Object.keys(activeProfile.tabConfigurations)
    : [activeProfile?.selectedTabTitle || "Trang tính1"];

  const writableColsText =
    activeProfile?.fieldMappings
      .filter((m) => m.permission === "READ_WRITE")
      .map((m) => `${m.columnHeader} (${m.columnLetter})`)
      .join(", ") || "Chưa chọn cột ghi";

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-3 text-foreground custom-scrollbar">
      {/* Tab & Workspace Bar */}
      <div className="flex items-center justify-between p-3 bg-card/60 border border-border/80 rounded-2xl shrink-0 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Trang tính (Tab):</span>
            {availableTabTitles.length > 1 ? (
              <select
                value={activeProfile?.selectedTabTitle || ""}
                onChange={(e) => {
                  switchActiveTab(e.target.value);
                  if (discoveredJobs.length > 0) {
                    alert(`Đã chuyển sang tab "${e.target.value}". Hãy bấm chọn lại thư mục để so khớp dữ liệu theo cấu trúc cột của tab này.`);
                  }
                }}
                className="bg-background border border-border text-foreground font-semibold text-xs rounded-xl px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary shadow-inner cursor-pointer"
              >
                {availableTabTitles.map((title) => (
                  <option key={title} value={title}>
                    {title} {activeProfile?.tabConfigurations?.[title] ? "(Đã cấu hình riêng)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="px-2.5 py-0.5 bg-primary/10 border border-primary/25 text-primary text-xs font-semibold rounded-lg">
                {activeProfile?.selectedTabTitle || "Edit 9/2026"}
              </span>
            )}
          </div>

          <div className="h-4 w-px bg-border/80" />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tiêu đề: <b className="text-foreground">Dòng {activeProfile?.headerRow || 3}</b></span>
            <span>•</span>
            <span>Cột ghi: <b className="text-emerald-400 font-semibold">{writableColsText}</b></span>
          </div>
        </div>

        {discoveredJobs.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={clearJobs}
              className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground font-semibold rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
            >
              Xóa danh sách
            </button>
          </div>
        )}
      </div>

      {/* Compact Drop Zone - Ultra Minimal Vertical Footprint */}
      <div
        onClick={handlePickFolders}
        className={`px-4 py-2.5 rounded-xl border border-dashed flex items-center justify-between transition-all cursor-pointer select-none shrink-0 ${
          isDragging
            ? "border-primary bg-primary/15 shadow-md ring-2 ring-primary/30"
            : "border-border/80 bg-card/40 hover:bg-card/70 hover:border-primary/50 shadow-sm"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
            <FolderPlus size={15} />
          </div>
          <div className="flex items-center gap-2 truncate">
            <span className="text-xs font-bold text-foreground truncate">
              {isDragging ? "Thả thư mục vào đây để quét tự động" : "Kéo thả thư mục ngày (hoặc từng job) vào đây"}
            </span>
            <span className="text-[11px] text-muted-foreground hidden sm:inline truncate">
              — hệ thống sẽ tự động quét đệ quy & đối soát dòng trên Google Sheets
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isScanning ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/15 border border-primary/30 text-primary text-xs font-semibold rounded-lg">
              <RotateCw size={12} className="animate-spin" />
              <span>Đang quét...</span>
            </div>
          ) : (
            <button
              type="button"
              className="px-3 py-1 bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold rounded-lg border border-border/80 transition-colors cursor-pointer"
            >
              Chọn thư mục
            </button>
          )}
        </div>
      </div>

      {/* Scanning In-Progress Banner - Visual Feedback */}
      {isScanning && (
        <div className="p-3.5 bg-card/95 border border-primary/35 rounded-xl flex items-center justify-between gap-4 shadow-xl backdrop-blur-xl animate-fade-in shrink-0 ring-1 ring-primary/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0">
              <RotateCw size={16} className="animate-spin" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-foreground">
                  Đang đồng bộ Google Sheets & quét cây thư mục...
                </span>
                {scanProgress?.total ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/15 text-primary font-bold">
                    {scanProgress.current}%
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {scanProgress?.message || "Đang truy vấn dữ liệu từ trang tính Google Sheets và so khớp..."}
              </p>
            </div>
          </div>

          <div className="w-28 hidden sm:block shrink-0">
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(15, scanProgress?.current || 25)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Metric Filter Tabs */}
      {discoveredJobs.length > 0 && (
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-background/60 border border-border/80 rounded-xl">
            <button
              onClick={() => setFilterStatus("ALL")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === "ALL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({discoveredJobs.length})
            </button>
            <button
              onClick={() => setFilterStatus("READY")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                filterStatus === "READY"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-emerald-400 hover:text-emerald-300"
              }`}
            >
              <CheckCircle2 size={12} />
              <span>Sẵn sàng ({readyCount})</span>
            </button>
            <button
              onClick={() => setFilterStatus("CONFLICT")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                filterStatus === "CONFLICT"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-amber-400 hover:text-amber-300"
              }`}
            >
              <AlertCircle size={12} />
              <span>Xung đột ({conflictCount})</span>
            </button>
            <button
              onClick={() => setFilterStatus("NEEDS_REVIEW")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                filterStatus === "NEEDS_REVIEW"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-purple-300 hover:text-purple-200"
              }`}
            >
              <AlertTriangle size={12} />
              <span>Cần duyệt ({needsReviewCount})</span>
            </button>
            {completedCount > 0 && (
              <button
                onClick={() => setFilterStatus("COMPLETED")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filterStatus === "COMPLETED"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-blue-400 hover:text-blue-300"
                }`}
              >
                <Check size={12} />
                <span>Đã cập nhật ({completedCount})</span>
              </button>
            )}
          </div>

          {/* Quick Bulk Actions for Conflicts */}
          {filterStatus === "CONFLICT" && conflictCount > 0 && (
            <div className="flex items-center gap-2 animate-fade-in">
              <span className="text-[11px] font-bold text-amber-400">Duyệt nhanh tất cả:</span>
              <button
                onClick={() => handleBulkResolveConflict("APPEND")}
                className="px-2.5 py-1 bg-primary/15 hover:bg-primary/25 border border-primary/30 text-foreground font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                title="Giữ nội dung cũ trên Sheet và chèn giá trị mới xuống dòng dưới"
              >
                Nối tiếp tất cả (APPEND)
              </button>
              <button
                onClick={() => handleBulkResolveConflict("OVERWRITE")}
                className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                title="Ghi đè hoàn toàn toàn bộ các ô bị xung đột"
              >
                Ghi đè tất cả (OVERWRITE)
              </button>
              <button
                onClick={() => handleBulkResolveConflict("SKIP")}
                className="px-2.5 py-1 bg-muted/40 hover:bg-muted border border-border text-muted-foreground hover:text-foreground font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                title="Không thay đổi các ô bị xung đột"
              >
                Bỏ qua tất cả (SKIP)
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={clearJobs}
              className="px-3 py-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-semibold hover:bg-muted/40 transition-colors cursor-pointer"
            >
              Xóa danh sách
            </button>
          </div>
        </div>
      )}

      {/* Jobs Table */}
      <div className="flex-1 bg-background/50 border border-border rounded-2xl overflow-hidden flex flex-col shadow-inner min-h-0">
        {discoveredJobs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Layers size={36} className="text-muted-foreground/30 mb-2" />
            <p className="text-sm font-semibold text-foreground">Chưa có job nào được quét</p>
            <p className="text-xs mt-1 text-muted-foreground">Kéo thả thư mục chứa ảnh vào thanh phía trên hoặc bấm "Chọn thư mục" để bắt đầu.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold sticky top-0 backdrop-blur-md">
                  <th className="py-2.5 px-4">Tên Job Folder</th>
                  <th className="py-2.5 px-4">Thư mục thành phẩm sâu nhất</th>
                  <th className="py-2.5 px-4">Số ảnh</th>
                  <th className="py-2.5 px-4">Khớp hàng Sheet</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                  <th className="py-2.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-foreground max-w-[220px] truncate">
                      {job.jobFolderName}
                    </td>
                    <td className="py-2.5 px-4 max-w-[240px]">
                      <span className="font-semibold text-foreground block truncate">
                        {job.finalFolderName}
                      </span>
                      <span className="text-[10px] text-muted-foreground/80 font-mono block truncate">
                        {job.finalFolderPath}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-foreground">
                      {job.imageCount} ảnh
                    </td>
                    <td className="py-2.5 px-4">
                      {job.status === "NEEDS_REVIEW" ? (
                        <div className="flex flex-col gap-1 max-w-[280px]">
                          <span className="text-[11px] text-purple-300 font-medium line-clamp-1" title={job.statusReason}>
                            {job.statusReason || "Cần duyệt chọn hàng"}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setReviewingJob(job)}
                              className="px-2.5 py-0.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              <CheckCircle2 size={11} />
                              <span>Chọn hàng ngay</span>
                            </button>
                            <button
                              onClick={() => {
                                setAssigningRowJob(job);
                                setManualRowInput("");
                              }}
                              className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                            >
                              Nhập số khác
                            </button>
                          </div>
                        </div>
                      ) : job.targetSheetRow ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[11px]">
                            Hàng {job.targetSheetRow}
                          </span>
                          <button
                            onClick={() => {
                              setAssigningRowJob(job);
                              setManualRowInput(String(job.targetSheetRow || ""));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                            title="Gán lại hàng khác"
                          >
                            Đổi
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground italic text-xs truncate max-w-[180px]" title={job.statusReason}>
                            {job.statusReason || "Chưa tìm thấy"}
                          </span>
                          <button
                            onClick={() => {
                              setAssigningRowJob(job);
                              setManualRowInput("");
                            }}
                            className="px-2 py-0.5 bg-muted/60 hover:bg-muted text-foreground border border-border rounded text-[10px] font-semibold transition-colors cursor-pointer shrink-0"
                            title="Điền số hàng trên Sheet bằng tay"
                          >
                            Gán hàng
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {job.status === "READY" && (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px]">
                          <CheckCircle2 size={12} /> Sẵn sàng
                        </span>
                      )}
                      {job.status === "CONFLICT" && (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[11px]">
                          <AlertCircle size={12} /> Xung đột: {job.conflictDetails?.field || "Dữ liệu"}
                        </span>
                      )}
                      {job.status === "NEEDS_REVIEW" && (
                        <button
                          onClick={() => setReviewingJob(job)}
                          className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200 font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-[11px] cursor-pointer transition-all"
                        >
                          <AlertTriangle size={12} /> Cần duyệt ({job.candidateRows?.length || 0})
                        </button>
                      )}
                      {job.status === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1 text-blue-400 font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-[11px]">
                          <Check size={12} /> Đã cập nhật
                        </span>
                      )}
                      {job.status === "ERROR" && (
                        <div className="flex flex-col gap-0.5" title={job.statusReason}>
                          <span className="inline-flex items-center gap-1 text-destructive font-semibold px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/25 text-[11px]">
                            <AlertCircle size={12} /> {job.statusReason ? `Lỗi: ${job.statusReason}` : "Lỗi"}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {job.status === "NEEDS_REVIEW" && (
                          <button
                            onClick={() => setReviewingJob(job)}
                            className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          >
                            <CheckCircle2 size={12} />
                            <span>Chọn hàng</span>
                          </button>
                        )}
                        {job.status === "CONFLICT" && (
                          <button
                            onClick={() => setResolvingConflictJob(job)}
                            className="px-2.5 py-1 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/25 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Xử lý xung đột
                          </button>
                        )}
                        <button
                          onClick={() => setInspectingJob(job)}
                          className="px-2.5 py-1 bg-muted/40 hover:bg-muted text-foreground border border-border rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>Xem thay đổi</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar */}
      {discoveredJobs.length > 0 && (
        <div className="p-3.5 bg-card/90 backdrop-blur-xl border border-border rounded-2xl flex items-center justify-between gap-4 shadow-lg shrink-0">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground">
              Sẵn sàng cập nhật: <b className="text-emerald-400">{readyCount} jobs</b>
              {conflictCount > 0 && ` — Xung đột: ${conflictCount}`}
              {needsReviewCount > 0 && ` — Cần duyệt: ${needsReviewCount}`}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Áp dụng nguyên tắc Partial Safe Success: Cập nhật ngay các job sẵn sàng, không bị chặn bởi các job xung đột.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExecuteUpdate}
              disabled={readyCount === 0 || isExecutingBatch}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs shadow-md active:scale-95 transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer"
            >
              <Play size={14} className="fill-current" />
              <span>
                {isExecutingBatch
                  ? `Đang cập nhật (${batchProgress?.current || 0}/${batchProgress?.total || readyCount})...`
                  : `Cập nhật ${readyCount} Job Sẵn sàng`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {inspectingJob && (
        <PreviewPlanModal
          job={inspectingJob}
          plan={updatePlans[inspectingJob.id]}
          onClose={() => setInspectingJob(null)}
        />
      )}

      {resolvingConflictJob && (
        <ConflictResolverDialog
          job={resolvingConflictJob}
          onResolve={handleResolveConflict}
          onClose={() => setResolvingConflictJob(null)}
        />
      )}

      {/* Modal gán số hàng thủ công */}
      {assigningRowJob && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
                Gán số hàng trên Sheet thủ công
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Nhập số thứ tự hàng (Row) trên Google Sheet cho job này. Áp dụng khi tên khách trên Sheet chưa xuất hiện hoặc sheet bị lỗi công thức.
              </p>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs flex flex-col gap-2">
              <div className="flex justify-between items-start gap-2">
                <span className="text-muted-foreground shrink-0">Thư mục Job:</span>
                <span className="font-semibold text-foreground truncate text-right">
                  {assigningRowJob.jobFolderName}
                </span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-muted-foreground shrink-0">Khách hàng nhận diện:</span>
                <span className="font-semibold text-teal-300 text-right">
                  {assigningRowJob.metadata?.customerName || assigningRowJob.finalFolderName}
                </span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const rowNum = parseInt(manualRowInput.trim(), 10);
                if (isNaN(rowNum) || rowNum <= 0) {
                  alert("Vui lòng nhập số hàng hợp lệ (lớn hơn 0)");
                  return;
                }
                handleManualAssignRow(assigningRowJob, rowNum);
              }}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="text-xs font-bold text-foreground block mb-1.5">
                  Số hàng trên Sheet (Row number):
                </label>
                <input
                  type="number"
                  min="1"
                  autoFocus
                  placeholder="Ví dụ: 13, 14, 15..."
                  value={manualRowInput}
                  onChange={(e) => setManualRowInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                />
                <span className="text-[11px] text-muted-foreground mt-1.5 block">
                  Hệ thống sẽ cập nhật an toàn đúng vào cột <b>Tên Edit (N)</b> và <b>Link Edit (O)</b> của hàng này.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    setAssigningRowJob(null);
                    setManualRowInput("");
                  }}
                  className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Xác nhận gán hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Duyệt và Chọn Hàng */}
      {reviewingJob && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div>
                <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                  Duyệt và chọn hàng chính xác trên Sheet
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chọn một hàng bên dưới để liên kết với job này, hoặc nhập số hàng bằng tay.
                </p>
              </div>
              <button
                onClick={() => setReviewingJob(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Thông tin Job đang duyệt */}
            <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs flex flex-col gap-1.5 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Thư mục job:</span>
                <span className="font-bold text-foreground font-mono">{reviewingJob.jobFolderName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Khách hàng nhận diện:</span>
                <span className="font-bold text-teal-300">
                  {reviewingJob.metadata?.customerName || reviewingJob.finalFolderName}
                </span>
              </div>
              {reviewingJob.metadata?.shootDate && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ngày / Giờ chụp:</span>
                  <span className="font-medium text-foreground">
                    {reviewingJob.metadata.shootDate} {reviewingJob.metadata.shootTime ? `— ${reviewingJob.metadata.shootTime}` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Danh sách các hàng tiềm năng */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2.5 pr-1">
              <span className="text-xs font-bold text-foreground">
                Các hàng tiềm năng ({reviewingJob.candidateRows?.length || 0}):
              </span>

              {(!reviewingJob.candidateRows || reviewingJob.candidateRows.length === 0) ? (
                <div className="p-4 text-center text-xs text-muted-foreground italic bg-muted/20 rounded-xl">
                  Không có hàng đề xuất tự động. Bạn có thể nhập số hàng bằng tay bên dưới.
                </div>
              ) : (
                reviewingJob.candidateRows.map((candidate) => (
                  <div
                    key={candidate.row}
                    className="p-3 bg-background hover:bg-muted/30 border border-border rounded-xl flex items-center justify-between gap-3 transition-colors shadow-sm"
                  >
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded text-xs font-extrabold font-mono">
                          Hàng {candidate.row}
                        </span>
                        <span className="text-[11px] text-emerald-400 font-semibold">
                          Độ tin cậy: {Math.min(100, Math.round((candidate.score / 2.0) * 100))}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ({candidate.matchedFields.join(", ")})
                        </span>
                      </div>

                      {/* Snapshot các cột quan trọng của hàng */}
                      <div className="text-[11px] text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 bg-muted/20 p-2 rounded-lg">
                        {candidate.values["C"] && (
                          <div className="truncate">
                            <b className="text-foreground">Tên khách:</b> {candidate.values["C"]}
                          </div>
                        )}
                        {candidate.values["H"] && (
                          <div className="truncate">
                            <b className="text-foreground">Tên file:</b> {candidate.values["H"]}
                          </div>
                        )}
                        {candidate.values["B"] && (
                          <div>
                            <b className="text-foreground">Giờ:</b> {candidate.values["B"]}
                          </div>
                        )}
                        {candidate.values["D"] && (
                          <div className="truncate">
                            <b className="text-foreground">Concept:</b> {candidate.values["D"]}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectCandidateRow(reviewingJob, candidate.row, candidate.values)}
                      className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:opacity-90 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      <Check size={14} />
                      <span>Chọn hàng này</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Lựa chọn nhập tay bên dưới */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const job = reviewingJob;
                  setReviewingJob(null);
                  setAssigningRowJob(job);
                  setManualRowInput("");
                }}
                className="text-xs text-teal-400 hover:underline cursor-pointer flex items-center gap-1 font-semibold"
              >
                Nhập số hàng khác bằng tay...
              </button>
              <button
                onClick={() => setReviewingJob(null)}
                className="px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
