import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryGroup } from '@/types/settings';
import { REASON_LABELS } from '@/types/settings';
import { GroupManager } from './group-manager';

const MOCK_UUID = 'test-uuid-1234';
vi.stubGlobal('crypto', { randomUUID: () => MOCK_UUID });

function createMockGroup(overrides: Partial<RepositoryGroup> = {}): RepositoryGroup {
  return {
    id: 'g1',
    name: '案件A',
    repositories: ['org/repo-1'],
    color: '#3b82f6',
    enableDesktopNotification: false,
    notifyReasons: [],
    enableSound: false,
    soundType: 'default',
    ...overrides,
  };
}

const defaultProps = {
  groups: [] as RepositoryGroup[],
  knownRepos: ['org/repo-1', 'org/repo-2'],
  onSave: vi.fn(),
};

async function openNewGroupForm() {
  const user = userEvent.setup();
  render(<GroupManager {...defaultProps} />);
  await user.click(screen.getByText('+ プロジェクトを追加'));
  return user;
}

async function openEditGroupForm(group: RepositoryGroup, onSave?: ReturnType<typeof vi.fn>) {
  const user = userEvent.setup();
  render(
    <GroupManager
      groups={[group]}
      knownRepos={defaultProps.knownRepos}
      onSave={onSave ?? defaultProps.onSave}
    />,
  );
  await user.click(screen.getByText('編集'));
  return user;
}

function getToggleSwitchByLabel(labelText: string): HTMLButtonElement {
  const label = screen.getByText(labelText);
  const container = label.closest('.flex.items-center.justify-between')!;
  return within(container as HTMLElement).getByRole('button') as HTMLButtonElement;
}

