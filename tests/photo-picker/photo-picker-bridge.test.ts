import { test } from "node:test";
import assert from "node:assert/strict";
import { useAuthStore } from "../../src/core/stores/useAuthStore.ts";
import { useAppStore } from "../../src/core/stores/useAppStore.ts";
import { useSettingsStore } from "../../src/core/stores/useSettingsStore.ts";
import { useContactSheetStore } from "../../src/modules/contact-the-sheet/stores/useContactSheetStore.ts";
import { BridgeError } from "../../src/modules/contact-the-sheet/services/contactSheetBridge.ts";
import {
  handlePhotoPickerBridgeRequest,
  setPhotoPickerBridgeRuntime,
  type PhotoPickerBridgeContext,
  type PhotoPickerRuntime,
} from "../../src/modules/photo-picker/services/photoPickerBridge.ts";
import type { CopyResult, CustomerCode, MatchResult, PhotoFile, ScanResult } from "../../src/core/types/index.ts";

function setAuthenticatedPhotoPickerSession() {
  useAuthStore.setState({
    isLoading: false,
    session: {
      userId: "user_pp_1",
      email: "picker@devhouse.vn",
      name: "Photo Picker Tester",
      role: "ADMIN",
      accessToken: "token",
      refreshToken: "refresh",
      deviceId: "dev_pp_1",
      subscription: {
        status: "LIFETIME",
        plan: "FULL_APP",
        expiresAt: null,
        daysRemaining: null,
      },
      entitlements: [{ app: "photo-picker", isTrial: false, expiresAt: null }],
    } as any,
  });
}

function resetStores() {
  useAppStore.getState().resetAll();
  useSettingsStore.setState({
    settings: {
      ...useSettingsStore.getState().settings,
      default_output: "/tmp/studio-out",
    },
  });
  useContactSheetStore.setState({
    profiles: [],
    activeProfile: null,
  });
}

function makeFakeRuntime(calls: Array<{ cmd: string; args?: Record<string, unknown> }>): PhotoPickerRuntime {
  const sampleFiles: PhotoFile[] = [
    {
      full_path: "/tmp/cust/IMG_1001.CR3",
      filename: "IMG_1001.CR3",
      extension: "cr3",
      folder: "/tmp/cust",
      size: 1024,
      normalized_number: "1001",
    },
    {
      full_path: "/tmp/cust/IMG_1002.CR3",
      filename: "IMG_1002.CR3",
      extension: "cr3",
      folder: "/tmp/cust",
      size: 1024,
      normalized_number: "1002",
    },
  ];

  return {
    async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
      calls.push({ cmd, args });
      switch (cmd) {
        case "load_settings":
          return useSettingsStore.getState().settings as T;
        case "save_settings":
          return undefined as T;
        case "parse_customer_codes": {
          const input = String(args?.input ?? "");
          const lines = input.split("\n").map((s) => s.trim()).filter(Boolean);
          const codes: CustomerCode[] = lines.map((raw) => ({
            raw,
            normalized: raw.replace(/\D/g, ""),
          }));
          return codes as T;
        }
        case "scan_folders": {
          const res: ScanResult = {
            files: sampleFiles,
            total_files: sampleFiles.length,
            total_folders: 1,
            elapsed_ms: 12,
          };
          return res as T;
        }
        case "match_photos": {
          const codes = (args?.codes as CustomerCode[]) || [];
          const files = (args?.files as PhotoFile[]) || [];
          const seen = new Set<string>();
          let found = 0;
          let missing = 0;
          let dup = 0;
          const matches = codes.map((c) => {
            if (seen.has(c.normalized)) {
              dup++;
              return { code: c.raw, photo: null, status: "InputDuplicate" as const, all_matches: [] };
            }
            seen.add(c.normalized);
            const hit = files.find((f) => f.normalized_number === c.normalized);
            if (hit) {
              found++;
              return { code: c.raw, photo: hit, status: "Found" as const, all_matches: [hit] };
            }
            missing++;
            return { code: c.raw, photo: null, status: "Missing" as const, all_matches: [] };
          });
          const res: MatchResult = {
            matches,
            found_count: found,
            missing_count: missing,
            duplicate_count: dup,
            total_codes: codes.length,
          };
          return res as T;
        }
        case "copy_files": {
          const res: CopyResult = {
            success_count: 1,
            error_count: 0,
            skipped_count: 0,
            errors: [],
          };
          return res as T;
        }
        case "export_log":
          return undefined as T;
        default:
          throw new Error(`Unexpected command: ${cmd}`);
      }
    },
    async listen() {
      return () => {};
    },
  };
}

test("photo_picker bridge: get_context reports unauthenticated cleanly without throwing", async () => {
  resetStores();
  useAuthStore.setState({ isLoading: false, session: null });
  const calls: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
  setPhotoPickerBridgeRuntime(makeFakeRuntime(calls));

  try {
    const ctx = (await handlePhotoPickerBridgeRequest(
      "photo_picker.get_context",
      {}
    )) as PhotoPickerBridgeContext;

    assert.equal(ctx.authenticated, false);
    assert.equal(ctx.hasAccess, false);
    assert.equal(ctx.outputFolder, "/tmp/studio-out");
  } finally {
    setPhotoPickerBridgeRuntime(null);
  }
});

