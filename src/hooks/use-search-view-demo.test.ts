import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '@/types';

const demoItems: NotificationItem[] = [
  {
    id: 'demo-search',
    number: 101,
    title: 'デモ検索結果',
    url: 'https://github.com/kouiso/github-notify/pull/101',
    state: 'open',
    itemType: 'pullrequest',
    createdAt: '2026-05-06T00:00:00.000Z',
    updatedAt: '2026-05-07T00:00:00.000Z',
    author: { login: 'demo-user' },
    repository: { owner: { login: 'kouiso' }, name: 'github-notify' },
    labels: [],
    isRead: false,
    isDraft: false,
    reviewDecision: 'REVIEW_REQUIRED',
  },
];

const demoDataMock = vi.hoisted(() => ({
  createDemoSearchItems: vi.fn(() => demoItems),
  isDemoMode: vi.fn(() => true),
}));

const commandMock = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  markAllAsRead: vi.fn(),
  markAsRead: vi.fn(),
}));

vi.mock('@/lib/demo-data', () => demoDataMock);

vi.mock('@/lib/tauri/commands', () => commandMock);

vi.mock('@/lib/utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { useSearchView } from './use-search-view';

describe('useSearchView demo mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    demoDataMock.createDemoSearchItems.mockReturnValue(demoItems);
    demoDataMock.isDemoMode.mockReturnValue(true);
  });

  it('demo mode では Tauri IPC を呼ばずに demo search item を返す', async () => {
    const { result } = renderHook(() => useSearchView());

    await act(async () => {
      await result.current.fetch('is:open is:pr review-requested:demo-user');
    });

    expect(demoDataMock.createDemoSearchItems).toHaveBeenCalledWith(
      'is:open is:pr review-requested:demo-user',
    );
    expect(commandMock.fetchNotifications).not.toHaveBeenCalled();
    expect(result.current.items).toEqual(demoItems);
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  it('demo mode の既読操作は Tauri IPC を呼ばずにローカル状態だけ更新する', async () => {
    const { result } = renderHook(() => useSearchView());

    await act(async () => {
      await result.current.fetch('is:open');
      await result.current.markAsRead('demo-search');
    });

    expect(commandMock.markAsRead).not.toHaveBeenCalled();
    expect(result.current.items[0].isRead).toBe(true);
  });

  it('demo mode の全既読操作は Tauri IPC を呼ばずにローカル状態だけ更新する', async () => {
    const { result } = renderHook(() => useSearchView());

    await act(async () => {
      await result.current.fetch('is:open');
      await result.current.markAllAsRead();
    });

    expect(commandMock.markAllAsRead).not.toHaveBeenCalled();
    expect(result.current.items.every((item) => item.isRead)).toBe(true);
  });
});