describe('GroupManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('グループ一覧表示', () => {
    it('グループがないとき案内メッセージが表示される', () => {
      render(<GroupManager {...defaultProps} />);
      expect(
        screen.getByText('プロジェクトを作成すると、案件ごとに通知を分けて表示できます'),
      ).toBeInTheDocument();
    });

    it('追加ボタンが表示される', () => {
      render(<GroupManager {...defaultProps} />);
      expect(screen.getByText('+ プロジェクトを追加')).toBeInTheDocument();
    });

    it('既存グループが一覧に表示される', () => {
      const group = createMockGroup();
      render(<GroupManager {...defaultProps} groups={[group]} />);
      expect(screen.getByText('案件A')).toBeInTheDocument();
      expect(screen.getByText('1リポ')).toBeInTheDocument();
    });
  });

  describe('新規グループフォーム: 通知設定セクション', () => {
    it('通知設定セクションが表示される', async () => {
      await openNewGroupForm();
      expect(screen.getByText('通知設定')).toBeInTheDocument();
    });

    it('デスクトップ通知トグルが表示される', async () => {
      await openNewGroupForm();
      expect(screen.getByText('デスクトップ通知')).toBeInTheDocument();
    });

    it('初期状態ではデスクトップ通知がOFF', async () => {
      await openNewGroupForm();
      const toggle = getToggleSwitchByLabel('デスクトップ通知');
      expect(toggle.className).not.toContain('bg-primary');
    });
  });

  describe('デスクトップ通知トグル', () => {
    it('トグルクリックでONになる', async () => {
      const user = await openNewGroupForm();
      const toggle = getToggleSwitchByLabel('デスクトップ通知');

      await user.click(toggle);

      expect(toggle.className).toContain('bg-primary');
    });

    it('ONからもう一度クリックでOFFに戻る', async () => {
      const user = await openNewGroupForm();
      const toggle = getToggleSwitchByLabel('デスクトップ通知');

      await user.click(toggle);
      expect(toggle.className).toContain('bg-primary');

      await user.click(toggle);
      expect(toggle.className).not.toContain('bg-primary');
    });
  });

  describe('デスクトップ通知ON時: 通知する種類チェックボックス', () => {
    it('通知する種類のチェックボックスが表示される', async () => {
      const user = await openNewGroupForm();
      await user.click(getToggleSwitchByLabel('デスクトップ通知'));

      expect(screen.getByText('通知する種類（未選択 = すべて通知）:')).toBeInTheDocument();
      expect(screen.getByText(REASON_LABELS.review_requested)).toBeInTheDocument();
      expect(screen.getByText(REASON_LABELS.mention)).toBeInTheDocument();
      expect(screen.getByText(REASON_LABELS.assign)).toBeInTheDocument();
      expect(screen.getByText(REASON_LABELS.comment)).toBeInTheDocument();
    });

    it('個別のreasonをトグルできる', async () => {
      const user = await openNewGroupForm();
      await user.click(getToggleSwitchByLabel('デスクトップ通知'));

      const reviewLabel = screen.getByText(REASON_LABELS.review_requested);
      const checkbox = reviewLabel.closest('label')!.querySelector('input[type="checkbox"]')!;
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('複数のreasonを同時に選択できる', async () => {
      const user = await openNewGroupForm();
      await user.click(getToggleSwitchByLabel('デスクトップ通知'));

      const reviewCheckbox = screen
        .getByText(REASON_LABELS.review_requested)
        .closest('label')!
        .querySelector('input[type="checkbox"]')!;
      const mentionCheckbox = screen
        .getByText(REASON_LABELS.mention)
        .closest('label')!
        .querySelector('input[type="checkbox"]')!;

      await user.click(reviewCheckbox);
      await user.click(mentionCheckbox);

      expect(reviewCheckbox).toBeChecked();
      expect(mentionCheckbox).toBeChecked();
    });
  });

  describe('デスクトップ通知ON時: 通知音トグル', () => {
    it('通知音トグルが表示される', async () => {
      const user = await openNewGroupForm();
      await user.click(getToggleSwitchByLabel('デスクトップ通知'));

      expect(screen.getByText('通知音')).toBeInTheDocument();
    });

    it('通知音トグルの初期状態はOFF', async () => {
      const user = await openNewGroupForm();
      await user.click(getToggleSwitchByLabel('デスクトップ通知'));

      const soundToggle = getToggleSwitchByLabel('通知音');
      expect(soundToggle.className).not.toContain('bg-primary');
    });

    it('通知音トグルをONにできる', async () => {
      const user = await openNewGroupForm();
      await user.click(getToggleSwitchByLabel('デスクトップ通知'));

      const soundToggle = getToggleSwitchByLabel('通知音');
      await user.click(soundToggle);
      expect(soundToggle.className).toContain('bg-primary');
    });
  });

  describe('通知音ON時: サウンドタイプ選択', () => {
    async function enableDesktopAndSound() {
      const user = await openNewGroupForm();
      await user.click(getToggleSwitchByLabel('デスクトップ通知'));
      await user.click(getToggleSwitchByLabel('通知音'));
      return user;
    }

    it('サウンドタイプボタン（標準/ソフト/チャイム）が表示される', async () => {
      await enableDesktopAndSound();

      expect(screen.getByText('標準')).toBeInTheDocument();
      expect(screen.getByText('ソフト')).toBeInTheDocument();
      expect(screen.getByText('チャイム')).toBeInTheDocument();
    });

    it('デフォルトで「標準」が選択されている', async () => {
      await enableDesktopAndSound();

      const defaultBtn = screen.getByText('標準');
      expect(defaultBtn.className).toContain('border-primary');
    });

    it('「ソフト」をクリックすると選択が切り替わる', async () => {
      const user = await enableDesktopAndSound();

      await user.click(screen.getByText('ソフト'));

      expect(screen.getByText('ソフト').className).toContain('border-primary');
      expect(screen.getByText('標準').className).not.toContain('border-primary');
    });

    it('「チャイム」をクリックすると選択が切り替わる', async () => {
      const user = await enableDesktopAndSound();

      await user.click(screen.getByText('チャイム'));

      expect(screen.getByText('チャイム').className).toContain('border-primary');
      expect(screen.getByText('標準').className).not.toContain('border-primary');
    });
  });

  describe('デスクトップ通知OFF時: 通知関連セクション非表示', () => {
    it('通知する種類セクションが非表示', async () => {
      await openNewGroupForm();
      expect(screen.queryByText('通知する種類（未選択 = すべて通知）:')).not.toBeInTheDocument();
    });

    it('通知音トグルが非表示', async () => {
      await openNewGroupForm();
      expect(screen.queryByText('通知音')).not.toBeInTheDocument();
    });

    it('サウンドタイプボタンが非表示', async () => {
      await openNewGroupForm();
      expect(screen.queryByText('標準')).not.toBeInTheDocument();
      expect(screen.queryByText('ソフト')).not.toBeInTheDocument();
      expect(screen.queryByText('チャイム')).not.toBeInTheDocument();
    });

    it('デスクトップ通知をONにしてから再度OFFにすると通知セクションが隠れる', async () => {
      const user = await openNewGroupForm();
      const toggle = getToggleSwitchByLabel('デスクトップ通知');

      await user.click(toggle);
      expect(screen.getByText('通知音')).toBeInTheDocument();

      await user.click(toggle);
      expect(screen.queryByText('通知音')).not.toBeInTheDocument();
      expect(screen.queryByText('通知する種類（未選択 = すべて通知）:')).not.toBeInTheDocument();
    });
  });

  describe('保存: 通知設定が正しく反映される', () => {
    it('通知設定なしで保存するとデフォルト値が使われる', async () => {
      const user = await openNewGroupForm();
      const onSave = defaultProps.onSave;

      const nameInput = screen.getByPlaceholderText('プロジェクト名');
      await user.type(nameInput, 'テスト案件');
      await user.click(screen.getByText('保存'));

      expect(onSave).toHaveBeenCalledWith([
        expect.objectContaining({
          id: MOCK_UUID,
          name: 'テスト案件',
          enableDesktopNotification: false,
          notifyReasons: [],
          enableSound: false,
          soundType: 'default',
        }),
      ]);
    });

    it('通知設定を有効にして保存すると正しいデータが渡される', async () => {
      const user = await openNewGroupForm();
      const onSave = defaultProps.onSave;

      await user.type(screen.getByPlaceholderText('プロジェクト名'), '通知あり案件');

      await user.click(getToggleSwitchByLabel('デスクトップ通知'));

      const reviewCheckbox = screen
        .getByText(REASON_LABELS.review_requested)
        .closest('label')!
        .querySelector('input[type="checkbox"]')!;
      const mentionCheckbox = screen
        .getByText(REASON_LABELS.mention)
        .closest('label')!
        .querySelector('input[type="checkbox"]')!;
      await user.click(reviewCheckbox);
      await user.click(mentionCheckbox);

      await user.click(getToggleSwitchByLabel('通知音'));
      await user.click(screen.getByText('チャイム'));

      await user.click(screen.getByText('保存'));

      expect(onSave).toHaveBeenCalledWith([
        expect.objectContaining({
          name: '通知あり案件',
          enableDesktopNotification: true,
          notifyReasons: ['review_requested', 'mention'],
          enableSound: true,
          soundType: 'chime',
        }),
      ]);
    });

    it('名前が空のときは保存ボタンが無効', async () => {
      await openNewGroupForm();
      const saveButton = screen.getByText('保存');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('既存グループ編集: 通知設定の保持', () => {
    it('通知設定がONの既存グループを編集すると設定が保持される', async () => {
      const group = createMockGroup({
        enableDesktopNotification: true,
        notifyReasons: ['review_requested', 'assign'],
        enableSound: true,
        soundType: 'soft',
      });

      await openEditGroupForm(group);

      const desktopToggle = getToggleSwitchByLabel('デスクトップ通知');
      expect(desktopToggle.className).toContain('bg-primary');

      const reviewCheckbox = screen
        .getByText(REASON_LABELS.review_requested)
        .closest('label')!
        .querySelector('input[type="checkbox"]')!;
      const assignCheckbox = screen
        .getByText(REASON_LABELS.assign)
        .closest('label')!
        .querySelector('input[type="checkbox"]')!;
      const mentionCheckbox = screen
        .getByText(REASON_LABELS.mention)
        .closest('label')!
        .querySelector('input[type="checkbox"]')!;

      expect(reviewCheckbox).toBeChecked();
      expect(assignCheckbox).toBeChecked();
      expect(mentionCheckbox).not.toBeChecked();

      const soundToggle = getToggleSwitchByLabel('通知音');
      expect(soundToggle.className).toContain('bg-primary');

      expect(screen.getByText('ソフト').className).toContain('border-primary');
      expect(screen.getByText('標準').className).not.toContain('border-primary');
    });

    it('既存グループの通知設定を変更して保存できる', async () => {
      const onSave = vi.fn();
      const group = createMockGroup({
        enableDesktopNotification: true,
        notifyReasons: ['review_requested'],
        enableSound: false,
        soundType: 'default',
      });

      const user = await openEditGroupForm(group, onSave);

      const mentionCheckbox = screen
        .getByText(REASON_LABELS.mention)
        .closest('label')!
        .querySelector('input[type="checkbox"]')!;
      await user.click(mentionCheckbox);

      await user.click(getToggleSwitchByLabel('通知音'));
      await user.click(screen.getByText('ソフト'));

      await user.click(screen.getByText('保存'));

      expect(onSave).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'g1',
          enableDesktopNotification: true,
          notifyReasons: ['review_requested', 'mention'],
          enableSound: true,
          soundType: 'soft',
        }),
      ]);
    });

    it('通知OFFの既存グループは通知セクションが隠れている', async () => {
      const group = createMockGroup({
        enableDesktopNotification: false,
      });

      await openEditGroupForm(group);

      expect(screen.queryByText('通知する種類（未選択 = すべて通知）:')).not.toBeInTheDocument();
      expect(screen.queryByText('通知音')).not.toBeInTheDocument();
    });
  });

  describe('キャンセル操作', () => {
    it('キャンセルボタンクリックでフォームが閉じる', async () => {
      const user = await openNewGroupForm();

      expect(screen.getByPlaceholderText('プロジェクト名')).toBeInTheDocument();

      await user.click(screen.getByText('キャンセル'));

      expect(screen.queryByPlaceholderText('プロジェクト名')).not.toBeInTheDocument();
      expect(screen.getByText('+ プロジェクトを追加')).toBeInTheDocument();
    });
  });
});
