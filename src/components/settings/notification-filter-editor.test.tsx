import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { CustomFilter, NotificationReason } from '@/types';
import { IssueStatusRulesEditor, NotificationFilterEditor } from './notification-filter-editor';

const baseFilter: CustomFilter = {
  id: 'test-filter-1',
  name: 'テストフィルター',
  reasons: ['review_requested'],
  enableDesktopNotification: true,
  enableSound: true,
  soundType: 'default',
  repositories: [],
};

describe('NotificationFilterEditor', () => {
  const defaultProps = {
    filter: baseFilter,
    isCreating: false,
    onUpdate: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onToggleReason: vi.fn(),
  };

  it('編集モードでタイトルが「フィルターを編集」になること', () => {
    render(<NotificationFilterEditor {...defaultProps} />);
    expect(screen.getByText('フィルターを編集')).toBeInTheDocument();
  });

  it('作成モードでタイトルが「フィルターを作成」になること', () => {
    render(<NotificationFilterEditor {...defaultProps} isCreating={true} />);
    expect(screen.getByText('フィルターを作成')).toBeInTheDocument();
  });

  it('フィルター名が表示されること', () => {
    render(<NotificationFilterEditor {...defaultProps} />);
    const input = screen.getByPlaceholderText('フィルター名');
    expect(input).toHaveValue('テストフィルター');
  });

  it('フィルター名を変更するとonUpdateが呼ばれること', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<NotificationFilterEditor {...defaultProps} onUpdate={onUpdate} />);

    const input = screen.getByPlaceholderText('フィルター名');
    await user.clear(input);
    await user.type(input, '新しい名前');

    expect(onUpdate).toHaveBeenCalled();
  });

  it('チェックボックスをクリックするとonToggleReasonが呼ばれること', async () => {
    const user = userEvent.setup();
    const onToggleReason = vi.fn();
    render(<NotificationFilterEditor {...defaultProps} onToggleReason={onToggleReason} />);

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    expect(onToggleReason).toHaveBeenCalled();
  });

  it('デスクトップ通知が有効な場合にベルアイコンが表示されること', () => {
    render(<NotificationFilterEditor {...defaultProps} />);
    expect(screen.getByText('🔔')).toBeInTheDocument();
  });

  it('デスクトップ通知が無効な場合にベルアイコンが表示されないこと', () => {
    const filter = { ...baseFilter, enableDesktopNotification: false };
    render(<NotificationFilterEditor {...defaultProps} filter={filter} />);
    expect(screen.queryByText('🔔')).not.toBeInTheDocument();
  });

  it('通知音が有効でデスクトップ通知も有効な場合にスピーカーアイコンが表示されること', () => {
    render(<NotificationFilterEditor {...defaultProps} />);
    expect(screen.getByText('🔊')).toBeInTheDocument();
  });

  it('通知音が有効でもデスクトップ通知が無効ならスピーカーアイコンが表示されないこと', () => {
    const filter = { ...baseFilter, enableDesktopNotification: false, enableSound: true };
    render(<NotificationFilterEditor {...defaultProps} filter={filter} />);
    expect(screen.queryByText('🔊')).not.toBeInTheDocument();
  });

  it('通知音が無効の場合にスピーカーアイコンが表示されないこと', () => {
    const filter = { ...baseFilter, enableSound: false };
    render(<NotificationFilterEditor {...defaultProps} filter={filter} />);
    expect(screen.queryByText('🔊')).not.toBeInTheDocument();
  });

  it('通知音とデスクトップ通知が有効な場合にサウンド種類ボタンが表示されること', () => {
    render(<NotificationFilterEditor {...defaultProps} />);
    expect(screen.getByText('標準')).toBeInTheDocument();
    expect(screen.getByText('ソフト')).toBeInTheDocument();
    expect(screen.getByText('チャイム')).toBeInTheDocument();
  });

  it('通知音が無効の場合にサウンド種類ボタンが非表示なこと', () => {
    const filter = { ...baseFilter, enableSound: false };
    render(<NotificationFilterEditor {...defaultProps} filter={filter} />);
    expect(screen.queryByText('標準')).not.toBeInTheDocument();
  });

  it('サウンド種類ボタンをクリックするとonUpdateが呼ばれること', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<NotificationFilterEditor {...defaultProps} onUpdate={onUpdate} />);

    await user.click(screen.getByText('ソフト'));
    expect(onUpdate).toHaveBeenCalledWith({ ...baseFilter, soundType: 'soft' });
  });

  it('デスクトップ通知トグルをクリックするとonUpdateが呼ばれること', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<NotificationFilterEditor {...defaultProps} onUpdate={onUpdate} />);

    const desktopCheckbox = screen.getByRole('checkbox', { name: /デスクトップ通知/ });
    await user.click(desktopCheckbox);

    expect(onUpdate).toHaveBeenCalledWith({
      ...baseFilter,
      enableDesktopNotification: false,
    });
  });

  it('通知音トグルをクリックするとonUpdateが呼ばれること', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<NotificationFilterEditor {...defaultProps} onUpdate={onUpdate} />);

    const soundCheckbox = screen.getByRole('checkbox', { name: /通知音/ });
    await user.click(soundCheckbox);

    expect(onUpdate).toHaveBeenCalledWith({
      ...baseFilter,
      enableSound: false,
    });
  });

  it('保存ボタンをクリックするとonSaveが呼ばれること', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<NotificationFilterEditor {...defaultProps} onSave={onSave} />);

    await user.click(screen.getByText('保存'));
    expect(onSave).toHaveBeenCalled();
  });

  it('キャンセルボタンをクリックするとonCancelが呼ばれること', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<NotificationFilterEditor {...defaultProps} onCancel={onCancel} />);

    await user.click(screen.getByText('キャンセル'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('リポジトリフィールドに値を入力するとonUpdateが呼ばれること', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<NotificationFilterEditor {...defaultProps} onUpdate={onUpdate} />);

    const textarea = screen.getByPlaceholderText('owner/repo（1行に1つ）');
    await user.type(textarea, 'owner/repo');

    expect(onUpdate).toHaveBeenCalled();
  });

  it('デスクトップ通知が無効な場合に通知音チェックボックスがdisabledになること', () => {
    const filter = { ...baseFilter, enableDesktopNotification: false };
    render(<NotificationFilterEditor {...defaultProps} filter={filter} />);

    const soundCheckbox = screen.getByRole('checkbox', { name: /通知音/ });
    expect(soundCheckbox).toBeDisabled();
  });
});

