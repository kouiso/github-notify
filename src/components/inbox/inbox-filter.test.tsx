import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InboxListHeader, ReasonTabs } from './inbox-filter';

describe('InboxListHeader', () => {
  const baseProps = {
    isAllSelected: false,
    hasSelection: false,
    filter: 'all',
    searchQuery: '',
    isLoading: false,
    onSelectAll: vi.fn(),
    onMarkSelectedAsDone: vi.fn(),
    onFilterChange: vi.fn(),
    onSearchChange: vi.fn(),
    onRefresh: vi.fn(),
  };

  it('通常モードで選択、フィルタ、検索、更新を操作できる', () => {
    const onSelectAll = vi.fn();
    const onFilterChange = vi.fn();
    const onSearchChange = vi.fn();
    const onRefresh = vi.fn();

    render(
      <InboxListHeader
        {...baseProps}
        isAllSelected={true}
        filter="unread"
        onSelectAll={onSelectAll}
        onFilterChange={onFilterChange}
        onSearchChange={onSearchChange}
        onRefresh={onRefresh}
      />,
    );

    fireEvent.click(screen.getByTitle('Select all'));
    fireEvent.click(screen.getByRole('button', { name: 'すべて' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'repo:owner/repo' } });
    fireEvent.click(screen.getByRole('button', { name: '通知を更新' }));

    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith('all');
    expect(onSearchChange).toHaveBeenCalledWith('repo:owner/repo');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('選択中はDone操作を表示し、検索モードでは選択UIを隠して更新を無効化する', () => {
    const onMarkSelectedAsDone = vi.fn();

    const { rerender } = render(
      <InboxListHeader
        {...baseProps}
        hasSelection={true}
        onMarkSelectedAsDone={onMarkSelectedAsDone}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onMarkSelectedAsDone).toHaveBeenCalledTimes(1);

    rerender(<InboxListHeader {...baseProps} isSearchMode={true} isLoading={true} />);

    expect(screen.queryByTitle('Select all')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通知を更新' })).toBeDisabled();
  });
});

describe('ReasonTabs', () => {
  it('理由が1件以下なら表示しない', () => {
    const { container } = render(
      <ReasonTabs reasons={['mention']} activeReason={null} onSelect={vi.fn()} counts={{}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('理由タブの全件、選択理由、件数ありなしを処理する', () => {
    const onSelect = vi.fn();

    render(
      <ReasonTabs
        reasons={['mention', 'assign']}
        activeReason="assign"
        onSelect={onSelect}
        counts={{ mention: 2, assign: 0 }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'すべて' }));
    fireEvent.click(screen.getByRole('button', { name: 'メンション 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'アサイン' }));

    expect(onSelect).toHaveBeenNthCalledWith(1, null);
    expect(onSelect).toHaveBeenNthCalledWith(2, 'mention');
    expect(onSelect).toHaveBeenNthCalledWith(3, 'assign');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
