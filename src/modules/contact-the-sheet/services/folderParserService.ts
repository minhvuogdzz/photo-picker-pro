import type { ParsedJobMetadata } from "../types";

export class FolderParserService {
  /**
   * Parses studio job folder names into structured metadata signals.
   * Example: "7-9 12h _xuka_11 1cc" -> date: "07/09", time: "12:00", social: "xuka_11", package: "1cc"
   */
  public parseFolderName(folderName: string): ParsedJobMetadata {
    // Unicode normalization NFC & trim
    const normalized = folderName.normalize("NFC").trim();

    // Strip emojis for cleaner parsing
    const emojiRegex = /[\p{Extended_Pictographic}\uFE0F]/gu;
    const cleanNoEmoji = normalized.replace(emojiRegex, " ").replace(/\s+/g, " ").trim();

    let shootDate: string | undefined;
    let shootTime: string | undefined;
    let packageCode: string | undefined;
    let socialUsername: string | undefined;
    let customerName: string | undefined;
    const candidateNames: string[] = [];
    const unparsedTokens: string[] = [];

    // 1. Extract Date: "7-9", "07-09", "7/9", "07/09", "4-9", "2026-09-04"
    const dateRegex = /(?:^|[\s_])(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?(?:[\s_]|$)/;
    const dateMatch = cleanNoEmoji.match(dateRegex);
    if (dateMatch) {
      const d = dateMatch[1].padStart(2, "0");
      const m = dateMatch[2].padStart(2, "0");
      shootDate = `${d}/${m}`;
    }

    // 2. Extract Time: "8h", "13h", "14h30", "12:00", "9h"
    const timeRegex = /(?:^|[\s_])(\d{1,2})(?:h|:)(\d{2})?h?(?:[\s_]|$)/i;
    const timeMatch = cleanNoEmoji.match(timeRegex);
    if (timeMatch) {
      const h = timeMatch[1].padStart(2, "0");
      const min = (timeMatch[2] || "00").padStart(2, "0");
      shootTime = `${h}:${min}`;
    }

    // 3. Extract Package Code: e.g. "2cc", "1cc", "vip1", "std", "combo"
    const pkgRegex = /\b(\d+cc|vip\d*|combo\d*|std\d*)\b/i;
    const pkgMatch = cleanNoEmoji.match(pkgRegex);
    if (pkgMatch) {
      packageCode = pkgMatch[1].toLowerCase();
    }

    // 4. Isolate the Core Identity Part by removing date, time, and package
    let identityPart = cleanNoEmoji;
    if (dateMatch) {
      identityPart = identityPart.replace(dateMatch[0], " ");
    }
    if (timeMatch) {
      identityPart = identityPart.replace(timeMatch[0], " ");
    }
    if (pkgMatch) {
      identityPart = identityPart.replace(new RegExp(`\\b${pkgMatch[1]}\\b`, "i"), " ");
    }

    // Strip generic concept tags often placed at the end: couple, single, gia đình, baby, bầu, cưới
    const conceptTags = /\b(couple|single|gia đình|baby|bầu|cưới|tiệc|studio|ngoại cảnh)\b/gi;
    identityPart = identityPart.replace(conceptTags, " ");

    // Clean remaining leading/trailing spaces, dashes, slashes (preserve leading _ and @ for handles)
    identityPart = identityPart.replace(/^[\s\-|/]+|[\s\-|/]+$/g, "").trim();

    // 5. Parse Identity Part
    if (identityPart.includes(" - ") || (identityPart.includes("-") && !identityPart.includes(" "))) {
      // Divided by dash e.g. "phuog_thyur08 - peppa" or "phw.nah_129 - Ng Phuong Anh"
      const parts = identityPart.split(/\s*-\s*/).filter(Boolean);
      if (parts.length >= 2) {
        const left = parts[0].trim();
        const right = parts.slice(1).join(" - ").trim();

        const isLeftSocial = /[_0-9.]/.test(left) || left.startsWith("@") || left.startsWith("user");
        if (isLeftSocial) {
          socialUsername = left.replace(/^[@_]+/, "");
          customerName = right;
        } else {
          customerName = left;
          socialUsername = right.replace(/^[@_]+/, "");
        }

        candidateNames.push(right);
        candidateNames.push(left);
        candidateNames.push(identityPart);
      } else {
        customerName = identityPart;
        candidateNames.push(identityPart);
      }
    } else if (identityPart.startsWith("_") || identityPart.startsWith("@") || identityPart.startsWith("#")) {
      // Identifier like "_xuka_11"
      socialUsername = identityPart.replace(/^[_@#]+/, "");
      const baseName = socialUsername.replace(/[_\d]+$/, "");
      customerName = baseName || socialUsername;
      candidateNames.push(socialUsername);
      if (baseName && baseName !== socialUsername) candidateNames.push(baseName);
      candidateNames.push(identityPart);
    } else if (identityPart) {
      // Multi-word name like "Hoàng Thị Khánh Ly"
      customerName = identityPart;
      candidateNames.push(identityPart);

      const words = identityPart.split(/\s+/).filter(Boolean);
      if (words.length >= 3) {
        const shortName = words.slice(-2).join(" ");
        candidateNames.push(shortName);
      }
    }

    const uniqueCandidates = Array.from(
      new Set(candidateNames.map((c) => c.trim()).filter((c) => c.length >= 2))
    );

    return {
      rawFolderName: normalized,
      shootDate,
      shootTime,
      customerName: customerName || uniqueCandidates[0] || normalized,
      socialUsername,
      packageCode,
      candidateNames: uniqueCandidates,
      unparsedTokens,
    };
  }

  /**
   * Normalizes strings for robust matching (removes accents, lowercase, removes punctuation).
   */
  public normalizeForComparison(str: string): string {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove Vietnamese diacritics
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
  }
}

export const folderParserService = new FolderParserService();
