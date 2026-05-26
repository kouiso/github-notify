import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InboxItem, NotificationItem } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { InboxList } from './inbox-list';

vi.mock('@/hooks', () => ({
  useSettings: () => ({
    settings: DEFAULT_SETTINGS,
    isLoading: false,
    saveError: null,
    updateSettings: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

const items: InboxItem[] = [
  {
    id: 'thread-1',
    title: '成功する通知',
    url: null,
    reason: 'mention',
    unread: true,
    updatedAt: new Date().toISOString(),
    itemType: 'Issue',
    repositoryName: 'repo',
    repositoryFullName: 'owner/repo',
    ownerLogin: 'owner',
    ownerAvatar: '',
  },
  {
    id: 'thread-2',
    title: '失敗する通知',
    url: null,
    reason: 'mention',
    unread: true,
    updatedAt: new Date().toISOString(),
    itemType: 'Issue',
    repositoryName: 'repo',
    repositoryFullName: 'owner/repo',
    ownerLogin: 'owner',
    ownerAvatar: '',
  },
];

const searchItems: NotificationItem[] = [
  {
    id: 'search-1',
    number: 42,
    title: 'Search hit',
    url: 'https://github.com/owner/repo/pull/42',
    itemType: 'pullrequest',
    state: 'open',
    isDraft: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    repository: {
      name: 'repo',
      owner: {
        login: 'owner',
        avatarUrl: '',
      },
    },
    author: null,
    labels: [],
    isRead: false,
    reviewDecision: null,
  },
];

describe('InboxList', () => {
  it('選択既読化の一部失敗を表示し、失敗した項目だけ選択に残す', async () => {
    const onMarkAsRead = vi.fn((id: string) =>
      id === 'thread-2' ? Promise.reject(new Error('mark failed')) : Promise.resolve(),
    );

    render(
      <InboxList
        items={items}
        isLoading={false}
        error={null}
        lastUpdated={null}
        onMarkAsRead={onMarkAsRead}
        onRefresh={vi.fn()}
        selectedIndex={0}
        setSelectedIndex={vi.fn()}
        selectedFilterId={null}
      />,
    );

    fireEvent.click(screen.getByLabelText('成功する通知 を選択'));
    fireEvent.click(screen.getByLabelText('失敗する通知 を選択'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(await screen.findByRole('status')).toHaveTextContent('1件成功 / 1件失敗（未処理 1件）');
    await waitFor(() => expect(screen.getByLabelText('成功する通知 を選択')).not.toBeChecked());
    expect(screen.getByLabelText('失敗する通知 を選択')).toBeChecked();
  });

  it('エラー、ローディング、空状態、検索モードの主要分岐を表示する', () => {
    const onRefresh = vi.fn();
    const baseProps = {
      items: [],
      isLoading: false,
      error: null,
      lastUpdated: new Date('2026-05-24T08:30:00Z'),
      onMarkAsRead: vi.fn(),
      onRefresh,
      selectedIndex: 0,
      setSelectedIndex: vi.fn(),
      selectedFilterId: null,
    };

    const { rerender } = render(<InboxList {...baseProps} error="load failed" />);
    expect(screen.getByText('load failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(<InboxList {...baseProps} isLoading={true} />);
    expect(screen.getByText('0 notifications')).toBeInTheDocument();

    rerender(<InboxList {...baseProps} />);
    expect(screen.getByText('No unread notifications')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View all' }));
    expect(screen.getByText('No notifications')).toBeInTheDocument();

    rerender(<InboxList {...baseProps} isSearchMode={true} searchItems={searchItems} />);
    expect(screen.getByText('1 results')).toBeInTheDocument();
    expect(screen.getByText('Search hit')).toBeInTheDocument();

    rerender(
      <InboxList
        {...baseProps}
        isSearchMode={true}
        searchItems={searchItems}
        activeRepositories={['other/repo']}
      />,
    );
    expect(screen.getByText('0 results')).toBeInTheDocument();
  });
});
