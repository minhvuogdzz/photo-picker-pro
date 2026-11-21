import type { AuditRecord } from "../types/index.ts";
import { useContactSheetStore } from "../stores/useContactSheetStore.ts";
import { trText } from "../../../core/lib/i18n.ts";

export class AuditService {
  public addRecord(record: AuditRecord): void {
    useContactSheetStore.getState().addAuditRecord(record);
  }

  public getRecords(): AuditRecord[] {
    return useContactSheetStore.getState().auditRecords;
  }

  public clearRecords(): void {
    useContactSheetStore.getState().clearAuditRecords();
  }

  public exportAuditLogAsCsv(records: AuditRecord[]): string {
    const headers = [
      trText("Thời gian", "Time"),
      "Workspace",
      "Tab",
      trText("Tên Folder Job", "Job Folder Name"),
      trText("Hàng Đích", "Target Row"),
      trText("Cột Đã Đổi", "Modified Columns"),
      trText("Giá Trị Cũ", "Old Value"),
      trText("Giá Trị Mới", "New Value"),
      trText("Trạng Thái", "Status"),
      trText("Tài Khoản Google", "Google Account"),
    ];

    const rows = records.flatMap((r) =>
      r.changes.map((c) => [
        `"${r.timestamp}"`,
        `"${r.workspaceTitle.replace(/"/g, '""')}"`,
        `"${r.tabTitle}"`,
        `"${r.jobFolderName.replace(/"/g, '""')}"`,
        r.targetRow,
        `"${c.columnLetter} (${c.field})"`,
        `"${c.oldValue.replace(/"/g, '""')}"`,
        `"${c.newValue.replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${r.operatorGoogleAccount || ""}"`,
      ].join(","))
    );

    return [headers.join(","), ...rows].join("\n");
  }
}

export const auditService = new AuditService();
