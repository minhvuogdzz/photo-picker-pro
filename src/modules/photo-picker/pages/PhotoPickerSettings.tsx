import { useSettingsStore } from "@/core/stores/useSettingsStore";
import { useTranslation } from "@/core/lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import {
  Hash,
  FolderOutput,
  Copy,
  FolderTree,
  Save,
} from "lucide-react";

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const { t } = useTranslation();

  const handleSave = async () => {
    try {
      await invoke("save_settings", { settings });
      alert(t("settings_saved") || "Đã lưu cài đặt");
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-5 animate-fade-in flex items-start justify-center custom-scrollbar">
      <div className="max-w-xl w-full space-y-4 py-2">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div>
            <h2 className="text-sm font-bold text-foreground">{t("settings")}</h2>
            <p className="text-[11px] text-muted-foreground">Cấu hình thuật toán quét và sao chép ảnh</p>
          </div>
          <button onClick={handleSave} className="btn-primary text-xs py-1.5 px-3 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer">
            <Save size={13} />
            {t("save_settings")}
          </button>
        </div>

        {/* Default Match Mode */}
        <div className="bg-card rounded-xl p-3.5 border border-border shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Hash size={14} className="text-primary" />
            {t("default_match_mode")}
          </div>
          <select
            className="w-full bg-muted/50 border border-border text-foreground py-1.5 px-2.5 rounded-lg text-xs font-medium outline-none focus:border-primary/50 cursor-pointer"
            value={settings.default_match_mode}
            onChange={(e) => updateSetting("default_match_mode", e.target.value)}
          >
            <option value="ExactNumber" className="bg-card text-foreground">{t("exact_number")}</option>
            <option value="Contains" className="bg-card text-foreground">{t("contains")}</option>
            <option value="Regex" className="bg-card text-foreground">{t("regex")}</option>
          </select>
        </div>

        {/* Default Output (PRO Feature) */}
        <div
          className="bg-card rounded-xl p-3.5 border border-border shadow-xs space-y-2 opacity-75 cursor-pointer hover:opacity-100 transition-opacity"
          onClick={() => alert("Vui lòng liên hệ nhà cung cấp để sử dụng tính năng trả phí qua Zalo: 0869528304")}
        >
          <div className="flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <FolderOutput size={14} className="text-amber-500" />
              {t("default_output_folder")}
            </div>
            <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-bold tracking-wider border border-amber-500/30">
              PRO
            </span>
          </div>
          <input
            type="text"
            className="w-full bg-muted/40 border border-border text-foreground py-1.5 px-2.5 rounded-lg text-xs opacity-70 pointer-events-none cursor-pointer"
            value=""
            readOnly
            placeholder="Tính năng tự động đồng bộ theo Studio"
          />
        </div>

        {/* Default Duplicate Policy */}
        <div className="bg-card rounded-xl p-3.5 border border-border shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Copy size={14} className="text-primary" />
            {t("default_duplicate_policy")}
          </div>
          <select
            className="w-full bg-muted/50 border border-border text-foreground py-1.5 px-2.5 rounded-lg text-xs font-medium outline-none focus:border-primary/50 cursor-pointer"
            value={settings.default_duplicate_policy}
            onChange={(e) => updateSetting("default_duplicate_policy", e.target.value)}
          >
            <option value="CopyFirst" className="bg-card text-foreground">{t("copy_first")}</option>
            <option value="CopyAll" className="bg-card text-foreground">{t("copy_all")}</option>
            <option value="RenameAutomatically" className="bg-card text-foreground">{t("rename_auto")}</option>
            <option value="Skip" className="bg-card text-foreground">{t("skip")}</option>
          </select>
        </div>

        {/* Preserve Folder Structure */}
        <div className="bg-card rounded-xl p-3.5 border border-border shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <FolderTree size={14} className="text-primary" />
            {t("preserve_folder")}
          </div>
          <label className="flex items-center gap-2 cursor-pointer pt-0.5">
            <input
              type="checkbox"
              checked={settings.default_preserve_folder}
              onChange={(e) =>
                updateSetting("default_preserve_folder", e.target.checked)
              }
              className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer"
            />
            <span className="text-xs text-muted-foreground">
              {t("maintain_hierarchy")}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
