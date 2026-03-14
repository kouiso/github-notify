import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@/types';

// Tauriコマンドのモック関数
const mockGetAppSettings = vi.fn<() => Promise<AppSettings>>();
const mockSaveAppSettings = vi.fn<(settings: AppSettings) => Promise<void>>();

vi.mock('@/lib/tauri/commands', () => ({
  getAppSettings: (...args: Parameters<typeof mockGetAppSettings>) => mockGetAppSettings(...args),
  saveAppSettings: (...args: Parameters<typeof mockSaveAppSettings>) =>
    mockSaveAppSettings(...args),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// vi.mock は巻き上げされるため、インポートはモック宣言の後に置く
import { SettingsProvider, useSettings } from '@/hooks/use-settings';
import { DEFAULT_INITIAL_FILTERS, DEFAULT_SETTINGS } from '@/types';

// SettingsProvider をラッパーとして提供するヘルパー
function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SettingsProvider>{children}</SettingsProvider>;
  };
}

// jsdom 環境で `'__TAURI_INTERNALS__' in window` を true にする。
// Object.defineProperty は一度設定したプロパティを再定義できないため、
// テストファイルのモジュールスコープで1回だけ設定する。
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {},
  writable: false,
  configurable: false,
});

// マイグレーション不要な完全な設定（テストのベースライン）
const migrationCompleteSettings: AppSettings = {
  ...DEFAULT_SETTINGS,
  customFilters: DEFAULT_INITIAL_FILTERS,
};

describe('useSettings / SettingsProvider', () => {
  describe('初期設定の読み込み（Tauri環境）', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('マウント時に getAppSettings が呼ばれる', async () => {
      mockGetAppSettings.mockResolvedValue(migrationCompleteSettings);

      renderHook(() => useSettings(), { wrapper: createWrapper() });

      await waitFor(() => expect(mockGetAppSettings).toHaveBeenCalledTimes(1));
    });

    it('取得した設定が state にセットされる', async () => {
      const customSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        theme: 'dark',
        customFilters: DEFAULT_INITIAL_FILTERS,
      };
      mockGetAppSettings.mockResolvedValue(customSettings);

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.settings.theme).toBe('dark');
    });

    it('読み込み中は isLoading が true', () => {
      // 解決しない Promise で読み込み中状態を維持
      // eslint-disable は使わず、空ブロックの代わりに noop 関数を渡す
      mockGetAppSettings.mockReturnValue(
        new Promise((_resolve) => {
          /* 意図的に解決しない */
        }),
      );

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('読み込み完了後に isLoading が false になる', async () => {
      mockGetAppSettings.mockResolvedValue(migrationCompleteSettings);

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('getAppSettings がエラーを投げても isLoading が false になる', async () => {
      mockGetAppSettings.mockRejectedValue(new Error('load error'));

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it('getAppSettings がエラーを投げると DEFAULT_SETTINGS のままになる', async () => {
      mockGetAppSettings.mockRejectedValue(new Error('load error'));

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('migrateDefaultFilters の呼び出し', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSaveAppSettings.mockResolvedValue(undefined);
    });

    it('旧デフォルトIDが残っている場合、saveAppSettings が呼ばれる', async () => {
      // 旧デフォルトIDを含む設定（マイグレーション対象）
      const outdatedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        customFilters: [
          {
            id: 'default-review',
            name: '旧レビュー依頼',
            reasons: ['review_requested'],
            enableDesktopNotification: true,
            enableSound: true,
            soundType: 'default',
          },
        ],
      };
      mockGetAppSettings.mockResolvedValue(outdatedSettings);

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockSaveAppSettings).toHaveBeenCalledTimes(1);
    });

    it('マイグレーション後の設定が state にセットされ、新デフォルトIDが含まれる', async () => {
      const outdatedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        customFilters: [
          {
            id: 'default-review',
            name: '旧レビュー依頼',
            reasons: ['review_requested'],
            enableDesktopNotification: true,
            enableSound: true,
            soundType: 'default',
          },
        ],
      };
      mockGetAppSettings.mockResolvedValue(outdatedSettings);

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const filterIds = result.current.settings.customFilters.map((f) => f.id);
      expect(filterIds).toContain('default-important');
      expect(filterIds).toContain('default-needs-review');
      expect(filterIds).toContain('default-my-prs');
    });

    it('マイグレーション不要な場合、saveAppSettings が呼ばれない', async () => {
      mockGetAppSettings.mockResolvedValue(migrationCompleteSettings);

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockSaveAppSettings).not.toHaveBeenCalled();
    });

    it('saveAppSettings がエラーを投げてもクラッシュせず isLoading が false になる', async () => {
      // customFilters が空なのでマイグレーションが発生する
      const outdatedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        customFilters: [],
      };
      mockGetAppSettings.mockResolvedValue(outdatedSettings);
      mockSaveAppSettings.mockRejectedValue(new Error('save error'));

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('設定の更新（updateSettings）', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockGetAppSettings.mockResolvedValue(migrationCompleteSettings);
      mockSaveAppSettings.mockResolvedValue(undefined);
    });

    it('updateSettings で settings が更新される', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateSettings({ theme: 'light' });
      });

      expect(result.current.settings.theme).toBe('light');
    });

    it('updateSettings は既存設定とマージされる（部分更新）', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateSettings({ theme: 'dark' });
      });

      // theme 以外の値は元のまま保持される
      expect(result.current.settings.desktopNotifications).toBe(
        migrationCompleteSettings.desktopNotifications,
      );
    });

    it('Tauri環境では updateSettings 時に saveAppSettings が呼ばれる', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateSettings({ theme: 'dark' });
      });

      expect(mockSaveAppSettings).toHaveBeenCalledTimes(1);
    });

    it('saveAppSettings に更新後の全設定が渡される', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateSettings({ theme: 'dark' });
      });

      const savedSettings = mockSaveAppSettings.mock.calls[0][0];
      expect(savedSettings.theme).toBe('dark');
    });

    it('saveAppSettings がエラーを投げてもクラッシュしない', async () => {
      mockSaveAppSettings.mockRejectedValue(new Error('save error'));

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await expect(
        act(async () => {
          await result.current.updateSettings({ theme: 'dark' });
        }),
      ).resolves.not.toThrow();
    });

    it('saveAppSettings がエラーを投げても settings は更新済みのまま', async () => {
      mockSaveAppSettings.mockRejectedValue(new Error('save error'));

      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateSettings({ theme: 'dark' });
      });

      // 保存失敗でも state の更新は反映される
      expect(result.current.settings.theme).toBe('dark');
    });
  });

  describe('SettingsProvider なしでの useSettings 呼び出し', () => {
    it('SettingsProvider なしで useSettings を呼ぶとエラーが投げられる', () => {
      // React の内部エラー出力を抑制
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation((_msg) => {
        /* 意図的に抑制 */
      });

      expect(() => {
        renderHook(() => useSettings());
      }).toThrow('useSettings must be used within a SettingsProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('返り値の構造', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockGetAppSettings.mockResolvedValue(migrationCompleteSettings);
    });

    it('必要なプロパティとメソッドが全て返される', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current).toHaveProperty('settings');
      expect(result.current).toHaveProperty('isLoading');
      expect(typeof result.current.updateSettings).toBe('function');
    });
  });
});
