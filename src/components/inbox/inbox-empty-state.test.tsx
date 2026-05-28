import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './inbox-empty-state';

describe('EmptyState', () => {
  it('検索モードで検索語ありの空状態を表示する', () => {
    render(
      <EmptyState isSearchMode={true} filter="all" searchQuery="repo:test" onSetFilter={vi.fn()} />,
    );

    expect(screen.getByText('検索に一致する通知はありません')).toBeInTheDocument();
    expect(
      screen.getByText('検索語を変えるか、対象のリポジトリを広げると見つかる場合があります。'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '全件を見る' })).not.toBeInTheDocument();
  });

  it('検索モードで検索語なしの空状態を表示する', () => {
    render(<EmptyState isSearchMode={true} filter="all" searchQuery="" onSetFilter={vi.fn()} />);

    expect(screen.getByText('検索に一致する通知はありません')).toBeInTheDocument();
    expect(
      screen.getByText('検索語や対象のリポジトリを指定すると、過去の通知を探せます。'),
    ).toBeInTheDocument();
  });

  it('未読フィルタの空状態から全件表示へ切り替えられる', () => {
    const onSetFilter = vi.fn();
    render(
      <EmptyState isSearchMode={false} filter="unread" searchQuery="" onSetFilter={onSetFilter} />,
    );

    expect(screen.getByText('未読の通知はありません')).toBeInTheDocument();
    expect(
      screen.getByText(
        '今すぐ対応が必要な未読はありません。既読も確認する場合は全件表示に切り替えてください。',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '全件を見る' }));
    expect(onSetFilter).toHaveBeenCalledWith('all');
  });

  it('通常モードで検索語ありの空状態を表示する', () => {
    render(
      <EmptyState
        isSearchMode={false}
        filter="all"
        searchQuery="owner/repo"
        onSetFilter={vi.fn()}
      />,
    );

    expect(screen.getByText('通知はありません')).toBeInTheDocument();
    expect(
      screen.getByText('検索語に一致する通知はありません。検索を消すと他の通知を確認できます。'),
    ).toBeInTheDocument();
  });

  it('通常モードで検索語なしの空状態を表示する', () => {
    render(<EmptyState isSearchMode={false} filter="all" searchQuery="" onSetFilter={vi.fn()} />);

    expect(screen.getByText('通知はありません')).toBeInTheDocument();
    expect(
      screen.getByText(
        'GitHub から取得した通知が 0 件です。更新すると新しい通知を再確認できます。',
      ),
    ).toBeInTheDocument();
  });
});
