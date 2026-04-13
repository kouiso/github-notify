import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxItem } from '@/types';
import type { AppSettings, CustomFilter } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';
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
  allItems: [] as InboxItem[],
  onOpenSettings: vi.fn(),
  user: { login: 'testuser', avatarUrl: 'https://avatar.example.com/testuser.png' },
  selectedFilterId: null as string | null,
  onSelectFilter: vi.fn(),
  repositoryGroups: [],
  activeGroupId: null as string | null,
  onSelectGroup: vi.fn(),
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

    it('Dashboard エントリが表示される', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
    });

    it('Dashboard クリックで onSelectFilter("dashboard") が呼ばれる', async () => {
      const user = userEvent.setup();
      const onSelectFilter = vi.fn();
      render(<Sidebar {...defaultProps} onSelectFilter={onSelectFilter} />);

      await user.click(screen.getByText('ダッシュボード'));
      expect(onSelectFilter).toHaveBeenCalledWith('dashboard');
    });

    it('Inbox フィルターが常に表示される', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('受信トレイ')).toBeInTheDocument();
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

    it('New view ボタンが表示される', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('ビューを追加')).toBeInTheDocument();
    });

    it('Views セクションヘッダーが表示される', () => {
      render(<Sidebar {...defaultProps} />);
      expect(screen.getByText('ビュー')).toBeInTheDocument();
    });
  });

  describe('ビューカウント', () => {
    it('Inbox にフィルターマッチする未読件数を表示する', () => {
      const filter = createMockFilter({ id: 'f1', reasons: ['review_requested'] });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      const items = [
        createMockItem({ id: '1', reason: 'review_requested', unread: true }),
        createMockItem({ id: '2', reason: 'mention', unread: true }),
        createMockItem({ id: '3', reason: 'review_requested', unread: false }),
      ];

      render(<Sidebar {...defaultProps} items={items} />);

      const allButton = screen.getByText('受信トレイ').closest('button')!;
      expect(within(allButton).getByText('1')).toBeInTheDocument();
    });

    it('カスタムビューに正しいカウントを表示する', () => {
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

      render(<Sidebar {...defaultProps} items={items} />);

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

      render(<Sidebar {...defaultProps} items={items} />);

      const filterButton = screen.getByText('CI リポ指定').closest('button')!;
      expect(within(filterButton).getByText('1')).toBeInTheDocument();
    });
  });

  describe('ビュー選択', () => {
    it('Inbox クリックで onSelectFilter(null) が呼ばれる', async () => {
      const user = userEvent.setup();
      const onSelectFilter = vi.fn();
      render(<Sidebar {...defaultProps} onSelectFilter={onSelectFilter} selectedFilterId="f1" />);

      const allButton = screen.getByText('受信トレイ').closest('button')!;
      await user.click(allButton);
      expect(onSelectFilter).toHaveBeenCalledWith(null);
    });

    it('カスタムビュークリックで onSelectFilter(id) が呼ばれる', async () => {
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

  describe('ビュー作成', () => {
    it('「New view」クリックで作成ダイアログが開く', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));
      expect(screen.getByText('ビューを作成')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('ビュー名')).toBeInTheDocument();
    });

    it('ビュー名と通知種類を設定して保存できる', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));

      // ビュー名を入力
      const nameInput = screen.getByPlaceholderText('ビュー名');
      await user.type(nameInput, 'CI監視');

      // 通知種類のチェックボックスが表示される
      expect(screen.getByText('通知の種類:')).toBeInTheDocument();

      await user.click(screen.getByText('保存'));

      expect(mockUpdateSettings).toHaveBeenCalledWith({
        customFilters: expect.arrayContaining([
          expect.objectContaining({
            id: MOCK_UUID,
            name: 'CI監視',
          }),
        ]),
      });
    });
  });

  describe('ビュー編集・削除', () => {
    it('編集ボタンクリックで編集ダイアログが開く', async () => {
      const user = userEvent.setup();
      const filter = createMockFilter({ id: 'f1', name: 'レビュー依頼' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} />);

      const editButton = screen.getByTitle('編集');
      await user.click(editButton);

      expect(screen.getByText('ビューを編集')).toBeInTheDocument();
      expect(screen.getByDisplayValue('レビュー依頼')).toBeInTheDocument();
    });

    it('編集ダイアログで保存ボタンクリックで updateSettings が呼ばれる', async () => {
      const user = userEvent.setup();
      const filter = createMockFilter({ id: 'f1', name: 'レビュー依頼' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByTitle('編集'));
      const nameInput = screen.getByDisplayValue('レビュー依頼');
      await user.clear(nameInput);
      await user.type(nameInput, 'レビュー（改）');
      await user.click(screen.getByText('保存'));

      expect(mockUpdateSettings).toHaveBeenCalledWith({
        customFilters: [expect.objectContaining({ id: 'f1', name: 'レビュー（改）' })],
      });
    });

    it('削除ボタンクリックでビューが削除される', async () => {
      const user = userEvent.setup();
      const filter = createMockFilter({ id: 'f1', name: 'レビュー依頼' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByTitle('編集'));
      await user.click(screen.getByText('削除'));

      expect(mockUpdateSettings).toHaveBeenCalledWith({
        customFilters: [],
      });
    });

    it('選択中のビューを削除すると onSelectFilter(null) が呼ばれる', async () => {
      const user = userEvent.setup();
      const onSelectFilter = vi.fn();
      const filter = createMockFilter({ id: 'f1', name: 'レビュー依頼' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} selectedFilterId="f1" onSelectFilter={onSelectFilter} />);

      await user.click(screen.getByTitle('編集'));
      await user.click(screen.getByText('削除'));

      expect(onSelectFilter).toHaveBeenCalledWith(null);
    });
  });

  describe('検索ビュー表示', () => {
    it('検索ビューにはカウントバッジが表示されない', () => {
      const searchFilter = createMockFilter({
        id: 'search-1',
        name: 'Needs My Review',
        reasons: [],
        searchQuery: 'is:open is:pr review-requested:@me',
      });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [searchFilter] };

      const items = [createMockItem({ id: '1', reason: 'review_requested', unread: true })];
      render(<Sidebar {...defaultProps} items={items} />);

      const filterButton = screen.getByText('Needs My Review').closest('button')!;
      // 検索ビューにはカウントが表示されない
      expect(within(filterButton).queryByText('1')).not.toBeInTheDocument();
    });

    it('検索ビューには編集ボタンが表示されない', () => {
      const searchFilter = createMockFilter({
        id: 'search-1',
        name: 'Needs My Review',
        reasons: [],
        searchQuery: 'is:open is:pr review-requested:@me',
      });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [searchFilter] };

      render(<Sidebar {...defaultProps} />);

      expect(screen.getByText('Needs My Review')).toBeInTheDocument();
      expect(screen.queryByTitle('編集')).not.toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('ユーザーアバターがフッターに表示される', () => {
      render(<Sidebar {...defaultProps} />);
      const avatar = screen.getByAltText('testuser');
      expect(avatar).toBeInTheDocument();
    });
  });

  describe('ビューダイアログ: キャンセル操作', () => {
    it('キャンセルボタンクリックでダイアログが閉じる', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));
      expect(screen.getByText('ビューを作成')).toBeInTheDocument();

      await user.click(screen.getByText('キャンセル'));
      expect(screen.queryByText('ビューを作成')).not.toBeInTheDocument();
    });
  });

  describe('ビューダイアログ: 通知種類の切り替え', () => {
    it('Reasonチェックボックスをオンにすると選択される', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));

      // 「レビュー依頼」チェックボックスをONにする
      const reviewLabel = screen.getByText('レビュー依頼');
      const checkbox = reviewLabel.closest('label')!.querySelector('input[type="checkbox"]')!;
      expect(checkbox).not.toBeChecked();
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('オン済みのReasonチェックボックスをクリックするとオフになる', async () => {
      const user = userEvent.setup();
      const filter = createMockFilter({ id: 'f1', name: 'テスト', reasons: ['review_requested'] });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} />);

      // 編集ダイアログを開く
      await user.click(screen.getByTitle('編集'));

      const reviewLabel = screen.getByText('レビュー依頼');
      const checkbox = reviewLabel.closest('label')!.querySelector('input[type="checkbox"]')!;
      // 既存フィルターで review_requested が選択されているためチェック済み
      expect(checkbox).toBeChecked();
      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('ビューダイアログ: デスクトップ通知・通知音', () => {
    it('デスクトップ通知チェックボックスを切り替えられる', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));

      const desktopLabel = screen.getByText('デスクトップ通知');
      const checkbox = desktopLabel.closest('label')!.querySelector('input[type="checkbox"]')!;
      expect(checkbox).not.toBeChecked();
      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('デスクトップ通知をONにすると通知音が有効化される', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));

      // デスクトップ通知をON
      const desktopLabel = screen.getByText('デスクトップ通知');
      await user.click(desktopLabel.closest('label')!.querySelector('input[type="checkbox"]')!);

      // 通知音チェックボックスが有効になる
      const soundLabel = screen.getByText('通知音');
      const soundCheckbox = soundLabel.closest('label')!.querySelector('input[type="checkbox"]')!;
      expect(soundCheckbox).not.toBeDisabled();
    });

    it('デスクトップ通知と通知音をONにするとサウンドタイプボタンが表示される', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));

      const desktopLabel = screen.getByText('デスクトップ通知');
      await user.click(desktopLabel.closest('label')!.querySelector('input[type="checkbox"]')!);

      const soundLabel = screen.getByText('通知音');
      await user.click(soundLabel.closest('label')!.querySelector('input[type="checkbox"]')!);

      // サウンドタイプボタンが表示される
      expect(screen.getByText('標準')).toBeInTheDocument();
      expect(screen.getByText('ソフト')).toBeInTheDocument();
      expect(screen.getByText('チャイム')).toBeInTheDocument();
    });

    it('サウンドタイプボタンをクリックすると選択が変わる', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));

      const desktopLabel = screen.getByText('デスクトップ通知');
      await user.click(desktopLabel.closest('label')!.querySelector('input[type="checkbox"]')!);

      const soundLabel = screen.getByText('通知音');
      await user.click(soundLabel.closest('label')!.querySelector('input[type="checkbox"]')!);

      // 「ソフト」を選択して保存
      await user.click(screen.getByText('ソフト'));
      await user.click(screen.getByText('保存'));

      expect(mockUpdateSettings).toHaveBeenCalledWith({
        customFilters: expect.arrayContaining([expect.objectContaining({ soundType: 'soft' })]),
      });
    });
  });

  describe('ビューダイアログ: リポジトリ操作', () => {
    it('追加ボタンクリックでリポジトリを追加できる', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));

      const repoInput = screen.getByPlaceholderText('owner/repo');
      await user.type(repoInput, 'owner/new-repo');
      await user.click(screen.getByText('追加'));

      // 入力欄がクリアされる
      expect(repoInput).toHaveValue('');
      // 追加されたリポジトリタグが表示される（owner/new-repo → new-repo）
      expect(screen.getByText('new-repo')).toBeInTheDocument();
    });

    it('Enterキーでリポジトリを追加できる', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));

      const repoInput = screen.getByPlaceholderText('owner/repo');
      await user.type(repoInput, 'owner/enter-repo');
      await user.keyboard('{Enter}');

      expect(repoInput).toHaveValue('');
      expect(screen.getByText('enter-repo')).toBeInTheDocument();
    });

    it('重複リポジトリは追加されない', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));

      const repoInput = screen.getByPlaceholderText('owner/repo');
      await user.type(repoInput, 'owner/dup-repo');
      await user.click(screen.getByText('追加'));
      // 同じものを再度追加しようとする
      await user.type(repoInput, 'owner/dup-repo');
      await user.click(screen.getByText('追加'));

      // dup-repo は1件のみ表示される
      const tags = screen.getAllByText('dup-repo');
      expect(tags).toHaveLength(1);
    });

    it('リポジトリタグの削除ボタンでタグを削除できる', async () => {
      const user = userEvent.setup();
      render(<Sidebar {...defaultProps} />);

      await user.click(screen.getByText('ビューを追加'));

      // リポジトリを追加
      const repoInput = screen.getByPlaceholderText('owner/repo');
      await user.type(repoInput, 'owner/del-repo');
      await user.click(screen.getByText('追加'));

      // タグが表示される
      expect(screen.getByText('del-repo')).toBeInTheDocument();

      // タグの削除ボタン（×アイコン）をクリック
      const tag = screen.getByText('del-repo').closest('span')!;
      const deleteBtn = tag.querySelector('button')!;
      await user.click(deleteBtn);

      // タグが消える
      expect(screen.queryByText('del-repo')).not.toBeInTheDocument();
    });

    it('通知アイテムのあるリポジトリがサジェストとして表示される', async () => {
      const user = userEvent.setup();
      const items = [createMockItem({ repositoryFullName: 'owner/suggested-repo' })];
      render(<Sidebar {...defaultProps} items={items} />);

      await user.click(screen.getByText('ビューを追加'));

      // サジェストリポジトリが表示される
      expect(screen.getByText('+ suggested-repo')).toBeInTheDocument();
    });

    it('サジェストリポジトリをクリックするとリポジトリが追加される', async () => {
      const user = userEvent.setup();
      const items = [createMockItem({ repositoryFullName: 'owner/click-repo' })];
      render(<Sidebar {...defaultProps} items={items} />);

      await user.click(screen.getByText('ビューを追加'));
      await user.click(screen.getByText('+ click-repo'));

      // タグが追加される
      expect(screen.getByText('click-repo')).toBeInTheDocument();
    });

    it('追加済みリポジトリはサジェストから消える', async () => {
      const user = userEvent.setup();
      const items = [createMockItem({ repositoryFullName: 'owner/hidden-repo' })];
      render(<Sidebar {...defaultProps} items={items} />);

      await user.click(screen.getByText('ビューを追加'));

      // まずサジェストが表示されている
      expect(screen.getByText('+ hidden-repo')).toBeInTheDocument();

      // クリックして追加
      await user.click(screen.getByText('+ hidden-repo'));

      // サジェストから消える（タグとして表示されるのみ）
      expect(screen.queryByText('+ hidden-repo')).not.toBeInTheDocument();
    });
  });

  describe('アクティブ状態', () => {
    it('selectedFilterId が "dashboard" のとき Dashboard がアクティブスタイルになる', () => {
      render(<Sidebar {...defaultProps} selectedFilterId="dashboard" />);

      const dashboardBtn = screen.getByText('ダッシュボード').closest('button')!;
      expect(dashboardBtn.className).toContain('bg-accent');
    });

    it('selectedFilterId が null のとき Inbox がアクティブスタイルになる', () => {
      render(<Sidebar {...defaultProps} selectedFilterId={null} />);

      const inboxBtn = screen.getByText('受信トレイ').closest('button')!;
      expect(inboxBtn.className).toContain('bg-accent');
    });

    it('選択中のカスタムビューがアクティブスタイルになる', () => {
      const filter = createMockFilter({ id: 'f1', name: 'アクティブビュー' });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} selectedFilterId="f1" />);

      const filterBtn = screen.getByText('アクティブビュー').closest('button')!;
      expect(filterBtn.className).toContain('bg-accent');
    });
  });

  describe('通知ドット表示', () => {
    it('enableDesktopNotification が true のビューに通知ドットが表示される', () => {
      const filter = createMockFilter({
        id: 'f1',
        name: '通知あり',
        enableDesktopNotification: true,
      });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} />);

      const filterBtn = screen.getByText('通知あり').closest('button')!;
      // 通知ドット（bg-primary rounded-full）の存在確認
      const dot = filterBtn.querySelector('.bg-primary.rounded-full');
      expect(dot).toBeInTheDocument();
    });

    it('enableDesktopNotification が false のビューに通知ドットが表示されない', () => {
      const filter = createMockFilter({
        id: 'f1',
        name: '通知なし',
        enableDesktopNotification: false,
      });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} />);

      const filterBtn = screen.getByText('通知なし').closest('button')!;
      const dot = filterBtn.querySelector('.bg-primary.rounded-full');
      expect(dot).not.toBeInTheDocument();
    });
  });

  describe('プロジェクトタブバー', () => {
    const groups = [
      {
        id: 'g1',
        name: '案件A',
        repositories: ['org/repo-1'],
        color: '#3b82f6',
      },
      {
        id: 'g2',
        name: '案件B',
        repositories: ['org/repo-2'],
        color: '#22c55e',
      },
    ];

    it('グループがあるときタブバーが表示される', () => {
      render(<Sidebar {...defaultProps} repositoryGroups={groups} />);
      expect(screen.getByText('ALL')).toBeInTheDocument();
      expect(screen.getByText('案件A')).toBeInTheDocument();
      expect(screen.getByText('案件B')).toBeInTheDocument();
    });

    it('グループがないときタブバーが表示されない', () => {
      render(<Sidebar {...defaultProps} repositoryGroups={[]} />);
      expect(screen.queryByText('ALL')).not.toBeInTheDocument();
    });

    it('ALLタブクリックで onSelectGroup(null) が呼ばれる', async () => {
      const user = userEvent.setup();
      const onSelectGroup = vi.fn();
      render(
        <Sidebar
          {...defaultProps}
          repositoryGroups={groups}
          activeGroupId="g1"
          onSelectGroup={onSelectGroup}
        />,
      );

      await user.click(screen.getByText('ALL'));
      expect(onSelectGroup).toHaveBeenCalledWith(null);
    });

    it('プロジェクトタブクリックで onSelectGroup(id) が呼ばれる', async () => {
      const user = userEvent.setup();
      const onSelectGroup = vi.fn();
      render(<Sidebar {...defaultProps} repositoryGroups={groups} onSelectGroup={onSelectGroup} />);

      await user.click(screen.getByText('案件A'));
      expect(onSelectGroup).toHaveBeenCalledWith('g1');
    });

    it('非アクティブタブに未読バッジが表示される', () => {
      const allItems = [
        createMockItem({ id: '1', repositoryFullName: 'org/repo-2', unread: true }),
        createMockItem({ id: '2', repositoryFullName: 'org/repo-2', unread: true }),
        createMockItem({ id: '3', repositoryFullName: 'org/repo-2', unread: false }),
      ];
      render(
        <Sidebar
          {...defaultProps}
          repositoryGroups={groups}
          activeGroupId="g1"
          allItems={allItems}
        />,
      );

      const tabB = screen.getByText('案件B').closest('button')!;
      expect(within(tabB).getByText('2')).toBeInTheDocument();
    });

    it('アクティブタブにはバッジが表示されない', () => {
      const allItems = [
        createMockItem({ id: '1', repositoryFullName: 'org/repo-1', unread: true }),
      ];
      render(
        <Sidebar
          {...defaultProps}
          repositoryGroups={groups}
          activeGroupId="g1"
          allItems={allItems}
        />,
      );

      const tabA = screen.getByText('案件A').closest('button')!;
      expect(within(tabA).queryByText('1')).not.toBeInTheDocument();
    });

    it('アクティブグループのカラーラインが表示される', () => {
      const { container } = render(
        <Sidebar {...defaultProps} repositoryGroups={groups} activeGroupId="g1" />,
      );

      const colorLine = container.querySelector('.h-0\\.5.rounded-full');
      expect(colorLine).toBeInTheDocument();
    });

    it('タブバーが横スクロール可能なコンテナを持つ（overflow-x-auto）', () => {
      const { container } = render(<Sidebar {...defaultProps} repositoryGroups={groups} />);

      const scrollContainer = container.querySelector('.overflow-x-auto');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('未読数が99を超えるとき "99+" バッジを表示する', () => {
      const allItems = Array.from({ length: 100 }, (_, i) =>
        createMockItem({ id: String(i), repositoryFullName: 'org/repo-2', unread: true }),
      );
      render(
        <Sidebar
          {...defaultProps}
          repositoryGroups={groups}
          activeGroupId="g1"
          allItems={allItems}
        />,
      );

      const tabB = screen.getByText('案件B').closest('button')!;
      expect(within(tabB).getByText('99+')).toBeInTheDocument();
    });

    it('非アクティブタブの未読数が0のときバッジが表示されない', () => {
      const allItems = [
        createMockItem({ id: '1', repositoryFullName: 'org/repo-1', unread: true }),
      ];
      render(
        <Sidebar
          {...defaultProps}
          repositoryGroups={groups}
          activeGroupId="g1"
          allItems={allItems}
        />,
      );

      const tabB = screen.getByText('案件B').closest('button')!;
      expect(within(tabB).queryByText('0')).not.toBeInTheDocument();
    });

    it('activeGroupId が null（ALL選択）のときカラーラインが表示されない', () => {
      const { container } = render(
        <Sidebar {...defaultProps} repositoryGroups={groups} activeGroupId={null} />,
      );

      const colorLine = container.querySelector('.h-0\\.5.rounded-full');
      expect(colorLine).not.toBeInTheDocument();
    });

    it('アクティブグループにカラーが未設定のときカラーラインが表示されない', () => {
      const noColorGroups = [{ id: 'g1', name: '案件A', repositories: ['org/repo-1'], color: '' }];
      const { container } = render(
        <Sidebar {...defaultProps} repositoryGroups={noColorGroups} activeGroupId="g1" />,
      );

      const colorLine = container.querySelector('.h-0\\.5.rounded-full');
      expect(colorLine).not.toBeInTheDocument();
    });

    it('複数グループがそれぞれ固有のカラードットを表示する', () => {
      const threeGroups = [
        { id: 'g1', name: 'Alpha', repositories: ['org/a'], color: '#ff0000' },
        { id: 'g2', name: 'Beta', repositories: ['org/b'], color: '#00ff00' },
        { id: 'g3', name: 'Gamma', repositories: ['org/c'], color: '#0000ff' },
      ];
      render(<Sidebar {...defaultProps} repositoryGroups={threeGroups} />);

      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('Gamma')).toBeInTheDocument();

      const alphaBtn = screen.getByText('Alpha').closest('button')!;
      const betaBtn = screen.getByText('Beta').closest('button')!;
      const gammaBtn = screen.getByText('Gamma').closest('button')!;

      const alphaDot = alphaBtn.querySelector('.rounded-full.w-2.h-2') as HTMLElement;
      const betaDot = betaBtn.querySelector('.rounded-full.w-2.h-2') as HTMLElement;
      const gammaDot = gammaBtn.querySelector('.rounded-full.w-2.h-2') as HTMLElement;

      expect(alphaDot).toBeInTheDocument();
      expect(betaDot).toBeInTheDocument();
      expect(gammaDot).toBeInTheDocument();
      expect(alphaDot.style.backgroundColor).toBe('#ff0000');
      expect(betaDot.style.backgroundColor).toBe('#00ff00');
      expect(gammaDot.style.backgroundColor).toBe('#0000ff');
    });

    it('グループタブ選択後にALLタブクリックで選択がリセットされる', async () => {
      const user = userEvent.setup();
      const onSelectGroup = vi.fn();
      render(
        <Sidebar
          {...defaultProps}
          repositoryGroups={groups}
          activeGroupId="g1"
          onSelectGroup={onSelectGroup}
        />,
      );

      await user.click(screen.getByText('案件B'));
      expect(onSelectGroup).toHaveBeenCalledWith('g2');

      await user.click(screen.getByText('ALL'));
      expect(onSelectGroup).toHaveBeenCalledWith(null);
    });

    it('旧リストスタイル要素（プロジェクトヘッダー・GlobeIcon・FolderIcon）が存在しない', () => {
      render(<Sidebar {...defaultProps} repositoryGroups={groups} />);

      expect(screen.queryByText('プロジェクト')).not.toBeInTheDocument();
      expect(document.querySelector('[data-testid="globe-icon"]')).not.toBeInTheDocument();
      expect(document.querySelector('[data-testid="folder-icon"]')).not.toBeInTheDocument();
    });
  });

  describe('カウント表示: 境界値', () => {
    it('カウントが100以上のとき "99+" を表示する', () => {
      const filter = createMockFilter({ id: 'f1', name: '大量通知', reasons: ['mention'] });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      // 100件の未読通知を生成
      const items = Array.from({ length: 100 }, (_, i) =>
        createMockItem({ id: String(i), reason: 'mention', unread: true }),
      );

      render(<Sidebar {...defaultProps} items={items} />);

      const filterBtn = screen.getByText('大量通知').closest('button')!;
      expect(within(filterBtn).getByText('99+')).toBeInTheDocument();
    });

    it('カウントが0のときカウントバッジを表示しない', () => {
      const filter = createMockFilter({ id: 'f1', name: 'ゼロ通知', reasons: ['mention'] });
      mockSettings = { ...DEFAULT_SETTINGS, customFilters: [filter] };

      render(<Sidebar {...defaultProps} items={[]} />);

      const filterBtn = screen.getByText('ゼロ通知').closest('button')!;
      // 数値テキストが存在しない
      expect(within(filterBtn).queryByText('0')).not.toBeInTheDocument();
    });
  });
});
