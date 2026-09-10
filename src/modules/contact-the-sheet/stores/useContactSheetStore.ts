import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  WorkspaceProfile,
  TabConfiguration,
  DiscoveredJob,
  UpdatePlan,
  AuditRecord,
  DriveConfig,
  FieldMapping,
} from "../types/index.ts";

export type GoogleAuthStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "TOKEN_REFRESHING"
  | "RESOURCE_ACCESS_DENIED"
  | "AUTHORIZATION_EXPIRED";

export interface GoogleConnectionState {
  status: GoogleAuthStatus;
  accountEmail?: string;
  accountName?: string;
  avatarUrl?: string;
  grantedScopes: string[];
  hasDriveAccess: boolean;
  hasSheetsAccess: boolean;
  sharingAutomationEnabled: boolean;
  error?: string;
}

interface ContactSheetState {
  // Profiles
  profiles: WorkspaceProfile[];
  activeProfile: WorkspaceProfile | null;
  setActiveProfile: (id: string) => void;
  saveProfile: (profile: WorkspaceProfile) => void;
  deleteProfile: (id: string) => void;
  switchActiveTab: (tabTitle: string) => void;
  saveTabConfiguration: (tabConfig: TabConfiguration) => void;
  resetToStandard19Profile: () => void;

  // Persisted Sheet URL & Drive Config
  lastSheetUrl: string;
  setLastSheetUrl: (url: string) => void;
  lastDriveConfig: DriveConfig;
  setLastDriveConfig: (config: DriveConfig) => void;

  // Google Connection (Module-Local)
  googleConnection: GoogleConnectionState;
  setGoogleConnection: (state: Partial<GoogleConnectionState>) => void;
  disconnectGoogle: () => void;

  // Jobs
  discoveredJobs: DiscoveredJob[];
  setDiscoveredJobs: (jobs: DiscoveredJob[]) => void;
  updateJob: (jobId: string, updates: Partial<DiscoveredJob>) => void;
  clearJobs: () => void;

  // Scanning State
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
  scanProgress: { current: number; total: number; message: string } | null;
  setScanProgress: (progress: { current: number; total: number; message: string } | null) => void;

  // Plans & Executions
  updatePlans: Record<string, UpdatePlan>; // jobId -> UpdatePlan
  setUpdatePlan: (jobId: string, plan: UpdatePlan) => void;
  clearPlans: () => void;
  isExecutingBatch: boolean;
  setIsExecutingBatch: (executing: boolean) => void;
  batchProgress: { current: number; total: number } | null;
  setBatchProgress: (progress: { current: number; total: number } | null) => void;

  // Audit
  auditRecords: AuditRecord[];
  addAuditRecord: (record: AuditRecord) => void;
  clearAuditRecords: () => void;
}

export const DEFAULT_PRODUCTION_DRIVE_CONFIG: DriveConfig = {
  localRootPath: "/Users/vuongdev/Library/CloudStorage/GoogleDrive-ougn.it2@gmail.com/My Drive",
  remoteRootDriveId: "root",
  sharingPolicy: "KEEP_EXISTING",
  sharingAutomationEnabled: false,
};

export const STANDARD_19_STUDIO_MAPPINGS: FieldMapping[] = [
  {
    semanticField: "SHOOT_DATE",
    columnLetter: "A",
    columnIndex: 0,
    columnHeader: "Ngày",
    permission: "READ_ONLY",
    isFormulaDerived: true,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "SHOOT_TIME",
    columnLetter: "B",
    columnIndex: 1,
    columnHeader: "Giờ",
    permission: "READ_ONLY",
    isFormulaDerived: true,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "CUSTOMER_NAME",
    columnLetter: "C",
    columnIndex: 2,
    columnHeader: "Tên khách",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "NOTES",
    columnLetter: "D",
    columnIndex: 3,
    columnHeader: "Concept",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "NOTES",
    columnLetter: "E",
    columnIndex: 4,
    columnHeader: "Lưu ý",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "NOTES",
    columnLetter: "F",
    columnIndex: 5,
    columnHeader: "Cơ sở",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "NOTES",
    columnLetter: "G",
    columnIndex: 6,
    columnHeader: "Trạng Thái 1",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "JOB_FOLDER_NAME",
    columnLetter: "H",
    columnIndex: 7,
    columnHeader: "Tên file",
    permission: "READ_ONLY",
    isFormulaDerived: true,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "NOTES",
    columnLetter: "I",
    columnIndex: 8,
    columnHeader: "Mã ảnh chọn (1)",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "NOTES",
    columnLetter: "J",
    columnIndex: 9,
    columnHeader: "Mã ảnh chọn (2)",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "NOTES",
    columnLetter: "K",
    columnIndex: 10,
    columnHeader: "Yêu cầu edit",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "NOTES",
    columnLetter: "L",
    columnIndex: 11,
    columnHeader: "Hẹn trả ảnh",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "PHOTO_PICK_STATUS",
    columnLetter: "M",
    columnIndex: 12,
    columnHeader: "Trạng Thái Lọc",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "EDITOR",
    columnLetter: "N",
    columnIndex: 13,
    columnHeader: "Tên Edit",
    permission: "READ_WRITE",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "DELIVERY_LINK",
    columnLetter: "O",
    columnIndex: 14,
    columnHeader: "Link Edit",
    permission: "READ_WRITE",
    isFormulaDerived: false,
    writePolicy: "ASK_BEFORE_OVERWRITE",
  },
  {
    semanticField: "NOTES",
    columnLetter: "P",
    columnIndex: 15,
    columnHeader: "Fix",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "NOTES",
    columnLetter: "Q",
    columnIndex: 16,
    columnHeader: "Link Fix",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "NOTES",
    columnLetter: "R",
    columnIndex: 17,
    columnHeader: "Time mã",
    permission: "READ_ONLY",
    isFormulaDerived: false,
    writePolicy: "SET_IF_EMPTY",
  },
  {
    semanticField: "EDIT_COMPLETED_AT",
    columnLetter: "S",
    columnIndex: 18,
    columnHeader: "Time edit",
    permission: "READ_ONLY",
    isFormulaDerived: true,
    writePolicy: "SET_IF_EMPTY",
  },
];

