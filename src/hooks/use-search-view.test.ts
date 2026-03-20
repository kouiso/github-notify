import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '@/types';
import type { IssueStatusRule } from '@/types/settings';

const mockFetchNotifications =
  vi.fn<(query: string, issueStatusRules?: IssueStatusRule[]) => Promise<NotificationItem[]>>();
const mockMarkAsRead = vi.fn<(itemId: string) => Promise<void>>();
const mockMarkAllAsRead = vi.fn<(itemIds: string[]) => Promise<void>>();

vi.mock('@/lib/tauri/commands', () => ({
  fetchNotifications: (...args: Parameters<typeof mockFetchNotifications>) =>
    mockFetchNotifications(...args),
  markAsRead: (...args: Parameters<typeof mockMarkAsRead>) => mockMarkAsRead(...args),
  markAllAsRead: (...args: Parameters<typeof mockMarkAllAsRead>) => mockMarkAllAsRead(...args),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

import { useSearchView } from '@/hooks/use-search-view';

const mockItems: NotificationItem[] = [
  {
    id: 'item-1',
    number: 101,
    title: 'テスト通知1',
    url: 'https://github.com/owner/repo/issues/101',
    state: 'open',
    itemType: 'Issue',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    repository: {
      id: 'repo-1',
      name: 'repo',
      fullName: 'owner/repo',
      ownerLogin: 'owner',
      ownerAvatar: 'https://avatars.githubusercontent.com/owner',
    },
    labels: [],
    isRead: false,
  },
  {
    id: 'item-2',
    number: 202,
    title: 'テスト通知2',
    url: 'https://github.com/owner/repo/pull/202',
    state: 'open',
    itemType: 'PullRequest',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z',
    repository: {
      id: 'repo-1',
      name: 'repo',
      fullName: 'owner/repo',
      ownerLogin: 'owner',
      ownerAvatar: 'https://avatars.githubusercontent.com/owner',
    },
    labels: [],
    isRead: false,
  },
];

describe('useSearchView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchNotifications.mockResolvedValue([]);
    mockMarkAsRead.mockResolvedValue(undefined);
    mockMarkAllAsRead.mockResolvedValue(undefined);
  });

  describe('初期状態', () => {
    it('初期状態で items が空配列', () => {
      const { result } = renderHook(() => useSearchView());
      expect(result.current.items).toEqual([]);
    });

    it('初期状態で isLoading が false', () => {
      const { result } = renderHook(() => useSearchView());
      expect(result.current.isLoading).toBe(false);
    });

    it('初期状態で error が null', () => {
      const { result } = renderHook(() => useSearchView());
      expect(result.current.error).toBeNull();
    });

    it('初期状態で lastUpdated が null', () => {
      const { result } = renderHook(() => useSearchView());
      expect(result.current.lastUpdated).toBeNull();
    });
  });

  describe('fetch', () => {
    it('fetch が searchNotifications（fetchNotifications）を呼び出すこと', async () => {
      mockFetchNotifications.mockResolvedValue(mockItems);
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open');
      });

      expect(mockFetchNotifications).toHaveBeenCalledWith('is:open', undefined);
      expect(mockFetchNotifications).toHaveBeenCalledTimes(1);
    });

    it('fetch 実行中は isLoading が true になること', async () => {
      // 解決しないPromiseでローディング状態を保持
      mockFetchNotifications.mockReturnValue(new Promise(() => {}));
      const { result } = renderHook(() => useSearchView());

      act(() => {
        result.current.fetch('is:open');
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('fetch 成功後に isLoading が false になること', async () => {
      mockFetchNotifications.mockResolvedValue(mockItems);
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open');
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('fetch 成功後に items が更新されること', async () => {
      mockFetchNotifications.mockResolvedValue(mockItems);
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open');
      });

      expect(result.current.items).toEqual(mockItems);
    });

    it('fetch 成功後に lastUpdated が設定されること', async () => {
      mockFetchNotifications.mockResolvedValue(mockItems);
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open');
      });

      expect(result.current.lastUpdated).toBeInstanceOf(Date);
    });

    it('fetch 成功後に error が null になること', async () => {
      // 事前にエラー状態を作ってからリセットを確認
      mockFetchNotifications
        .mockRejectedValueOnce(new Error('前回のエラー'))
        .mockResolvedValueOnce(mockItems);

      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open');
      });
      expect(result.current.error).toBe('前回のエラー');

      await act(async () => {
        await result.current.fetch('is:closed');
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe('エラーハンドリング', () => {
    it('fetchNotifications がエラーを投げた場合に error がセットされること', async () => {
      mockFetchNotifications.mockRejectedValue(new Error('API error'));
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open');
      });

      expect(result.current.error).toBe('API error');
    });

    it('Error 以外のエラーの場合にフォールバックメッセージが使われること', async () => {
      mockFetchNotifications.mockRejectedValue('unexpected string error');
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open');
      });

      expect(result.current.error).toBe('Failed to fetch search results');
    });

    it('エラー発生後に isLoading が false になること', async () => {
      mockFetchNotifications.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open');
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('エラー発生後に items が変わらないこと', async () => {
      mockFetchNotifications
        .mockResolvedValueOnce(mockItems)
        .mockRejectedValueOnce(new Error('API error'));

      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open');
      });
      expect(result.current.items).toEqual(mockItems);

      await act(async () => {
        await result.current.fetch('is:closed');
      });
      // エラー後も前回の items が保持される
      expect(result.current.items).toEqual(mockItems);
    });
  });

  describe('refresh', () => {
    it('refresh が前回クエリで fetch を再実行すること', async () => {
      mockFetchNotifications.mockResolvedValue(mockItems);
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open label:bug');
      });
      expect(mockFetchNotifications).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockFetchNotifications).toHaveBeenCalledTimes(2);
      expect(mockFetchNotifications).toHaveBeenLastCalledWith('is:open label:bug', undefined);
    });

    it('fetch を一度も呼んでいない場合に refresh が何もしないこと', async () => {
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        result.current.refresh();
      });

      expect(mockFetchNotifications).not.toHaveBeenCalled();
    });
  });

  describe('stale クエリ防止', () => {
    it('古いクエリの結果が新しいクエリで上書きされないこと', async () => {
      // 最初のクエリ（遅い）と2番目のクエリ（早い）を設定
      let resolveFirstFetch!: (items: NotificationItem[]) => void;
      const firstFetchPromise = new Promise<NotificationItem[]>((resolve) => {
        resolveFirstFetch = resolve;
      });

      const secondItems: NotificationItem[] = [
        { ...mockItems[0], id: 'item-new', title: '新しいクエリの結果' },
      ];

      mockFetchNotifications
        .mockReturnValueOnce(firstFetchPromise)
        .mockResolvedValueOnce(secondItems);

      const { result } = renderHook(() => useSearchView());

      // 1つ目のクエリ（完了待ち）
      act(() => {
        result.current.fetch('is:open');
      });

      // 2つ目のクエリ（先に完了）
      await act(async () => {
        await result.current.fetch('is:merged');
      });

      // 2番目のクエリ結果が反映されている
      expect(result.current.items).toEqual(secondItems);

      // 1つ目のクエリが遅れて完了しても状態は上書きされない
      await act(async () => {
        resolveFirstFetch(mockItems);
      });

      await waitFor(() => {
        // 最新クエリ（is:merged）の結果が維持される
        expect(result.current.items).toEqual(secondItems);
      });
    });

    it('古いクエリのエラーが新しいクエリの結果を上書きしないこと', async () => {
      let rejectFirstFetch!: (err: Error) => void;
      const firstFetchPromise = new Promise<NotificationItem[]>((_, reject) => {
        rejectFirstFetch = reject;
      });

      const secondItems: NotificationItem[] = [
        { ...mockItems[0], id: 'item-new', title: '新しいクエリの結果' },
      ];

      mockFetchNotifications
        .mockReturnValueOnce(firstFetchPromise)
        .mockResolvedValueOnce(secondItems);

      const { result } = renderHook(() => useSearchView());

      // 1つ目のクエリ（完了待ち）
      act(() => {
        result.current.fetch('is:open');
      });

      // 2つ目のクエリ（先に完了）
      await act(async () => {
        await result.current.fetch('is:merged');
      });

      expect(result.current.items).toEqual(secondItems);
      expect(result.current.error).toBeNull();

      // 1つ目のクエリが遅れてエラー → 状態を上書きしない
      await act(async () => {
        rejectFirstFetch(new Error('古いクエリのエラー'));
      });

      await waitFor(() => {
        expect(result.current.items).toEqual(secondItems);
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('issueStatusRules', () => {
    const mockRules: IssueStatusRule[] = [
      {
        repositoryPattern: 'getozinc/mypappy-*',
        requiredStatuses: ['コードレビュー'],
        enabled: true,
      },
    ];

    it('fetch()にissueStatusRulesを渡した場合にfetchNotificationsに伝播されること', async () => {
      mockFetchNotifications.mockResolvedValue(mockItems);
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open', mockRules);
      });

      expect(mockFetchNotifications).toHaveBeenCalledWith('is:open', mockRules);
    });

    it('refresh()で前回のissueStatusRulesが再利用されること', async () => {
      mockFetchNotifications.mockResolvedValue(mockItems);
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open', mockRules);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockFetchNotifications).toHaveBeenCalledTimes(2);
      expect(mockFetchNotifications).toHaveBeenLastCalledWith('is:open', mockRules);
    });

    it('issueStatusRulesがundefinedの場合でも正常動作すること', async () => {
      mockFetchNotifications.mockResolvedValue(mockItems);
      const { result } = renderHook(() => useSearchView());

      await act(async () => {
        await result.current.fetch('is:open');
      });

      expect(mockFetchNotifications).toHaveBeenCalledWith('is:open', undefined);
      expect(result.current.items).toEqual(mockItems);
    });
  });

  describe('返り値の構造', () => {
    it('必要なプロパティとメソッドが全て返されること', () => {
      const { result } = renderHook(() => useSearchView());

      expect(result.current).toHaveProperty('items');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('lastUpdated');
      expect(typeof result.current.fetch).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
      expect(typeof result.current.markAsRead).toBe('function');
      expect(typeof result.current.markAllAsRead).toBe('function');
    });
  });
});
