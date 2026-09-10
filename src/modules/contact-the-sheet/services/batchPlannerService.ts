import type {
  DiscoveredJob,
  WorkspaceProfile,
  UpdatePlan,
  PlannedCellWrite,
} from "../types/index.ts";
import { schemaMappingService } from "./schemaMappingService.ts";
import { conflictDetectorService } from "./conflictDetectorService.ts";

export interface BatchPlanSummary {
  readyJobs: DiscoveredJob[];
  conflictJobs: DiscoveredJob[];
  needsReviewJobs: DiscoveredJob[];
  errorJobs: DiscoveredJob[];
  plans: Record<string, UpdatePlan>;
}

export class BatchPlannerService {
  /**
   * Builds an immutable UpdatePlan for a job and categorizes its execution state.
   */
  public planJobUpdate(job: DiscoveredJob, profile: WorkspaceProfile): { job: DiscoveredJob; plan: UpdatePlan } {
    // If job does not have a confirmed row yet, it cannot be planned
    if (!job.targetSheetRow) {
      return {
        job: { ...job, status: job.status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "ERROR" },
        plan: {
          jobId: job.id,
          targetRow: 0,
          writes: [],
          isSafeToExecute: false,
          warnings: ["Chưa xác định được hàng đích trên Sheet"],
        },
      };
    }

    const targetRow = job.targetSheetRow;
    const snapshot = job.targetRowSnapshot || {};
    const plannedWrites: PlannedCellWrite[] = [];
    const warnings: string[] = [];

    // Find mapped editor & delivery link fields
    const editorMapping = profile.fieldMappings.find((m) => m.semanticField === "EDITOR");
    const linkMapping = profile.fieldMappings.find((m) => m.semanticField === "DELIVERY_LINK");

    let hasConflict = false;
    let detectedConflict: {
      field: string;
      columnLetter: string;
      existingValue: string;
      proposedValue: string;
      allowedPolicies: Array<"OVERWRITE" | "APPEND" | "SKIP">;
    } | null = null;

    // 1. Evaluate EDITOR write
    if (editorMapping && editorMapping.permission === "READ_WRITE") {
      const currentVal = (snapshot[editorMapping.columnLetter] || "").trim();
      const currentUserEditor = (
        profile.valueMappings.find((v) => v.semanticRole === "EDITOR_CURRENT_USER")?.sheetValue || "Vương"
      ).trim();

      const isSameEditor = currentVal.toLowerCase() === currentUserEditor.toLowerCase();
      let allowed = false;
      let blockedReason: PlannedCellWrite["blockedReason"] = undefined;
      let finalEditor = currentUserEditor;

      // Base write permission (hard formula & scope checks)
      const baseCheck = schemaMappingService.evaluateWritePermission(
        profile,
        "EDITOR",
        targetRow,
        currentVal,
        false
      );

      if (!baseCheck.allowed && baseCheck.reason !== "EXISTING_VALUE_CONFLICT") {
        allowed = false;
        blockedReason = baseCheck.reason;
      } else if (editorMapping.writePolicy === "SET_IF_EMPTY") {
        if (currentVal.length === 0) {
          allowed = true;
        } else if (isSameEditor) {
          // Already set to current user editor, no overwrite needed
          allowed = false;
          blockedReason = undefined; // Already satisfied
        } else {
          // Cell already has another editor's name: DO NOT OVERWRITE!
          allowed = false;
          blockedReason = "EXISTING_VALUE_CONFLICT";
          warnings.push(`Cột ${editorMapping.columnLetter} (Tên Edit) đã có "${currentVal}", giữ nguyên theo chính sách "Chỉ ghi nếu ô trống".`);
        }
      } else if (editorMapping.writePolicy === "ASK_BEFORE_OVERWRITE") {
        if (currentVal.length === 0 || isSameEditor) {
          allowed = true;
        } else if (
          job.conflictDetails?.resolvedPolicy &&
          (job.conflictDetails.field === "Tên Edit" || job.conflictDetails.field === "EDITOR")
        ) {
          if (job.conflictDetails.resolvedPolicy === "OVERWRITE") {
            allowed = true;
            finalEditor = currentUserEditor;
          } else {
            allowed = false;
            blockedReason = "EXISTING_VALUE_CONFLICT";
          }
        } else {
          hasConflict = true;
          detectedConflict = {
            field: "Tên Edit",
            columnLetter: editorMapping.columnLetter,
            existingValue: currentVal,
            proposedValue: currentUserEditor,
            allowedPolicies: ["OVERWRITE", "SKIP"],
          };
          allowed = false;
          blockedReason = "EXISTING_VALUE_CONFLICT";
          warnings.push(`Cột ${editorMapping.columnLetter} (Tên Edit) đã có dữ liệu "${currentVal}". Cần xác nhận trước khi ghi đè.`);
        }
      } else if (editorMapping.writePolicy === "ALWAYS_REPLACE") {
        allowed = true;
      } else {
        // PREVENT_OVERWRITE / default
        if (currentVal.length === 0) allowed = true;
        else {
          allowed = false;
          blockedReason = "EXISTING_VALUE_CONFLICT";
        }
      }

      plannedWrites.push({
        field: "EDITOR",
        columnLetter: editorMapping.columnLetter,
        row: targetRow,
        oldValue: currentVal,
        newValue: finalEditor,
        allowed,
        blockedReason,
      });
    }

    // 2. Evaluate DELIVERY_LINK write & conflict
    if (linkMapping && linkMapping.permission === "READ_WRITE") {
      const currentVal = (snapshot[linkMapping.columnLetter] || "").trim();
      const driveLink = (job.driveWebLink || "").trim();

      let allowed = false;
      let blockedReason: PlannedCellWrite["blockedReason"] = undefined;
      let finalNewLink = driveLink;

      // Base check (formula & scope)
      const baseCheck = schemaMappingService.evaluateWritePermission(
        profile,
        "DELIVERY_LINK",
        targetRow,
        currentVal,
        false
      );

      if (!baseCheck.allowed && baseCheck.reason !== "EXISTING_VALUE_CONFLICT") {
        allowed = false;
        blockedReason = baseCheck.reason;
      } else if (!driveLink) {
        allowed = false;
        blockedReason = "FIELD_READ_ONLY";
        warnings.push(`Chưa có đường dẫn Drive cho job "${job.jobFolderName}".`);
      } else {
        const isSameLink = currentVal.includes(driveLink);

        if (linkMapping.writePolicy === "SET_IF_EMPTY") {
          if (currentVal.length === 0) {
            allowed = true;
          } else if (isSameLink) {
            allowed = false;
            blockedReason = undefined;
          } else {
            allowed = false;
            blockedReason = "EXISTING_VALUE_CONFLICT";
            warnings.push(`Cột ${linkMapping.columnLetter} (Link Edit) đã có dữ liệu, giữ nguyên theo chính sách "Chỉ ghi nếu ô trống".`);
          }
        } else if (linkMapping.writePolicy === "ASK_BEFORE_OVERWRITE") {
          const conflictCheck = conflictDetectorService.inspectLinkConflict(currentVal);

          if (!conflictCheck.hasConflict || isSameLink) {
            allowed = true;
          } else if (job.conflictDetails?.resolvedPolicy) {
            if (job.conflictDetails.resolvedPolicy === "OVERWRITE") {
              allowed = true;
              finalNewLink = driveLink;
            } else if (job.conflictDetails.resolvedPolicy === "APPEND") {
              allowed = true;
              finalNewLink = conflictDetectorService.resolveCellValue(currentVal, driveLink, "APPEND");
            } else {
              allowed = false;
              blockedReason = "EXISTING_VALUE_CONFLICT";
            }
          } else {
            hasConflict = true;
            detectedConflict = {
              field: "Link Edit",
              columnLetter: linkMapping.columnLetter,
              existingValue: currentVal,
              proposedValue: driveLink,
              allowedPolicies: ["APPEND", "OVERWRITE", "SKIP"],
            };
            allowed = false;
            blockedReason = "EXISTING_VALUE_CONFLICT";
            warnings.push(conflictCheck.description || "Ô Link Edit đã chứa dữ liệu cũ. Cần xác nhận trước khi ghi đè.");
          }
        } else if (linkMapping.writePolicy === "APPEND") {
          allowed = true;
          finalNewLink = conflictDetectorService.resolveCellValue(currentVal, driveLink, "APPEND");
        } else if (linkMapping.writePolicy === "ALWAYS_REPLACE") {
          allowed = true;
        } else {
          // PREVENT_OVERWRITE / default
          if (currentVal.length === 0) allowed = true;
          else {
            allowed = false;
            blockedReason = "EXISTING_VALUE_CONFLICT";
          }
        }
      }

      plannedWrites.push({
        field: "DELIVERY_LINK",
        columnLetter: linkMapping.columnLetter,
        row: targetRow,
        oldValue: currentVal,
        newValue: finalNewLink,
        allowed,
        blockedReason,
      });
    }

    // 3. Determine overall job execution readiness
    const hasHardError = plannedWrites.some(
      (w) => w.blockedReason === "FORMULA_CELL" || w.blockedReason === "OUTSIDE_ROW_SCOPE"
    );

    const executableWrites = plannedWrites.filter(
      (w) => w.allowed && w.oldValue.trim() !== w.newValue.trim()
    );

    let jobStatus: DiscoveredJob["status"] = "READY";
    let statusReason: string | undefined;

    if (hasConflict) {
      jobStatus = "CONFLICT";
      statusReason = `Ô ${detectedConflict?.field || "dữ liệu"} đã có sẵn nội dung cũ. Cần duyệt trước khi ghi đè.`;
    } else if (hasHardError) {
      jobStatus = "ERROR";
      const rawReason = plannedWrites.find((w) => !w.allowed)?.blockedReason;
      if (rawReason === "FORMULA_CELL") statusReason = "Ô đích chứa công thức bảo vệ";
      else if (rawReason === "OUTSIDE_ROW_SCOPE") statusReason = "Hàng nằm ngoài phạm vi cho phép";
      else statusReason = rawReason || "Bị chặn bởi quyền hạn";
    } else if (executableWrites.length > 0) {
      jobStatus = "READY";
      statusReason = undefined;
    } else {
      // No changes needed (cells are either already set or protected by SET_IF_EMPTY)
      jobStatus = "COMPLETED";
      statusReason = "Đã có đủ dữ liệu / Đã được bảo toàn theo chính sách";
    }

    const updatedJob: DiscoveredJob = {
      ...job,
      status: jobStatus,
      statusReason,
      conflictDetails: hasConflict && detectedConflict
        ? {
            field: detectedConflict.field,
            existingValue: detectedConflict.existingValue,
            proposedValue: detectedConflict.proposedValue,
            allowedPolicies: detectedConflict.allowedPolicies,
          }
        : job.conflictDetails,
    };

    const plan: UpdatePlan = {
      jobId: job.id,
      targetRow,
      writes: plannedWrites,
      isSafeToExecute: !hasConflict && !hasHardError && executableWrites.length > 0,
      warnings,
    };

    return { job: updatedJob, plan };
  }