describe('IssueStatusRulesEditor', () => {
  it('ルール追加ボタンが表示されること', () => {
    render(<IssueStatusRulesEditor rules={[]} onChange={vi.fn()} />);
    expect(screen.getByText('+ ルールを追加')).toBeInTheDocument();
  });

  it('ルール追加ボタンをクリックすると新しいルールが追加されること', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<IssueStatusRulesEditor rules={[]} onChange={onChange} />);

    await user.click(screen.getByText('+ ルールを追加'));

    expect(onChange).toHaveBeenCalledWith([
      { repositoryPattern: '', requiredStatuses: [], enabled: true },
    ]);
  });

  it('既存ルールが表示されること', () => {
    const rules = [
      { repositoryPattern: 'owner/repo-*', requiredStatuses: ['コードレビュー'], enabled: true },
    ];
    render(<IssueStatusRulesEditor rules={rules} onChange={vi.fn()} />);

    const input = screen.getByDisplayValue('owner/repo-*');
    expect(input).toBeInTheDocument();
  });

  it('ルールのパターンを変更するとonChangeが呼ばれること', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = [{ repositoryPattern: '', requiredStatuses: [], enabled: true }];
    render(<IssueStatusRulesEditor rules={rules} onChange={onChange} />);

    const input = screen.getByPlaceholderText('getozinc/mypappy-*（ワイルドカード対応）');
    await user.type(input, 'test');

    expect(onChange).toHaveBeenCalled();
  });

  it('ルールを削除するとonChangeが呼ばれること', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const rules = [{ repositoryPattern: 'owner/repo', requiredStatuses: [], enabled: true }];
    render(<IssueStatusRulesEditor rules={rules} onChange={onChange} />);

    const deleteButton = screen.getByTitle('ルールを削除');
    await user.click(deleteButton);

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
