/**
 * Audit Log and Operation History Types
 */

export interface AuditCellChange {
  columnLetter: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  workspaceId: string;
  workspaceTitle: string;
  sheetId: number;
  tabTitle: string;
  jobFolderName: string;
  targetRow: number;
  changes: AuditCellChange[];
  status: "SUCCESS" | "FAILED" | "REVERTED";
  errorMessage?: string;
  operatorGoogleAccount?: string;
}

export interface BatchAuditEntry {
  batchId: string;
  timestamp: string;
  workspaceTitle: string;
  totalJobs: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  records: AuditRecord[];
}
