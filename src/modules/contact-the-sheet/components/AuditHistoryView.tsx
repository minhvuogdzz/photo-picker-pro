import React from "react";
import { History, Download, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { useContactSheetStore } from "../stores/useContactSheetStore";
import { auditService } from "../services/auditService";

export function AuditHistoryView() {
  const auditRecords = useContactSheetStore((s) => s.auditRecords);
  const clearAuditRecords = useContactSheetStore((s) => s.clearAuditRecords);

  const handleExportCsv = () => {
    if (auditRecords.length === 0) return;
    const csv = auditService.exportAuditLogAsCsv(auditRecords);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `contact_the_sheet_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-4 text-foreground custom-scrollbar">
      {/* Top Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <History size={18} className="text-teal-400" />
            <span>Nhật ký hoạt động (Audit Trail)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lịch sử chi tiết mọi thao tác cập nhật bảng tính Google Sheets để đối soát và tra cứu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={auditRecords.length === 0}
            className="px-3.5 py-1.5 bg-muted/40 hover:bg-muted text-foreground font-semibold rounded-xl text-xs border border-border flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Download size={14} />
            <span>Xuất CSV</span>
          </button>
          <button
            onClick={clearAuditRecords}
            disabled={auditRecords.length === 0}
            className="px-3 py-1.5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive font-semibold rounded-xl text-xs border border-border flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Trash2 size={14} />
            <span>Xóa nhật ký</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-background/50 border border-border rounded-2xl overflow-hidden flex flex-col shadow-inner">
        {auditRecords.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <History size={36} className="text-muted-foreground/30 mb-2" />
            <p className="text-sm font-semibold">Chưa có lịch sử cập nhật nào</p>
            <p className="text-xs mt-1">Khi bạn thực thi cập nhật các job lên Sheet, lịch sử sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-bold sticky top-0 backdrop-blur-md">
                  <th className="py-2.5 px-4">Thời gian</th>
                  <th className="py-2.5 px-4">Workspace & Tab</th>
                  <th className="py-2.5 px-4">Job Folder</th>
                  <th className="py-2.5 px-4">Hàng</th>
                  <th className="py-2.5 px-4">Thay đổi</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                  <th className="py-2.5 px-4">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {auditRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                      {new Date(r.timestamp).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-foreground">{r.workspaceTitle}</span>
                      <span className="text-muted-foreground text-[10px] block">({r.tabTitle})</span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-foreground max-w-[200px] truncate">
                      {r.jobFolderName}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-teal-400">
                      Hàng {r.targetRow}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex flex-col gap-1 max-w-[300px]">
                        {r.changes.map((c, idx) => (
                          <div key={idx} className="text-[11px]">
                            <span className="font-semibold text-foreground">{c.columnLetter} ({c.field}): </span>
                            <span className="text-teal-300 font-mono truncate max-w-[200px] inline-block align-bottom">
                              {c.newValue}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {r.status === "SUCCESS" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 size={13} /> Thành công
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive font-semibold text-[11px]">
                          <AlertCircle size={13} /> Thất bại
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground text-[11px] truncate max-w-[150px]">
                      {r.operatorGoogleAccount || "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
