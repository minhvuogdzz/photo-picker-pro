import type {
  SpreadsheetMetadata,
  TabAnalysisResult,
  ColumnProfile,
  HeaderCandidate,
  CellSourceType,
  CellValueType,
  SheetTabInfo,
  FieldMapping,
  SemanticField,
} from "../types/index.ts";
import { googleCredentialManager } from "./googleCredentialBridge.ts";
import realSheetFixture from "../../../../tests/fixtures/contact-the-sheet/real-sheet-structure.json" with { type: "json" };

export interface SemanticAlias {
  field: string;
  aliases: string[];
}

export const KNOWN_SEMANTIC_ALIASES: SemanticAlias[] = [
  { field: "SHOOT_DATE", aliases: ["ngày", "date", "shoot date", "ngay", "ngày chụp"] },
  { field: "SHOOT_TIME", aliases: ["giờ", "time", "shoot time", "gio", "giờ chụp"] },
  { field: "CUSTOMER_NAME", aliases: ["tên khách", "tên kh", "khách hàng", "customer", "customer name", "khach hang"] },
  { field: "CUSTOMER_ID", aliases: ["mã khách", "mã kh", "customer id", "id khách", "makh"] },
  { field: "CONCEPT", aliases: ["concept", "bối cảnh", "chủ đề", "gói chụp"] },
  { field: "NOTES", aliases: ["lưu ý", "ghi chú", "note", "notes", "luu y"] },
  { field: "BRANCH", aliases: ["cơ sở", "chi nhánh", "branch", "studio"] },
  { field: "WORKFLOW_STATUS", aliases: ["trạng thái 1", "tiến độ", "workflow status", "status 1"] },
  { field: "JOB_FOLDER_NAME", aliases: ["tên file", "tên folder", "folder name", "tên thư mục", "file name", "job folder", "ten file"] },
  { field: "SELECTED_IMAGE_CODES_PRIMARY", aliases: ["mã ảnh chọn (1)", "mã ảnh chọn 1", "mã chọn", "selected codes"] },
  { field: "SELECTED_IMAGE_CODES_SECONDARY", aliases: ["mã ảnh chọn (2)", "mã ảnh chọn 2"] },
  { field: "EDIT_REQUEST", aliases: ["yêu cầu edit", "yêu cầu hậu kỳ", "edit request", "yêu cầu sửa"] },
  { field: "DELIVERY_DUE", aliases: ["hẹn trả ảnh", "hạn trả", "deadline", "delivery due", "trả ảnh"] },
  { field: "PHOTO_PICK_STATUS", aliases: ["trạng thái lọc", "lọc ảnh", "pick status", "trang thai loc"] },
  { field: "EDITOR", aliases: ["tên edit", "người edit", "editor", "retoucher", "người hậu kỳ", "ten edit"] },
  { field: "DELIVERY_LINK", aliases: ["link edit", "link ảnh", "drive link", "delivery link", "link bàn giao", "link hoàn thành"] },
  { field: "FIX_STATUS", aliases: ["fix", "trạng thái fix", "sửa lỗi", "bảo hành"] },
  { field: "FIX_LINK", aliases: ["link fix", "link sửa", "fix link"] },
  { field: "PICK_COMPLETED_AT", aliases: ["time mã", "thời gian lọc", "pick time"] },
  { field: "EDIT_COMPLETED_AT", aliases: ["time edit", "thời gian edit", "edit time", "hoàn thành edit"] },
];

