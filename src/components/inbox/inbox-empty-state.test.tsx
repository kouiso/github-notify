import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './inbox-empty-state';

describe('EmptyState', () => {
  it('検索モードで検索語ありの空状態を表示する', () => {
    render(
      <EmptyState isSearchMode={true} filter="all" searchQuery="repo:test" onSetFilter={vi.fn()} />,
    );

    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('No items match your search.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View all' })).not.toBeInTheDocument();
  });

  it('検索モードで検索語なしの空状態を表示する', () => {
    render(<EmptyState isSearchMode={true} filter="all" searchQuery="" onSetFilter={vi.fn()} />);

    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('No items found for this query.')).toBeInTheDocument();
  });

  it('未読フィルタの空状態から全件表示へ切り替えられる', () => {
    const onSetFilter = vi.fn();
    render(
      <EmptyState isSearchMode={false} filter="unread" searchQuery="" onSetFilter={onSetFilter} />,
    );

    expect(screen.getByText('No unread notifications')).toBeInTheDocument();
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View all' }));
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

    expect(screen.getByText('No notifications')).toBeInTheDocument();
    expect(screen.getByText('No notifications match your search.')).toBeInTheDocument();
  });

  it('通常モードで検索語なしの空状態を表示する', () => {
    render(<EmptyState isSearchMode={false} filter="all" searchQuery="" onSetFilter={vi.fn()} />);

    expect(screen.getByText('No notifications')).toBeInTheDocument();
    expect(screen.getByText('New notifications will appear here.')).toBeInTheDocument();
  });
});
