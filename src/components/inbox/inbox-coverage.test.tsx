import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxItem, NotificationItem } from '@/types';
import type { AppSettings, CustomFilter, NotificationReason } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { InboxListHeader, ReasonTabs } from './inbox-filter';
import { InboxList } from './inbox-list';

const mockOpen = vi.fn();
let mockSettings: AppSettings;

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (...args: Parameters<typeof mockOpen>) => mockOpen(...args),
}));

vi.mock('@/hooks', () => ({
  useSettings: () => ({ settings: mockSettings }),
}));

vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

const allReasons: NotificationReason[] = [
  'review_requested',
  'mention',
  'team_mention',
  'assign',
  'author',
  'ci_activity',
  'comment',
  'state_change',
  'subscribed',
  'security_alert',
  'manual',
  'push',
  'your_activity',
];

const importantFilter: CustomFilter = {
  id: 'important',
  name: '重要',
  reasons: allReasons,
  enableDesktopNotification: true,
  enableSound: true,
  soundType: 'default',
};

function resetSettings() {
  mockSettings = {
    ...DEFAULT_SETTINGS,
    customFilters: [importantFilter],
  };
}

function createInboxItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: 'item-1',
    title: 'Review request',
    url: 'https://github.com/kouiso/github-notify/pull/1',
    reason: 'review_requested',
    unread: true,
    updatedAt: '2026-05-07T00:00:00.000Z',
    itemType: 'PullRequest',
    repositoryName: 'github-notify',
    repositoryFullName: 'kouiso/github-notify',
    ownerLogin: 'kouiso',
    ownerAvatar: '',
    ...overrides,
  };
}

function createSearchItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'search-1',
    number: 11,
    title: 'Draft pull request',
    url: 'https://github.com/kouiso/github-notify/pull/11',
    state: 'open',
    itemType: 'pullrequest',
    createdAt: '2026-05-06T23:00:00.000Z',
    updatedAt: '2026-05-07T00:00:00.000Z',
    author: { login: 'reviewer' },
    repository: { owner: { login: 'kouiso' }, name: 'github-notify' },
    labels: [],
    isRead: false,
    isDraft: true,
    reviewDecision: 'CHANGES_REQUESTED',
    ...overrides,
  };
}

function renderInboxList(
  props: Partial<React.ComponentProps<typeof InboxList>> = {},
  items: InboxItem[] = [createInboxItem()],
) {
  const defaultProps: React.ComponentProps<typeof InboxList> = {
    items,
    isLoading: false,
    error: null,
    lastUpdated: new Date('2026-05-07T01:23:00.000Z'),
    onMarkAsRead: vi.fn(),
    onRefresh: vi.fn(),
    selectedIndex: 0,
    setSelectedIndex: vi.fn(),
    selectedFilterId: 'all',
  };

  return render(<InboxList {...defaultProps} {...props} />);
}

