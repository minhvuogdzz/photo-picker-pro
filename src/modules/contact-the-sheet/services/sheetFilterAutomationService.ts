import { useAppStore } from "../../../core/stores/useAppStore.ts";
import { useContactSheetStore } from "../stores/useContactSheetStore.ts";
import { googleCredentialManager } from "./googleCredentialBridge.ts";
import { sheetDiscoveryService } from "./sheetDiscoveryService.ts";
import { sheetExtractorService } from "./sheetExtractorService.ts";
import { sheetUpdateService } from "./sheetUpdateService.ts";
import type { CopyResult } from "../../../core/types/index.ts";

export class SheetFilterAutomationService {
  /**
   * Automatically updates the PHOTO_PICK_STATUS column on Google Sheets
   * when file filtering (copy/move) operation successfully completes.
   */
  public async updateStatusOnFilterComplete(
    inputFolders: string[],
    copyResult?: CopyResult | null
  ): Promise<{ success: boolean; message: string }> {
    // If copyResult is provided and no files were copied or processed, skip update
    if (copyResult && copyResult.success_count === 0 && copyResult.skipped_count === 0) {
      console.log("[SheetFilterAutomation] No photos were copied or processed. Skipping sheet status update.");
      return { success: false, message: "Không có file nào được chép thành công." };
    }

    const { sheetFilterContext, setSheetUpdateStatus } = useAppStore.getState();
    const { activeProfile, profiles } = useContactSheetStore.getState();

    const targetProfile =
      activeProfile ||
      (sheetFilterContext?.profileId
        ? profiles.find((p) => p.id === sheetFilterContext.profileId)
        : null) ||
      profiles[0];

    if (!targetProfile) {
      console.log("[SheetFilterAutomation] No Google Sheet profile found.");
      return { success: false, message: "Chưa cấu hình hồ sơ Google Sheet." };
    }

    const isMock = Boolean(targetProfile.isMockSandbox || targetProfile.spreadsheetId?.startsWith("mock"));

    // Check if Google is connected (or in mock sandbox)
    const isConnected = googleCredentialManager.isConnected();
    if (!isConnected && !isMock) {
      console.log("[SheetFilterAutomation] Google account not connected, skipping status update.");
      const msg = "Tài khoản Google chưa được kết nối để cập nhật trang tính.";
      setSheetUpdateStatus({
        state: "error",
        message: msg,
      });
      return { success: false, message: msg };
    }

    setSheetUpdateStatus({
      state: "updating",
      message: "Đang liên hệ Google Sheets để cập nhật trạng thái...",
    });

    try {
      let targetRow = sheetFilterContext?.matchedRow;
      let targetTab = sheetFilterContext?.tabTitle || targetProfile.selectedTabTitle || "Edit 9/2026";

      // Fallback matching: If no matchedRow was recorded from modal, try to match by input folder name
      if (!targetRow && inputFolders && inputFolders.length > 0) {
        const folderPath = inputFolders[0];
        const rawName = folderPath.split(/[/\\]+/).filter(Boolean).pop() || folderPath;

        if (rawName) {
          try {
            const startRow =
              targetProfile.tabConfigurations?.[targetTab]?.rowScope?.startRow ||
              targetProfile.rowScope?.startRow ||
              4;
            const rows = await sheetDiscoveryService.fetchSheetRowsForMatching(
              targetProfile.spreadsheetId,
              targetTab,
              startRow,
              1000,
              isMock
            );
            const match = sheetExtractorService.extractCodesForFolder(
              rawName,
              folderPath,
              rows,
              isMock ? { ...targetProfile, isMockSandbox: true } : targetProfile
            );
            if (match.matchedRow) {
              targetRow = match.matchedRow;
              console.log(
                `[SheetFilterAutomation] Dynamically matched folder "${rawName}" to Row ${targetRow} on tab "${targetTab}"`
              );
            }
          } catch (matchErr) {
            console.warn("[SheetFilterAutomation] Error during dynamic row matching:", matchErr);
          }
        }
      }

      if (!targetRow) {
        const msg = "Không tìm thấy dòng tương ứng của thư mục này trên Google Sheet để đổi trạng thái.";
        console.warn("[SheetFilterAutomation]", msg);
        setSheetUpdateStatus({
          state: "idle",
          message: msg,
        });
        return { success: false, message: msg };
      }

      // Identify status column from context, tab config or profile
      const tabConfig = targetProfile.tabConfigurations?.[targetTab];
      const mappings = tabConfig?.fieldMappings || targetProfile.fieldMappings || [];
      const statusMapping = mappings.find((m) => m.semanticField === "PHOTO_PICK_STATUS");

      let targetCol = "";
      if (sheetFilterContext?.statusColumnLetter && sheetFilterContext.statusColumnLetter !== "NONE") {
        targetCol = sheetFilterContext.statusColumnLetter;
      } else if (
        statusMapping?.columnLetter &&
        statusMapping.columnLetter !== "NONE" &&
        statusMapping.permission !== "IGNORE"
      ) {
        targetCol = statusMapping.columnLetter;
      } else {
        targetCol = "G"; // sensible default (Cột G Trạng Thái 1)
      }

      const targetVal =
        sheetFilterContext?.statusValue ||
        targetProfile.valueMappings?.find((v) => v.semanticRole === "PHOTO_PICK_STATUS_COMPLETED")?.sheetValue ||
        "Đã lọc";

      console.log(
        `[SheetFilterAutomation] Updating status: Tab "${targetTab}", Row ${targetRow}, Col ${targetCol} -> "${targetVal}"`
      );

      const effectiveProfile = isMock ? { ...targetProfile, isMockSandbox: true } : targetProfile;

      const updateRes = await sheetUpdateService.updateSingleCell(
        effectiveProfile,
        targetRow,
        targetCol,
        targetVal,
        "ALWAYS_REPLACE",
        targetTab
      );

      if (updateRes.success) {
        const successMsg = `Đã tự động đổi trạng thái thành "${targetVal}" trên Google Sheet (Tab ${targetTab}, Cột ${targetCol}, Dòng ${targetRow})`;
        setSheetUpdateStatus({
          state: "success",
          message: successMsg,
          updatedAt: new Date().toLocaleTimeString(),
        });
        console.log("[SheetFilterAutomation] SUCCESS:", successMsg);
        return { success: true, message: successMsg };
      } else {
        const failMsg = `Cập nhật trạng thái Sheet thất bại: ${updateRes.error || "Lỗi không xác định"}`;
        setSheetUpdateStatus({
          state: "error",
          message: failMsg,
        });
        console.warn("[SheetFilterAutomation] FAILED:", failMsg);
        return { success: false, message: failMsg };
      }
    } catch (err: any) {
      const errDetail = err?.message || String(err);
      const errMsg = `Lỗi kết nối Google Sheet: ${errDetail}`;
      console.error("[SheetFilterAutomation] EXCEPTION:", err);
      setSheetUpdateStatus({
        state: "error",
        message: errMsg,
      });
      return { success: false, message: errMsg };
    }
  }
}

export const sheetFilterAutomationService = new SheetFilterAutomationService();
