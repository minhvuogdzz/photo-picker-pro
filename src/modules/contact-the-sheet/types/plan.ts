/**
 * Batch Planning and Pre-Commit Types
 */

import type { SemanticField } from "./workspace";

export interface PlannedCellWrite {
  field: SemanticField;
  columnLetter: string;
  row: number;
  oldValue: string;
  newValue: string;
  allowed: boolean;
  blockedReason?: "FORMULA_CELL" | "FIELD_READ_ONLY" | "OUTSIDE_ROW_SCOPE" | "EXISTING_VALUE_CONFLICT";
}

export interface UpdatePlan {
  jobId: string;
  targetRow: number;
  writes: PlannedCellWrite[];
  isSafeToExecute: boolean;
  warnings: string[];
}

export interface PreCommitRevalidationResult {
  jobId: string;
  isStale: boolean;
  staleFields: Array<{
    columnLetter: string;
    field: string;
    expectedOldValue: string;
    actualCurrentValue: string;
  }>;
}

export interface BatchExecutionSummary {
  batchId: string;
  startedAt: string;
  finishedAt: string;
  totalPlanned: number;
  successCount: number;
  conflictCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{
    jobId: string;
    row?: number;
    error: string;
  }>;
}
