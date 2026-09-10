/**
 * Workspace Profile, Mapping, and Permission Types
 */

export type SemanticField =
  | "SHOOT_DATE"
  | "SHOOT_TIME"
  | "CUSTOMER_NAME"
  | "CUSTOMER_ID"
  | "SOCIAL_USERNAME"
  | "CONCEPT"
  | "NOTES"
  | "BRANCH"
  | "WORKFLOW_STATUS"
  | "JOB_FOLDER_NAME"
  | "SELECTED_IMAGE_CODES_PRIMARY"
  | "SELECTED_IMAGE_CODES_SECONDARY"
  | "EDIT_REQUEST"
  | "DELIVERY_DUE"
  | "PHOTO_PICK_STATUS"
  | "PHOTO_PICKER"
  | "EDITOR"
  | "EDIT_STATUS"
  | "DELIVERY_LINK"
  | "FIX_STATUS"
  | "FIX_LINK"
  | "PICK_COMPLETED_AT"
  | "EDIT_COMPLETED_AT";

export type FieldPermission = "IGNORE" | "READ_ONLY" | "READ_WRITE";

export type WritePolicy =
  | "SET_IF_EMPTY"
  | "ASK_BEFORE_OVERWRITE"
  | "ALWAYS_REPLACE"
  | "APPEND";

export interface FieldMapping {
  semanticField: SemanticField;
  columnLetter: string; // "A", "B", ...
  columnIndex: number; // 0-indexed
  columnHeader: string;
  permission: FieldPermission;
  isFormulaDerived: boolean;
  writePolicy: WritePolicy;
}

export interface DropdownValueMapping {
  semanticRole: "EDITOR_CURRENT_USER" | "PHOTO_PICK_STATUS_COMPLETED" | "EDIT_STATUS_COMPLETED" | "CUSTOM";
  sheetValue: string;
  customRoleName?: string;
}

export interface RowScopeConfig {
  startRow: number; // 1-indexed, typically detectedHeaderRow + 1
  endRow?: number; // optional upper bound
  ignoreEmptyRows: boolean;
}

export interface DriveConfig {
  localRootPath: string; // e.g. /Users/vuongdev/Library/CloudStorage/GoogleDrive-user@studio.com/My Drive
  remoteRootDriveId: string; // Drive root folder id or 'root'
  sharingPolicy: "KEEP_EXISTING" | "ANYONE_WITH_LINK" | "STUDIO_ACCOUNTS_ONLY";
  sharingAutomationEnabled: boolean; // MVP defaults to false (least privilege)
}

export type WorkspaceHealthStatus =
  | "HEALTHY"
  | "WORKSPACE_DATA_UNHEALTHY"
  | "SCHEMA_SHIFTED"
  | "UNAUTHORIZED"
  | "UNINITIALIZED";

export interface TabConfiguration {
  sheetId: number;
  tabTitle: string;
  headerRow: number;
  fieldMappings: FieldMapping[];
  rowScope: RowScopeConfig;
  schemaFingerprint: string;
  updatedAt: string;
}

export interface WorkspaceProfile {
  id: string;
  displayName: string;
  googleAccountEmail?: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  selectedTabTitle: string;
  selectedTabId: number;
  headerRow: number;
  fieldMappings: FieldMapping[];
  valueMappings: DropdownValueMapping[];
  rowScope: RowScopeConfig;
  driveConfig: DriveConfig;
  isMockSandbox: boolean;
  schemaFingerprint: string;
  healthStatus: WorkspaceHealthStatus;
  tabConfigurations?: Record<string, TabConfiguration>;
  createdAt: string;
  updatedAt: string;
}
