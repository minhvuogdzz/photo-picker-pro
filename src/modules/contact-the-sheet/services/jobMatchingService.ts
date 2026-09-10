import type {
  DiscoveredJob,
  WorkspaceProfile,
  FieldMapping,
} from "../types/index.ts";
import { folderParserService } from "./folderParserService.ts";

export interface SheetRowRecord {
  row: number; // 1-indexed
  values: Record<string, string>; // column letter -> cell formatted value
}

export interface MatchScoreResult {
  row: number;
  score: number;
  matchedFields: string[];
  values: Record<string, string>;
}

export const GENERIC_STOP_WORDS = new Set([
  "anh", "anh1", "anh2", "chup", "edit", "fix", "studio", "gap", "note", "notes",
  "2cc", "1cc", "couple", "single", "baby", "cuoi", "bau", "ngay", "gio", "file", "folder"
]);

export class JobMatchingService {
  /**
   * Matches a job against indexed sheet rows using multi-signal scoring.
   */
  public matchJobToSheetRows(
    job: DiscoveredJob,
    rows: SheetRowRecord[],
    profile: WorkspaceProfile
  ): {
    status: "READY" | "NEEDS_REVIEW" | "NO_MATCH";
    targetRow?: number;
    targetSnapshot?: Record<string, string>;
    confidence?: number;
    candidateRows?: MatchScoreResult[];
    reason?: string;
  } {
    const scoredCandidates: MatchScoreResult[] = [];

    // Find mapped columns
    const fileCol = profile.fieldMappings.find((m) => m.semanticField === "JOB_FOLDER_NAME")?.columnLetter;
    const dateCol = profile.fieldMappings.find((m) => m.semanticField === "SHOOT_DATE")?.columnLetter;
    const timeCol = profile.fieldMappings.find((m) => m.semanticField === "SHOOT_TIME")?.columnLetter;
    const customerCol = profile.fieldMappings.find((m) => m.semanticField === "CUSTOMER_NAME")?.columnLetter;
    const socialCol = profile.fieldMappings.find((m) => m.semanticField === "SOCIAL_USERNAME")?.columnLetter;

    const normFolderName = folderParserService.normalizeForComparison(job.jobFolderName);
    const normFinalName = folderParserService.normalizeForComparison(job.finalFolderName);

    // Collect all customer name candidates from metadata and deepest folder name
    const candidateNamesSet = new Set<string>();
    if (job.metadata.customerName) candidateNamesSet.add(job.metadata.customerName);
    if (job.metadata.candidateNames) {
      job.metadata.candidateNames.forEach((c) => candidateNamesSet.add(c));
    }

    // Also extract candidates from final folder name directly (deepest folder)
    const finalMeta = folderParserService.parseFolderName(job.finalFolderName);
    if (finalMeta.customerName) candidateNamesSet.add(finalMeta.customerName);
    if (finalMeta.candidateNames) {
      finalMeta.candidateNames.forEach((c) => candidateNamesSet.add(c));
    }

    const allCustomerCandidates = Array.from(candidateNamesSet)
      .map((n) => n.trim())
      .filter((n) => n.length >= 2 && !GENERIC_STOP_WORDS.has(folderParserService.normalizeForComparison(n)));

    for (const record of rows) {
      // Row scope check
      if (profile.rowScope.startRow && record.row < profile.rowScope.startRow) {
        continue;
      }
      if (profile.rowScope.endRow && record.row > profile.rowScope.endRow) {
        continue;
      }

      let score = 0;
      const matchedFields: string[] = [];

      // 1. Signal A: Tên file (Job folder name) - HIGHEST PRIORITY
      if (fileCol && record.values[fileCol]) {
        const fileVal = record.values[fileCol].trim();
        if (!this.isErrorValue(fileVal)) {
          const normFile = folderParserService.normalizeForComparison(fileVal);
          if (normFile && (normFile === normFolderName || normFile === normFinalName)) {
            score += 3.0; // Absolute exact match
            matchedFields.push("Khớp chính xác Tên file");
          } else if (normFile && normFile.length >= 6 && (normFolderName.includes(normFile) || normFile.includes(normFolderName))) {
            score += 1.5;
            matchedFields.push("Tên file (chứa)");
          }
        }
      }

      // 2. Signal B: Social username / customer identifier
      if (job.metadata.socialUsername) {
        const normSocial = folderParserService.normalizeForComparison(job.metadata.socialUsername);
        if (normSocial.length >= 3 && !GENERIC_STOP_WORDS.has(normSocial)) {
          if (socialCol && record.values[socialCol]) {
            const sVal = folderParserService.normalizeForComparison(record.values[socialCol]);
            if (!this.isErrorValue(sVal) && sVal === normSocial) {
              score += 1.2;
              matchedFields.push("Social ID");
            }
          }
          if (customerCol && record.values[customerCol]) {
            const cVal = folderParserService.normalizeForComparison(record.values[customerCol]);
            if (!this.isErrorValue(cVal) && normSocial.length >= 5 && (cVal.includes(normSocial) || normSocial.includes(cVal))) {
              score += 0.9;
              matchedFields.push("Tên khách (khớp mã)");
            }
          }
        }
      }

      // 3. Signal C: Targeted Customer Name on mapped column
      let customerMatched = false;
      if (customerCol && record.values[customerCol]) {
        const cVal = record.values[customerCol].trim();
        if (!this.isErrorValue(cVal)) {
          const normC = folderParserService.normalizeForComparison(cVal);
          for (const cand of allCustomerCandidates) {
            const normCand = folderParserService.normalizeForComparison(cand);
            if (!normCand || GENERIC_STOP_WORDS.has(normCand) || normCand.length < 2) continue;

            if (normC === normCand) {
              score += 1.8;
              customerMatched = true;
              matchedFields.push("Khớp Tên khách");
              break;
            } else if (normCand.length >= 4 && normC.includes(normCand)) {
              score += 1.2;
              customerMatched = true;
              matchedFields.push("Tên khách (chứa)");
              break;
            } else if (normC.length >= 4 && normCand.includes(normC) && normC.length >= normCand.length - 3) {
              score += 1.0;
              customerMatched = true;
              matchedFields.push("Tên khách (gần đúng)");
              break;
            }
          }
        }
      }

      // 4. Signal D: FULL ROW SEARCH across all columns in this row if customer name not matched yet
      if (!customerMatched && allCustomerCandidates.length > 0) {
        for (const [colLetter, cellRaw] of Object.entries(record.values)) {
          if (!cellRaw || this.isErrorValue(cellRaw)) continue;
          const normCell = folderParserService.normalizeForComparison(cellRaw);
          if (normCell.length < 3 || GENERIC_STOP_WORDS.has(normCell)) continue;

          for (const cand of allCustomerCandidates) {
            const normCand = folderParserService.normalizeForComparison(cand);
            if (!normCand || GENERIC_STOP_WORDS.has(normCand) || normCand.length < 3) continue;

            if (normCell === normCand) {
              score = Math.max(score, 1.4);
              matchedFields.push(`Ô ${colLetter}: "${cellRaw}"`);
              customerMatched = true;
              break;
            } else if (normCand.length >= 5 && normCell.includes(normCand)) {
              score = Math.max(score, 1.0);
              matchedFields.push(`Ô ${colLetter}: "${cellRaw}"`);
              customerMatched = true;
              break;
            }
          }
          if (customerMatched) break;
        }
      }

      // 5. Signal E: Date + Time confirmation bonus
      if (job.metadata.shootDate) {
        const normJobD = folderParserService.normalizeForComparison(job.metadata.shootDate);
        let dateFound = false;

        if (dateCol && record.values[dateCol]) {
          const dVal = record.values[dateCol].trim();
          if (!this.isErrorValue(dVal)) {
            const normD = folderParserService.normalizeForComparison(dVal);
            if (normD === normJobD || dVal.includes(job.metadata.shootDate)) {
              dateFound = true;
            }
          }
        }

        if (dateFound) {
          score += 0.2;
          matchedFields.push("Ngày");
        }
      }

      if (job.metadata.shootTime) {
        const normJobT = folderParserService.normalizeForComparison(job.metadata.shootTime);
        let timeFound = false;

        if (timeCol && record.values[timeCol]) {
          const tVal = record.values[timeCol].trim();
          if (!this.isErrorValue(tVal)) {
            const normT = folderParserService.normalizeForComparison(tVal);
            if (normT === normJobT || tVal.startsWith(job.metadata.shootTime.slice(0, 2))) {
              timeFound = true;
            }
          }
        }

        if (timeFound) {
          score += 0.1;
          matchedFields.push("Giờ");
        }
      }

      // Only qualify candidates with high confidence
      if (score >= 0.85) {
        scoredCandidates.push({
          row: record.row,
          score,
          matchedFields,
          values: record.values,
        });
      }
    }

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 0 Matches
    if (scoredCandidates.length === 0) {
      return {
        status: "NO_MATCH",
        reason: `Không tìm thấy khách hàng "${job.metadata.customerName || job.finalFolderName}" trong tab trang tính`,
      };
    }

    // High-confidence unique match
    const top = scoredCandidates[0];
    const second = scoredCandidates[1];

    if (top.score >= 2.5) {
      return {
        status: "READY",
        targetRow: top.row,
        targetSnapshot: top.values,
        confidence: 1.0,
        reason: `Khớp chính xác tuyệt đối (${top.matchedFields.join(", ")})`,
      };
    }

    if (!second || (top.score >= 1.0 && top.score - second.score >= 0.2) || (top.score >= 1.5 && second.score < 1.4)) {
      return {
        status: "READY",
        targetRow: top.row,
        targetSnapshot: top.values,
        confidence: top.score,
        reason: `Đã dóng đúng hàng ${top.row} theo (${top.matchedFields.join(", ")})`,
      };
    }

    // Ambiguity: multiple plausible candidate rows (cap to top 5)
    const topCandidates = scoredCandidates.slice(0, 5);
    return {
      status: "NEEDS_REVIEW",
      confidence: top.score,
      candidateRows: topCandidates,
      reason: `Tìm thấy ${scoredCandidates.length} hàng tiềm năng có tên tương tự (Hàng ${topCandidates.map((c) => c.row).join(", ")}), vui lòng bấm để xác nhận hàng`,
    };
  }

  public isErrorValue(val: string): boolean {
    const upper = val.toUpperCase().trim();
    return (
      upper === "#REF!" ||
      upper === "#N/A" ||
      upper === "#VALUE!" ||
      upper === "#ERROR!" ||
      upper === "#DIV/0!" ||
      upper === "#NAME?"
    );
  }
}

export const jobMatchingService = new JobMatchingService();
