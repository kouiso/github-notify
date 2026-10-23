import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxItem } from '@/types/notification';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { InboxList } from './inbox-list';

const mockOpen = vi.fn();

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (...args: Parameters<typeof mockOpen>) => mockOpen(...args),
}));

vi.mock('@/hooks', () => ({
  useSettings: () => ({
    settings: {
      ...DEFAULT_SETTINGS,
      customFilters: [],
    },
  }),
}));

function createItem(overrides: Partial<InboxItem>): InboxItem {
  return {
    id: 'item-1',
    title: '通知',
    url: 'https://github.com/kouiso/github-notify/issues/1',
    reason: 'review_requested',
    unread: true,
    updatedAt: '2026-05-07T00:00:00.000Z',
    itemType: 'Issue',
    repositoryName: 'github-notify',
    repositoryFullName: 'kouiso/github-notify',
    ownerLogin: 'kouiso',
    ownerAvatar: '',
    ...overrides,
  };
}

function renderInbox(items: InboxItem[]) {
  return render(
    <InboxList
      items={items}
      isLoading={false}
      error={null}
      lastUpdated={new Date('2026-05-07T01:23:00.000Z')}
      onMarkAsRead={vi.fn()}
      onRefresh={vi.fn()}
      selectedIndex={0}
      setSelectedIndex={vi.fn()}
      selectedFilterId="all"
    />,
  );
}

describe('InboxList view modes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('カンバンモードで reason ごとの列と件数を表示する', async () => {
    const user = userEvent.setup();
    renderInbox([
      createItem({ id: 'review-1', title: 'Review request', reason: 'review_requested' }),
      createItem({ id: 'assign-1', title: 'Assigned issue', reason: 'assign' }),
      createItem({ id: 'mention-1', title: 'Mentioned issue', reason: 'mention' }),
      createItem({ id: 'ci-1', title: 'CI failed', reason: 'ci_activity' }),
    ]);

    await user.click(screen.getByRole('button', { name: 'カンバン' }));

    expect(screen.getByRole('heading', { name: 'レビュー' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'メンション' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '作業中' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'システム' })).toBeInTheDocument();
    expect(screen.getByText('Review request')).toBeInTheDocument();
    expect(screen.getByText('Assigned issue')).toBeInTheDocument();
    expect(screen.getByText('Mentioned issue')).toBeInTheDocument();
    expect(screen.getByText('CI failed')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review request/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('集中モードで選択中通知を詳細表示する', async () => {
    const user = userEvent.setup();
    renderInbox([
      createItem({ id: 'review-1', title: 'Review request', reason: 'review_requested' }),
      createItem({ id: 'mention-1', title: 'Mentioned issue', reason: 'mention' }),
    ]);

    await user.click(screen.getByRole('button', { name: '集中' }));

    expect(screen.getByRole('heading', { name: 'Review request' })).toBeInTheDocument();
    expect(screen.getAllByText('kouiso/github-notify').length).toBeGreaterThan(0);
    expect(screen.getByText('種別')).toBeInTheDocument();
    expect(screen.getByText('所有者')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GitHubで開く' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '完了にする' })).toBeInTheDocument();
  });
});
