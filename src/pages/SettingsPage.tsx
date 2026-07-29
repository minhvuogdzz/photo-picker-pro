import { useSettingsStore } from "@/stores/useSettingsStore";
import { useAppStore } from "@/stores/useAppStore";
import { useTranslation } from "@/lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import {
  Sun,
  Moon,
  Globe,
  Hash,
  FolderOutput,
  Copy,
  FolderTree,
  Save,
  DownloadCloud,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { AppSettings } from "@/types";
import { UpdateDialog } from "@/components/updater";
import { checkForUpdates, UpdateCheckResult } from "@/updater";
import { useState } from "react";

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const { t } = useTranslation();

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [manualUpdateResult, setManualUpdateResult] = useState<UpdateCheckResult | null>(null);

  const handleManualUpdateCheck = async () => {
    setIsCheckingUpdate(true);
    try {
      const result = await checkForUpdates();
      if (!result.hasUpdate) {
        alert("Bạn đang sử dụng phiên bản mới nhất!");
      } else {
        setManualUpdateResult(result);
      }
    } catch (err) {
      alert("Không thể kiểm tra cập nhật lúc này. Lỗi: " + String(err));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

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

        {/* Theme */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {settings.theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            {t("theme")}
          </div>
          <div className="flex gap-2">
            {["dark", "light"].map((theme) => (
              <button
                key={theme}
                onClick={() => updateSetting("theme", theme)}
                className={`btn text-xs py-1.5 px-4 capitalize cursor-pointer ${settings.theme === theme ? "btn-primary" : "btn-outline"
                  }`}
              >
                {theme === "dark" ? <Moon size={12} /> : <Sun size={12} />}
                {theme === "dark" ? t("dark") : t("light")}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="panel p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Globe size={16} />
            {t("language")}
          </div>
          <select
            className="input-field cursor-pointer"
            value={settings.language}
            onChange={(e) => updateSetting("language", e.target.value)}
          >
            <option value="en">English</option>
            <option value="vi">Tiếng Việt</option>
          </select>
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

        {/* Updates */}
        <div className="panel p-4 space-y-3 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between text-sm font-medium">
            <div className="flex items-center gap-2">
              <DownloadCloud size={16} className="text-blue-500" />
              Cập nhật Ứng dụng
            </div>
            <button
              onClick={handleManualUpdateCheck}
              disabled={isCheckingUpdate}
              className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              {isCheckingUpdate ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Kiểm tra cập nhật
            </button>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Tự động kiểm tra bản cập nhật mới
              </span>
              <input
                type="checkbox"
                checked={settings.auto_check_updates}
                onChange={(e) => updateSetting("auto_check_updates", e.target.checked)}
                className="w-4 h-4 rounded border-border accent-blue-600 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Tự động tải xuống khi có bản cập nhật
              </span>
              <input
                type="checkbox"
                checked={settings.auto_download_updates}
                onChange={(e) => updateSetting("auto_download_updates", e.target.checked)}
                className="w-4 h-4 rounded border-border accent-blue-600 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer opacity-50">
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Nhận bản cập nhật thử nghiệm (Beta)
              </span>
              <input
                type="checkbox"
                checked={settings.beta_channel}
                disabled
                onChange={(e) => updateSetting("beta_channel", e.target.checked)}
                className="w-4 h-4 rounded border-border accent-blue-600 cursor-not-allowed"
              />
            </label>
          </div>
        </div>
      </div>

      {manualUpdateResult && (
        <UpdateDialog
          updateResult={manualUpdateResult}
          onClose={() => setManualUpdateResult(null)}
          onSkip={() => setManualUpdateResult(null)}
        />
      )}
    </div>
  );
}
