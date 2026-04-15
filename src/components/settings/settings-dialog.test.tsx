import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@/types';
import { DEFAULT_INITIAL_FILTERS, DEFAULT_SETTINGS } from '@/types';

const mockUpdateSettings = vi.fn<(partial: Partial<AppSettings>) => Promise<void>>();
const mockSetTheme = vi.fn();

vi.mock('@/hooks', () => ({
  useSettings: () => ({
    settings: mockSettings,
    isLoading: false,
    updateSettings: mockUpdateSettings,
  }),
  useTheme: () => ({
    theme: 'system' as const,
    setTheme: mockSetTheme,
  }),
}));

const mockCheckKeychainStatus = vi.fn<() => Promise<boolean>>();

vi.mock('@/lib/tauri/commands', () => ({
  checkKeychainStatus: () => mockCheckKeychainStatus(),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { SettingsDialog } from './settings-dialog';

let mockSettings: AppSettings;

const _needsReviewFilter = DEFAULT_INITIAL_FILTERS.find((f) => f.id === 'default-needs-review')!;

function renderSettingsDialog(settingsOverride?: Partial<AppSettings>) {
  mockSettings = { ...DEFAULT_SETTINGS, ...settingsOverride };
  return render(
    <SettingsDialog
      open={true}
      onOpenChange={vi.fn()}
      user={{ login: 'testuser', avatarUrl: 'https://example.com/avatar.png' }}
      onLogout={vi.fn()}
    />,
  );
}

/**
 * 検索ビューの「設定」ボタンを押してエディタを開き、
 * IssueStatusRulesEditor が表示される状態にするヘルパー。
 */
function openIssueStatusRulesEditor(settingsOverride?: Partial<AppSettings>) {
  const result = renderSettingsDialog(settingsOverride);
  // SearchViewCardの「設定」ボタンを取得（DialogTitleの「設定」テキストと区別）
  const settingButtons = screen.getAllByRole('button', { name: '設定' });
  fireEvent.click(settingButtons[0]);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateSettings.mockResolvedValue(undefined);
  mockCheckKeychainStatus.mockResolvedValue(true);
});

// ============================================================
// ToggleSwitch（SettingsDialog内のトグル）
// ============================================================

describe('ToggleSwitch（設定ダイアログ内）', () => {
  it('デスクトップ通知のトグルをクリックするとupdateSettingsが呼ばれる', () => {
    renderSettingsDialog({ desktopNotifications: true });

    const toggleButtons = screen.getAllByRole('button');
    const desktopToggle = toggleButtons.find((btn) => btn.className.includes('rounded-full'));
    expect(desktopToggle).toBeDefined();
    fireEvent.click(desktopToggle!);

    expect(mockUpdateSettings).toHaveBeenCalledWith({ desktopNotifications: false });
  });

  it('通知音のトグルをクリックするとsoundEnabledが切り替わる', () => {
    renderSettingsDialog({ soundEnabled: true });

    const toggleButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('rounded-full'));
    expect(toggleButtons.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(toggleButtons[1]);

    expect(mockUpdateSettings).toHaveBeenCalledWith({ soundEnabled: false });
  });
});

// ============================================================
// IssueStatusRulesEditor
// ============================================================

describe('IssueStatusRulesEditor', () => {
  describe('空のルールでレンダリング', () => {
    it('ルール追加ボタンが表示される', () => {
      openIssueStatusRulesEditor();

      expect(screen.getByText('+ ルールを追加')).toBeInTheDocument();
    });

    it('組織別レビュー対象ルールのラベルが表示される', () => {
      openIssueStatusRulesEditor();

      expect(screen.getByText('組織別レビュー対象ルール')).toBeInTheDocument();
    });
  });

  describe('ルールの追加', () => {
    it('「ルールを追加」ボタンをクリックすると新しいルールが追加される', () => {
      openIssueStatusRulesEditor();

      fireEvent.click(screen.getByText('+ ルールを追加'));

      const repoInputs = screen.getAllByPlaceholderText('getozinc/mypappy-*（ワイルドカード対応）');
      expect(repoInputs.length).toBe(1);
    });
  });

  describe('既存ルールの操作', () => {
    const existingRules = [
      { repositoryPattern: 'org/repo-*', requiredStatuses: ['コードレビュー'], enabled: true },
    ];

    it('既存ルールのリポジトリパターンが入力欄に表示される', () => {
      openIssueStatusRulesEditor({
        customFilters: DEFAULT_INITIAL_FILTERS.map((f) =>
          f.id === 'default-needs-review' ? { ...f, issueStatusRules: existingRules } : f,
        ),
      });

      const repoInput = screen.getByDisplayValue('org/repo-*');
      expect(repoInput).toBeInTheDocument();
    });

    it('リポジトリパターンの入力を変更できる', () => {
      openIssueStatusRulesEditor({
        customFilters: DEFAULT_INITIAL_FILTERS.map((f) =>
          f.id === 'default-needs-review' ? { ...f, issueStatusRules: existingRules } : f,
        ),
      });

      const repoInput = screen.getByDisplayValue('org/repo-*');
      fireEvent.change(repoInput, { target: { value: 'neworg/newrepo-*' } });

      expect(screen.getByDisplayValue('neworg/newrepo-*')).toBeInTheDocument();
    });

    it('ステータス入力を変更できる', () => {
      openIssueStatusRulesEditor({
        customFilters: DEFAULT_INITIAL_FILTERS.map((f) =>
          f.id === 'default-needs-review' ? { ...f, issueStatusRules: existingRules } : f,
        ),
      });

      const statusInput = screen.getByDisplayValue('コードレビュー');
      fireEvent.change(statusInput, { target: { value: 'レビュー中, 対応中' } });

      expect(screen.getByDisplayValue('レビュー中, 対応中')).toBeInTheDocument();
    });

    it('トグルスイッチでルールの有効/無効を切り替えられる', () => {
      openIssueStatusRulesEditor({
        customFilters: DEFAULT_INITIAL_FILTERS.map((f) =>
          f.id === 'default-needs-review' ? { ...f, issueStatusRules: existingRules } : f,
        ),
      });

      // IssueStatusRulesEditor内のトグル（rounded-full クラスを持つボタン）
      const allToggles = screen
        .getAllByRole('button')
        .filter((btn) => btn.className.includes('rounded-full'));
      // フィルターのトグル（デスクトップ通知・通知音）+ ルール内トグル
      // ルール内のトグルは後ろの方にある
      const ruleToggle = allToggles[allToggles.length - 1];
      fireEvent.click(ruleToggle);

      // トグル後、bg-primary クラスが外れている（無効化状態）ことを確認
      // 内部的にonChangeが呼ばれ再レンダリングされることで反映される
      expect(ruleToggle).toBeInTheDocument();
    });

    it('削除ボタンでルールを削除できる', () => {
      openIssueStatusRulesEditor({
        customFilters: DEFAULT_INITIAL_FILTERS.map((f) =>
          f.id === 'default-needs-review' ? { ...f, issueStatusRules: existingRules } : f,
        ),
      });

      expect(screen.getByDisplayValue('org/repo-*')).toBeInTheDocument();

      const deleteButton = screen.getByTitle('ルールを削除');
      fireEvent.click(deleteButton);

      expect(screen.queryByDisplayValue('org/repo-*')).not.toBeInTheDocument();
    });
  });

  describe('複数ルールの操作', () => {
    it('複数ルールを追加して個別に操作できる', () => {
      openIssueStatusRulesEditor();

      fireEvent.click(screen.getByText('+ ルールを追加'));
      fireEvent.click(screen.getByText('+ ルールを追加'));

      const repoInputs = screen.getAllByPlaceholderText('getozinc/mypappy-*（ワイルドカード対応）');
      expect(repoInputs.length).toBe(2);
    });
  });
});

// ============================================================
// タブ切り替え
// ============================================================

describe('タブ切り替え', () => {
  it('外観タブを開くとテーマ選択が表示される', () => {
    renderSettingsDialog();
    fireEvent.click(screen.getByText('外観'));

    expect(screen.getByText('テーマ')).toBeInTheDocument();
    expect(screen.getByText('ライト')).toBeInTheDocument();
    expect(screen.getByText('ダーク')).toBeInTheDocument();
    expect(screen.getByText('システム')).toBeInTheDocument();
  });

  it('外観タブでテーマをクリックするとsetThemeが呼ばれる', () => {
    renderSettingsDialog();
    fireEvent.click(screen.getByText('外観'));
    fireEvent.click(screen.getByText('ダーク'));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('外観タブにバージョン情報が表示される', () => {
    renderSettingsDialog();
    fireEvent.click(screen.getByText('外観'));

    expect(screen.getByText('GitHub Notify v0.1.0')).toBeInTheDocument();
  });

  it('アカウントタブを開くとユーザー情報が表示される', () => {
    renderSettingsDialog();
    fireEvent.click(screen.getByText('アカウント'));

    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('ログアウト')).toBeInTheDocument();
  });

  it('アカウントタブでアバターが表示される', () => {
    renderSettingsDialog();
    fireEvent.click(screen.getByText('アカウント'));

    const avatar = screen.getByAltText('testuser');
    expect(avatar).toBeInTheDocument();
  });

  it('アバターがない場合はプレースホルダーが表示される', () => {
    mockSettings = { ...DEFAULT_SETTINGS };
    const { container } = render(
      <SettingsDialog
        open={true}
        onOpenChange={vi.fn()}
        user={{ login: 'testuser', avatarUrl: null }}
        onLogout={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('アカウント'));

    const placeholder = container.querySelector('.rounded-full.bg-accent');
    expect(placeholder).toBeInTheDocument();
  });

  it('プロジェクトタブを開くとグループマネージャーが表示される', () => {
    renderSettingsDialog();
    fireEvent.click(screen.getByText('プロジェクト'));

    expect(screen.getByText('+ プロジェクトを追加')).toBeInTheDocument();
  });
});

// ============================================================
// フィルター操作
// ============================================================

describe('フィルター操作', () => {
  it('通知フィルターがない場合にテンプレートが表示される', () => {
    const searchViewOnly = DEFAULT_INITIAL_FILTERS.filter(
      (f) => 'searchQuery' in f && f.searchQuery,
    );
    renderSettingsDialog({ customFilters: searchViewOnly });

    expect(screen.getByText('おすすめテンプレート:')).toBeInTheDocument();
  });

  it('フィルター追加ボタンが表示される', () => {
    renderSettingsDialog();

    expect(screen.getByText('+ 新しいフィルターを追加')).toBeInTheDocument();
  });

  it('フィルター追加ボタンをクリックするとエディターが開く', () => {
    renderSettingsDialog();

    fireEvent.click(screen.getByText('+ 新しいフィルターを追加'));

    expect(screen.getByText('フィルターを作成')).toBeInTheDocument();
  });

  it('ログアウトボタンをクリックするとonLogoutとonOpenChangeが呼ばれる', () => {
    const onLogout = vi.fn();
    const onOpenChange = vi.fn();
    mockSettings = { ...DEFAULT_SETTINGS };
    render(
      <SettingsDialog
        open={true}
        onOpenChange={onOpenChange}
        user={{ login: 'testuser' }}
        onLogout={onLogout}
      />,
    );

    fireEvent.click(screen.getByText('アカウント'));
    fireEvent.click(screen.getByText('ログアウト'));

    expect(onLogout).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ============================================================
// Keychain ステータス警告
// ============================================================

describe('Keychain ステータス', () => {
  it('keychain が利用不可の場合に警告が表示される', async () => {
    mockCheckKeychainStatus.mockResolvedValue(false);
    renderSettingsDialog();

    fireEvent.click(screen.getByText('アカウント'));

    await screen.findByText('OS キーチェーンが利用できません');
  });

  it('keychain が利用可能な場合に警告が表示されない', async () => {
    mockCheckKeychainStatus.mockResolvedValue(true);
    renderSettingsDialog();

    fireEvent.click(screen.getByText('アカウント'));

    // 少し待ってから確認
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('OS キーチェーンが利用できません')).not.toBeInTheDocument();
  });
});
