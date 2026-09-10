import type {
  WorkspaceProfile,
  DiscoveredJob,
  ParsedJobMetadata,
} from "../types/index.ts";
import { folderParserService } from "./folderParserService.ts";
import { jobMatchingService, type SheetRowRecord, type MatchScoreResult } from "./jobMatchingService.ts";

export interface ExtractedCodeColumn {
  columnLetter: string;
  columnHeader: string;
  value: string;
  codeCount: number;
  sampleCodes: string[];
  isPrimary: boolean;
}

export interface SheetExtractionResult {
  matchedRow?: number;
  customerName?: string;
  jobFolderName: string;
  confidence?: number;
  status: "READY" | "NEEDS_REVIEW" | "NO_MATCH";
  reason?: string;
  targetSnapshot?: Record<string, string>;
  candidateColumns: ExtractedCodeColumn[];
  candidateRows?: MatchScoreResult[];
}

export class SheetExtractorService {
  private codeHeaderKeywords = [
    "mã chọn", "ma chon", "mã ảnh chọn", "ma anh chon", "mã ảnh", "ma anh",
    "ảnh chọn", "anh chon", "chọn ảnh", "chon anh", "file chọn", "file chon",
    "mã lọc", "ma loc", "ảnh lọc", "anh loc", "chọn 1", "chọn 2", "chọn (1)", "chọn (2)",
    "ảnh cọc", "anh coc", "ảnh cổng", "anh cong", "ảnh tiệc", "anh tiec", "ảnh phóng", "anh phong",
    "album", "cuốn", "mã", "code", "selected", "pick", "selection"
  ];

  /**
   * Matches a folder path/name against Sheet rows and extracts candidate customer code columns.
   */
  public extractCodesForFolder(
    folderName: string,
    folderPath: string = "",
    rows: SheetRowRecord[],
    profile: WorkspaceProfile
  ): SheetExtractionResult {
    const rawName = folderName.split(/[/\\]+/).filter(Boolean).pop() || folderName;
    const metadata = folderParserService.parseFolderName(rawName);

    const job: DiscoveredJob = {
      id: `extract_${Date.now()}`,
      sourceType: "LOCAL_DRIVE_DESKTOP",
      jobFolderName: rawName,
      finalFolderName: rawName,
      finalFolderPath: folderPath || rawName,
      metadata,
      imageCount: 0,
      status: "PENDING",
    };

    const match = jobMatchingService.matchJobToSheetRows(job, rows, profile);

    if (match.status === "NO_MATCH" || !match.targetRow || !match.targetSnapshot) {
      return {
        jobFolderName: rawName,
        customerName: metadata.customerName,
        status: "NO_MATCH",
        reason: match.reason || `Không tìm thấy dòng tương ứng với "${rawName}" trên bảng tính.`,
        candidateColumns: [],
        candidateRows: match.candidateRows,
      };
    }

    const candidateColumns = this.detectCodeColumns(profile, match.targetSnapshot);

    return {
      matchedRow: match.targetRow,
      customerName: metadata.customerName,
      jobFolderName: rawName,
      confidence: match.confidence,
      status: match.status,
      reason: match.reason,
      targetSnapshot: match.targetSnapshot,
      candidateColumns,
      candidateRows: match.candidateRows,
    };
  }