export const DEFAULT_PRODUCTION_PROFILE: WorkspaceProfile = {
  id: "studio-production",
  displayName: "Studio Ops",
  spreadsheetId: "1mQQ7FeFvy93kked5T_ob7wiiRa8XhX9lC54i6M_J0ak",
  spreadsheetTitle: "Link edit",
  selectedTabTitle: "Edit 9/2026",
  selectedTabId: 0,
  headerRow: 3,
  fieldMappings: STANDARD_19_STUDIO_MAPPINGS,
  valueMappings: [
    {
      semanticRole: "EDITOR_CURRENT_USER",
      sheetValue: "Vương",
    },
    {
      semanticRole: "PHOTO_PICK_STATUS_COMPLETED",
      sheetValue: "Đã lọc",
    },
  ],
  rowScope: {
    startRow: 4,
    ignoreEmptyRows: true,
  },
  driveConfig: DEFAULT_PRODUCTION_DRIVE_CONFIG,
  isMockSandbox: false,
  schemaFingerprint: "production-fingerprint-edit-9-2026",
  healthStatus: "HEALTHY",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const getSafeStorage = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  const memoryStore: Record<string, string> = {};
  return {
    getItem: (key: string) => memoryStore[key] ?? null,
    setItem: (key: string, val: string) => {
      memoryStore[key] = val;
    },
    removeItem: (key: string) => {
      delete memoryStore[key];
    },
    clear: () => {
      Object.keys(memoryStore).forEach((k) => delete memoryStore[k]);
    },
    key: (i: number) => Object.keys(memoryStore)[i] ?? null,
    length: 0,
  };
};

