import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InboxItem, NotificationItem } from '@/types';
import type { NotificationReason } from '@/types/settings';
import { formatRelativeTime, InboxRow, SearchRow } from './inbox-item';

const baseInboxItem: InboxItem = {
  id: 'thread-1',
  title: 'Inbox title',
  url: 'https://github.com/owner/repo/issues/1',
  reason: 'mention',
  unread: true,
  updatedAt: new Date(Date.now() - 30_000).toISOString(),
  itemType: 'Issue',
  repositoryName: 'repo',
  repositoryFullName: 'owner/repo',
  ownerLogin: 'owner',
  ownerAvatar: '',
};

const baseSearchItem: NotificationItem = {
  id: 'node-1',
  number: 1,
  title: 'Search title',
  url: 'https://github.com/owner/repo/pull/1',
  itemType: 'pullrequest',
  state: 'open',
  isDraft: false,
  createdAt: new Date(Date.now() - 120_000).toISOString(),
  updatedAt: new Date(Date.now() - 90_000).toISOString(),
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
};

describe('formatRelativeTime', () => {
  it('相対時刻の全分岐を表示する', () => {
    const now = Date.now();
    expect(formatRelativeTime(new Date(now - 10_000).toISOString())).toBe('たった今');
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString())).toBe('5分前');
    expect(formatRelativeTime(new Date(now - 2 * 3_600_000).toISOString())).toBe('2時間前');
    expect(formatRelativeTime(new Date(now - 3 * 86_400_000).toISOString())).toBe('3日前');
    expect(formatRelativeTime(new Date(now - 10 * 86_400_000).toISOString())).toMatch(/\d/);
  });
});

describe('InboxRow', () => {
  it('未読Issue行のクリック、チェック、既読化を処理する', () => {
    const onClick = vi.fn();
    const onCheckChange = vi.fn();
    const onMarkAsDone = vi.fn();

    render(
      <InboxRow
        item={baseInboxItem}
        isSelected={true}
        isChecked={false}
        onCheckChange={onCheckChange}
        onClick={onClick}
        onMarkAsDone={onMarkAsDone}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Inbox title/ })[0]);
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Inbox title を選択'));
    expect(onCheckChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: '「Inbox title」を既読にする' }));
    expect(onMarkAsDone).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('既読PR行と未知reasonのフォールバックを表示する', () => {
    render(
      <InboxRow
        item={{
          ...baseInboxItem,
          unread: false,
          itemType: 'PullRequest',
          reason: 'unknown_reason' as NotificationReason,
          title: 'Pull request title',
        }}
        isSelected={false}
        isChecked={true}
        onCheckChange={vi.fn()}
        onClick={vi.fn()}
        onMarkAsDone={vi.fn()}
      />,
    );

    expect(screen.getByText('Pull request title')).toBeInTheDocument();
    expect(screen.getByText('unknown_reason')).toBeInTheDocument();
    expect(screen.getByLabelText('Pull request title を選択')).toBeChecked();
  });

  it('Issue/PR以外の通知アイコン分岐を表示する', () => {
    render(
      <InboxRow
        item={{ ...baseInboxItem, itemType: 'Discussion', reason: 'assign' }}
        isSelected={false}
        isChecked={false}
        onCheckChange={vi.fn()}
        onClick={vi.fn()}
        onMarkAsDone={vi.fn()}
      />,
    );

    expect(screen.getByText('アサイン')).toBeInTheDocument();
  });

  it('review、CI、bot、人間コメントの補助ラベルを表示する', () => {
    const { rerender } = render(
      <InboxRow
        item={{ ...baseInboxItem, reason: 'review_requested' }}
        isSelected={false}
        isChecked={false}
        onCheckChange={vi.fn()}
        onClick={vi.fn()}
        onMarkAsDone={vi.fn()}
      />,
    );
    expect(screen.getByText('Review')).toBeInTheDocument();

    rerender(
      <InboxRow
        item={{ ...baseInboxItem, reason: 'ci_activity' }}
        isSelected={false}
        isChecked={false}
        onCheckChange={vi.fn()}
        onClick={vi.fn()}
        onMarkAsDone={vi.fn()}
      />,
    );
    expect(screen.getByText('CI alert')).toBeInTheDocument();

    rerender(
      <InboxRow
        item={{
          ...baseInboxItem,
          reason: 'comment',
          title: 'CodeRabbit reviewed this pull request',
        }}
        isSelected={false}
        isChecked={false}
        onCheckChange={vi.fn()}
        onClick={vi.fn()}
        onMarkAsDone={vi.fn()}
      />,
    );
    expect(screen.getByText('Bot')).toBeInTheDocument();

    rerender(
      <InboxRow
        item={{ ...baseInboxItem, reason: 'comment', title: 'alice commented on this issue' }}
        isSelected={false}
        isChecked={false}
        onCheckChange={vi.fn()}
        onClick={vi.fn()}
        onMarkAsDone={vi.fn()}
      />,
    );
    expect(screen.getByText('Human')).toBeInTheDocument();
  });
});

describe('SearchRow', () => {
  it('PR検索行でdraft、author、reviewDecisionを表示する', () => {
    const onClick = vi.fn();
    render(
      <SearchRow
        item={{
          ...baseSearchItem,
          isDraft: true,
          author: { login: 'octo', avatarUrl: '' },
          reviewDecision: 'APPROVED',
        }}
        onClick={onClick}
      />,
    );

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('by @octo')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Search title/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Issue検索行で任意項目なしの分岐を表示する', () => {
    render(<SearchRow item={{ ...baseSearchItem, itemType: 'issue' }} onClick={vi.fn()} />);

    expect(screen.getByText('Search title')).toBeInTheDocument();
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    expect(screen.queryByText(/by @/)).not.toBeInTheDocument();
  });
});