export class SheetDiscoveryService {
  /**
   * Extracts Google Spreadsheet ID from URL or raw ID string.
   */
  public parseSpreadsheetId(input: string): string {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // If input itself matches standard Google Sheet ID format
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
      return trimmed;
    }
    throw new Error("INVALID_SHEET_URL: Không tìm thấy Spreadsheet ID hợp lệ trong liên kết");
  }

  /**
   * Fetches metadata only (spreadsheet title, tabs, row/col counts) without downloading cell data.
   */
  public async fetchSpreadsheetMetadata(spreadsheetId: string, isMock: boolean = false): Promise<SpreadsheetMetadata> {
    if (isMock) {
      const fixture = realSheetFixture as any;
      return {
        spreadsheetId: fixture.spreadsheetId,
        title: fixture.properties.title,
        locale: fixture.properties.locale,
        timeZone: fixture.properties.timeZone,
        tabs: fixture.sheets.map((s: any) => ({
          sheetId: s.properties.sheetId,
          title: s.properties.title,
          index: s.properties.index,
          rowCount: s.properties.gridProperties?.rowCount || 1000,
          columnCount: s.properties.gridProperties?.columnCount || 26,
        })),
      };
    }

    let token = await googleCredentialManager.getValidAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties,sheets.properties`;
    
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      try {
        const refreshedToken = await googleCredentialManager.getValidAccessToken(true);
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${refreshedToken}` },
        });
      } catch (refreshErr) {
        console.warn("Failed to refresh token on 401:", refreshErr);
      }
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const googleErrMsg = errBody?.error?.message || "";
      if (res.status === 401) {
        throw new Error(`GOOGLE_TOKEN_EXPIRED: Phiên xác thực Google đã hết hạn (${googleErrMsg || "401"}). Vui lòng bấm 'Ngắt kết nối' và 'Kết nối Google' lại.`);
      }
      if (res.status === 403) {
        throw new Error(`SHEET_ACCESS_DENIED: Không thể truy cập bảng tính. Chi tiết từ Google:\n"${googleErrMsg || "Quyền bị từ chối"}"\n\n💡 Vui lòng kiểm tra:\n1. Kích hoạt Google Sheets API trong dự án Google Cloud (devhouse-af4bf).\n2. Chia sẻ bảng tính Google Sheet cho tài khoản "${googleCredentialManager.getAccountEmail() || "Google"}" (quyền Người xem hoặc Người chỉnh sửa).`);
      }
      if (res.status === 404) {
        throw new Error(`SHEET_NOT_FOUND: Bảng tính không tồn tại hoặc ID không đúng: ${spreadsheetId}`);
      }
      throw new Error(`Google Sheets API lỗi (HTTP ${res.status}): ${googleErrMsg || res.statusText}`);
    }

    const data = await res.json();
    return {
      spreadsheetId: data.spreadsheetId,
      title: data.properties?.title || "Untitled Spreadsheet",
      locale: data.properties?.locale || "vi_VN",
      timeZone: data.properties?.timeZone || "Asia/Saigon",
      tabs: (data.sheets || []).map((s: any) => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title,
        index: s.properties.index,
        rowCount: s.properties.gridProperties?.rowCount || 1000,
        columnCount: s.properties.gridProperties?.columnCount || 26,
        frozenRowCount: s.properties.gridProperties?.frozenRowCount,
      })),
    };
  }

  /**
   * Performs bounded cell sampling (first 30-50 rows) for a specific tab to analyze schema and detect headers.
   */
  public async analyzeTabSchema(
    spreadsheetId: string,
    tab: SheetTabInfo,
    sampleRowCount: number = 40,
    isMock: boolean = false
  ): Promise<TabAnalysisResult> {
    let rowData: any[] = [];

    if (isMock) {
      const fixture = realSheetFixture as any;
      const targetSheet = fixture.sheets.find((s: any) => s.properties.sheetId === tab.sheetId) || fixture.sheets[0];
      rowData = targetSheet?.data?.[0]?.rowData || [];
    } else {
      let token = await googleCredentialManager.getValidAccessToken();
      const maxColLetter = this.columnIndexToLetter(Math.min(tab.columnCount - 1, 25));
      const range = `'${tab.title}'!A1:${maxColLetter}${sampleRowCount}`;
      const fields = "sheets.data.rowData.values(formattedValue,userEnteredValue,effectiveValue,dataValidation,hyperlink)";
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?ranges=${encodeURIComponent(range)}&fields=${encodeURIComponent(fields)}`;

      let res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        try {
          token = await googleCredentialManager.getValidAccessToken(true);
          res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (refreshErr) {
          console.warn("Failed to refresh token on 401:", refreshErr);
        }
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const googleErrMsg = errBody?.error?.message || "";
        throw new Error(`Khảo sát dòng bảng tính thất bại (HTTP ${res.status}): ${googleErrMsg || res.statusText}`);
      }

      const json = await res.json();
      rowData = json.sheets?.[0]?.data?.[0]?.rowData || [];
    }

    // 1. Detect candidate header rows
    const headerCandidates = this.scoreHeaderCandidates(rowData);
    const detectedHeaderRow = headerCandidates.length > 0 ? headerCandidates[0].row : 1;

    // 2. Build column profiles using detected header row and sample rows below it
    const columns = this.buildColumnProfiles(rowData, detectedHeaderRow, tab.columnCount);

    // 3. Detect #REF! and IMPORTRANGE health
    const refErrorColumns = columns.filter((c) => c.hasErrors).map((c) => c.letter);
    const summaryRowsDetected = headerCandidates
      .filter((c) => c.row < detectedHeaderRow && c.textRatio > 0.1)
      .map((c) => c.row);

    return {
      tab,
      detectedHeaderRow,
      headerCandidates,
      columns,
      hasImportRangeRefErrors: refErrorColumns.length > 0,
      refErrorColumns,
      summaryRowsDetected,
    };
  }

  /**
   * Scores candidate rows (1-10) to reliably detect the header row.
   */
  public scoreHeaderCandidates(rowData: any[]): HeaderCandidate[] {
    const candidates: HeaderCandidate[] = [];
    const maxRowToCheck = Math.min(rowData.length, 10);

    for (let r = 0; r < maxRowToCheck; r++) {
      const rowNum = r + 1; // 1-indexed
      const cells = rowData[r]?.values || [];
      if (cells.length === 0) continue;

      let textCount = 0;
      let formulaCount = 0;
      let nonEmptyCount = 0;
      const valuesSet = new Set<string>();
      let matchedAliases = 0;
      const sampleHeaders: string[] = [];

      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        const text = (cell?.formattedValue || cell?.userEnteredValue?.stringValue || "").trim();
        if (!text) continue;

        nonEmptyCount++;
        valuesSet.add(text.toLowerCase());

        if (cell?.userEnteredValue?.formulaValue) {
          formulaCount++;
        } else {
          textCount++;
        }

        if (sampleHeaders.length < 5 && text) {
          sampleHeaders.push(text);
        }

        // Check if text matches known semantic aliases
        const normalized = text.toLowerCase();
        const matchesAnyAlias = KNOWN_SEMANTIC_ALIASES.some((item) =>
          item.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))
        );
        if (matchesAnyAlias) {
          matchedAliases++;
        }
      }

      if (nonEmptyCount === 0) continue;

      const textRatio = textCount / nonEmptyCount;
      const formulaRatio = formulaCount / nonEmptyCount;
      const uniqueRatio = valuesSet.size / nonEmptyCount;

      // Scoring formula: High text proportion, low formulas, high uniqueness, high alias matches
      // Header rows typically have 10+ columns with unique names and almost 0 formulas
      let score = textRatio * 0.3 + uniqueRatio * 0.3 + Math.min(matchedAliases / 4, 1.0) * 0.4 - formulaRatio * 0.5;
      
      // If row has 4+ matched known headers (like Tên khách, Tên file, Ngày, Giờ), boost significantly
      if (matchedAliases >= 4) score += 0.5;

      candidates.push({
        row: rowNum,
        score: Math.max(0, Math.min(1.0, score)),
        textRatio,
        formulaRatio,
        uniqueRatio,
        matchedAliases,
        sampleHeaders,
      });
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  /**
   * Analyzes columns based on header row and succeeding sample data rows.
   */
  public buildColumnProfiles(rowData: any[], headerRow: number, totalCols: number): ColumnProfile[] {
    const profiles: ColumnProfile[] = [];
    const headerRowIdx = headerRow - 1;
    const headerCells = rowData[headerRowIdx]?.values || [];
    const maxCols = Math.max(headerCells.length, Math.min(totalCols, 26));

    for (let c = 0; c < maxCols; c++) {
      const colLetter = this.columnIndexToLetter(c);
      const headerText = (headerCells[c]?.formattedValue || headerCells[c]?.userEnteredValue?.stringValue || "").trim();

      let formulaCount = 0;
      let hasImportRange = false;
      let hasErrors = false;
      let isHyperlink = false;
      const sampleValues: string[] = [];
      const dropdownOptionsSet = new Set<string>();

      // Check validation on header cell or sample cells
      if (headerCells[c]?.dataValidation?.condition?.values) {
        for (const v of headerCells[c].dataValidation.condition.values) {
          if (v.userEnteredValue) dropdownOptionsSet.add(v.userEnteredValue);
        }
      }

      // Inspect data rows below header (up to 30 rows)
      for (let r = headerRowIdx + 1; r < rowData.length; r++) {
        const cell = rowData[r]?.values?.[c];
        if (!cell) continue;

        const val = (cell.formattedValue || "").trim();
        const formula = cell.userEnteredValue?.formulaValue || "";

        if (cell.hyperlink || val.startsWith("http://") || val.startsWith("https://")) {
          isHyperlink = true;
        }

        if (cell.dataValidation?.condition?.values) {
          for (const v of cell.dataValidation.condition.values) {
            if (v.userEnteredValue) dropdownOptionsSet.add(v.userEnteredValue);
          }
        }

        if (formula) {
          formulaCount++;
          if (formula.toUpperCase().includes("IMPORTRANGE")) {
            hasImportRange = true;
          }
        }

        if (val === "#REF!" || val === "#N/A" || val === "#ERROR!" || val === "#VALUE!" || cell.isError) {
          hasErrors = true;
        }

        if (val && sampleValues.length < 3 && !sampleValues.includes(val)) {
          sampleValues.push(val);
        }
      }

      // Determine detected cell source type
      let detectedSourceType: CellSourceType = "DIRECT_VALUE";
      if (hasErrors) {
        detectedSourceType = "FORMULA_ERROR";
      } else if (hasImportRange) {
        detectedSourceType = "IMPORTRANGE";
      } else if (formulaCount > 0) {
        detectedSourceType = "FORMULA";
      }

      // Suggest semantic mapping based on header name
      const { suggestedField, confidence } = this.suggestSemanticField(headerText);

      profiles.push({
        index: c,
        letter: colLetter,
        headerName: headerText || `Cột ${colLetter}`,
        headerRow,
        detectedSourceType,
        hasFormulas: formulaCount > 0,
        formulaCount,
        sampleValues,
        dropdownOptions: dropdownOptionsSet.size > 0 ? Array.from(dropdownOptionsSet) : undefined,
        isHyperlinkField: isHyperlink,
        hasErrors,
        suggestedSemanticField: suggestedField,
        suggestedConfidence: confidence,
      });
    }

    return profiles;
  }

  /**
   * Suggests a matching semantic field for a column header using alias matching.
   */
  public suggestSemanticField(header: string): { suggestedField?: string; confidence: number } {
    if (!header) return { confidence: 0 };
    const normalized = header.toLowerCase().trim();

    for (const item of KNOWN_SEMANTIC_ALIASES) {
      for (const alias of item.aliases) {
        if (normalized === alias) {
          return { suggestedField: item.field, confidence: 1.0 };
        }
        if (normalized.includes(alias) || alias.includes(normalized)) {
          return { suggestedField: item.field, confidence: 0.8 };
        }
      }
    }

    return { confidence: 0 };
  }

  public columnIndexToLetter(index: number): string {
    let letter = "";
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  /**
   * Fetches sheet rows for matching in BatchRunnerView.
   */
  public async fetchSheetRowsForMatching(
    spreadsheetId: string,
    tabTitle: string,
    startRow: number = 4,
    rowCount: number = 1000,
    isMock: boolean = false
  ): Promise<Array<{ row: number; values: Record<string, string> }>> {
    if (isMock) {
      const fixture = realSheetFixture as any;
      return fixture.sheets[0].data[0].rowData.slice(startRow - 1).map((r: any, idx: number) => {
        const values: Record<string, string> = {};
        for (let c = 0; c < 26; c++) {
          const letter = this.columnIndexToLetter(c);
          values[letter] = r.values?.[c]?.formattedValue || "";
        }
        return {
          row: startRow + idx,
          values,
        };
      });
    }

    let token = await googleCredentialManager.getValidAccessToken();
    const range = `'${tabTitle}'!A${startRow}:ZZ${startRow + rowCount - 1}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      try {
        token = await googleCredentialManager.getValidAccessToken(true);
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (refreshErr) {
        console.warn("Failed to refresh token on 401 in fetchSheetRows:", refreshErr);
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to load sheet rows for matching: HTTP ${res.status} - ${errText}`);
    }

    const data = await res.json();
    const rows: string[][] = data.values || [];

    return rows.map((cols, idx) => {
      const values: Record<string, string> = {};
      for (let c = 0; c < cols.length; c++) {
        const letter = this.columnIndexToLetter(c);
        values[letter] = cols[c] || "";
      }
      return {
        row: startRow + idx,
        values,
      };
    });
  }

  /**
   * Intelligently auto-maps columns for a target tab, transferring existing mapping intents
   * (e.g. from another configured tab) while adjusting for column position shifts and formula protections.
   */
  public autoDetectOrCloneMappings(
    targetTabColumns: ColumnProfile[],
    baseMappings: FieldMapping[] = []
  ): FieldMapping[] {
    return targetTabColumns.map((col) => {
      const isFormula = col.hasFormulas || col.detectedSourceType === "IMPORTRANGE";
      const normalizedHeader = col.headerName.toLowerCase().trim();

      // 1. Try to find an existing mapping with matching header name or semantic field
      const matchByHeader = baseMappings.find(
        (m) => m.columnHeader.toLowerCase().trim() === normalizedHeader
      );
      const matchBySemantic = col.suggestedSemanticField
        ? baseMappings.find((m) => m.semanticField === col.suggestedSemanticField)
        : undefined;

      const matched = matchByHeader || matchBySemantic;

      const semanticField: SemanticField =
        matched?.semanticField || (col.suggestedSemanticField as SemanticField) || "NOTES";

      const isWritableField = semanticField === "EDITOR" || semanticField === "DELIVERY_LINK";

      // If formula, strictly READ_ONLY regardless of previous setting
      const permission = isFormula
        ? "READ_ONLY"
        : matched?.permission || (isWritableField ? "READ_WRITE" : "READ_ONLY");

      const writePolicy =
        matched?.writePolicy ||
        (semanticField === "DELIVERY_LINK" ? "ASK_BEFORE_OVERWRITE" : "SET_IF_EMPTY");

      return {
        semanticField,
        columnLetter: col.letter,
        columnIndex: col.index,
        columnHeader: col.headerName,
        permission,
        isFormulaDerived: isFormula,
        writePolicy,
      };
    });
  }
}

export const sheetDiscoveryService = new SheetDiscoveryService();
