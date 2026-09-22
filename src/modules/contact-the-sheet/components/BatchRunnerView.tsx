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
  Ban,
  RotateCcw,
  Trash2,
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
import type { SheetRowRecord } from "../services/jobMatchingService";

interface BatchRunnerViewProps {
  initialFolderPaths?: string[] | null;
  onClearInitialPaths?: () => void;
}

export function BatchRunnerView({
  initialFolderPaths,
  onClearInitialPaths,
}: BatchRunnerViewProps = {}) {
  const activeProfile = useContactSheetStore((s) => s.activeProfile);
  const discoveredJobs = useContactSheetStore((s) => s.discoveredJobs);
  const setDiscoveredJobs = useContactSheetStore((s) => s.setDiscoveredJobs);
  const updateJob = useContactSheetStore((s) => s.updateJob);
  const removeJob = useContactSheetStore((s) => s.removeJob);
  const clearJobs = useContactSheetStore((s) => s.clearJobs);
  const lastScannedPaths = useContactSheetStore((s) => s.lastScannedPaths);
  const setLastScannedPaths = useContactSheetStore((s) => s.setLastScannedPaths);
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
  const [manualTabInput, setManualTabInput] = useState<string>("");

  const availableTabTitles = Array.from(
    new Set([
      ...(activeProfile?.tabConfigurations ? Object.keys(activeProfile.tabConfigurations) : []),
      ...(activeProfile?.selectedTabTitle ? [activeProfile.selectedTabTitle] : []),
    ])
  );

  const [selectedTabTitles, setSelectedTabTitles] = useState<string[]>(() => {
    if (activeProfile?.tabConfigurations && Object.keys(activeProfile.tabConfigurations).length > 0) {
      return Object.keys(activeProfile.tabConfigurations);
    }
    return [activeProfile?.selectedTabTitle || "Edit 9/2026"];
  });

  const [filterTab, setFilterTab] = useState<string>("ALL");

  useEffect(() => {
    if (availableTabTitles.length > 0) {
      setSelectedTabTitles((prev) => {
        const valid = prev.filter((t) => availableTabTitles.includes(t));
        if (valid.length > 0) return valid;
        return availableTabTitles;
      });
    }
  }, [activeProfile?.tabConfigurations, activeProfile?.selectedTabTitle]);

  const toggleTabSelection = (tabTitle: string) => {
    setSelectedTabTitles((prev) => {
      if (prev.includes(tabTitle)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== tabTitle);
      } else {
        return [...prev, tabTitle];
      }
    });
  };

  const selectAllTabs = () => {
    setSelectedTabTitles(availableTabTitles);
  };

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

  // Automatically process initial folder paths (e.g. transferred from Subfolder Sync)
  useEffect(() => {
    if (initialFolderPaths && initialFolderPaths.length > 0 && activeProfile) {
      handleProcessFolderPaths(initialFolderPaths);
      onClearInitialPaths?.();
    }
  }, [initialFolderPaths, activeProfile]);

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
    if (paths && paths.length > 0) {
      setLastScannedPaths(paths);
    }
    setIsScanning(true);
    setScanProgress({ current: 0, total: 100, message: "Đang phân tích cây thư mục..." });

    try {
      const isSandbox = activeProfile.isMockSandbox && googleConnection.status !== "CONNECTED";
      const tabsToScan = selectedTabTitles.length > 0 ? selectedTabTitles : [activeProfile.selectedTabTitle];

      setScanProgress({
        current: 10,
        total: 100,
        message: `Đang kết nối tải dữ liệu trên ${tabsToScan.length} tab (${tabsToScan.join(", ")})...`,
      });

      const allSheetRows: SheetRowRecord[] = [];

      for (let i = 0; i < tabsToScan.length; i++) {
        const tabTitle = tabsToScan[i];
        const tabConfig = activeProfile.tabConfigurations?.[tabTitle];
        const startRow = tabConfig?.rowScope?.startRow ?? activeProfile.rowScope.startRow;

        setScanProgress({
          current: 10 + Math.round(((i + 1) / tabsToScan.length) * 35),
          total: 100,
          message: isSandbox
            ? `Đang nạp dữ liệu bảng tính mẫu (Tab "${tabTitle}")...`
            : `Đang tải dữ liệu Google Sheet tab "${tabTitle}" (từ dòng ${startRow})...`,
        });

        try {
          const rows = await sheetDiscoveryService.fetchSheetRowsForMatching(
            activeProfile.spreadsheetId,
            tabTitle,
            startRow,
            undefined,
            isSandbox
          );
          for (const r of rows) {
            allSheetRows.push({ ...r, tabTitle });
          }
        } catch (tabErr) {
          console.warn(`Lỗi khi nạp dữ liệu tab ${tabTitle}:`, tabErr);
        }
      }

      setScanProgress({
        current: 50,
        total: 100,
        message: `Đang quét thư mục thành phẩm sâu nhất & so khớp trên ${tabsToScan.length} tab...`,
      });

      const jobs = await folderScannerService.scanAndDiscoverJobs(
        paths,
        activeProfile,
        allSheetRows,
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
      // Merge with existing jobs, replacing any that share the same jobFolderName or finalFolderPath
      const currentJobs = useContactSheetStore.getState().discoveredJobs;
      const existingRemaining = currentJobs.filter(
        (oldJob) =>
          !finalJobs.some(
            (newJob) =>
              newJob.jobFolderName === oldJob.jobFolderName ||
              newJob.finalFolderPath === oldJob.finalFolderPath
          )
      );
      setDiscoveredJobs([...existingRemaining, ...finalJobs]);
    } catch (err: any) {
      console.error("Scan & discover jobs error:", err);
      alert(`Lỗi khi quét và khớp dữ liệu: ${err?.message || String(err)}`);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const handleRefreshData = async () => {
    if (isScanning) return;
    let paths = lastScannedPaths;
    if (!paths || paths.length === 0) {
      const currentJobs = useContactSheetStore.getState().discoveredJobs;
      const jobPaths = currentJobs.map((j) => j.finalFolderPath).filter((p): p is string => Boolean(p));
      paths = Array.from(new Set(jobPaths));
    }

    if (paths.length > 0) {
      await handleProcessFolderPaths(paths);
    } else {
      await handlePickFolders();
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

  const handleManualAssignRow = (job: DiscoveredJob, rowNumber: number, tabTitle?: string) => {
    if (!activeProfile || rowNumber <= 0) return;

    const targetTabTitle = tabTitle || job.targetTabTitle || activeProfile.selectedTabTitle;
    const updatedJob: DiscoveredJob = {
      ...job,
      targetSheetRow: rowNumber,
      targetTabTitle,
      statusReason: undefined,
    };

    const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(updatedJob, activeProfile);
    setUpdatePlan(job.id, plan);
    updateJob(job.id, plannedJob);
    setAssigningRowJob(null);
    setManualRowInput("");
  };

  const handleSelectCandidateRow = (
    job: DiscoveredJob,
    rowNumber: number,
    rowSnapshot?: Record<string, string>,
    tabTitle?: string
  ) => {
    if (!activeProfile || rowNumber <= 0) return;

    const targetTabTitle = tabTitle || job.targetTabTitle || activeProfile.selectedTabTitle;
    const updatedJob: DiscoveredJob = {
      ...job,
      targetSheetRow: rowNumber,
      targetTabTitle,
      targetRowSnapshot: rowSnapshot || job.targetRowSnapshot,
      statusReason: undefined,
    };

    const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(updatedJob, activeProfile);
    setUpdatePlan(job.id, plan);
    updateJob(job.id, plannedJob);
    setReviewingJob(null);
  };

  const handleCancelJob = (jobId: string) => {
    updateJob(jobId, {
      status: "SKIPPED",
      statusReason: "Người dùng hủy bỏ (bỏ qua không cập nhật)",
    });
  };

  const handleRestoreJob = (jobId: string) => {
    const job = discoveredJobs.find((j) => j.id === jobId);
    if (!job || !activeProfile) return;

    if (job.targetSheetRow && job.targetSheetRow > 0) {
      const { job: plannedJob, plan } = batchPlannerService.planJobUpdate(
        { ...job, status: "READY", statusReason: undefined },
        activeProfile
      );
      setUpdatePlan(job.id, plan);
      updateJob(job.id, plannedJob);
    } else {
      updateJob(job.id, {
        status: "NEEDS_REVIEW",
        statusReason: "Cần gán số hàng",
      });
    }
  };

  const handleRemoveJob = (jobId: string) => {
    removeJob(jobId);
  };

  // Status Counts
  const readyCount = discoveredJobs.filter((j) => j.status === "READY").length;
  const conflictCount = discoveredJobs.filter((j) => j.status === "CONFLICT").length;
  const needsReviewCount = discoveredJobs.filter((j) => j.status === "NEEDS_REVIEW").length;
  const errorCount = discoveredJobs.filter((j) => j.status === "ERROR").length;
  const completedCount = discoveredJobs.filter((j) => j.status === "COMPLETED").length;
  const skippedCount = discoveredJobs.filter((j) => j.status === "SKIPPED").length;

  const discoveredTabTitles = Array.from(
    new Set(discoveredJobs.map((j) => j.targetTabTitle || activeProfile?.selectedTabTitle).filter(Boolean) as string[])
  );

  const filteredJobs = discoveredJobs.filter((j) => {
    if (filterStatus === "READY") return j.status === "READY";
    if (filterStatus === "CONFLICT") return j.status === "CONFLICT";
    if (filterStatus === "NEEDS_REVIEW") return j.status === "NEEDS_REVIEW";
    if (filterStatus === "ERROR") return j.status === "ERROR";
    if (filterStatus === "COMPLETED") return j.status === "COMPLETED";
    if (filterStatus === "SKIPPED") return j.status === "SKIPPED";
    return true;
  }).filter((j) => {
    if (filterTab === "ALL") return true;
    const tab = j.targetTabTitle || activeProfile?.selectedTabTitle;
    return tab === filterTab;
  });

  const writableColsText =
    activeProfile?.fieldMappings
      .filter((m) => m.permission === "READ_WRITE")
      .map((m) => `${m.columnHeader} (${m.columnLetter})`)
      .join(", ") || "Chưa chọn cột ghi";

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 gap-3 text-foreground custom-scrollbar min-w-0">
      {/* Tab & Workspace Bar with Multi-Tab Checkboxes */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between p-3 sm:p-3.5 bg-card/60 border border-border/80 rounded-2xl shrink-0 backdrop-blur-md shadow-sm gap-2.5 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Layers size={14} className="text-muted-foreground" />
            <span className="text-xs font-bold text-foreground">Quét các Tab:</span>
          </div>

          {/* Quick Select All Button */}
          {availableTabTitles.length > 1 && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={selectAllTabs}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                  selectedTabTitles.length === availableTabTitles.length
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground border-border/60"
                }`}
                title="Chọn tất cả các tab để quét"
              >
                Tất cả ({availableTabTitles.length})
              </button>
            </div>
          )}

          {/* Multi-Tab Checkbox Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {availableTabTitles.map((title) => {
              const isSelected = selectedTabTitles.includes(title);
              const isConfigured = !!activeProfile?.tabConfigurations?.[title];
              return (
                <button
                  type="button"
                  key={title}
                  onClick={() => toggleTabSelection(title)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
                    isSelected
                      ? "bg-primary/10 border-primary/30 text-primary shadow-2xs"
                      : "bg-background/60 border-border/70 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by button click
                    className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-0 cursor-pointer pointer-events-none accent-primary"
                  />
                  <span>{title}</span>
                  {isConfigured && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-semibold border border-border">
                      Đã cấu hình
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-border/80 hidden xl:block" />

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="shrink-0">Tiêu đề: <b className="text-foreground">Dòng {activeProfile?.headerRow || 3}</b></span>
            <span>•</span>
            <span className="truncate max-w-[240px] sm:max-w-xs md:max-w-md" title={writableColsText}>
              Cột ghi: <b className="text-foreground font-semibold">{writableColsText}</b>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end xl:self-center">
          <button
            type="button"
            onClick={handleRefreshData}
            disabled={isScanning}
            className="px-3 py-1.5 text-xs text-foreground hover:text-foreground font-semibold rounded-xl bg-muted/60 hover:bg-muted border border-border transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            title="Tải lại toàn bộ dữ liệu Google Sheets mới nhất & quét lại đối soát"
          >
            <RotateCw size={13} className={isScanning ? "animate-spin" : ""} />
            <span>Làm mới dữ liệu</span>
          </button>
          {discoveredJobs.length > 0 && (
            <button
              onClick={clearJobs}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold rounded-xl hover:bg-muted/40 transition-colors cursor-pointer"
            >
              Xóa danh sách
            </button>
          )}
        </div>
      </div>

      {/* Compact Drop Zone - Ultra Minimal Vertical Footprint */}
      <div
        onClick={handlePickFolders}
        className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-dashed flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 transition-all cursor-pointer select-none shrink-0 min-w-0 ${
          isDragging
            ? "border-primary bg-primary/15 shadow-md ring-2 ring-primary/30"
            : "border-border/80 bg-card/40 hover:bg-card/70 hover:border-primary/50 shadow-sm"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
            <FolderPlus size={15} />
          </div>
          <div className="flex items-center gap-2 min-w-0 truncate">
            <span className="text-xs font-bold text-foreground truncate">
              {isDragging ? "Thả thư mục vào đây để quét tự động" : "Kéo thả thư mục ngày (hoặc từng job) vào đây"}
            </span>
            <span className="text-[11px] text-muted-foreground hidden lg:inline truncate">
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
            <div className="flex items-center gap-2">
              {(lastScannedPaths.length > 0 || discoveredJobs.length > 0) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshData();
                  }}
                  className="px-3 py-1 bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold rounded-lg border border-border/80 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Quét lại các thư mục với dữ liệu Google Sheets mới nhất"
                >
                  <RotateCw size={12} />
                  <span>Quét lại</span>
                </button>
              )}
              <button
                type="button"
                className="px-3 py-1 bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold rounded-lg border border-border/80 transition-colors cursor-pointer"
              >
                Chọn thư mục
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scanning In-Progress Banner - Clean Single Line Feedback */}
      {isScanning && (
        <div className="p-3 bg-card/95 border border-primary/35 rounded-xl flex items-center justify-between gap-3 shadow-md backdrop-blur-xl animate-fade-in shrink-0 ring-1 ring-primary/20 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0">
              <RotateCw size={14} className="animate-spin" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-extrabold text-foreground truncate">
                Đang đồng bộ Google Sheets & quét cây thư mục...
              </span>
              {scanProgress?.total ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/15 text-primary font-bold shrink-0">
                  {scanProgress.current}%
                </span>
              ) : null}
            </div>
          </div>

          <div className="w-24 sm:w-28 shrink-0">
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
        <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0 min-w-0">
          <div className="flex items-center gap-1.5 p-1 bg-background/60 border border-border/80 rounded-xl overflow-x-auto max-w-full custom-scrollbar">
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
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <CheckCircle2 size={12} className={filterStatus === "READY" ? "" : "text-emerald-500"} />
              <span>Sẵn sàng ({readyCount})</span>
            </button>
            <button
              onClick={() => setFilterStatus("CONFLICT")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                filterStatus === "CONFLICT"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <AlertCircle size={12} className={filterStatus === "CONFLICT" ? "" : "text-amber-500"} />
              <span>Xung đột ({conflictCount})</span>
            </button>
            <button
              onClick={() => setFilterStatus("NEEDS_REVIEW")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                filterStatus === "NEEDS_REVIEW"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <AlertTriangle size={12} className={filterStatus === "NEEDS_REVIEW" ? "" : "text-amber-500"} />
              <span>Cần duyệt ({needsReviewCount})</span>
            </button>
            {completedCount > 0 && (
              <button
                onClick={() => setFilterStatus("COMPLETED")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filterStatus === "COMPLETED"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Check size={12} />
                <span>Đã cập nhật ({completedCount})</span>
              </button>
            )}
            {skippedCount > 0 && (
              <button
                onClick={() => setFilterStatus("SKIPPED")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filterStatus === "SKIPPED"
                    ? "bg-muted text-foreground border border-border shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Ban size={12} />
                <span>Đã hủy ({skippedCount})</span>
              </button>
            )}
          </div>

          {/* Quick Bulk Actions for Conflicts */}
          {filterStatus === "CONFLICT" && conflictCount > 0 && (
            <div className="flex items-center gap-2 animate-fade-in">
              <span className="text-[11px] font-bold text-foreground">Duyệt nhanh tất cả:</span>
              <button
                onClick={() => handleBulkResolveConflict("APPEND")}
                className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                title="Giữ nội dung cũ trên Sheet và chèn giá trị mới xuống dòng dưới"
              >
                Nối tiếp tất cả (APPEND)
              </button>
              <button
                onClick={() => handleBulkResolveConflict("OVERWRITE")}
                className="px-2.5 py-1 bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
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
            {discoveredTabTitles.length > 1 && (
              <div className="flex items-center gap-1.5 bg-background/60 border border-border/80 px-2 py-1 rounded-xl">
                <span className="text-[11px] text-muted-foreground font-medium">Lọc Tab:</span>
                <select
                  value={filterTab}
                  onChange={(e) => setFilterTab(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-card text-foreground">Tất cả tab ({discoveredJobs.length})</option>
                  {discoveredTabTitles.map((tab) => (
                    <option key={tab} value={tab} className="bg-card text-foreground">
                      {tab} ({discoveredJobs.filter((j) => (j.targetTabTitle || activeProfile?.selectedTabTitle) === tab).length})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={handleRefreshData}
              disabled={isScanning}
              className="px-3 py-1.5 rounded-xl border border-border bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Tải lại Google Sheets mới nhất và quét lại danh sách job"
            >
              <RotateCw size={12} className={isScanning ? "animate-spin" : ""} />
              <span>Làm mới dữ liệu</span>
            </button>
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
                      {job.status === "SKIPPED" ? (
                        <div className="flex items-center gap-1.5 opacity-60">
                          {job.targetTabTitle && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              {job.targetTabTitle}
                            </span>
                          )}
                          <span className="text-muted-foreground line-through text-[11px]">
                            {job.targetSheetRow ? `Hàng ${job.targetSheetRow}` : "Chưa gắn"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium">(Đã bỏ qua)</span>
                        </div>
                      ) : job.status === "NEEDS_REVIEW" ? (
                        <div className="flex flex-col gap-1 max-w-[280px]">
                          <span className="text-[11px] text-muted-foreground font-medium line-clamp-1" title={job.statusReason}>
                            {job.statusReason || "Cần duyệt chọn hàng"}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setReviewingJob(job)}
                              className="px-2.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <CheckCircle2 size={11} />
                              <span>Chọn hàng ngay</span>
                            </button>
                            <button
                              onClick={() => {
                                setAssigningRowJob(job);
                                setManualRowInput("");
                                setManualTabInput(job.targetTabTitle || selectedTabTitles[0] || "");
                              }}
                              className="text-[10px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                            >
                              Nhập số khác
                            </button>
                          </div>
                        </div>
                      ) : job.targetSheetRow ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {job.targetTabTitle && (
                            <span className="font-medium text-foreground bg-muted border border-border px-1.5 py-0.5 rounded text-[10px]" title="Tab Google Sheet">
                              {job.targetTabTitle}
                            </span>
                          )}
                          <span className="font-semibold text-foreground bg-muted border border-border px-2 py-0.5 rounded-md text-[11px] font-mono">
                            Hàng {job.targetSheetRow}
                          </span>
                          <button
                            onClick={() => {
                              setAssigningRowJob(job);
                              setManualRowInput(String(job.targetSheetRow || ""));
                              setManualTabInput(job.targetTabTitle || selectedTabTitles[0] || "");
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
                              setManualTabInput(job.targetTabTitle || selectedTabTitles[0] || "");
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
                        <span className="inline-flex items-center gap-1 text-foreground font-medium px-2 py-0.5 rounded-full bg-muted/60 border border-border text-[11px]">
                          <CheckCircle2 size={12} className="text-emerald-500" /> Sẵn sàng
                        </span>
                      )}
                      {job.status === "CONFLICT" && (
                        <span className="inline-flex items-center gap-1 text-foreground font-medium px-2 py-0.5 rounded-full bg-muted/60 border border-border text-[11px]">
                          <AlertCircle size={12} className="text-amber-500" /> Xung đột: {job.conflictDetails?.field || "Dữ liệu"}
                        </span>
                      )}
                      {job.status === "NEEDS_REVIEW" && (
                        <button
                          onClick={() => setReviewingJob(job)}
                          className="inline-flex items-center gap-1 text-foreground hover:text-primary font-medium px-2 py-0.5 rounded-full bg-muted/60 hover:bg-muted border border-border text-[11px] cursor-pointer transition-all"
                        >
                          <AlertTriangle size={12} className="text-amber-500" /> Cần duyệt ({job.candidateRows?.length || 0})
                        </button>
                      )}
                      {job.status === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1 text-foreground font-medium px-2 py-0.5 rounded-full bg-muted/60 border border-border text-[11px]">
                          <Check size={12} className="text-primary" /> Đã cập nhật
                        </span>
                      )}
                      {job.status === "SKIPPED" && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted/40 border border-border text-[11px]">
                          <Ban size={12} className="text-muted-foreground" /> Đã hủy bỏ
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
                            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                          >
                            <CheckCircle2 size={12} />
                            <span>Chọn hàng</span>
                          </button>
                        )}
                        {job.status === "CONFLICT" && (
                          <button
                            onClick={() => setResolvingConflictJob(job)}
                            className="px-2.5 py-1 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Xử lý xung đột
                          </button>
                        )}
                        {job.status !== "SKIPPED" ? (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="px-2 py-1 bg-muted/40 hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Hủy / Bỏ qua job này, không cập nhật lên Google Sheet"
                          >
                            <Ban size={12} />
                            <span>Hủy</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestoreJob(job.id)}
                            className="px-2 py-1 bg-muted hover:bg-accent text-foreground border border-border rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Khôi phục lại job này vào danh sách sẵn sàng"
                          >
                            <RotateCcw size={12} />
                            <span>Khôi phục</span>
                          </button>
                        )}
                        <button
                          onClick={() => setInspectingJob(job)}
                          className="px-2.5 py-1 bg-muted/40 hover:bg-muted text-foreground border border-border rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>Xem thay đổi</span>
                        </button>
                        <button
                          onClick={() => handleRemoveJob(job.id)}
                          className="p-1 hover:bg-destructive/15 text-muted-foreground hover:text-destructive rounded-lg text-[11px] transition-colors cursor-pointer"
                          title="Xóa job này khỏi danh sách quét"
                        >
                          <Trash2 size={13} />
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
              Sẵn sàng cập nhật: <b className="text-foreground">{readyCount} jobs</b>
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
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs shadow-md active:scale-95 transition-all disabled:opacity-40 flex items-center gap-2 cursor-pointer"
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
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
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
                <span className="font-semibold text-foreground text-right">
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
                const targetTab = manualTabInput || assigningRowJob.targetTabTitle || selectedTabTitles[0];
                handleManualAssignRow(assigningRowJob, rowNum, targetTab);
              }}
              className="flex flex-col gap-4"
            >
              {availableTabTitles.length > 1 && (
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1.5">
                    Tab Google Sheet:
                  </label>
                  <select
                    value={manualTabInput || (assigningRowJob.targetTabTitle || selectedTabTitles[0] || "")}
                    onChange={(e) => setManualTabInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {(selectedTabTitles.length > 0 ? selectedTabTitles : availableTabTitles).map((tab) => (
                      <option key={tab} value={tab} className="bg-card text-foreground">
                        {tab}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
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
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
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
                <span className="font-bold text-foreground">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {candidate.tabTitle && (
                          <span className="px-1.5 py-0.5 bg-muted text-foreground border border-border rounded text-[10px] font-medium">
                            Tab: {candidate.tabTitle}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-muted text-foreground border border-border rounded text-xs font-semibold font-mono">
                          Hàng {candidate.row}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-medium">
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
                      onClick={() => handleSelectCandidateRow(reviewingJob, candidate.row, candidate.values, candidate.tabTitle)}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
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
                  setManualTabInput(job.targetTabTitle || selectedTabTitles[0] || "");
                }}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 font-semibold"
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
