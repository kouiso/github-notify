import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxItem } from '@/types';
import type { AppSettings, CustomFilter } from '@/types/settings';
import { DEFAULT_SETTINGS, FILTER_TEMPLATES } from '@/types/settings';
import { Sidebar } from './sidebar';

// useSettings をモック
const mockUpdateSettings = vi.fn().mockResolvedValue(undefined);
let mockSettings: AppSettings;

vi.mock('@/hooks', () => ({
  useSettings: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
  }),
  useTheme: () => ({
    theme: 'light',
    effectiveTheme: 'light',
    setTheme: vi.fn(),
  }),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn() },
}));

// crypto.randomUUID モック
const MOCK_UUID = 'test-uuid-1234';
vi.stubGlobal('crypto', { randomUUID: () => MOCK_UUID });

function createMockItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: '1',
    title: 'Test notification',
    url: 'https://github.com/test/repo/pull/1',
    reason: 'review_requested',
    unread: true,
    updatedAt: '2025-01-01T00:00:00Z',
    itemType: 'pullrequest',
    repositoryName: 'repo',
    repositoryFullName: 'owner/repo',
    ownerLogin: 'owner',
    ownerAvatar: 'https://avatar.example.com',
    ...overrides,
  };
}

function createMockFilter(overrides: Partial<CustomFilter> = {}): CustomFilter {
  return {
    id: 'filter-1',
    name: 'レビュー依頼',
    reasons: ['review_requested'],
    enableDesktopNotification: true,
    enableSound: true,
    soundType: 'default',
    repositories: [],
    ...overrides,
  };
}

