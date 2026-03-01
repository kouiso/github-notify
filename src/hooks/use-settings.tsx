import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { getAppSettings, saveAppSettings } from '@/lib/tauri/commands';
import { logger } from '@/lib/utils/logger';
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  migrateDefaultFilters,
  type NotificationReason,
  PRESETS,
} from '@/types';

interface SettingsContextValue {
  settings: AppSettings;
  isLoading: boolean;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  getActiveReasons: () => NotificationReason[];
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    // Check if we're in Tauri context
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      setIsLoading(false);
      return;
    }

    getAppSettings()
      .then(async (loaded) => {
        // Migrate: ensure all default filters exist for existing users
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

  // Update settings
  const updateSettings = useCallback(
    async (updates: Partial<AppSettings>) => {
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);

      // Check if we're in Tauri context
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        try {
          await saveAppSettings(newSettings);
        } catch (err) {
          logger.error('Failed to save settings', err);
        }
      }
    },
    [settings],
  );

  // Get active notification reasons based on preset or custom selection
  const getActiveReasons = useCallback((): NotificationReason[] => {
    if (settings.notificationPreset === 'custom') {
      return settings.customReasons;
    }
    const preset = PRESETS.find((p) => p.id === settings.notificationPreset);
    return preset?.reasons || [];
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSettings, getActiveReasons }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