describe('inbox coverage supplement', () => {
  beforeEach(() => {
    resetSettings();
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('header は選択状態、検索、表示モード、更新操作を通知する', async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    const onMarkSelectedAsDone = vi.fn();
    const onFilterChange = vi.fn();
    const onViewModeChange = vi.fn();
    const onSearchChange = vi.fn();
    const onRefresh = vi.fn();

    const { rerender } = render(
      <InboxListHeader
        isAllSelected={true}
        hasSelection={false}
        filter="all"
        viewMode="list"
        searchQuery=""
        isLoading={false}
        onSelectAll={onSelectAll}
        onMarkSelectedAsDone={onMarkSelectedAsDone}
        onFilterChange={onFilterChange}
        onViewModeChange={onViewModeChange}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByTitle('すべて選択')).toBeChecked();
    await user.click(screen.getByRole('button', { name: '未読' }));
    await user.click(screen.getByRole('button', { name: 'カンバン' }));
    fireEvent.change(screen.getByPlaceholderText('検索...'), { target: { value: 'repo' } });
    await user.click(screen.getAllByRole('button').at(-1) as HTMLElement);

    expect(onFilterChange).toHaveBeenCalledWith('unread');
    expect(onViewModeChange).toHaveBeenCalledWith('board');
    expect(onSearchChange).toHaveBeenCalledWith('repo');
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <InboxListHeader
        isAllSelected={false}
        hasSelection={true}
        filter="unread"
        viewMode="focus"
        searchQuery="repo"
        isLoading={false}
        onSelectAll={onSelectAll}
        onMarkSelectedAsDone={onMarkSelectedAsDone}
        onFilterChange={onFilterChange}
        onViewModeChange={onViewModeChange}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
      />,
    );

    await user.click(screen.getByRole('button', { name: '完了' }));
    expect(onMarkSelectedAsDone).toHaveBeenCalledTimes(1);

    rerender(
      <InboxListHeader
        isAllSelected={false}
        hasSelection={true}
        filter="unread"
        viewMode="focus"
        searchQuery="repo"
        isLoading={false}
        onSelectAll={onSelectAll}
        onMarkSelectedAsDone={onMarkSelectedAsDone}
        onFilterChange={onFilterChange}
        onViewModeChange={onViewModeChange}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
        isSearchMode={true}
      />,
    );

    expect(screen.queryByTitle('すべて選択')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '集中' })).not.toBeInTheDocument();
  });

  it('reason tabs は単一理由では非表示、複数理由では選択と件数を表示する', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <ReasonTabs
        reasons={['mention']}
        activeReason={null}
        onSelect={onSelect}
        counts={{ mention: 1 }}
      />,
    );

    expect(container).toBeEmptyDOMElement();

    rerender(
      <ReasonTabs
        reasons={['mention', 'assign']}
        activeReason="assign"
        onSelect={onSelect}
        counts={{ mention: 2, assign: 0 }}
      />,
    );

    expect(screen.getByText('2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'すべて' }));
    await user.click(screen.getByRole('button', { name: 'メンション 2' }));
    expect(onSelect).toHaveBeenNthCalledWith(1, null);
    expect(onSelect).toHaveBeenNthCalledWith(2, 'mention');
  });

  it('list view は filter、検索、選択、完了、row open を処理する', async () => {
    const user = userEvent.setup();
    const onMarkAsRead = vi.fn();
    const setSelectedIndex = vi.fn();
    const items = [
      createInboxItem({ id: 'review', title: 'Review request', reason: 'review_requested' }),
      createInboxItem({
        id: 'mention',
        title: 'Mention issue',
        reason: 'mention',
        unread: false,
        itemType: 'Issue',
      }),
      createInboxItem({
        id: 'ci',
        title: 'CI activity',
        reason: 'ci_activity',
        itemType: 'CheckSuite',
      }),
    ];

    renderInboxList({ onMarkAsRead, setSelectedIndex }, items);

    expect(screen.queryByText('Mention issue')).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'すべて' })[0]);
    expect(screen.getByText('Mention issue')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('検索...'), { target: { value: 'ci' } });
    expect(screen.getByText('CI activity')).toBeInTheDocument();
    expect(screen.queryByText('Review request')).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('検索...'));
    await user.click(screen.getByTitle('すべて選択'));
    await user.click(screen.getByRole('button', { name: '完了' }));
    expect(onMarkAsRead).toHaveBeenCalledWith('review');
    expect(onMarkAsRead).toHaveBeenCalledWith('mention');
    expect(onMarkAsRead).toHaveBeenCalledWith('ci');

    await user.click(screen.getByText('Review request'));
    expect(setSelectedIndex).toHaveBeenCalledWith(0);
    expect(mockOpen).toHaveBeenCalledWith('https://github.com/kouiso/github-notify/pull/1');
  });

  it('empty, loading, error state を表示して復旧操作を受け付ける', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const { rerender } = renderInboxList({ error: 'load failed', onRefresh }, []);

    expect(screen.getByText('load failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '再試行' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <InboxList
        items={[]}
        isLoading={true}
        error={null}
        lastUpdated={null}
        onMarkAsRead={vi.fn()}
        onRefresh={onRefresh}
        selectedIndex={0}
        setSelectedIndex={vi.fn()}
        selectedFilterId="all"
      />,
    );
    expect(screen.queryByText('未読通知はありません')).not.toBeInTheDocument();

    rerender(
      <InboxList
        items={[]}
        isLoading={false}
        error={null}
        lastUpdated={null}
        onMarkAsRead={vi.fn()}
        onRefresh={onRefresh}
        selectedIndex={0}
        setSelectedIndex={vi.fn()}
        selectedFilterId="all"
      />,
    );
    expect(screen.getByText('未読通知はありません')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'すべて表示' }));
    expect(screen.getByText('通知はありません')).toBeInTheDocument();
  });

  it('board と focus view のカード操作を処理する', async () => {
    const user = userEvent.setup();
    const onMarkAsRead = vi.fn();
    const setSelectedIndex = vi.fn();
    const items = [
      createInboxItem({ id: 'review', title: 'Review request', reason: 'review_requested' }),
      createInboxItem({ id: 'author', title: 'Author update', reason: 'author', unread: false }),
      createInboxItem({
        id: 'manual',
        title: 'Manual note',
        reason: 'manual',
        itemType: 'Discussion',
      }),
    ];

    renderInboxList({ onMarkAsRead, setSelectedIndex, selectedIndex: 99 }, items);

    await user.click(screen.getByRole('button', { name: 'カンバン' }));
    expect(screen.getByRole('heading', { name: 'レビュー' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '作業中' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'システム' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: '完了' }).at(-1) as HTMLElement);
    expect(onMarkAsRead).toHaveBeenCalledWith('manual');

    await user.click(screen.getByRole('button', { name: '集中' }));
    expect(screen.getByRole('heading', { name: 'Review request' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'GitHubで開く' }));
    expect(mockOpen).toHaveBeenCalledWith('https://github.com/kouiso/github-notify/pull/1');
    await user.click(screen.getByRole('button', { name: '完了にする' }));
    expect(onMarkAsRead).toHaveBeenCalledWith('review');
    await user.click(screen.getByRole('button', { name: 'Manual note kouiso/github-notify' }));
    expect(setSelectedIndex).toHaveBeenCalledWith(1);
  });

  it('search mode は repository scope、query、draft/review 表示、click を処理する', async () => {
    const user = userEvent.setup();
    const items = [
      createSearchItem(),
      createSearchItem({
        id: 'issue-1',
        title: 'Plain issue',
        url: 'https://github.com/kouiso/other/issues/1',
        itemType: 'issue',
        repository: { owner: { login: 'kouiso' }, name: 'other' },
        author: undefined,
        isDraft: false,
        reviewDecision: null,
      }),
    ];

    renderInboxList({
      isSearchMode: true,
      searchItems: items,
      activeRepositories: ['kouiso/github-notify'],
      items: [],
      selectedFilterId: null,
    });

    expect(screen.getByText('Draft pull request')).toBeInTheDocument();
    expect(screen.queryByText('Plain issue')).not.toBeInTheDocument();
    expect(screen.getByText('下書き')).toBeInTheDocument();
    expect(screen.getByText('修正依頼')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('検索...'), { target: { value: 'missing' } });
    expect(screen.getByText('該当する項目はありません')).toBeInTheDocument();
    expect(screen.getByText('検索条件に一致する項目はありません。')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('検索...'), { target: { value: 'draft' } });
    await user.click(screen.getByText('Draft pull request'));
    expect(mockOpen).toHaveBeenCalledWith('https://github.com/kouiso/github-notify/pull/11');
  });
});
