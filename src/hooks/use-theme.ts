import { useEffect, useMemo } from 'react';
import type { Theme } from '@/types';
import { useSettings } from './use-settings-hook';

function prefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const { settings, updateSettings } = useSettings();

  const effectiveTheme = useMemo(() => {
    if (settings.theme === 'system') {
      return prefersDark() ? 'dark' : 'light';
    }
    return settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  // systemモード時にOS側のテーマ変更を検知して即反映する
  useEffect(() => {
    if (settings.theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      if (e.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [settings.theme]);

  const setTheme = async (theme: Theme) => {
    await updateSettings({ theme });
  };

  return {
    theme: settings.theme,
    effectiveTheme,
    setTheme,
  };
}