  /**
   * Inspects a target row snapshot and field mappings to identify columns holding customer selection codes.
   */
  public detectCodeColumns(
    profile: WorkspaceProfile,
    targetSnapshot: Record<string, string>
  ): ExtractedCodeColumn[] {
    const results: ExtractedCodeColumn[] = [];
    const seenCols = new Set<string>();

    const nonCodeSemanticFields = new Set([
      "JOB_FOLDER_NAME",
      "CUSTOMER_NAME",
      "CUSTOMER_ID",
      "SOCIAL_USERNAME",
      "SHOOT_DATE",
      "SHOOT_TIME",
      "EDITOR",
      "DELIVERY_LINK",
      "FIX_LINK",
    ]);

    for (const mapping of profile.fieldMappings) {
      const headerLower = (mapping.columnHeader || "").normalize("NFC").trim().toLowerCase();
      const isKeywordMatch = this.codeHeaderKeywords.some((kw) => headerLower.includes(kw));
      // Only exclude if it has a non-code semantic field AND the header doesn't explicitly look like code column
      if (nonCodeSemanticFields.has(mapping.semanticField) && !isKeywordMatch) {
        seenCols.add(mapping.columnLetter);
      }
    }

    // 1. Check explicitly mapped semantic fields in profile (Mã chọn 1 & Mã chọn 2)
    const primaryMapping = profile.fieldMappings.find(
      (m) => m.semanticField === "SELECTED_IMAGE_CODES_PRIMARY" && m.permission !== "IGNORE"
    );
    const secondaryMapping = profile.fieldMappings.find(
      (m) => m.semanticField === "SELECTED_IMAGE_CODES_SECONDARY" && m.permission !== "IGNORE"
    );

    if (primaryMapping) {
      seenCols.add(primaryMapping.columnLetter);
      const val = (targetSnapshot[primaryMapping.columnLetter] || "").trim();
      const parsed = val ? this.parseTokenList(val) : [];
      results.push({
        columnLetter: primaryMapping.columnLetter,
        columnHeader: primaryMapping.columnHeader || `Cột ${primaryMapping.columnLetter}`,
        value: val,
        codeCount: parsed.length,
        sampleCodes: parsed.slice(0, 5),
        isPrimary: true,
      });
    }

    if (secondaryMapping && secondaryMapping.columnLetter !== primaryMapping?.columnLetter) {
      seenCols.add(secondaryMapping.columnLetter);
      const val = (targetSnapshot[secondaryMapping.columnLetter] || "").trim();
      const parsed = val ? this.parseTokenList(val) : [];
      results.push({
        columnLetter: secondaryMapping.columnLetter,
        columnHeader: secondaryMapping.columnHeader || `Cột ${secondaryMapping.columnLetter}`,
        value: val,
        codeCount: parsed.length,
        sampleCodes: parsed.slice(0, 5),
        isPrimary: false,
      });
    }

    // If configured code columns were found in profile, return them directly without guessing other unrelated columns!
    if (results.length > 0) {
      return results;
    }

    // 2. Fallback ONLY if no code columns were configured in profile:
    for (const mapping of profile.fieldMappings) {
      if (seenCols.has(mapping.columnLetter)) continue;

      const headerLower = (mapping.columnHeader || "").normalize("NFC").trim().toLowerCase();
      const isKeywordMatch = this.codeHeaderKeywords.some((kw) => headerLower.includes(kw));

      if (isKeywordMatch) {
        const val = (targetSnapshot[mapping.columnLetter] || "").trim();
        // Ignore formula errors, timestamps or single URLs
        if (val && !val.startsWith("#") && !val.startsWith("http://") && !val.startsWith("https://")) {
          seenCols.add(mapping.columnLetter);
          const parsed = this.parseTokenList(val);
          results.push({
            columnLetter: mapping.columnLetter,
            columnHeader: mapping.columnHeader || `Cột ${mapping.columnLetter}`,
            value: val,
            codeCount: parsed.length,
            sampleCodes: parsed.slice(0, 5),
            isPrimary: results.length === 0,
          });
        }
      }
    }

    return results;
  }

  public isPhotoCodeToken(token: string): boolean {
    return /\d/.test(token) || /\.(jpe?g|png|raw|cr[23]|nef|arw|dng|tif|webp)$/i.test(token);
  }

  /**
   * Splits a raw cell string into individual code tokens.
   */
  public parseTokenList(text: string): string[] {
    if (!text || !text.trim()) return [];

    // Split by commas, semicolons, pluses, newlines, spaces, tabs
    const rawTokens = text.split(/[\r\n,;+ \t/|]+/);
    const tokens: string[] = [];

    for (const token of rawTokens) {
      let t = token.trim();
      // Strip outer punctuation except periods in extensions
      t = t.replace(/^[^a-zA-Z0-9_]+/, "");
      t = t.replace(/[^a-zA-Z0-9_]+$/, "");
      if (t.length > 0 && !/^(anh|hinh|file|va|và|hoac|hoặc)$/i.test(t)) {
        tokens.push(t);
      }
    }

    return tokens;
  }

  /**
   * Combines and formats codes from selected columns into one code per line.
   */
  public formatExtractedCodes(columns: Array<{ value: string }>): string {
    const allCodes: string[] = [];
    const seen = new Set<string>();

    for (const col of columns) {
      const tokens = this.parseTokenList(col.value);
      for (const t of tokens) {
        if (!seen.has(t)) {
          seen.add(t);
          allCodes.push(t);
        }
      }
    }

    return allCodes.join("\n");
  }
}

export const sheetExtractorService = new SheetExtractorService();
