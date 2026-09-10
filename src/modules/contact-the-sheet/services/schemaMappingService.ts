import type {
  FieldMapping,
  SemanticField,
  FieldPermission,
  WritePolicy,
  WorkspaceProfile,
  PlannedCellWrite,
} from "../types";

export class SchemaMappingService {
  /**
   * Evaluates whether a write operation to a semantic field on a given row is permitted.
   * Enforces Two-Layer Write Security + Formula Protection + Row Scope.
   */
  public evaluateWritePermission(
    profile: WorkspaceProfile,
    field: SemanticField,
    targetRow: number,
    currentCellValue: string,
    isTargetCellFormula: boolean
  ): { allowed: boolean; reason?: PlannedCellWrite["blockedReason"] } {
    // 1. Check row scope
    if (profile.rowScope.startRow && targetRow < profile.rowScope.startRow) {
      return { allowed: false, reason: "OUTSIDE_ROW_SCOPE" };
    }
    if (profile.rowScope.endRow && targetRow > profile.rowScope.endRow) {
      return { allowed: false, reason: "OUTSIDE_ROW_SCOPE" };
    }

    // 2. Check field mapping exists
    const mapping = profile.fieldMappings.find((m) => m.semanticField === field);
    if (!mapping) {
      return { allowed: false, reason: "FIELD_READ_ONLY" };
    }

    // 3. Check field permission allowlist
    if (mapping.permission !== "READ_WRITE") {
      return { allowed: false, reason: "FIELD_READ_ONLY" };
    }

    // 4. Hard guard: Formula protection
    if (isTargetCellFormula || mapping.isFormulaDerived) {
      return { allowed: false, reason: "FORMULA_CELL" };
    }

    // 5. Write policy check for non-empty existing values
    if (mapping.writePolicy === "SET_IF_EMPTY" && currentCellValue.trim().length > 0) {
      return { allowed: false, reason: "EXISTING_VALUE_CONFLICT" };
    }

    return { allowed: true };
  }

  /**
   * Generates a deterministic fingerprint of tab headers to detect schema shifts.
   */
  public generateSchemaFingerprint(headers: Array<{ index: number; headerName: string }>): string {
    const raw = headers
      .sort((a, b) => a.index - b.index)
      .map((h) => `${h.index}:${h.headerName.trim().toLowerCase()}`)
      .join("|");
    
    // Simple fast hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `fp_${Math.abs(hash).toString(16)}`;
  }
}

export const schemaMappingService = new SchemaMappingService();
