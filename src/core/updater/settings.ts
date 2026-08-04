import { useSettingsStore } from '@/core/stores/useSettingsStore';

export interface UpdaterSettings {
  autoCheck: boolean;
  autoDownload: boolean;
  installOnExit: boolean;
  betaChannel: boolean;
}

export function getUpdaterSettings(): UpdaterSettings {
  const settings = useSettingsStore.getState().settings;
  return {
    autoCheck: settings.auto_check_updates,
    autoDownload: settings.auto_download_updates,
    installOnExit: settings.install_on_exit,
    betaChannel: settings.beta_channel,
  };
}

export function setUpdaterSetting(key: keyof UpdaterSettings, value: boolean): void {
  const storeKey = 
    key === 'autoCheck' ? 'auto_check_updates' :
    key === 'autoDownload' ? 'auto_download_updates' :
    key === 'installOnExit' ? 'install_on_exit' :
    'beta_channel';
    
  useSettingsStore.getState().updateSetting(storeKey, value);
}
