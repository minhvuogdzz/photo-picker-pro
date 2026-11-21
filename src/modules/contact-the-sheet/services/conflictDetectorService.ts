import { trText } from "../../../core/lib/i18n.ts";

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictType?: "EXISTING_URL" | "MULTIPLE_URLS" | "URL_AND_NOTES" | "PLAIN_NOTES" | "FORMULA";
  existingValue: string;
  suggestedAction: "OVERWRITE" | "APPEND" | "SKIP" | "ASK";
  description?: string;
}

export class ConflictDetectorService {
  /**
   * Inspects existing Link Edit cell content to detect overwrite conflicts.
   */
  public inspectLinkConflict(currentCellValue: string): ConflictCheckResult {
    const trimmed = (currentCellValue || "").trim();

    // 1. Empty cell is completely safe
    if (!trimmed) {
      return {
        hasConflict: false,
        existingValue: "",
        suggestedAction: "OVERWRITE",
      };
    }

    // 2. Cell contains formula
    if (trimmed.startsWith("=")) {
      return {
        hasConflict: true,
        conflictType: "FORMULA",
        existingValue: trimmed,
        suggestedAction: "SKIP",
        description: trText(
          "Ô chứa công thức Google Sheets, bị chặn ghi đè để bảo vệ tính toàn vẹn dữ liệu.",
          "Cell contains a Google Sheets formula and is write-protected to preserve integrity."
        ),
      };
    }

    // 3. Count URLs in the cell
    const urlMatches = trimmed.match(/https?:\/\/[^\s]+/g) || [];
    const nonUrlText = trimmed.replace(/https?:\/\/[^\s]+/g, "").trim();

    if (urlMatches.length > 1) {
      return {
        hasConflict: true,
        conflictType: "MULTIPLE_URLS",
        existingValue: trimmed,
        suggestedAction: "ASK",
        description: trText(
          `Ô đang chứa ${urlMatches.length} đường dẫn Drive khác nhau. Cần chọn ghi đè hoặc thêm nối tiếp.`,
          `Cell contains ${urlMatches.length} different Drive links. Choose overwrite or append.`
        ),
      };
    }

    if (urlMatches.length === 1 && nonUrlText.length > 0) {
      return {
        hasConflict: true,
        conflictType: "URL_AND_NOTES",
        existingValue: trimmed,
        suggestedAction: "ASK",
        description: trText(
          `Ô chứa link cũ kèm ghi chú: "${nonUrlText.slice(0, 40)}...". Cần chọn giữ ghi chú hay ghi đè.`,
          `Cell contains an existing link plus notes: "${nonUrlText.slice(0, 40)}...". Choose keep/append or overwrite.`
        ),
      };
    }

    if (urlMatches.length === 0 && nonUrlText.length > 0) {
      return {
        hasConflict: true,
        conflictType: "PLAIN_NOTES",
        existingValue: trimmed,
        suggestedAction: "ASK",
        description: trText(
          `Ô đang chứa ghi chú: "${nonUrlText.slice(0, 40)}...". Cần chọn thêm link hay ghi đè.`,
          `Cell contains text notes: "${nonUrlText.slice(0, 40)}...". Choose append link or overwrite.`
        ),
      };
    }

    return {
      hasConflict: true,
      conflictType: "EXISTING_URL",
      existingValue: trimmed,
      suggestedAction: "ASK",
      description: trText(
        "Ô đã có sẵn 1 link Drive cũ. Cần xác nhận trước khi thay thế.",
        "Cell already has an existing Drive link. Confirmation needed before replacing."
      ),
    };
  }

  /**
   * Formats the new cell value based on chosen conflict policy.
   */
  public resolveCellValue(
    existingValue: string,
    newUrl: string,
    policy: "OVERWRITE" | "APPEND" | "SKIP"
  ): string {
    if (policy === "OVERWRITE") {
      return newUrl;
    }
    if (policy === "APPEND") {
      if (!existingValue.trim()) return newUrl;
      return `${existingValue.trim()}\n\n${newUrl}`;
    }
    return existingValue;
  }
}

export const conflictDetectorService = new ConflictDetectorService();
