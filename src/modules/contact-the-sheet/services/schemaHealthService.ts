import type {
  WorkspaceProfile,
  ColumnProfile,
  WorkspaceHealthStatus,
  FieldMapping,
} from "../types";

export interface HealthCheckReport {
  status: WorkspaceHealthStatus;
  isHealthy: boolean;
  warnings: string[];
  shiftedFields: Array<{
    field: string;
    oldLetter: string;
    newLetter: string;
  }>;
  unhealthyFields: Array<{
    field: string;
    columnLetter: string;
    errorReason: string;
  }>;
}

export class SchemaHealthService {
  /**
   * Evaluates the schema health and source data validity of a workspace.
   */
  public verifyWorkspaceHealth(
    profile: WorkspaceProfile,
    currentColumns: ColumnProfile[]
  ): HealthCheckReport {
    const warnings: string[] = [];
    const shiftedFields: HealthCheckReport["shiftedFields"] = [];
    const unhealthyFields: HealthCheckReport["unhealthyFields"] = [];

    // 1. Check for column movements / shifts
    for (const mapping of profile.fieldMappings) {
      const currentCol = currentColumns.find((c) => c.index === mapping.columnIndex);
      const matchingByName = currentColumns.find(
        (c) => c.headerName.toLowerCase().trim() === mapping.columnHeader.toLowerCase().trim()
      );

      if (!currentCol && !matchingByName) {
        unhealthyFields.push({
          field: mapping.semanticField,
          columnLetter: mapping.columnLetter,
          errorReason: `Không tìm thấy cột ${mapping.columnHeader} (${mapping.columnLetter}) trên Sheet`,
        });
        continue;
      }

      // Check if header moved to a new column
      if (matchingByName && matchingByName.letter !== mapping.columnLetter) {
        shiftedFields.push({
          field: mapping.semanticField,
          oldLetter: mapping.columnLetter,
          newLetter: matchingByName.letter,
        });
        warnings.push(
          `Cột ${mapping.columnHeader} đã dời vị trí từ ${mapping.columnLetter} sang ${matchingByName.letter}`
        );
      }

      // 2. Check source data health (e.g. #REF! errors in matching fields)
      const targetCol = matchingByName || currentCol;
      if (targetCol && targetCol.hasErrors) {
        unhealthyFields.push({
          field: mapping.semanticField,
          columnLetter: targetCol.letter,
          errorReason: `Cột ${targetCol.headerName} đang chứa lỗi công thức (#REF! hoặc #N/A)`,
        });
      }
    }

    let status: WorkspaceHealthStatus = "HEALTHY";
    if (unhealthyFields.length > 0) {
      status = "WORKSPACE_DATA_UNHEALTHY";
    } else if (shiftedFields.length > 0) {
      status = "SCHEMA_SHIFTED";
    }

    return {
      status,
      isHealthy: status === "HEALTHY",
      warnings,
      shiftedFields,
      unhealthyFields,
    };
  }

  /**
   * Auto-remaps shifted columns when headers are unambiguously identified.
   */
  public autoRemapShiftedColumns(
    profile: WorkspaceProfile,
    shiftedFields: HealthCheckReport["shiftedFields"],
    currentColumns: ColumnProfile[]
  ): FieldMapping[] {
    return profile.fieldMappings.map((mapping) => {
      const shift = shiftedFields.find((s) => s.field === mapping.semanticField);
      if (!shift) return mapping;

      const newCol = currentColumns.find((c) => c.letter === shift.newLetter);
      if (!newCol) return mapping;

      return {
        ...mapping,
        columnLetter: newCol.letter,
        columnIndex: newCol.index,
        columnHeader: newCol.headerName,
      };
    });
  }
}

export const schemaHealthService = new SchemaHealthService();
