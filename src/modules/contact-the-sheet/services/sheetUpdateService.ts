import type {
  DiscoveredJob,
  WorkspaceProfile,
  UpdatePlan,
  BatchExecutionSummary,
  AuditRecord,
  WritePolicy,
} from "../types/index.ts";
import { googleCredentialManager } from "./googleCredentialBridge.ts";
import { auditService } from "./auditService.ts";

export class SheetUpdateService {
  /**
   * Revalidates target rows immediately before commit to detect stale rows modified by others.
   */
  public async revalidateRowsBeforeCommit(
    jobs: DiscoveredJob[],
    profile: WorkspaceProfile,
    isMock?: boolean
  ): Promise<{ validJobs: DiscoveredJob[]; staleJobs: DiscoveredJob[] }> {
    const useMock = isMock !== undefined ? isMock : profile.isMockSandbox;
    if (useMock) {
      // In mock mode, all ready jobs pass revalidation
      return { validJobs: jobs, staleJobs: [] };
    }

    const validJobs: DiscoveredJob[] = [];
    const staleJobs: DiscoveredJob[] = [];

    try {
      let token = await googleCredentialManager.getValidAccessToken();

      // Batch read ranges for all jobs
      const ranges = jobs.map((j) => `'${profile.selectedTabTitle}'!A${j.targetSheetRow}:Z${j.targetSheetRow}`);
      const query = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${profile.spreadsheetId}/values:batchGet?${query}`;

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
        throw new Error(`Revalidation batchGet failed: HTTP ${res.status} - ${errBody?.error?.message || res.statusText}`);
      }

      const json = await res.json();
      const valueRanges: any[] = json.valueRanges || [];

      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const rowData = valueRanges[i]?.values?.[0] || [];
        const snapshot = job.targetRowSnapshot || {};

        let isStale = false;
        // Compare mapped writable fields
        for (const mapping of profile.fieldMappings) {
          if (mapping.permission === "READ_WRITE") {
            const expected = (snapshot[mapping.columnLetter] || "").trim();
            const current = (rowData[mapping.columnIndex] || "").trim();
            if (expected !== current) {
              isStale = true;
              break;
            }
          }
        }

        if (isStale) {
          staleJobs.push({
            ...job,
            status: "CONFLICT",
            statusReason: "STALE_ROW_CONFLICT: Hàng này vừa được người khác chỉnh sửa trên Sheet",
          });
        } else {
          validJobs.push(job);
        }
      }
    } catch (err) {
      console.warn("Pre-commit revalidation encountered network issue, failing safe:", err);
      return { validJobs: [], staleJobs: jobs };
    }

    return { validJobs, staleJobs };
  }

  /**
   * Executes batch updates for READY jobs with partial safe success and failure isolation.
   */
  public async executeBatchUpdates(
    readyJobs: DiscoveredJob[],
    plans: Record<string, UpdatePlan>,
    profile: WorkspaceProfile,
    onProgress?: (current: number, total: number) => void
  ): Promise<BatchExecutionSummary> {
    const isMock = profile.isMockSandbox;
    const batchId = `batch_${Date.now().toString(36)}`;
    const startedAt = new Date().toISOString();

    const summary: BatchExecutionSummary = {
      batchId,
      startedAt,
      finishedAt: "",
      totalPlanned: readyJobs.length,
      successCount: 0,
      conflictCount: 0,
      skippedCount: 0,
      failedCount: 0,
      errors: [],
    };

    if (readyJobs.length === 0) {
      summary.finishedAt = new Date().toISOString();
      return summary;
    }

    // 1. Pre-commit revalidation
    const { validJobs, staleJobs } = await this.revalidateRowsBeforeCommit(readyJobs, profile, isMock);
    summary.conflictCount += staleJobs.length;

    if (validJobs.length === 0) {
      summary.finishedAt = new Date().toISOString();
      return summary;
    }

    // 2. In Sandbox Mock Mode: Simulate execution
    if (isMock) {
      for (let i = 0; i < validJobs.length; i++) {
        const job = validJobs[i];
        const plan = plans[job.id];
        summary.successCount++;

        // Record audit
        const auditRecord: AuditRecord = {
          id: `audit_${Date.now()}_${i}`,
          timestamp: new Date().toISOString(),
          workspaceId: profile.id,
          workspaceTitle: profile.displayName,
          sheetId: profile.selectedTabId,
          tabTitle: profile.selectedTabTitle,
          jobFolderName: job.jobFolderName,
          targetRow: job.targetSheetRow || 0,
          changes: (plan?.writes || []).map((w) => ({
            columnLetter: w.columnLetter,
            field: w.field,
            oldValue: w.oldValue,
            newValue: w.newValue,
          })),
          status: "SUCCESS",
          operatorGoogleAccount: profile.googleAccountEmail || "sandbox@studio.com",
        };
        auditService.addRecord(auditRecord);

        if (onProgress) onProgress(i + 1, validJobs.length);
      }

      summary.finishedAt = new Date().toISOString();
      return summary;
    }

    // 3. Live Google Sheets API: Chunked batchUpdate
    let token = await googleCredentialManager.getValidAccessToken();
    const chunkSize = 10;

    for (let chunkStart = 0; chunkStart < validJobs.length; chunkStart += chunkSize) {
      const chunkJobs = validJobs.slice(chunkStart, chunkStart + chunkSize);

      const updateData: Array<{ range: string; values: string[][] }> = [];
      for (const job of chunkJobs) {
        const plan = plans[job.id];
        if (!plan) continue;

        for (const write of plan.writes) {
          if (write.allowed) {
            updateData.push({
              range: `'${profile.selectedTabTitle}'!${write.columnLetter}${write.row}`,
              values: [[write.newValue]],
            });
          }
        }
      }

      try {
        let res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${profile.spreadsheetId}/values:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              valueInputOption: "USER_ENTERED",
              data: updateData,
            }),
          }
        );

        if (res.status === 401) {
          try {
            token = await googleCredentialManager.getValidAccessToken(true);
            res = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${profile.spreadsheetId}/values:batchUpdate`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  valueInputOption: "USER_ENTERED",
                  data: updateData,
                }),
              }
            );
          } catch (refreshErr) {
            console.warn("Failed to refresh token on 401 in batchUpdate:", refreshErr);
          }
        }

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(`Google Sheets batchUpdate failed with HTTP ${res.status}: ${errBody?.error?.message || res.statusText}`);
        }

        for (const job of chunkJobs) {
          const plan = plans[job.id];
          summary.successCount++;

          const auditRecord: AuditRecord = {
            id: `audit_${Date.now()}_${job.id}`,
            timestamp: new Date().toISOString(),
            workspaceId: profile.id,
            workspaceTitle: profile.displayName,
            sheetId: profile.selectedTabId,
            tabTitle: profile.selectedTabTitle,
            jobFolderName: job.jobFolderName,
            targetRow: job.targetSheetRow || 0,
            changes: (plan?.writes || []).map((w) => ({
              columnLetter: w.columnLetter,
              field: w.field,
              oldValue: w.oldValue,
              newValue: w.newValue,
            })),
            status: "SUCCESS",
            operatorGoogleAccount: profile.googleAccountEmail,
          };
          auditService.addRecord(auditRecord);
        }
      } catch (chunkErr) {
        // Isolate chunk failure
        console.error("Chunk update error, isolating items:", chunkErr);
        for (const job of chunkJobs) {
          summary.failedCount++;
          summary.errors.push({
            jobId: job.id,
            row: job.targetSheetRow,
            error: String(chunkErr),
          });
        }
      }

      if (onProgress) {
        onProgress(Math.min(chunkStart + chunkSize, validJobs.length), validJobs.length);
      }
    }

    summary.finishedAt = new Date().toISOString();
    return summary;
  }
  /**
   * Updates a single cell on the active sheet (e.g. for photo picker status or customer codes).
   * Respects row scope and writePolicy (SET_IF_EMPTY, ALWAYS_REPLACE, APPEND).
   */
  public async updateSingleCell(
    profile: WorkspaceProfile,
    row: number,
    columnLetter: string,
    newValue: string,
    writePolicy: WritePolicy = "SET_IF_EMPTY",
    tabTitle?: string
  ): Promise<{ success: boolean; oldValue?: string; skipped?: boolean; error?: string }> {
    const tab = tabTitle || profile.selectedTabTitle;

    // Check row scope
    if (profile.rowScope?.startRow && row < profile.rowScope.startRow) {
      return {
        success: false,
        error: `Dòng ${row} nằm ngoài phạm vi xử lý cho phép (StartRow: ${profile.rowScope.startRow})`,
      };
    }

    if (profile.isMockSandbox) {
      auditService.addRecord({
        id: `audit_single_mock_${Date.now()}_${row}`,
        timestamp: new Date().toISOString(),
        workspaceId: profile.id,
        workspaceTitle: profile.displayName,
        sheetId: profile.selectedTabId,
        tabTitle: tab,
        jobFolderName: `Row ${row}`,
        targetRow: row,
        changes: [
          {
            columnLetter,
            field: "PHOTO_PICK_STATUS",
            oldValue: "",
            newValue,
          },
        ],
        status: "SUCCESS",
        operatorGoogleAccount: profile.googleAccountEmail || "sandbox@studio.com",
      });
      return { success: true, oldValue: "" };
    }

    try {
      let token = await googleCredentialManager.getValidAccessToken();
      const cellRange = `'${tab}'!${columnLetter}${row}`;
      const encodedRange = encodeURIComponent(cellRange);
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${profile.spreadsheetId}/values/${encodedRange}`;

      let readRes = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (readRes.status === 401) {
        try {
          token = await googleCredentialManager.getValidAccessToken(true);
          readRes = await fetch(readUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (refreshErr) {
          console.warn("Failed to refresh token on read cell 401:", refreshErr);
        }
      }

      let currentValue = "";
      if (readRes.ok) {
        const json = await readRes.json();
        currentValue = (json.values?.[0]?.[0] || "").toString().trim();
      }

      // Check write policy
      if (writePolicy === "SET_IF_EMPTY" && currentValue !== "") {
        return {
          success: false,
          skipped: true,
          oldValue: currentValue,
          error: `Ô ${columnLetter}${row} đã có nội dung ("${currentValue}"). Chính sách là 'Chỉ ghi nếu ô trống'.`,
        };
      }

      let finalValue = newValue;
      if (writePolicy === "APPEND" && currentValue !== "") {
        finalValue = `${currentValue}\n${newValue}`;
      }

      const writeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${profile.spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;
      let writeRes = await fetch(writeUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          range: cellRange,
          values: [[finalValue]],
        }),
      });

      if (writeRes.status === 401) {
        try {
          token = await googleCredentialManager.getValidAccessToken(true);
          writeRes = await fetch(writeUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              range: cellRange,
              values: [[finalValue]],
            }),
          });
        } catch (refreshErr) {
          console.warn("Failed to refresh token on write cell 401:", refreshErr);
        }
      }

      if (!writeRes.ok) {
        const errBody = await writeRes.json().catch(() => null);
        throw new Error(
          `Cập nhật ô thất bại (HTTP ${writeRes.status}): ${errBody?.error?.message || writeRes.statusText}`
        );
      }

      auditService.addRecord({
        id: `audit_single_${Date.now()}_${row}`,
        timestamp: new Date().toISOString(),
        workspaceId: profile.id,
        workspaceTitle: profile.displayName,
        sheetId: profile.selectedTabId,
        tabTitle: tab,
        jobFolderName: `Row ${row}`,
        targetRow: row,
        changes: [
          {
            columnLetter,
            field: "PHOTO_PICK_STATUS",
            oldValue: currentValue,
            newValue: finalValue,
          },
        ],
        status: "SUCCESS",
        operatorGoogleAccount: profile.googleAccountEmail,
      });

      return { success: true, oldValue: currentValue };
    } catch (err: any) {
      console.error("updateSingleCell error:", err);
      return { success: false, error: err?.message || String(err) };
    }
  }
}

export const sheetUpdateService = new SheetUpdateService();
