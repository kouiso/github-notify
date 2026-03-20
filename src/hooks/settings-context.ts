import { createContext } from 'react';
import type { AppSettings } from '@/types';

export interface SettingsContextValue {
  settings: AppSettings;
  isLoading: boolean;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);
