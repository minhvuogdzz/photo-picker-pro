import React, { useState, useEffect, useMemo } from "react";
import {
  FolderPlus,
  Play,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Eye,
  Layers,
  Check,
  X,
  Ban,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
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

const COMPACT_TAB_PREVIEW_LIMIT = 4;

export function BatchRunnerView() {
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
  const googleConnection = useContactSheetStore((s) => s.googleConnection);
  const removeTabConfiguration = useContactSheetStore((s) => s.removeTabConfiguration);
  const undoApplyAllTabs = useContactSheetStore((s) => s.undoApplyAllTabs);

  const [isDragging, setIsDragging] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [inspectingJob, setInspectingJob] = useState<DiscoveredJob | null>(null);
  const [resolvingConflictJob, setResolvingConflictJob] = useState<DiscoveredJob | null>(null);
  const [assigningRowJob, setAssigningRowJob] = useState<DiscoveredJob | null>(null);
  const [reviewingJob, setReviewingJob] = useState<DiscoveredJob | null>(null);
  const [manualRowInput, setManualRowInput] = useState<string>("");
  const [manualTabInput, setManualTabInput] = useState<string>("");

  const [isTabsExpanded, setIsTabsExpanded] = useState(false);
  const [tabSearchQuery, setTabSearchQuery] = useState("");
  const [userClearedAll, setUserClearedAll] = useState(false);

  const availableTabTitles = useMemo(
    () =>
      Array.from(
        new Set([
          ...(activeProfile?.tabConfigurations ? Object.keys(activeProfile.tabConfigurations) : []),
          ...(activeProfile?.selectedTabTitle ? [activeProfile.selectedTabTitle] : []),
        ])
      ),
    [activeProfile?.tabConfigurations, activeProfile?.selectedTabTitle]
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
        if (userClearedAll) return [];
        return [activeProfile?.selectedTabTitle || availableTabTitles[0]];
      });
    }
  }, [availableTabTitles, activeProfile?.selectedTabTitle, userClearedAll]);

  const toggleTabSelection = (tabTitle: string) => {
    setSelectedTabTitles((prev) => {
      if (prev.includes(tabTitle)) {
        const next = prev.filter((t) => t !== tabTitle);
        setUserClearedAll(next.length === 0);
        return next;
      } else {
        setUserClearedAll(false);
        return [...prev, tabTitle];
      }
    });
  };

  const selectAllTabs = () => {
    setUserClearedAll(false);
    setSelectedTabTitles(availableTabTitles);
  };

  const deselectAllTabs = () => {
    setUserClearedAll(true);
    setSelectedTabTitles([]);
  };

  const selectOnlyPrimaryTab = () => {
    const primary = activeProfile?.selectedTabTitle || availableTabTitles[0];
    if (primary) {
      setUserClearedAll(false);
      setSelectedTabTitles([primary]);
    }
  };

  const handleUndoApplyAllTabs = () => {
    const restored = undoApplyAllTabs();
    const restoredKeys = Object.keys(restored);
    setUserClearedAll(false);
    setSelectedTabTitles(
      restoredKeys.length > 0
        ? restoredKeys
        : [activeProfile?.selectedTabTitle || "Edit 9/2026"]
    );
    setIsTabsExpanded(false);
  };

  const handleRemoveTabFromBatchList = (tabTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (availableTabTitles.length <= 1) return;
    removeTabConfiguration(tabTitle);
    setSelectedTabTitles((prev) => prev.filter((t) => t !== tabTitle));
  };

  const filteredAvailableTabs = useMemo(() => {
    const q = tabSearchQuery.trim().toLowerCase();
    if (!q) return availableTabTitles;
    return availableTabTitles.filter((t) => t.toLowerCase().includes(q));
  }, [availableTabTitles, tabSearchQuery]);

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
  }, [activeProfile, selectedTabTitles]);

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

    if (selectedTabTitles.length === 0) {
      alert("Bạn đang bỏ chọn tất cả các tab. Vui lòng chọn ít nhất 1 tab trước khi quét dữ liệu.");
      setIsTabsExpanded(true);
      return;
    }

    let effectivePaths = paths;
    try {
      const resolved = await folderScannerService.resolveSmartInputFolders(paths);
      if (resolved && resolved.length > 0) {
        effectivePaths = resolved;
      }
    } catch (err) {
      console.warn("Folder expansion error in BatchRunner:", err);
    }

    if (effectivePaths && effectivePaths.length > 0) {
      setLastScannedPaths(effectivePaths);
    }
    setIsScanning(true);
    setScanProgress({ current: 0, total: 100, message: "Đang phân tích cây thư mục..." });

    try {
      const isSandbox = activeProfile.isMockSandbox && googleConnection.status !== "CONNECTED";
      const tabsToScan = selectedTabTitles.length > 0 ? selectedTabTitles : [activeProfile.selectedTabTitle];

      setScanProgress({
        current: 10,
        total: 100,
        message: `Đang kết nối tải dữ liệu trên ${tabsToScan.length} tab...`,
      });

      const allSheetRows: SheetRowRecord[] = [];

      setScanProgress({
        current: 30,
        total: 100,
        message: isSandbox
          ? "Đang nạp dữ liệu bảng tính mẫu..."
          : `Đang tải dữ liệu Google Sheet (${tabsToScan.length} tab)...`,
      });

      const perTabRows = await Promise.all(
        tabsToScan.map(async (tabTitle) => {
          const tabConfig = activeProfile.tabConfigurations?.[tabTitle];
          const startRow = tabConfig?.rowScope?.startRow ?? activeProfile.rowScope.startRow;
          try {
            const rows = await sheetDiscoveryService.fetchSheetRowsForMatching(
              activeProfile.spreadsheetId,
              tabTitle,
              startRow,
              undefined,
              isSandbox
            );
            return rows.map((r) => ({ ...r, tabTitle }));
          } catch (tabErr) {
            console.warn(`Lỗi khi nạp dữ liệu tab ${tabTitle}:`, tabErr);
            return [];
          }
        })
      );
      for (const rows of perTabRows) {
        allSheetRows.push(...rows);
      }

      setScanProgress({
        current: 50,
        total: 100,
        message: `Đang quét thư mục thành phẩm & so khớp trên ${tabsToScan.length} tab...`,
      });

      const jobs = await folderScannerService.scanAndDiscoverJobs(
        effectivePaths,
        activeProfile,
        allSheetRows,
        isSandbox,
        (msg) => setScanProgress({ current: 65, total: 100, message: msg })
      );

      setScanProgress({
        current: 85,
        total: 100,
        message: "Đang lập kế hoạch cập nhật bảng tính...",
      });

      const planSummary = batchPlannerService.planBatch(jobs, activeProfile);
      Object.entries(planSummary.plans).forEach(([id, p]) => setUpdatePlan(id, p));

      const finalJobs = [
        ...planSummary.readyJobs,
        ...planSummary.conflictJobs,
        ...planSummary.needsReviewJobs,
        ...planSummary.errorJobs,
      ];
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

      const updated = discoveredJobs.map((j) => {
        if (j.status === "READY") {
          return { ...j, status: "COMPLETED" as const };
        }
        return j;
      });
      setDiscoveredJobs(updated);

      alert(
        `Hoàn tất cập nhật:\n- Thành công: ${summary.successCount} job\n- Xung đột: ${summary.conflictCount}\n- Lỗi: ${summary.failedCount}`
      );
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
      statusReason: "Người dùng bỏ qua",
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

  const readyCount = discoveredJobs.filter((j) => j.status === "READY").length;
  const conflictCount = discoveredJobs.filter((j) => j.status === "CONFLICT").length;
  const needsReviewCount = discoveredJobs.filter((j) => j.status === "NEEDS_REVIEW").length;
  const completedCount = discoveredJobs.filter((j) => j.status === "COMPLETED").length;
  const skippedCount = discoveredJobs.filter((j) => j.status === "SKIPPED").length;

  const discoveredTabTitles = Array.from(
    new Set(
      discoveredJobs
        .map((j) => j.targetTabTitle || activeProfile?.selectedTabTitle)
        .filter(Boolean) as string[]
    )
  );

  const filteredJobs = discoveredJobs
    .filter((j) => {
      if (filterStatus === "READY") return j.status === "READY";
      if (filterStatus === "CONFLICT") return j.status === "CONFLICT";
      if (filterStatus === "NEEDS_REVIEW") return j.status === "NEEDS_REVIEW";
      if (filterStatus === "ERROR") return j.status === "ERROR";
      if (filterStatus === "COMPLETED") return j.status === "COMPLETED";
      if (filterStatus === "SKIPPED") return j.status === "SKIPPED";
      return true;
    })
    .filter((j) => {
      if (filterTab === "ALL") return true;
      const tab = j.targetTabTitle || activeProfile?.selectedTabTitle;
      return tab === filterTab;
    });

  const writableColsText =
    activeProfile?.fieldMappings
      .filter((m) => m.permission === "READ_WRITE")
      .map((m) => `${m.columnHeader} (${m.columnLetter})`)
      .join(", ") || "Chưa chọn cột ghi";

  // Compact preview tabs when collapsed
  const compactPreviewTabs =
    availableTabTitles.length <= COMPACT_TAB_PREVIEW_LIMIT
      ? availableTabTitles
      : selectedTabTitles.length > 0
      ? selectedTabTitles.slice(0, COMPACT_TAB_PREVIEW_LIMIT)
      : availableTabTitles.slice(0, COMPACT_TAB_PREVIEW_LIMIT);

  const hiddenSelectedCount = Math.max(0, selectedTabTitles.length - compactPreviewTabs.length);
  const hiddenTotalCount = Math.max(0, availableTabTitles.length - compactPreviewTabs.length);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden p-4 sm:p-5 gap-3 text-foreground custom-scrollbar min-w-0">
      {/* Compact & Collapsible Tab Selection Card */}
      <div className="flex flex-col bg-card border border-border rounded-2xl px-4 py-3 shrink-0 shadow-xs gap-2.5 min-w-0">
        {/* Top Row: Summary, Inline Pills & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <Layers size={14} strokeWidth={1.75} className="text-muted-foreground" />
              <span className="text-[12px] font-medium text-foreground">Quét Tab:</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-foreground/[0.05] text-muted-foreground font-medium tabular-nums">
                {selectedTabTitles.length}/{availableTabTitles.length}
              </span>
            </div>

            {/* Collapsed Inline Preview */}
            {!isTabsExpanded && (
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {selectedTabTitles.length === 0 ? (
                  <span className="text-[11.5px] text-muted-foreground italic px-1">
                    Đã bỏ chọn tất cả — bấm Mở rộng hoặc chọn tab để quét
                  </span>
                ) : (
                  compactPreviewTabs.map((title) => {
                    const isSelected = selectedTabTitles.includes(title);
                    return (
                      <button
                        type="button"
                        key={title}
                        onClick={() => toggleTabSelection(title)}
                        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11.5px] font-medium border transition-colors cursor-pointer select-none ${
                          isSelected
                            ? "bg-primary/10 border-primary/25 text-primary"
                            : "bg-foreground/[0.03] border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-[4px] flex items-center justify-center border transition-colors ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/40 bg-transparent"
                          }`}
                        >
                          {isSelected && <Check size={10} strokeWidth={2.5} />}
                        </span>
                        <span className="truncate max-w-[140px]">{title}</span>
                      </button>
                    );
                  })
                )}

                {hiddenTotalCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsTabsExpanded(true)}
                    className="h-7 px-2.5 rounded-lg text-[11.5px] font-medium bg-foreground/[0.05] hover:bg-foreground/[0.08] text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
                    title="Bấm để xem và chọn trong danh sách đầy đủ các tab"
                  >
                    {hiddenSelectedCount > 0
                      ? `+${hiddenSelectedCount} tab đã chọn khác`
                      : `+${hiddenTotalCount} tab khác`}
                  </button>
                )}
              </div>
            )}

            <div className="h-3.5 w-px bg-border hidden xl:block mx-0.5" />

            <div className="hidden xl:flex items-center gap-1.5 text-[11.5px] text-muted-foreground truncate">
              <span className="shrink-0">
                Tiêu đề: <span className="font-medium text-foreground">Dòng {activeProfile?.headerRow || 3}</span>
              </span>
              <span>·</span>
              <span className="truncate max-w-[260px]" title={writableColsText}>
                Cột ghi: <span className="font-medium text-foreground">{writableColsText}</span>
              </span>
            </div>
          </div>

          {/* Right Quick Actions */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {availableTabTitles.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={selectAllTabs}
                  disabled={selectedTabTitles.length === availableTabTitles.length}
                  className="h-7 px-2.5 rounded-lg text-[11.5px] font-medium bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground border border-border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Chọn tất cả các tab"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={deselectAllTabs}
                  disabled={selectedTabTitles.length === 0}
                  className="h-7 px-2.5 rounded-lg text-[11.5px] font-medium bg-foreground/[0.04] hover:bg-foreground/[0.08] text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Bỏ chọn tất cả các tab"
                >
                  Bỏ chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={handleUndoApplyAllTabs}
                  className="h-7 px-2.5 rounded-lg text-[11.5px] font-medium bg-foreground/[0.04] hover:bg-foreground/[0.08] text-muted-foreground hover:text-foreground border border-border transition-colors flex items-center gap-1 cursor-pointer"
                  title="Hoàn tác việc áp dụng cho tất cả các tab (chỉ giữ lại tab chính đã cấu hình)"
                >
                  <RotateCcw size={12} strokeWidth={1.75} />
                  <span>Hoàn tác áp dụng tất cả</span>
                </button>
              </>
            )}

            {availableTabTitles.length > COMPACT_TAB_PREVIEW_LIMIT && (
              <button
                type="button"
                onClick={() => setIsTabsExpanded(!isTabsExpanded)}
                className="h-7 px-2.5 rounded-lg text-[11.5px] font-medium bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground border border-border transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>{isTabsExpanded ? "Thu gọn" : `Mở rộng (${availableTabTitles.length})`}</span>
                {isTabsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}

            <button
              type="button"
              onClick={handleRefreshData}
              disabled={isScanning}
              className="h-7 px-2.5 rounded-lg text-[11.5px] font-medium bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground border border-border transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Tải lại dữ liệu Google Sheets mới nhất và quét lại"
            >
              <RotateCw size={12} strokeWidth={1.75} className={isScanning ? "animate-spin" : ""} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Expanded Collapsible Tab Drawer */}
        {isTabsExpanded && (
          <div className="pt-2.5 border-t border-border flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
                {availableTabTitles.length > 6 && (
                  <div className="relative flex-1">
                    <Search
                      size={12}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    />
                    <input
                      type="text"
                      value={tabSearchQuery}
                      onChange={(e) => setTabSearchQuery(e.target.value)}
                      placeholder="Tìm nhanh tab..."
                      className="w-full h-7 pl-7 pr-2.5 rounded-lg bg-background border border-border text-[11.5px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                )}
                <span className="text-[11px] text-muted-foreground">
                  Bấm vào tab để chọn/bỏ chọn quét, hoặc bấm dấu × để gỡ khỏi danh sách thực thi Batch.
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectOnlyPrimaryTab}
                  className="h-6 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] transition-colors cursor-pointer"
                >
                  Chỉ chọn tab chính ({activeProfile?.selectedTabTitle})
                </button>
              </div>
            </div>

            <div className="max-h-36 overflow-y-auto custom-scrollbar pr-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {filteredAvailableTabs.map((title) => {
                  const isSelected = selectedTabTitles.includes(title);
                  const isPrimary = title === activeProfile?.selectedTabTitle;
                  return (
                    <div
                      key={title}
                      onClick={() => toggleTabSelection(title)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleTabSelection(title);
                        }
                      }}
                      className={`group inline-flex items-center gap-1.5 h-7 pl-2 pr-1.5 rounded-lg text-[11.5px] font-medium border transition-colors cursor-pointer select-none ${
                        isSelected
                          ? "bg-primary/10 border-primary/25 text-primary"
                          : "bg-background/60 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-[4px] flex items-center justify-center border transition-colors shrink-0 ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/40 bg-transparent"
                        }`}
                      >
                        {isSelected && <Check size={10} strokeWidth={2.5} />}
                      </span>
                      <span className="truncate max-w-[150px]">{title}</span>
                      {isPrimary && (
                        <span className="text-[10px] px-1 rounded bg-foreground/[0.06] text-muted-foreground">
                          Chính
                        </span>
                      )}
                      {availableTabTitles.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => handleRemoveTabFromBatchList(title, e)}
                          title={`Gỡ tab "${title}" khỏi phần Thực thi Batch`}
                          className="w-4 h-4 rounded flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clean Minimal Drop Zone */}
      <div
        onClick={handlePickFolders}
        className={`px-4 py-2.5 rounded-2xl border border-dashed flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-colors cursor-pointer select-none shrink-0 min-w-0 ${
          isDragging
            ? "border-primary bg-primary/10"
            : "border-border bg-card/50 hover:bg-card hover:border-foreground/20"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-foreground/[0.05] flex items-center justify-center text-foreground shrink-0">
            <FolderPlus size={15} strokeWidth={1.75} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0 truncate">
            <span className="text-[12.5px] font-medium text-foreground truncate">
              {isDragging
                ? "Thả thư mục vào đây để bắt đầu quét"
                : "Kéo thả thư mục ngày hoặc từng job vào đây"}
            </span>
            <span className="text-[11.5px] text-muted-foreground hidden lg:inline truncate">
              — tự động quét đệ quy & đối soát hàng trên Google Sheets
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isScanning ? (
            <div className="flex items-center gap-1.5 h-7 px-3 bg-primary/10 text-primary text-[11.5px] font-medium rounded-lg">
              <RotateCw size={12} className="animate-spin" />
              <span>Đang quét...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              {(lastScannedPaths.length > 0 || discoveredJobs.length > 0) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshData();
                  }}
                  className="h-7 px-3 bg-foreground/[0.05] hover:bg-foreground/[0.08] text-foreground text-[11.5px] font-medium rounded-lg border border-border transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCw size={12} strokeWidth={1.75} />
                  <span>Quét lại</span>
                </button>
              )}
              <button
                type="button"
                className="h-7 px-3 bg-foreground/[0.05] hover:bg-foreground/[0.08] text-foreground text-[11.5px] font-medium rounded-lg border border-border transition-colors cursor-pointer"
              >
                Chọn thư mục
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scanning Progress Bar */}
      {isScanning && (
        <div className="px-4 py-2.5 bg-card border border-border rounded-xl flex items-center justify-between gap-3 shrink-0 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <RotateCw size={14} className="animate-spin text-primary shrink-0" />
            <span className="text-[12px] font-medium text-foreground truncate">
              {scanProgress?.message || "Đang đồng bộ Google Sheets & quét cây thư mục..."}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {scanProgress?.total ? (
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                {scanProgress.current}%
              </span>
            ) : null}
            <div className="w-28 bg-foreground/[0.06] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(15, scanProgress?.current || 25)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Bulk Conflict Actions */}
      {discoveredJobs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0 min-w-0">
          <div className="flex items-center gap-0.5 p-1 bg-foreground/[0.04] border border-border rounded-xl overflow-x-auto max-w-full custom-scrollbar">
            {[
              { id: "ALL", label: "Tất cả", count: discoveredJobs.length, dot: "" },
              { id: "READY", label: "Sẵn sàng", count: readyCount, dot: "bg-success" },
              { id: "CONFLICT", label: "Xung đột", count: conflictCount, dot: "bg-warning" },
              { id: "NEEDS_REVIEW", label: "Cần duyệt", count: needsReviewCount, dot: "bg-info" },
              ...(completedCount > 0
                ? [{ id: "COMPLETED", label: "Đã cập nhật", count: completedCount, dot: "bg-primary" }]
                : []),
              ...(skippedCount > 0
                ? [{ id: "SKIPPED", label: "Đã bỏ qua", count: skippedCount, dot: "bg-muted-foreground/50" }]
                : []),
            ].map((tab) => {
              const active = filterStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`h-7 px-2.5 rounded-lg text-[11.5px] transition-colors cursor-pointer flex items-center gap-1.5 border ${
                    active
                      ? "glass-pill text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.dot && <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />}
                  <span>
                    {tab.label} ({tab.count})
                  </span>
                </button>
              );
            })}
          </div>

          {filterStatus === "CONFLICT" && conflictCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] text-muted-foreground">Xử lý nhanh:</span>
              <button
                type="button"
                onClick={() => handleBulkResolveConflict("APPEND")}
                className="h-7 px-2.5 bg-primary/10 hover:bg-primary/15 border border-primary/25 text-primary font-medium rounded-lg text-[11.5px] transition-colors cursor-pointer"
              >
                Nối tiếp tất cả
              </button>
              <button
                type="button"
                onClick={() => handleBulkResolveConflict("OVERWRITE")}
                className="h-7 px-2.5 bg-foreground/[0.05] hover:bg-foreground/[0.08] border border-border text-foreground font-medium rounded-lg text-[11.5px] transition-colors cursor-pointer"
              >
                Ghi đè tất cả
              </button>
              <button
                type="button"
                onClick={() => handleBulkResolveConflict("SKIP")}
                className="h-7 px-2.5 bg-foreground/[0.03] hover:bg-foreground/[0.06] border border-border text-muted-foreground hover:text-foreground font-medium rounded-lg text-[11.5px] transition-colors cursor-pointer"
              >
                Bỏ qua tất cả
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {discoveredTabTitles.length > 1 && (
              <div className="flex items-center gap-1.5 bg-card border border-border h-7 px-2.5 rounded-lg">
                <span className="text-[11px] text-muted-foreground">Tab:</span>
                <select
                  value={filterTab}
                  onChange={(e) => setFilterTab(e.target.value)}
                  className="bg-transparent text-[11.5px] font-medium text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-card text-foreground">
                    Tất cả ({discoveredJobs.length})
                  </option>
                  {discoveredTabTitles.map((tab) => (
                    <option key={tab} value={tab} className="bg-card text-foreground">
                      {tab} (
                      {
                        discoveredJobs.filter(
                          (j) => (j.targetTabTitle || activeProfile?.selectedTabTitle) === tab
                        ).length
                      }
                      )
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={clearJobs}
              className="h-7 px-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground text-[11.5px] font-medium hover:bg-foreground/[0.04] transition-colors cursor-pointer"
            >
              Xóa danh sách
            </button>
          </div>
        </div>
      )}

      {/* Jobs Table */}
      <div className="flex-1 bg-card border border-border rounded-2xl overflow-hidden flex flex-col min-h-0">
        {discoveredJobs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="w-10 h-10 rounded-2xl bg-foreground/[0.04] border border-border flex items-center justify-center text-muted-foreground mb-3">
              <Layers size={18} strokeWidth={1.75} />
            </div>
            <p className="text-[13px] font-medium text-foreground">Chưa có job nào được quét</p>
            <p className="text-[12px] mt-1 text-muted-foreground max-w-md">
              Kéo thả thư mục chứa ảnh vào khung phía trên hoặc bấm "Chọn thư mục" để đối soát tự động với Google Sheets.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-border bg-foreground/[0.03] text-muted-foreground font-medium sticky top-0 backdrop-blur-md z-10">
                  <th className="py-2.5 px-4 font-medium">Thư mục Job</th>
                  <th className="py-2.5 px-4 font-medium">Thư mục thành phẩm</th>
                  <th className="py-2.5 px-4 font-medium">Số ảnh</th>
                  <th className="py-2.5 px-4 font-medium">Hàng khớp trên Sheet</th>
                  <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                  <th className="py-2.5 px-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-foreground/[0.02] transition-colors">
                    <td className="py-2.5 px-4 font-medium text-foreground max-w-[220px] truncate">
                      {job.jobFolderName}
                    </td>
                    <td className="py-2.5 px-4 max-w-[240px]">
                      <span className="font-medium text-foreground block truncate">
                        {job.finalFolderName}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground font-mono block truncate">
                        {job.finalFolderPath}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground tabular-nums">
                      {job.imageCount} ảnh
                    </td>
                    <td className="py-2.5 px-4">
                      {job.status === "SKIPPED" ? (
                        <div className="flex items-center gap-1.5 opacity-60">
                          {job.targetTabTitle && (
                            <span className="text-[11px] text-muted-foreground line-through">
                              {job.targetTabTitle}
                            </span>
                          )}
                          <span className="text-muted-foreground line-through text-[11.5px]">
                            {job.targetSheetRow ? `Hàng ${job.targetSheetRow}` : "Chưa gắn"}
                          </span>
                        </div>
                      ) : job.status === "NEEDS_REVIEW" ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setReviewingJob(job)}
                            className="h-6 px-2.5 bg-primary/10 hover:bg-primary/15 text-primary border border-primary/25 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Chọn hàng ({job.candidateRows?.length || 0})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAssigningRowJob(job);
                              setManualRowInput("");
                              setManualTabInput(job.targetTabTitle || selectedTabTitles[0] || "");
                            }}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                          >
                            Nhập tay
                          </button>
                        </div>
                      ) : job.targetSheetRow ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {job.targetTabTitle && (
                            <span className="text-muted-foreground bg-foreground/[0.04] border border-border px-1.5 py-0.5 rounded text-[11px]">
                              {job.targetTabTitle}
                            </span>
                          )}
                          <span className="font-medium text-foreground bg-foreground/[0.04] border border-border px-2 py-0.5 rounded text-[11px] font-mono">
                            Hàng {job.targetSheetRow}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAssigningRowJob(job);
                              setManualRowInput(String(job.targetSheetRow || ""));
                              setManualTabInput(job.targetTabTitle || selectedTabTitles[0] || "");
                            }}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer ml-0.5"
                          >
                            Đổi
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-[11.5px] truncate max-w-[160px]">
                            {job.statusReason || "Chưa tìm thấy"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAssigningRowJob(job);
                              setManualRowInput("");
                              setManualTabInput(job.targetTabTitle || selectedTabTitles[0] || "");
                            }}
                            className="h-6 px-2 bg-foreground/[0.05] hover:bg-foreground/[0.08] text-foreground border border-border rounded text-[11px] font-medium transition-colors cursor-pointer shrink-0"
                          >
                            Gán hàng
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {job.status === "READY" && (
                        <span className="inline-flex items-center gap-1.5 text-foreground text-[11.5px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-success" />
                          <span>Sẵn sàng</span>
                        </span>
                      )}
                      {job.status === "CONFLICT" && (
                        <span className="inline-flex items-center gap-1.5 text-foreground text-[11.5px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                          <span>Xung đột ({job.conflictDetails?.field || "Dữ liệu"})</span>
                        </span>
                      )}
                      {job.status === "NEEDS_REVIEW" && (
                        <button
                          type="button"
                          onClick={() => setReviewingJob(job)}
                          className="inline-flex items-center gap-1.5 text-foreground hover:text-primary text-[11.5px] cursor-pointer"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-info" />
                          <span>Cần duyệt</span>
                        </button>
                      )}
                      {job.status === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1.5 text-primary text-[11.5px] font-medium">
                          <Check size={12} />
                          <span>Đã cập nhật</span>
                        </span>
                      )}
                      {job.status === "SKIPPED" && (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground text-[11.5px]">
                          <span>Đã bỏ qua</span>
                        </span>
                      )}
                      {job.status === "ERROR" && (
                        <span
                          className="inline-flex items-center gap-1.5 text-destructive text-[11.5px]"
                          title={job.statusReason}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                          <span className="truncate max-w-[180px]">
                            {job.statusReason || "Lỗi"}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {job.status === "NEEDS_REVIEW" && (
                          <button
                            type="button"
                            onClick={() => setReviewingJob(job)}
                            className="h-7 px-2.5 bg-primary/10 hover:bg-primary/15 text-primary border border-primary/25 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Chọn hàng
                          </button>
                        )}
                        {job.status === "CONFLICT" && (
                          <button
                            type="button"
                            onClick={() => setResolvingConflictJob(job)}
                            className="h-7 px-2.5 bg-foreground/[0.05] hover:bg-foreground/[0.08] text-foreground border border-border rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Xử lý
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setInspectingJob(job)}
                          className="h-7 px-2.5 bg-foreground/[0.04] hover:bg-foreground/[0.08] text-foreground border border-border rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="Xem chi tiết thay đổi"
                        >
                          <Eye size={12} strokeWidth={1.75} />
                          <span>Chi tiết</span>
                        </button>
                        {job.status !== "SKIPPED" ? (
                          <button
                            type="button"
                            onClick={() => handleCancelJob(job.id)}
                            className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] rounded-lg text-[11px] transition-colors cursor-pointer"
                            title="Bỏ qua job này"
                          >
                            Bỏ qua
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestoreJob(job.id)}
                            className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] rounded-lg text-[11px] transition-colors cursor-pointer"
                            title="Khôi phục job này"
                          >
                            Khôi phục
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveJob(job.id)}
                          className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                          title="Xóa khỏi danh sách"
                        >
                          <Trash2 size={13} strokeWidth={1.75} />
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
        <div className="px-4 py-3 bg-card border border-border rounded-2xl flex items-center justify-between gap-4 shrink-0">
          <div className="flex flex-col">
            <span className="text-[12.5px] font-medium text-foreground">
              Sẵn sàng cập nhật: <span className="font-semibold">{readyCount} job</span>
              {conflictCount > 0 && ` · Xung đột: ${conflictCount}`}
              {needsReviewCount > 0 && ` · Cần duyệt: ${needsReviewCount}`}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Chỉ cập nhật các job ở trạng thái Sẵn sàng, giữ nguyên các cột công thức.
            </span>
          </div>

          <button
            type="button"
            onClick={handleExecuteUpdate}
            disabled={readyCount === 0 || isExecutingBatch}
            className="btn-base btn-primary h-9 px-4 rounded-xl text-[12px] font-medium"
          >
            <Play size={13} className="fill-current" />
            <span>
              {isExecutingBatch
                ? `Đang cập nhật (${batchProgress?.current || 0}/${batchProgress?.total || readyCount})...`
                : `Cập nhật ${readyCount} job sẵn sàng`}
            </span>
          </button>
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-foreground">
                Gán số hàng trên Sheet
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAssigningRowJob(null);
                  setManualRowInput("");
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-3 bg-foreground/[0.03] rounded-xl border border-border text-[12px] flex flex-col gap-1.5">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Thư mục Job:</span>
                <span className="font-medium text-foreground truncate">{assigningRowJob.jobFolderName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Khách hàng:</span>
                <span className="font-medium text-foreground">
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
              className="flex flex-col gap-3.5"
            >
              {availableTabTitles.length > 1 && (
                <div>
                  <label className="text-[12px] font-medium text-foreground block mb-1.5">
                    Tab Google Sheet
                  </label>
                  <select
                    value={manualTabInput || assigningRowJob.targetTabTitle || selectedTabTitles[0] || ""}
                    onChange={(e) => setManualTabInput(e.target.value)}
                    className="w-full h-9 px-3 bg-background border border-border rounded-xl text-[12px] font-medium text-foreground focus:outline-none focus:border-primary"
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
                <label className="text-[12px] font-medium text-foreground block mb-1.5">
                  Số thứ tự hàng (Row)
                </label>
                <input
                  type="number"
                  min="1"
                  autoFocus
                  placeholder="Ví dụ: 14"
                  value={manualRowInput}
                  onChange={(e) => setManualRowInput(e.target.value)}
                  className="w-full h-9 px-3 bg-background border border-border rounded-xl text-[13px] font-medium text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setAssigningRowJob(null);
                    setManualRowInput("");
                  }}
                  className="h-8 px-3 text-[12px] text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-base btn-primary h-8 px-4 rounded-lg text-[12px]"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Duyệt và Chọn Hàng */}
      {reviewingJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl p-5 shadow-xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">
                  Chọn hàng tương ứng trên Sheet
                </h3>
                <p className="text-[11.5px] text-muted-foreground mt-0.5">
                  Chọn một hàng đề xuất bên dưới hoặc nhập số hàng thủ công.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingJob(null)}
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-foreground/[0.05] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-foreground/[0.03] rounded-xl border border-border text-[12px] flex flex-col gap-1 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Thư mục job:</span>
                <span className="font-medium text-foreground font-mono">{reviewingJob.jobFolderName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Khách hàng:</span>
                <span className="font-medium text-foreground">
                  {reviewingJob.metadata?.customerName || reviewingJob.finalFolderName}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
              <span className="text-[12px] font-medium text-foreground">
                Hàng đề xuất ({reviewingJob.candidateRows?.length || 0}):
              </span>

              {!reviewingJob.candidateRows || reviewingJob.candidateRows.length === 0 ? (
                <div className="p-4 text-center text-[12px] text-muted-foreground bg-foreground/[0.02] rounded-xl border border-border">
                  Không có hàng đề xuất tự động. Bạn có thể nhập số hàng thủ công bên dưới.
                </div>
              ) : (
                reviewingJob.candidateRows.map((candidate) => (
                  <div
                    key={`${candidate.tabTitle || ""}-${candidate.row}`}
                    className="p-3 bg-background/60 hover:bg-foreground/[0.03] border border-border rounded-xl flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {candidate.tabTitle && (
                          <span className="px-1.5 py-0.5 bg-foreground/[0.05] text-foreground rounded text-[11px]">
                            {candidate.tabTitle}
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-foreground/[0.05] text-foreground rounded text-[11.5px] font-medium font-mono">
                          Hàng {candidate.row}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Độ khớp: {Math.min(100, Math.round((candidate.score / 2.0) * 100))}%
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
                        {candidate.values["C"] && (
                          <div className="truncate">
                            <span className="text-foreground font-medium">Khách:</span> {candidate.values["C"]}
                          </div>
                        )}
                        {candidate.values["H"] && (
                          <div className="truncate">
                            <span className="text-foreground font-medium">File:</span> {candidate.values["H"]}
                          </div>
                        )}
                        {candidate.values["B"] && (
                          <div>
                            <span className="text-foreground font-medium">Giờ:</span> {candidate.values["B"]}
                          </div>
                        )}
                        {candidate.values["D"] && (
                          <div className="truncate">
                            <span className="text-foreground font-medium">Concept:</span> {candidate.values["D"]}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleSelectCandidateRow(
                          reviewingJob,
                          candidate.row,
                          candidate.values,
                          candidate.tabTitle
                        )
                      }
                      className="btn-base btn-primary h-8 px-3.5 rounded-lg text-[11.5px] shrink-0"
                    >
                      Chọn hàng này
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const job = reviewingJob;
                  setReviewingJob(null);
                  setAssigningRowJob(job);
                  setManualRowInput("");
                  setManualTabInput(job.targetTabTitle || selectedTabTitles[0] || "");
                }}
                className="text-[12px] text-muted-foreground hover:text-foreground cursor-pointer font-medium"
              >
                Nhập số hàng bằng tay...
              </button>
              <button
                type="button"
                onClick={() => setReviewingJob(null)}
                className="h-8 px-3.5 text-[12px] text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
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
