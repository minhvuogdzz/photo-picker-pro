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
    <div className="flex-1 flex flex-col h-full overflow-hidden p-5 gap-3.5 text-foreground custom-scrollbar">
      {/* Top Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <History size={15} className="text-muted-foreground" />
            <span>Nhật ký hoạt động</span>
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Lịch sử các thao tác cập nhật bảng tính Google Sheets để đối soát và tra cứu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={auditRecords.length === 0}
            className="px-3 py-1.5 bg-muted/30 hover:bg-muted/60 text-foreground font-medium rounded-lg text-[11px] border border-border/60 flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Download size={13} />
            <span>Xuất CSV</span>
          </button>
          <button
            onClick={clearAuditRecords}
            disabled={auditRecords.length === 0}
            className="px-3 py-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive font-medium rounded-lg text-[11px] border border-border/60 flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Xóa nhật ký</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-card/30 border border-border/60 rounded-xl overflow-hidden flex flex-col">
        {auditRecords.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <div className="w-10 h-10 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center mb-2.5">
              <History size={18} className="text-muted-foreground/50" />
            </div>
            <p className="text-xs font-medium text-foreground/80">Chưa có lịch sử cập nhật</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Khi bạn thực thi cập nhật các job lên Sheet, lịch sử sẽ hiển thị tại đây.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground font-medium text-[11px] sticky top-0 backdrop-blur-md">
                  <th className="py-2.5 px-3.5">Thời gian</th>
                  <th className="py-2.5 px-3.5">Workspace & Tab</th>
                  <th className="py-2.5 px-3.5">Job Folder</th>
                  <th className="py-2.5 px-3.5">Hàng</th>
                  <th className="py-2.5 px-3.5">Thay đổi</th>
                  <th className="py-2.5 px-3.5">Trạng thái</th>
                  <th className="py-2.5 px-3.5">Tài khoản</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {auditRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/15 transition-colors">
                    <td className="py-2.5 px-3.5 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                      {new Date(r.timestamp).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className="font-medium text-foreground">{r.workspaceTitle}</span>
                      <span className="text-muted-foreground text-[10px] block">{r.tabTitle}</span>
                    </td>
                    <td className="py-2.5 px-3.5 font-medium text-foreground max-w-[200px] truncate">
                      {r.jobFolderName}
                    </td>
                    <td className="py-2.5 px-3.5 text-muted-foreground font-mono text-[11px]">
                      #{r.targetRow}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <div className="flex flex-col gap-1 max-w-[300px]">
                        {r.changes.map((c, idx) => (
                          <div key={idx} className="text-[11px]">
                            <span className="font-medium text-foreground">{c.columnLetter} ({c.field}): </span>
                            <span className="text-muted-foreground font-mono truncate max-w-[200px] inline-block align-bottom">
                              {c.newValue}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      {r.status === "SUCCESS" ? (
                        <span className="inline-flex items-center gap-1 text-foreground font-medium text-[11px]">
                          <CheckCircle2 size={12} className="text-emerald-500" /> Thành công
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive font-medium text-[11px]">
                          <AlertCircle size={12} /> Thất bại
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-muted-foreground text-[11px] truncate max-w-[150px]">
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