  /**
   * Plans the entire batch and groups jobs for partial safe execution.
   */
  public planBatch(jobs: DiscoveredJob[], profile: WorkspaceProfile): BatchPlanSummary {
    const readyJobs: DiscoveredJob[] = [];
    const conflictJobs: DiscoveredJob[] = [];
    const needsReviewJobs: DiscoveredJob[] = [];
    const errorJobs: DiscoveredJob[] = [];
    const plans: Record<string, UpdatePlan> = {};

    for (const job of jobs) {
      if (job.status === "NEEDS_REVIEW") {
        needsReviewJobs.push(job);
        continue;
      }

      const { job: evaluatedJob, plan } = this.planJobUpdate(job, profile);
      plans[evaluatedJob.id] = plan;

      if (evaluatedJob.status === "READY") {
        readyJobs.push(evaluatedJob);
      } else if (evaluatedJob.status === "CONFLICT") {
        conflictJobs.push(evaluatedJob);
      } else if (evaluatedJob.status === "NEEDS_REVIEW") {
        needsReviewJobs.push(evaluatedJob);
      } else {
        errorJobs.push(evaluatedJob);
      }
    }

    return {
      readyJobs,
      conflictJobs,
      needsReviewJobs,
      errorJobs,
      plans,
    };
  }
}

export const batchPlannerService = new BatchPlannerService();