const defaultProps = {
  items: [] as InboxItem[],
  unreadCount: 0,
  onOpenSettings: vi.fn(),
  user: { login: 'testuser', avatarUrl: 'https://avatar.example.com/testuser.png' },
  selectedFilterId: null as string | null,
  onSelectFilter: vi.fn(),
};

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = { ...DEFAULT_SETTINGS, customFilters: [] };
  });

  describe('ヘッダー・基本表示', () => {
    it('GitHub Notify タイトルを表示する', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('GitHub Notify')).toBeInTheDocument();
    });

    it('Inbox フィルターが常に表示される', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Inbox')).toBeInTheDocument();
    });

    it('ユーザーアバターとログイン名を表示する', () => {
      render(<Sidebar {...defaultProps} />);
      const avatar = screen.getByAltText('testuser');
      expect(avatar).toBeInTheDocument();
      expect(avatar.getAttribute('src')).toBe('https://avatar.example.com/testuser.png');
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('user が null のとき Settings テキストを表示する', () => {
      render(<Sidebar {...defaultProps} user={null} />);
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('Add filter ボタンが表示される', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('Add filter')).toBeInTheDocument();
    });
  });

  describe('フィルターカウント', () => {
    it('「すべて」にフィルターマッチする未読件数を表示する', () => {
      const filter = createMockFilter({ id: 'f1', reasons: ['review_requested'] });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      const items = [
        createMockItem({ id: '1', reason: 'review_requested', unread: true }),
        createMockItem({ id: '2', reason: 'mention', unread: true }),
        createMockItem({ id: '3', reason: 'review_requested', unread: false }),
      ];

      render(<Sidebar {...defaultProps} items={items} unreadCount={2} />);

      // 「すべて」は customFilters のいずれかにマッチする未読 → review_requested が1件
      const allButton = screen.getByText('Inbox').closest('button')!;
      expect(within(allButton).getByText('1')).toBeInTheDocument();
    });

    it('カスタムフィルターに正しいカウントを表示する', () => {
      const filter = createMockFilter({
        id: 'f1',
        name: 'レビュー依頼',
        reasons: ['review_requested'],
      });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      const items = [
        createMockItem({ id: '1', reason: 'review_requested', unread: true }),
        createMockItem({ id: '2', reason: 'review_requested', unread: true }),
        createMockItem({ id: '3', reason: 'mention', unread: true }),
      ];

      render(<Sidebar {...defaultProps} items={items} unreadCount={3} />);

      // レビュー依頼フィルターは review_requested の未読2件
      const filterButton = screen.getByText('レビュー依頼').closest('button')!;
      expect(within(filterButton).getByText('2')).toBeInTheDocument();
    });

    it('リポジトリフィルターが正しく動作する', () => {
      const filter = createMockFilter({
        id: 'f1',
        name: 'CI リポ指定',
        reasons: ['ci_activity'],
        repositories: ['owner/repo-a'],
      });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      const items = [
        createMockItem({
          id: '1',
          reason: 'ci_activity',
          unread: true,
          repositoryFullName: 'owner/repo-a',
        }),
        createMockItem({
          id: '2',
          reason: 'ci_activity',
          unread: true,
          repositoryFullName: 'owner/repo-b',
        }),
      ];

      render(<Sidebar {...defaultProps} items={items} unreadCount={2} />);

      const filterButton = screen.getByText('CI リポ指定').closest('button')!;
      expect(within(filterButton).getByText('1')).toBeInTheDocument();
    });
  });

  describe('フィルター選択', () => {
    it('Inbox クリックで onSelectFilter(null) が呼ばれる', async () => {
      const user = userEvent.setup();
      const onSelectFilter = vi.fn();
      render(<Sidebar {...defaultProps} onSelectFilter={onSelectFilter} selectedFilterId="f1" />);

      const allButton = screen.getByText('Inbox').closest('button')!;
      await user.click(allButton);
      expect(onSelectFilter).toHaveBeenCalledWith(null);
    });

    it('カスタムフィルタークリックで onSelectFilter(id) が呼ばれる', async () => {
      const user = userEvent.setup();
      const onSelectFilter = vi.fn();
      const filter = createMockFilter({ id: 'f1', name: 'レビュー依頼' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} onSelectFilter={onSelectFilter} />);

      await user.click(screen.getByText('レビュー依頼'));
      expect(onSelectFilter).toHaveBeenCalledWith('f1');
    });
  });

  describe('設定ボタン', () => {
    it('設定ボタンクリックで onOpenSettings が呼ばれる', async () => {
      const user = userEvent.setup();
      const onOpenSettings = vi.fn();
      render(<Sidebar {...defaultProps} onOpenSettings={onOpenSettings} />);

      await user.click(screen.getByText('testuser'));
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('フィルター追加ダイアログ', () => {
    it('「フィルターを追加」クリックでダイアログが開く', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Add filter'));
      expect(screen.getByText('受け取りたい通知の種類を選んでください')).toBeInTheDocument();
    });

    it('テンプレート一覧が表示される', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Add filter'));

      for (const template of FILTER_TEMPLATES) {
        expect(screen.getByText(template.name)).toBeInTheDocument();
      }
    });

    it('既存フィルターと同名のテンプレートは非表示になる', async () => {
      const user = userEvent.setup();
      const filter = createMockFilter({ name: 'レビュー依頼' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Add filter'));

      // テンプレート一覧で「レビュー依頼」の説明文は非表示（既にフィルターとして存在するため）
      expect(screen.queryByText('PRのレビューを依頼された時')).not.toBeInTheDocument();
    });

    it('テンプレート選択で updateSettings が呼ばれる', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Add filter'));
      // 「アサイン」テンプレートを選択
      await user.click(screen.getByText('アサイン'));

      expect(mockUpdateSettings).toHaveBeenCalledWith({
        customFilters: expect.arrayContaining([
          expect.objectContaining({
            id: MOCK_UUID,
            name: 'アサイン',
            reasons: ['assign'],
          }),
        ]),
      });
    });

    it('カスタムフィルター作成ボタンで編集ダイアログが開く', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('Add filter'));
      await user.click(screen.getByText('カスタムフィルターを作成'));

      expect(screen.getByText('フィルターを作成')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('フィルター名')).toBeInTheDocument();
    });
  });

  describe('フィルター編集・削除', () => {
    it('編集ボタンクリックで編集ダイアログが開く', async () => {
      const user = userEvent.setup();
      const filter = createMockFilter({ id: 'f1', name: 'レビュー依頼' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} />);

      // SidebarItem の編集ボタンは hover 時に表示されるが、DOM上は存在する
      const editButton = screen.getByTitle('Edit');
      await user.click(editButton);

      expect(screen.getByText('フィルターを編集')).toBeInTheDocument();
      expect(screen.getByDisplayValue('レビュー依頼')).toBeInTheDocument();
    });

    it('編集ダイアログで保存ボタンクリックで updateSettings が呼ばれる', async () => {
      const user = userEvent.setup();
      const filter = createMockFilter({ id: 'f1', name: 'レビュー依頼' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByTitle('Edit'));
      const nameInput = screen.getByDisplayValue('レビュー依頼');
      await user.clear(nameInput);
      await user.type(nameInput, 'レビュー（改）');
      await user.click(screen.getByText('保存'));

      expect(mockUpdateSettings).toHaveBeenCalledWith({
        customFilters: [expect.objectContaining({ id: 'f1', name: 'レビュー（改）' })],
      });
    });

    it('削除ボタンクリックでフィルターが削除される', async () => {
      const user = userEvent.setup();
      const filter = createMockFilter({ id: 'f1', name: 'レビュー依頼' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByTitle('Edit'));
      await user.click(screen.getByText('削除'));

      expect(mockUpdateSettings).toHaveBeenCalledWith({
        customFilters: [],
      });
    });

    it('選択中のフィルターを削除すると onSelectFilter(null) が呼ばれる', async () => {
      const user = userEvent.setup();
      const onSelectFilter = vi.fn();
      const filter = createMockFilter({ id: 'f1', name: 'レビュー依頼' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} selectedFilterId="f1" onSelectFilter={onSelectFilter} />);

      await user.click(screen.getByTitle('Edit'));
      await user.click(screen.getByText('削除'));

      expect(onSelectFilter).toHaveBeenCalledWith(null);
    });
  });

  describe('Footer', () => {
    it('ユーザーアバターがフッターに表示される', () => {
      render(<Sidebar {...defaultProps} />);
      const avatar = screen.getByAltText('testuser');
      expect(avatar).toBeInTheDocument();
    });
  });
});
