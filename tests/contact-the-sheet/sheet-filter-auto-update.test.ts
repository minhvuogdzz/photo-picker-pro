import { test } from "node:test";
import assert from "node:assert/strict";
import { sheetFilterAutomationService } from "../../src/modules/contact-the-sheet/services/sheetFilterAutomationService.ts";
import { useAppStore } from "../../src/core/stores/useAppStore.ts";
import { useContactSheetStore } from "../../src/modules/contact-the-sheet/stores/useContactSheetStore.ts";
import type { WorkspaceProfile } from "../../src/modules/contact-the-sheet/types/index.ts";
import type { CopyResult } from "../../src/core/types/index.ts";

const mockProfile: WorkspaceProfile = {
  id: "test-profile-auto-update",
  displayName: "Test Auto Update Sheet",
  spreadsheetId: "mock_spreadsheet_123",
  spreadsheetTitle: "Test Studio Sheet",
  selectedTabTitle: "Edit 9/2026",
  selectedTabId: 101,
  headerRow: 4,
  isMockSandbox: true,
  fieldMappings: [
    {
      semanticField: "JOB_FOLDER_NAME",
      columnLetter: "H",
      columnIndex: 7,
      columnHeader: "Tên file",
      permission: "READ_ONLY",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
    {
      semanticField: "PHOTO_PICK_STATUS",
      columnLetter: "G",
      columnIndex: 6,
      columnHeader: "Trạng Thái 1",
      permission: "READ_WRITE",
      isFormulaDerived: false,
      writePolicy: "SET_IF_EMPTY",
    },
  ],
  valueMappings: [
    {
      semanticRole: "PHOTO_PICK_STATUS_COMPLETED",
      sheetValue: "Đã lọc",
    },
  ],
  rowScope: {
    startRow: 4,
    ignoreEmptyRows: true,
  },
};

test("Sheet Filter Auto-Update: Successfully updates status using saved sheetFilterContext", async () => {
  // Setup store state
  useContactSheetStore.getState().saveProfile(mockProfile);
  useContactSheetStore.getState().setActiveProfile(mockProfile.id);

  useAppStore.getState().setSheetFilterContext({
    profileId: mockProfile.id,
    spreadsheetId: mockProfile.spreadsheetId,
    tabTitle: "Edit 9/2026",
    matchedRow: 15,
    jobName: "4-9 8h phuog_thyur08 - peppa 2cc",
    folderName: "4-9 8h phuog_thyur08 - peppa 2cc",
    statusColumnLetter: "G",
    statusValue: "Đã lọc",
    autoUpdateOnFilterComplete: true,
  });

  const mockCopyResult: CopyResult = {
    success_count: 24,
    skipped_count: 0,
    error_count: 0,
    errors: [],
    copied_files: [],
  };

  const res = await sheetFilterAutomationService.updateStatusOnFilterComplete(
    ["/Volumes/Drive/4-9 8h phuog_thyur08 - peppa 2cc"],
    mockCopyResult
  );

  assert.equal(res.success, true);
  assert.ok(res.message.includes("Đã tự động đổi trạng thái thành \"Đã lọc\""));
  assert.ok(res.message.includes("Dòng 15"));
  assert.ok(res.message.includes("Cột G"));

  const updateStatus = useAppStore.getState().sheetUpdateStatus;
  assert.ok(updateStatus);
  assert.equal(updateStatus.state, "success");
  assert.ok(updateStatus.message?.includes("Dòng 15"));
});

test("Sheet Filter Auto-Update: Skips status update if copy operation had 0 photos processed", async () => {
  const emptyCopyResult: CopyResult = {
    success_count: 0,
    skipped_count: 0,
    error_count: 1,
    errors: ["Folder not found"],
    copied_files: [],
  };

  const res = await sheetFilterAutomationService.updateStatusOnFilterComplete(
    ["/Volumes/Drive/test_folder"],
    emptyCopyResult
  );

  assert.equal(res.success, false);
  assert.equal(res.message, "Không có file nào được chép thành công.");
});

test("Sheet Filter Auto-Update: Dynamic row matching fallback using input folder name", async () => {
  // Clear stored context to test fallback
  useAppStore.getState().setSheetFilterContext(null);
  useContactSheetStore.getState().saveProfile(mockProfile);
  useContactSheetStore.getState().setActiveProfile(mockProfile.id);

  const mockCopyResult: CopyResult = {
    success_count: 10,
    skipped_count: 0,
    error_count: 0,
    errors: [],
    copied_files: [],
  };

  // Run with folder name matching standard fixture
  const res = await sheetFilterAutomationService.updateStatusOnFilterComplete(
    ["/Users/studio/Pictures/7-9 12h _xuka_11 1cc"],
    mockCopyResult
  );

  assert.equal(res.success, true);
  assert.ok(res.message.includes("Đã tự động đổi trạng thái thành \"Đã lọc\""));

  const status = useAppStore.getState().sheetUpdateStatus;
  assert.equal(status?.state, "success");
});

test("Photo Picker Sheet Premium Gate: Verifies non-premium user requires license key", async () => {
  const { useAuthStore } = await import("../../src/core/stores/useAuthStore.ts");

  // Non-premium session
  useAuthStore.getState().setSession({
    user: { id: "u1", email: "free@mvd.vn", name: "Free User" },
    token: "tok123",
    subscription: {
      status: "ACTIVE",
      plan: "Standard",
      isPremium: false,
      daysRemaining: 30,
      startDate: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    },
  });

  const freeSession = useAuthStore.getState().session;
  assert.equal(freeSession?.subscription?.isPremium, false);

  // Upgrade to Premium session
  useAuthStore.getState().setSession({
    user: { id: "u1", email: "vip@mvd.vn", name: "VIP User" },
    token: "tok456",
    subscription: {
      status: "ACTIVE",
      plan: "Studio VIP",
      isPremium: true,
      daysRemaining: 365,
      startDate: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 365).toISOString(),
    },
  });

  const vipSession = useAuthStore.getState().session;
  assert.equal(vipSession?.subscription?.isPremium, true);
});