test("photo_picker bridge: single-customer pre-scan -> paste/set_codes instant RAM match -> options -> copy -> export", async () => {
  resetStores();
  setAuthenticatedPhotoPickerSession();
  const calls: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
  setPhotoPickerBridgeRuntime(makeFakeRuntime(calls));

  try {
    // 1. Set single customer folder
    const folderCtx = (await handlePhotoPickerBridgeRequest("photo_picker.set_folder", {
      folderPath: "/tmp/cust",
    })) as PhotoPickerBridgeContext;
    assert.equal(folderCtx.folderPath, "/tmp/cust");
    assert.equal(folderCtx.folderName, "cust");
    assert.equal(useAppStore.getState().pickerMode, "single");

    // 2. Pre-scan folder with empty codes (Option 1 workflow)
    const preScan = (await handlePhotoPickerBridgeRequest(
      "photo_picker.scan_and_match",
      {}
    )) as PhotoPickerBridgeContext & { elapsedMs: number };
    assert.equal(preScan.scannedFilesCount, 2);
    assert.equal(preScan.phase, "scanned");
    assert.equal(preScan.matchResult, null);

    // 3. Format pasted messy codes using DH Studio Pro's exact formatter
    const formatted = (await handlePhotoPickerBridgeRequest("photo_picker.format_codes", {
      text: "IMG_1001-1001, 9999",
    })) as { formatted: string };
    assert.equal(formatted.formatted, "IMG_1001\n1001\n9999");

    // 4. Set codes -> instant in-memory RAM match without re-scanning disk!
    const scanCallsBefore = calls.filter((c) => c.cmd === "scan_folders").length;
    const setCodesRes = (await handlePhotoPickerBridgeRequest("photo_picker.set_codes", {
      rawCodeInput: "1001\n1001\n9999",
    })) as {
      parsedCodeCount: number;
      phase: string;
      matchResult: MatchResult;
      lineAnalysis: PhotoPickerBridgeContext["lineAnalysis"];
    };
    const scanCallsAfter = calls.filter((c) => c.cmd === "scan_folders").length;
    assert.equal(scanCallsAfter, scanCallsBefore, "must re-match in RAM without re-scanning disk");
    assert.equal(setCodesRes.parsedCodeCount, 3);
    assert.equal(setCodesRes.phase, "matched");
    assert.equal(setCodesRes.matchResult.found_count, 1);
    assert.equal(setCodesRes.matchResult.missing_count, 1);
    assert.equal(setCodesRes.matchResult.duplicate_count, 1);
    assert.equal(setCodesRes.lineAnalysis.missingLineCount, 1);
    assert.equal(setCodesRes.lineAnalysis.duplicateLineCount, 2);

    // 5. Update options (outputFolder persists via save_settings)
    const optCtx = (await handlePhotoPickerBridgeRequest("photo_picker.set_options", {
      matchMode: "Contains",
      outputFolder: "/tmp/new-out",
      inheritExtensionEnabled: true,
      inheritedExtensions: ["cr3", "jpg"],
    })) as PhotoPickerBridgeContext;
    assert.equal(optCtx.matchMode, "Contains");
    assert.equal(optCtx.outputFolder, "/tmp/new-out");
    assert.equal(optCtx.inheritExtensionEnabled, true);
    assert.deepEqual(optCtx.inheritedExtensions, ["cr3", "jpg"]);
    assert.ok(calls.some((c) => c.cmd === "save_settings"));

    // 6. Copy matched files
    const copyRes = (await handlePhotoPickerBridgeRequest("photo_picker.copy", {
      operation: "Copy",
      updateSheetStatus: false,
    })) as { copyResult: CopyResult; context: PhotoPickerBridgeContext };
    assert.equal(copyRes.copyResult.success_count, 1);
    assert.equal(copyRes.context.phase, "done");

    // 7. Export report
    const exportRes = (await handlePhotoPickerBridgeRequest("photo_picker.export_report", {
      format: "csv",
      outputPath: "/tmp/report.csv",
    })) as { outputPath: string };
    assert.equal(exportRes.outputPath, "/tmp/report.csv");
    assert.ok(calls.some((c) => c.cmd === "export_log"));
  } finally {
    setPhotoPickerBridgeRuntime(null);
  }
});

test("photo_picker bridge: unknown action throws BridgeError UNKNOWN_ACTION", async () => {
  resetStores();
  setAuthenticatedPhotoPickerSession();
  setPhotoPickerBridgeRuntime(makeFakeRuntime([]));

  try {
    await assert.rejects(
      () => handlePhotoPickerBridgeRequest("photo_picker.does_not_exist", {}),
      (err: unknown) => err instanceof BridgeError && err.code === "UNKNOWN_ACTION"
    );
  } finally {
    setPhotoPickerBridgeRuntime(null);
  }
});
