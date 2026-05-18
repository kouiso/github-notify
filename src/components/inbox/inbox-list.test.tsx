import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InboxItem } from '@/types';
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

    expect(await screen.findByRole('status')).toHaveTextContent('1件成功 / 1件失敗');
    await waitFor(() => expect(screen.getByLabelText('成功する通知 を選択')).not.toBeChecked());
    expect(screen.getByLabelText('失敗する通知 を選択')).toBeChecked();
  });
});
