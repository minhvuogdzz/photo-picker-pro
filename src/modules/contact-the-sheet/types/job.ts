/**
 * Job and Scanning Domain Types
 * Unified model for jobs discovered via local filesystem or remote Drive Web.
 */

export type JobStatus =
  | "PENDING"
  | "READY"
  | "CONFLICT"
  | "NEEDS_REVIEW"
  | "ERROR"
  | "COMPLETED"
  | "SKIPPED";

export interface ParsedJobMetadata {
  rawFolderName: string;
  shootDate?: string; // "07/09"
  shootTime?: string; // "12:00"
  customerName?: string;
  customerId?: string;
  socialUsername?: string;
  packageCode?: string;
  candidateNames?: string[];
  unparsedTokens: string[];
}

export interface FinalFolderCandidate {
  path: string;
  name: string;
  depth: number;
  finishedImageCount: number;
  rawImageCount: number;
  representativeExtensions: string[];
  isCandidate: boolean;
  reasons: string[];
}

export interface DiscoveredJob {
  id: string; // generated unique id
  sourceType: "LOCAL_DRIVE_DESKTOP" | "REMOTE_DRIVE_WEB";
  jobFolderName: string; // root job folder name e.g. "7-9 12h _xuka_11 1cc"
  finalFolderName: string; // deepest delivery folder name
  finalFolderPath: string; // absolute local path or remote path
  relativePathFromRoot?: string; // relative to Drive root
  driveItemId?: string; // resolved Google Drive folder ID
  driveWebLink?: string; // resolved web URL
  metadata: ParsedJobMetadata;
  imageCount: number;
  status: JobStatus;
  statusReason?: string;
  targetSheetRow?: number;
  targetRowSnapshot?: Record<string, string>; // column letter -> current value
  matchConfidence?: number;
  candidateRows?: Array<{
    row: number;
    score: number;
    matchedFields: string[];
    values: Record<string, string>;
  }>;
  conflictDetails?: {
    field: string;
    existingValue: string;
    proposedValue: string;
    allowedPolicies: Array<"OVERWRITE" | "APPEND" | "SKIP">;
    resolvedPolicy?: "OVERWRITE" | "APPEND" | "SKIP";
  };
}
