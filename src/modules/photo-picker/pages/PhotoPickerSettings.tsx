import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { useAppStore } from "@/core/stores/useAppStore";
import { useTranslation } from "@/core/lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import {
  Hash,
  FolderOutput,
  Copy,
  FolderTree,
  Save,
} from "lucide-react";
import type { AppSettings } from "@/core/types";


export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const { t } = useTranslation();



  const handleSave = async () => {
    try {
      await invoke("save_settings", { settings });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("settings")}</h2>
          <button onClick={handleSave} className="btn-primary text-xs py-1.5">
            <Save size={14} />
            {t("save_settings")}
          </button>
        </div>



        {/* Default Match Mode */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Hash size={16} />
            {t("default_match_mode")}
          </div>
          <select
            className="input-field cursor-pointer"
            value={settings.default_match_mode}
            onChange={(e) => updateSetting("default_match_mode", e.target.value)}
          >
            <option value="ExactNumber">{t("exact_number")}</option>
            <option value="Contains">{t("contains")}</option>
            <option value="Regex">{t("regex")}</option>
          </select>
        </div>

        {/* Default Output (PRO Feature) */}
        <div
          className="panel p-4 space-y-3 opacity-60 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => alert("Vui lòng liên hệ nhà cung cấp để sử dụng tính năng trả phí qua Zalo: 0869528304")}
        >
          <div className="flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FolderOutput size={16} />
              {t("default_output_folder")}
            </div>
            <span className="bg-warning/20 text-warning text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider">
              PRO
            </span>
          </div>
          <input
            type="text"
            className="input-field cursor-pointer opacity-50 pointer-events-none"
            value=""
            readOnly
            placeholder="Tính năng trả phí"
          />
        </div>

        {/* Default Duplicate Policy */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Copy size={16} />
            {t("default_duplicate_policy")}
          </div>
          <select
            className="input-field cursor-pointer"
            value={settings.default_duplicate_policy}
            onChange={(e) => updateSetting("default_duplicate_policy", e.target.value)}
          >
            <option value="CopyFirst">{t("copy_first")}</option>
            <option value="CopyAll">{t("copy_all")}</option>
            <option value="RenameAutomatically">{t("rename_auto")}</option>
            <option value="Skip">{t("skip")}</option>
          </select>
        </div>

        {/* Preserve Folder Structure */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FolderTree size={16} />
            {t("preserve_folder")}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.default_preserve_folder}
              onChange={(e) =>
                updateSetting("default_preserve_folder", e.target.checked)
              }
              className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">
              {t("maintain_hierarchy")}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
