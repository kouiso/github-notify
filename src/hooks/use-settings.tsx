import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { getAppSettings, saveAppSettings } from '@/lib/tauri/commands';
import { configureRemoteErrorReporting, logger } from '@/lib/utils/logger';
import { type AppSettings, DEFAULT_SETTINGS, migrateDefaultFilters } from '@/types';
import { SettingsContext } from './settings-context';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    configureRemoteErrorReporting({ enabled: settings.errorReportingEnabled ?? false });
  }, [settings.errorReportingEnabled]);

  useEffect(() => {
    // Tauri環境外ではスキップ（ブラウザプレビュー対応）
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      setIsLoading(false);
      return;
    }

    getAppSettings()
      .then(async (loaded) => {
        // 既存ユーザー向けにデフォルトフィルタの追加漏れを補完する
        const { filters, changed } = migrateDefaultFilters(loaded.customFilters);
        if (changed) {
          loaded.customFilters = filters;
          try {
            await saveAppSettings(loaded);
          } catch (err) {
            logger.error('Failed to save migrated settings', err);
          }
        }
        setSettings(loaded);
      })
      .catch((err) => {
        logger.error('Failed to load settings', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const updateSettings = useCallback(
    async (updates: Partial<AppSettings>) => {
      const previousSettings = settings;
      const newSettings = { ...previousSettings, ...updates };
      setSaveError(null);
      setSettings(newSettings);

      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        try {
          await saveAppSettings(newSettings);
        } catch (err) {
          setSettings((current) => (current === newSettings ? previousSettings : current));
          setSaveError('保存に失敗しました - 再試行してください');
          logger.error('Failed to save settings', err);
        }
      }
    },
    [settings],
  );

  return (
    <SettingsContext.Provider value={{ settings, isLoading, saveError, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
