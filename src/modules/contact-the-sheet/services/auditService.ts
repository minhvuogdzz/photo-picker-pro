import type { AuditRecord } from "../types/index.ts";
import { useContactSheetStore } from "../stores/useContactSheetStore.ts";

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
      "Thời gian",
      "Workspace",
      "Tab",
      "Tên Folder Job",
      "Hàng Đích",
      "Cột Đã Đổi",
      "Giá Trị Cũ",
      "Giá Trị Mới",
      "Trạng Thái",
      "Tài Khoản Google",
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
