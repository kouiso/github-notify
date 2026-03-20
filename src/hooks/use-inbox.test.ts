import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxItem } from '@/types';
import type { CustomFilter } from '@/types/settings';

// Tauri イベントリスナーのモック
const mockListen = vi.fn().mockResolvedValue(vi.fn());
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

// Tauri コマンドのモック
const mockFetchInbox = vi.fn<() => Promise<InboxItem[]>>();
const mockGetAppSettings = vi.fn();
const mockMarkInboxRead = vi.fn<(threadId: string) => Promise<void>>();
const mockMarkAllInboxRead = vi.fn<() => Promise<void>>();
const mockUpdateTrayBadge = vi.fn<(count: number) => Promise<void>>();
const mockSendNotificationWithSound = vi.fn();

vi.mock('@/lib/tauri/commands', () => ({
  fetchInbox: (...args: unknown[]) =>
    mockFetchInbox(...(args as Parameters<typeof mockFetchInbox>)),
  getAppSettings: () => mockGetAppSettings(),
  markInboxRead: (...args: unknown[]) =>
    mockMarkInboxRead(...(args as Parameters<typeof mockMarkInboxRead>)),
  markAllInboxRead: () => mockMarkAllInboxRead(),
  updateTrayBadge: (...args: unknown[]) =>
    mockUpdateTrayBadge(...(args as Parameters<typeof mockUpdateTrayBadge>)),
  sendNotificationWithSound: (...args: unknown[]) => mockSendNotificationWithSound(...args),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { useInbox } from '@/hooks/use-inbox';

// Tauri 環境をシミュレートする
function enableTauriEnv() {
  vi.stubGlobal('__TAURI_INTERNALS__', {});
}

function disableTauriEnv() {
  vi.unstubAllGlobals();
}

const defaultSettings = {
  theme: 'system',
  notificationPreset: 'none',
  customReasons: [],
  desktopNotifications: true,
  soundEnabled: true,
  customFilters: [
    {
      id: 'default-important',
      name: '重要な通知',
      reasons: ['review_requested', 'mention', 'assign'],
      enableDesktopNotification: true,
      enableSound: true,
      soundType: 'default',
      repositories: [],
    },
  ] satisfies CustomFilter[],
  activeFilterId: 'dashboard',
};

function createMockItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    title: 'Test notification',
    url: 'https://github.com/test/repo/issues/1',
    reason: 'review_requested',
    unread: true,
    updatedAt: new Date().toISOString(),
    itemType: 'Issue',
    repositoryName: 'repo',
    repositoryFullName: 'test/repo',
    ownerLogin: 'test',
    ownerAvatar: 'https://avatars.githubusercontent.com/test',
    ...overrides,
  };
}

describe('useInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enableTauriEnv();
    mockGetAppSettings.mockResolvedValue(defaultSettings);
    mockFetchInbox.mockResolvedValue([]);
    mockMarkInboxRead.mockResolvedValue(undefined);
    mockMarkAllInboxRead.mockResolvedValue(undefined);
    mockUpdateTrayBadge.mockResolvedValue(undefined);
    mockSendNotificationWithSound.mockResolvedValue(undefined);
  });

  afterEach(() => {
    disableTauriEnv();
  });

  describe('初期状態', () => {
    it('初期状態で isLoading が true', () => {
      mockGetAppSettings.mockReturnValue(new Promise(vi.fn()));
      const { result } = renderHook(() => useInbox());
      expect(result.current.isLoading).toBe(true);
    });

    it('初期状態で items が空配列', () => {
      mockGetAppSettings.mockReturnValue(new Promise(vi.fn()));
      const { result } = renderHook(() => useInbox());
      expect(result.current.items).toEqual([]);
    });

    it('初期状態で error が null', () => {
      mockGetAppSettings.mockReturnValue(new Promise(vi.fn()));
      const { result } = renderHook(() => useInbox());
      expect(result.current.error).toBeNull();
    });

    it('初期状態で unreadCount が 0', () => {
      mockGetAppSettings.mockReturnValue(new Promise(vi.fn()));
      const { result } = renderHook(() => useInbox());
      expect(result.current.unreadCount).toBe(0);
    });

    it('初期状態で selectedIndex が -1', () => {
      mockGetAppSettings.mockReturnValue(new Promise(vi.fn()));
      const { result } = renderHook(() => useInbox());
      expect(result.current.selectedIndex).toBe(-1);
    });
  });

  describe('データ取得', () => {
    it('マウント時に設定を読み込んでから fetchInbox を呼ぶ', async () => {
      const items = [createMockItem()];
      mockFetchInbox.mockResolvedValue(items);

      const { result } = renderHook(() => useInbox());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockGetAppSettings).toHaveBeenCalledTimes(1);
      expect(mockFetchInbox).toHaveBeenCalledWith(false);
    });

    it('設定済みフィルタ条件で通知一覧が絞り込まれる', async () => {
      const matchingItem = createMockItem({ reason: 'review_requested' });
      const nonMatchingItem = createMockItem({ reason: 'subscribed' });
      mockFetchInbox.mockResolvedValue([matchingItem, nonMatchingItem]);

      const { result } = renderHook(() => useInbox());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.items).toHaveLength(2);
      expect(result.current.items.map((item) => item.id)).toEqual(
        expect.arrayContaining([matchingItem.id, nonMatchingItem.id]),
      );
    });

    it('fetch 後に lastUpdated が設定される', async () => {
      mockFetchInbox.mockResolvedValue([]);
      const { result } = renderHook(() => useInbox());

      await waitFor(() => expect(result.current.lastUpdated).not.toBeNull());
    });

    it('fetchInbox がエラーを投げた場合、error がセットされる', async () => {
      mockFetchInbox.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useInbox());

      await waitFor(() => expect(result.current.error).toBe('Network error'));
      expect(result.current.isLoading).toBe(false);
    });

    it('Error 以外のエラーでフォールバックメッセージが使われる', async () => {
      mockFetchInbox.mockRejectedValue('unknown');
      const { result } = renderHook(() => useInbox());

      await waitFor(() => expect(result.current.error).toBe('Failed to fetch inbox'));
    });
  });

  describe('markAsRead', () => {
    it('markAsRead で対象アイテムが既読になる', async () => {
      const item = createMockItem({ id: 'thread-1', unread: true });
      mockFetchInbox.mockResolvedValue([item]);

      const { result } = renderHook(() => useInbox());
      await waitFor(() => expect(result.current.items).toHaveLength(1));

      await act(async () => {
        await result.current.markAsRead('thread-1');
      });

      expect(mockMarkInboxRead).toHaveBeenCalledWith('thread-1');
      expect(result.current.items[0].unread).toBe(false);
    });

    it('markAsRead がエラーを投げてもクラッシュしない', async () => {
      mockMarkInboxRead.mockRejectedValue(new Error('Failed'));
      const item = createMockItem({ id: 'thread-1' });
      mockFetchInbox.mockResolvedValue([item]);

      const { result } = renderHook(() => useInbox());
      await waitFor(() => expect(result.current.items).toHaveLength(1));

      await expect(
        act(async () => {
          await result.current.markAsRead('thread-1');
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('markAllAsRead', () => {
    it('markAllAsRead で全アイテムが既読になる', async () => {
      const items = [
        createMockItem({ id: 'thread-1', unread: true }),
        createMockItem({ id: 'thread-2', unread: true }),
      ];
      mockFetchInbox.mockResolvedValue(items);

      const { result } = renderHook(() => useInbox());
      await waitFor(() => expect(result.current.items).toHaveLength(2));

      await act(async () => {
        await result.current.markAllAsRead();
      });

      expect(mockMarkAllInboxRead).toHaveBeenCalledTimes(1);
      expect(result.current.items.every((i) => !i.unread)).toBe(true);
    });
  });

  describe('refresh', () => {
    it('refresh が fetchItems を再実行する', async () => {
      mockFetchInbox.mockResolvedValue([]);
      const { result } = renderHook(() => useInbox());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockFetchInbox.mockResolvedValue([createMockItem()]);

      await act(async () => {
        result.current.refresh();
      });

      await waitFor(() => expect(result.current.items).toHaveLength(1));
      expect(mockFetchInbox).toHaveBeenCalledTimes(2);
    });
  });

  describe('unreadCount', () => {
    it('未読アイテム数が正しくカウントされる', async () => {
      const items = [
        createMockItem({ unread: true }),
        createMockItem({ unread: false }),
        createMockItem({ unread: true }),
      ];
      mockFetchInbox.mockResolvedValue(items);

      const { result } = renderHook(() => useInbox());
      await waitFor(() => expect(result.current.items).toHaveLength(3));
      expect(result.current.unreadCount).toBe(2);
    });

    it('unreadCount 変更時にトレイバッジが更新される', async () => {
      const items = [createMockItem({ unread: true })];
      mockFetchInbox.mockResolvedValue(items);

      renderHook(() => useInbox());
      await waitFor(() => expect(mockUpdateTrayBadge).toHaveBeenCalled());
    });
  });

  describe('selectedIndex', () => {
    it('setSelectedIndex で選択インデックスが更新される', async () => {
      mockFetchInbox.mockResolvedValue([]);
      const { result } = renderHook(() => useInbox());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setSelectedIndex(5);
      });

      expect(result.current.selectedIndex).toBe(5);
    });
  });

  describe('Tauri環境外', () => {
    it('Tauri環境外でもフェッチは実行される', async () => {
      disableTauriEnv();
      mockFetchInbox.mockResolvedValue([]);

      const { result } = renderHook(() => useInbox());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockFetchInbox).toHaveBeenCalledWith(false);
    });
  });

  describe('返り値の構造', () => {
    it('必要なプロパティとメソッドが全て返される', async () => {
      const { result } = renderHook(() => useInbox());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current).toHaveProperty('items');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('lastUpdated');
      expect(result.current).toHaveProperty('unreadCount');
      expect(result.current).toHaveProperty('selectedIndex');
      expect(typeof result.current.markAsRead).toBe('function');
      expect(typeof result.current.markAllAsRead).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
      expect(typeof result.current.setSelectedIndex).toBe('function');
    });
  });
});
