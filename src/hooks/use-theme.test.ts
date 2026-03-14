import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// useSettings をモック
const mockUpdateSettings = vi.fn().mockResolvedValue(undefined);
let mockTheme: 'light' | 'dark' | 'system' = 'light';

vi.mock('@/hooks/use-settings', () => ({
  useSettings: () => ({
    settings: { theme: mockTheme },
    updateSettings: mockUpdateSettings,
  }),
}));

import { useTheme } from '@/hooks/use-theme';

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = 'light';
    document.documentElement.classList.remove('dark');
  });

  describe('effectiveTheme 計算', () => {
    it('theme が light のとき effectiveTheme は light', () => {
      mockTheme = 'light';
      const { result } = renderHook(() => useTheme());
      expect(result.current.effectiveTheme).toBe('light');
    });

    it('theme が dark のとき effectiveTheme は dark', () => {
      mockTheme = 'dark';
      const { result } = renderHook(() => useTheme());
      expect(result.current.effectiveTheme).toBe('dark');
    });

    it('theme が system でダークモード優先のとき effectiveTheme は dark', () => {
      mockTheme = 'system';
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useTheme());
      expect(result.current.effectiveTheme).toBe('dark');
    });

    it('theme が system でライトモード優先のとき effectiveTheme は light', () => {
      mockTheme = 'system';
      vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useTheme());
      expect(result.current.effectiveTheme).toBe('light');
    });
  });

  describe('DOM クラス操作', () => {
    it('dark テーマで document に .dark クラスが付与される', () => {
      mockTheme = 'dark';
      renderHook(() => useTheme());
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('light テーマで document から .dark クラスが除去される', () => {
      document.documentElement.classList.add('dark');
      mockTheme = 'light';
      renderHook(() => useTheme());
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('setTheme', () => {
    it('setTheme で updateSettings が呼ばれる', async () => {
      mockTheme = 'light';
      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme('dark');
      });

      expect(mockUpdateSettings).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('setTheme は関数として提供される', () => {
      const { result } = renderHook(() => useTheme());
      expect(typeof result.current.setTheme).toBe('function');
    });
  });

  describe('システムテーマ変更リスナー', () => {
    it('system モードのとき matchMedia の change リスナーが登録される', () => {
      mockTheme = 'system';
      const addEventListenerSpy = vi.fn();
      const removeEventListenerSpy = vi.fn();

      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: addEventListenerSpy,
        removeEventListener: removeEventListenerSpy,
        dispatchEvent: vi.fn(),
      }));

      const { unmount } = renderHook(() => useTheme());

      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));

      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('system 以外のモードではリスナーが登録されない', () => {
      mockTheme = 'dark';
      const addEventListenerSpy = vi.fn();

      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: addEventListenerSpy,
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      renderHook(() => useTheme());

      expect(addEventListenerSpy).not.toHaveBeenCalled();
    });

    it('OS がダークモードに変わったとき .dark クラスが付与される', () => {
      mockTheme = 'system';
      // change イベントのハンドラを取得するためリスナーを捕捉する
      let capturedHandler: ((e: MediaQueryListEvent) => void) | null = null;

      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event, handler) => {
          if (event === 'change') {
            capturedHandler = handler as (e: MediaQueryListEvent) => void;
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      renderHook(() => useTheme());

      expect(capturedHandler).not.toBeNull();

      // OS がダークモードに変わったイベントを発火
      act(() => {
        capturedHandler!({ matches: true } as MediaQueryListEvent);
      });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('OS がライトモードに変わったとき .dark クラスが除去される', () => {
      mockTheme = 'system';
      document.documentElement.classList.add('dark');
      let capturedHandler: ((e: MediaQueryListEvent) => void) | null = null;

      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event, handler) => {
          if (event === 'change') {
            capturedHandler = handler as (e: MediaQueryListEvent) => void;
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      renderHook(() => useTheme());

      expect(capturedHandler).not.toBeNull();

      // OS がライトモードに変わったイベントを発火
      act(() => {
        capturedHandler!({ matches: false } as MediaQueryListEvent);
      });

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('返り値', () => {
    it('theme, effectiveTheme, setTheme を返す', () => {
      mockTheme = 'light';
      const { result } = renderHook(() => useTheme());

      expect(result.current).toHaveProperty('theme', 'light');
      expect(result.current).toHaveProperty('effectiveTheme', 'light');
      expect(result.current).toHaveProperty('setTheme');
    });
  });
});
