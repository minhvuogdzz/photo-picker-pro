const VALID_EXTENSIONS_SET = new Set([
  "jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "webp",
  "heic", "heif", "raw", "cr2", "cr3", "nef", "arw", "orf",
  "rw2", "dng", "raf", "pef", "srw", "x3f", "psd"
]);

const EXTENSION_REGEX = /\.(jpe?g|png|gif|bmp|tiff?|webp|heic|heif|raw|cr[23]|nef|arw|orf|rw2|dng|raf|pef|srw|x3f|psd)$/i;

/**
 * Helper to detect commands like @clear, @none, #clear, #none, etc.
 */
export function isCommandToken(token: string): boolean {
  const trimmed = token.trim().toLowerCase();
  const cleaned = trimmed.replace(/^[@#]/, "").replace(/[:\-_=]+$/, "");
  return cleaned === "clear" || cleaned === "none" || cleaned === "reset" || cleaned === "all";
}

/**
 * Clean a single token:
 * Strips all non-alphanumeric characters from leading and trailing ends of each code,
 * while preserving valid image file extensions (e.g. .jpg, .cr3, .png, etc.)
 * and camera prefix underscore (e.g. _MG_1234.CR2),
 * and preserving prefix control commands (e.g. @clear, @none).
 */
export function cleanCodeToken(token: string): string {
  let t = token.trim();
  if (!t) return "";

  // Preserve prefix reset commands
  const lower = t.toLowerCase();
  const cmdCleaned = lower.replace(/^[@#]/, "").replace(/[:\-_=]+$/, "");
  if (cmdCleaned === "clear" || cmdCleaned === "none" || cmdCleaned === "reset" || cmdCleaned === "all") {
    return `@${cmdCleaned}`;
  }

  // Preserve explicit prefix declarations like @prefix ABC or #prefix ABC
  if (/^[@#](prefix|set)\s+[a-zA-Z0-9_]+/i.test(t)) {
    return t;
  }

  // 1. Strip leading non-alphanumeric characters.
  //    Keep leading '_' only if immediately followed by an alphabetic character (e.g. _MG_1234, _DSC001)
  t = t.replace(/^[^a-zA-Z0-9_]+/, "");
  t = t.replace(/^_(?![a-zA-Z])/, "");

  // 2. Strip trailing symbols/punctuation
  t = t.replace(/[^a-zA-Z0-9_.]+$/, "");

  // Check if it ends with a valid image extension
  const hasValidExt = EXTENSION_REGEX.test(t);

  if (!hasValidExt) {
    // If not a valid file extension, strip any trailing dots, underscores, dashes
    t = t.replace(/[._-]+$/, "");
  }

  // Strip any remaining trailing non-alphanumeric symbols if not part of valid ext
  if (!hasValidExt) {
    t = t.replace(/[^a-zA-Z0-9]+$/, "");
  }

  return t.trim();
}

/**
 * Auto-format pasted codes:
 * - Normalizes quotes, unicode zeros, unicode dashes.
 * - Handles codes joined by dots when NOT a file extension (e.g. zha0401.zha0407 -> zha0401, zha0407).
 * - Handles codes joined by dashes (e.g. HPP01099-01006-01078 or ZHA_0555-0573-0576 or HYTU3068.CR3-HYTU3124.CR3).
 * - Handles codes joined by pluses, slashes, colons, commas, semicolons, tabs, pipes, brackets, spaces.
 * - Cleans leading/trailing non-alphanumeric symbols from every code.
 * - Outputs one code per line.
 */
export function formatPastedCodes(text: string): string {
  if (!text || !text.trim()) return "";

  // 1. Normalize all quote types (curly/smart quotes → straight) then strip them
  let normalized = text
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036«»„‟]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  normalized = normalized.replace(/["']/g, "");

  // Normalize unicode zeros to standard ASCII '0'
  normalized = normalized
    .replace(/[\uFF10\u{1D7F6}\u{1D7CE}\u{1D7D8}\u{1D7E2}\u{1D7EC}\u3007]/gu, "0");

  // Normalize unicode dashes to standard hyphen '-'
  normalized = normalized.replace(/[\u2010-\u2015\u2212]/g, "-");

  // 2. Separate valid file extensions that are followed by another code:
  //    e.g. "HYTU3068.CR3-HYTU3124.CR3" or "zha0401.jpg.zha0407.jpg" or "zha0401.jpg+zha0407"
  normalized = normalized.replace(
    /(\.(?:jpe?g|png|gif|bmp|tiff?|webp|heic|heif|raw|cr[23]|nef|arw|orf|rw2|dng|raf|pef|srw|x3f|psd))([^a-zA-Z0-9\s]*)([a-zA-Z0-9])/gi,
    "$1\n$3"
  );

  // 3. Separate codes joined by dots when NOT a valid file extension:
  //    e.g. "zha0401.zha0407" or "01234.01235" -> check if the part after dot is a valid extension.
  //    If not, replace dot with newline.
  normalized = normalized.replace(/\.([a-zA-Z0-9_]+)/g, (match, afterDot) => {
    if (VALID_EXTENSIONS_SET.has(afterDot.toLowerCase())) {
      return match; // keep valid extension like .jpg
    }
    return "\n" + afterDot; // split into new line
  });

  // 4. Separate dash-joined codes/numbers:
  //    e.g. "HPP01099-01006-01078-00987"
  //    e.g. "ZHA_0555-0573-0576"
  //    e.g. "01099-01006"
  //    Match: any digit(s) followed by dash(es) followed by alphanumeric
  while (/(\d+)-+([a-zA-Z0-9])/g.test(normalized)) {
    normalized = normalized.replace(/(\d+)-+([a-zA-Z0-9])/g, "$1\n$2");
  }

  // 5. Replace plus signs '+' and other explicit delimiter symbols with newline:
  //    e.g. "+1234+5678" or "+zha0401+zha0407" or "[zha0401] [zha0407]"
  //    Preserve # when part of commands like #none, #clear, #all, #reset
  normalized = normalized.replace(/#(?!(?:none|clear|all|reset)\b)/gi, "\n");
  normalized = normalized.replace(/[+;,|/\\:()<>[\]{}*~!?^$%&•·]+/g, "\n");

  // 6. Split by newlines and whitespace
  const rawTokens = normalized.split(/[\r\n\s]+/);

  const cleaned: string[] = [];
  for (const raw of rawTokens) {
    const t = cleanCodeToken(raw);
    if (t.length > 0) {
      cleaned.push(t);
    }
  }

  return cleaned.join("\n");
}
