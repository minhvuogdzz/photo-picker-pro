import test from "node:test";
import assert from "node:assert/strict";
import { sheetDiscoveryService } from "../../src/modules/contact-the-sheet/services/sheetDiscoveryService.ts";
import { googleCredentialManager } from "../../src/modules/contact-the-sheet/services/googleCredentialBridge.ts";

const row = (file: string, code: string, due: string, status: string) =>
  ["", "", "", "", "", "", "", file, code, "", "", due, status];

// Mimics the Google APIs: merged blocks only keep the top-left value in values.get
function mockGoogle(merges: any[], valuesByRange: Record<string, string>) {
  (googleCredentialManager as any).getValidAccessToken = async () => "token";
  (globalThis as any).fetch = async (url: string) => {
    const u = String(url);
    if (u.includes("fields=sheets(properties(title),merges)")) {
      return { ok: true, status: 200, json: async () => ({ sheets: [{ properties: { title: "T" }, merges }] }) };
    }
    if (u.includes("values:batchGet")) {
      const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map((m) => decodeURIComponent(m[1]));
      return { ok: true, status: 200, json: async () => ({ valueRanges: ranges.map((r) => ({ values: [[valuesByRange[r] || ""]] })) }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        values: [
          row("a_01", "1", "20/10", "Chưa lọc"),
          row("b_02", "2", "", "Chưa lọc"),
          row("c_03", "3", "", "Chưa lọc"),
        ],
      }),
    };
  };
}

test("Merged due date is copied down to the other rows of the block", async () => {
  // L2:L4 merged (0-based, end exclusive) over rows 2..4
  mockGoogle([{ sheetId: 0, startRowIndex: 1, endRowIndex: 4, startColumnIndex: 11, endColumnIndex: 12 }], {});
  const rows = await sheetDiscoveryService.fetchSheetRowsForMatching("x", "T", 2, undefined, false);
  assert.deepEqual(rows.map((r) => r.values.L), ["20/10", "20/10", "20/10"]);
  assert.equal(rows[1].values.H, "b_02"); // other cells untouched
});

test("Merged block whose top-left cell is above the fetched range is read via batchGet", async () => {
  // L1:L3 merged, but fetching starts at row 2
  mockGoogle([{ sheetId: 0, startRowIndex: 0, endRowIndex: 3, startColumnIndex: 11, endColumnIndex: 12 }], { "'T'!L1": "19/10" });
  const rows = await sheetDiscoveryService.fetchSheetRowsForMatching("x", "T", 2, undefined, false);
  assert.equal(rows[0].values.L, "20/10"); // own value is never overwritten
  assert.equal(rows[1].values.L, "19/10");
  assert.equal(rows[2].values.L, ""); // row 4 is outside the block
});

test("Failure while reading merges falls back to raw values", async () => {
  mockGoogle([], {});
  const base = (globalThis as any).fetch;
  (globalThis as any).fetch = async (url: string) =>
    String(url).includes("merges") ? { ok: false, status: 500, json: async () => ({}) } : base(url);
  const rows = await sheetDiscoveryService.fetchSheetRowsForMatching("x", "T", 2, undefined, false);
  assert.equal(rows.length, 3);
  assert.equal(rows[1].values.L, "");
});