export const useContactSheetStore = create<ContactSheetState>()(
  persist(
    (set, get) => ({
      profiles: [DEFAULT_PRODUCTION_PROFILE],
      activeProfile: DEFAULT_PRODUCTION_PROFILE,

      lastSheetUrl: "https://docs.google.com/spreadsheets/d/1mQQ7FeFvy93kked5T_ob7wiiRa8XhX9lC54i6M_J0ak/edit",
      setLastSheetUrl: (lastSheetUrl) => set({ lastSheetUrl }),

      lastDriveConfig: DEFAULT_PRODUCTION_DRIVE_CONFIG,
      setLastDriveConfig: (lastDriveConfig) =>
        set((state) => ({
          lastDriveConfig,
          activeProfile: state.activeProfile
            ? { ...state.activeProfile, driveConfig: lastDriveConfig }
            : state.activeProfile,
        })),

      setActiveProfile: (id) =>
        set((state) => ({
          activeProfile: state.profiles.find((p) => p.id === id) || state.activeProfile,
        })),

      saveProfile: (profile) =>
        set((state) => {
          const sanitizedProfile: WorkspaceProfile = {
            ...profile,
            isMockSandbox: false, // Ensure mock sandbox is permanently disabled
          };
          const exists = state.profiles.some((p) => p.id === sanitizedProfile.id);
          const updatedProfiles = exists
            ? state.profiles.map((p) => (p.id === sanitizedProfile.id ? sanitizedProfile : p))
            : [...state.profiles, sanitizedProfile];
          return {
            profiles: updatedProfiles,
            activeProfile: sanitizedProfile,
            lastSheetUrl: sanitizedProfile.spreadsheetId
              ? `https://docs.google.com/spreadsheets/d/${sanitizedProfile.spreadsheetId}/edit`
              : state.lastSheetUrl,
            lastDriveConfig: sanitizedProfile.driveConfig || state.lastDriveConfig,
          };
        }),

      deleteProfile: (id) =>
        set((state) => {
          const filtered = state.profiles.filter((p) => p.id !== id);
          return {
            profiles: filtered,
            activeProfile: state.activeProfile?.id === id ? filtered[0] || null : state.activeProfile,
          };
        }),

      switchActiveTab: (tabTitle) =>
        set((state) => {
          const currentProfile = state.activeProfile || state.profiles[0];
          if (!currentProfile) return state;
          const tabConfig = currentProfile.tabConfigurations?.[tabTitle];
          if (!tabConfig) {
            // If no saved config, just switch title
            const updated = { ...currentProfile, selectedTabTitle: tabTitle };
            return {
              activeProfile: updated,
              profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)),
            };
          }

          const updated: WorkspaceProfile = {
            ...currentProfile,
            selectedTabTitle: tabConfig.tabTitle,
            selectedTabId: tabConfig.sheetId,
            headerRow: tabConfig.headerRow,
            fieldMappings: tabConfig.fieldMappings,
            rowScope: tabConfig.rowScope,
            schemaFingerprint: tabConfig.schemaFingerprint,
            updatedAt: new Date().toISOString(),
          };

          return {
            activeProfile: updated,
            profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)),
          };
        }),

      saveTabConfiguration: (tabConfig) =>
        set((state) => {
          const currentProfile = state.activeProfile || state.profiles[0];
          if (!currentProfile) return state;
          const existingConfigs = currentProfile.tabConfigurations || {};
          const updatedConfigs = {
            ...existingConfigs,
            [tabConfig.tabTitle]: tabConfig,
          };

          const isCurrentTab = currentProfile.selectedTabTitle === tabConfig.tabTitle;
          const updated: WorkspaceProfile = {
            ...currentProfile,
            tabConfigurations: updatedConfigs,
            ...(isCurrentTab
              ? {
                  selectedTabTitle: tabConfig.tabTitle,
                  selectedTabId: tabConfig.sheetId,
                  headerRow: tabConfig.headerRow,
                  fieldMappings: tabConfig.fieldMappings,
                  rowScope: tabConfig.rowScope,
                  schemaFingerprint: tabConfig.schemaFingerprint,
                }
              : {}),
            updatedAt: new Date().toISOString(),
          };

          return {
            activeProfile: updated,
            profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)),
          };
        }),

      resetToStandard19Profile: () =>
        set((state) => {
          const base = state.activeProfile || DEFAULT_PRODUCTION_PROFILE;
          const updated: WorkspaceProfile = {
            ...base,
            fieldMappings: STANDARD_19_STUDIO_MAPPINGS,
            updatedAt: new Date().toISOString(),
          };
          return {
            activeProfile: updated,
            profiles: state.profiles.map((p) => (p.id === updated.id ? updated : p)),
          };
        }),

      googleConnection: {
        status: "DISCONNECTED",
        grantedScopes: [],
        hasDriveAccess: false,
        hasSheetsAccess: false,
        sharingAutomationEnabled: false,
      },

      setGoogleConnection: (updates) =>
        set((state) => {
          const newConn = { ...state.googleConnection, ...updates };
          let updatedProfile = state.activeProfile;
          let updatedProfiles = state.profiles;
          if (newConn.status === "CONNECTED" && updatedProfile?.isMockSandbox) {
            updatedProfile = { ...updatedProfile, isMockSandbox: false };
            updatedProfiles = updatedProfiles.map((p) =>
              p.id === updatedProfile?.id ? updatedProfile : p
            );
          }
          return {
            googleConnection: newConn,
            activeProfile: updatedProfile,
            profiles: updatedProfiles,
          };
        }),

      disconnectGoogle: () =>
        set({
          googleConnection: {
            status: "DISCONNECTED",
            grantedScopes: [],
            hasDriveAccess: false,
            hasSheetsAccess: false,
            sharingAutomationEnabled: false,
          },
        }),

      discoveredJobs: [],
      setDiscoveredJobs: (discoveredJobs) => set({ discoveredJobs }),
      updateJob: (jobId, updates) =>
        set((state) => ({
          discoveredJobs: state.discoveredJobs.map((j) =>
            j.id === jobId ? { ...j, ...updates } : j
          ),
        })),
      clearJobs: () => set({ discoveredJobs: [], updatePlans: {} }),

      isScanning: false,
      setIsScanning: (isScanning) => set({ isScanning }),
      scanProgress: null,
      setScanProgress: (scanProgress) => set({ scanProgress }),

      updatePlans: {},
      setUpdatePlan: (jobId, plan) =>
        set((state) => ({
          updatePlans: { ...state.updatePlans, [jobId]: plan },
        })),
      clearPlans: () => set({ updatePlans: {} }),

      isExecutingBatch: false,
      setIsExecutingBatch: (isExecutingBatch) => set({ isExecutingBatch }),
      batchProgress: null,
      setBatchProgress: (batchProgress) => set({ batchProgress }),

      auditRecords: [],
      addAuditRecord: (record) =>
        set((state) => ({
          auditRecords: [record, ...state.auditRecords],
        })),
      clearAuditRecords: () => set({ auditRecords: [] }),
    }),
    {
      name: "mvd_contact_the_sheet_store",
      storage: createJSONStorage(getSafeStorage),
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfile: state.activeProfile,
        googleConnection: state.googleConnection,
        lastSheetUrl: state.lastSheetUrl,
        lastDriveConfig: state.lastDriveConfig,
      }),
    }
  )
);
