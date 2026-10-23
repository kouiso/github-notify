import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '@/types';
import type { CustomFilter, RepositoryGroup } from '@/types/settings';
import { Dashboard } from './dashboard';

const mockOpen = vi.fn();
const mockNeedsReviewFetch = vi.fn();
const mockNeedsReviewRefresh = vi.fn();
const mockMyPrsFetch = vi.fn();
const mockMyPrsRefresh = vi.fn();
let hookCallIndex = 0;
let needsReviewItems: NotificationItem[] = [];
let myPrItems: NotificationItem[] = [];

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (...args: Parameters<typeof mockOpen>) => mockOpen(...args),
}));

vi.mock('@/hooks/use-search-view', () => ({
  useSearchView: () => {
    const isNeedsReview = hookCallIndex % 2 === 0;
    hookCallIndex += 1;
    return isNeedsReview
      ? {
          items: needsReviewItems,
          isLoading: false,
          error: null,
          lastUpdated: null,
          fetch: mockNeedsReviewFetch,
          refresh: mockNeedsReviewRefresh,
          markAsRead: vi.fn(),
          markAllAsRead: vi.fn(),
        }
      : {
          items: myPrItems,
          isLoading: false,
          error: null,
          lastUpdated: null,
          fetch: mockMyPrsFetch,
          refresh: mockMyPrsRefresh,
          markAsRead: vi.fn(),
          markAllAsRead: vi.fn(),
        };
  },
}));

const filters: CustomFilter[] = [
  {
    id: 'default-needs-review',
    name: 'レビュー待ち',
    reasons: [],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
    searchQuery: 'is:open is:pr review-requested:@me -reviewed-by:@me',
  },
  {
    id: 'default-my-prs',
    name: '自分のPR',
    reasons: [],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
    searchQuery: 'is:open is:pr author:@me',
  },
];

const activeGroup: RepositoryGroup = {
  id: 'project-a',
  name: '案件A',
  repositories: ['kouiso/github-notify', 'kouiso/design-system'],
};

function createSearchItem(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'item-1',
    number: 101,
    title: 'Review item',
    url: 'https://github.com/kouiso/github-notify/pull/101',
    state: 'open',
    itemType: 'pullrequest',
    createdAt: '2026-05-06T00:00:00.000Z',
    updatedAt: '2026-05-07T00:00:00.000Z',
    author: { login: 'reviewer' },
    repository: { owner: { login: 'kouiso' }, name: 'github-notify' },
    labels: [],
    isRead: false,
    isDraft: false,
    reviewDecision: 'REVIEW_REQUIRED',
    ...overrides,
  };
}

describe('Dashboard repository scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookCallIndex = 0;
    needsReviewItems = [];
    myPrItems = [];
  });

  it('activeGroup の repository に含まれない検索結果を表示しない', async () => {
    needsReviewItems = [
      createSearchItem({ id: 'review-in', title: 'Grouped review PR' }),
      createSearchItem({
        id: 'review-out',
        title: 'Outside review PR',
        repository: { owner: { login: 'outside' }, name: 'notifier' },
      }),
    ];
    myPrItems = [
      createSearchItem({
        id: 'mine-in',
        title: 'Grouped own PR',
        repository: { owner: { login: 'kouiso' }, name: 'design-system' },
      }),
      createSearchItem({
        id: 'mine-out',
        title: 'Outside own PR',
        repository: { owner: { login: 'outside' }, name: 'owned' },
      }),
    ];

    render(
      <Dashboard
        filters={filters}
        onRefresh={vi.fn()}
        userLogin="kouiso"
        activeGroup={activeGroup}
      />,
    );

    await waitFor(() =>
      expect(mockNeedsReviewFetch).toHaveBeenCalledWith(
        'is:open is:pr review-requested:kouiso -reviewed-by:kouiso repo:kouiso/github-notify repo:kouiso/design-system',
        undefined,
      ),
    );
    expect(mockMyPrsFetch).toHaveBeenCalledWith(
      'is:open is:pr author:kouiso repo:kouiso/github-notify repo:kouiso/design-system',
    );
    expect(screen.getByText('Grouped review PR')).toBeInTheDocument();
    expect(screen.getByText('Grouped own PR')).toBeInTheDocument();
    expect(screen.queryByText('Outside review PR')).not.toBeInTheDocument();
    expect(screen.queryByText('Outside own PR')).not.toBeInTheDocument();
  });

  it('org dropdown の選択結果を表示側でも絞り込む', async () => {
    const user = userEvent.setup();
    needsReviewItems = [
      createSearchItem({ id: 'kouiso-review', title: 'Kouiso review PR' }),
      createSearchItem({
        id: 'ritmo-review',
        title: 'Ritmo review PR',
        repository: { owner: { login: 'ritmo-inc' }, name: 'horsemanager' },
      }),
    ];

    render(<Dashboard filters={filters} onRefresh={vi.fn()} userLogin="kouiso" />);

    expect(screen.getByText('Kouiso review PR')).toBeInTheDocument();
    expect(screen.getByText('Ritmo review PR')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /すべて/ })[0]);
    await user.click(screen.getByText('ritmo-inc'));

    expect(screen.queryByText('Kouiso review PR')).not.toBeInTheDocument();
    expect(screen.getByText('Ritmo review PR')).toBeInTheDocument();
  });
});
