import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterTemplates } from './filter-templates';

describe('FilterTemplates', () => {
  it('4つのテンプレートボタンが表示されること', () => {
    render(<FilterTemplates onAddFilter={vi.fn()} />);

    expect(screen.getByText('📝 レビュー依頼')).toBeInTheDocument();
    expect(screen.getByText('💬 メンション')).toBeInTheDocument();
    expect(screen.getByText('👤 アサイン')).toBeInTheDocument();
    expect(screen.getByText('⭐ 重要な通知')).toBeInTheDocument();
  });

  it('レビュー依頼テンプレートをクリックすると正しいテンプレートが渡されること', async () => {
    const user = userEvent.setup();
    const onAddFilter = vi.fn();
    render(<FilterTemplates onAddFilter={onAddFilter} />);

    await user.click(screen.getByText('📝 レビュー依頼'));

    expect(onAddFilter).toHaveBeenCalledWith({
      name: 'レビュー依頼',
      description: 'PRのレビューを依頼された時',
      reasons: ['review_requested'],
      enableDesktopNotification: true,
      enableSound: true,
      soundType: 'default',
    });
  });

  it('メンションテンプレートをクリックすると正しいテンプレートが渡されること', async () => {
    const user = userEvent.setup();
    const onAddFilter = vi.fn();
    render(<FilterTemplates onAddFilter={onAddFilter} />);

    await user.click(screen.getByText('💬 メンション'));

    expect(onAddFilter).toHaveBeenCalledWith({
      name: 'メンション',
      description: '@で名前を呼ばれた時',
      reasons: ['mention', 'team_mention'],
      enableDesktopNotification: true,
      enableSound: true,
      soundType: 'default',
    });
  });

  it('アサインテンプレートをクリックすると正しいテンプレートが渡されること', async () => {
    const user = userEvent.setup();
    const onAddFilter = vi.fn();
    render(<FilterTemplates onAddFilter={onAddFilter} />);

    await user.click(screen.getByText('👤 アサイン'));

    expect(onAddFilter).toHaveBeenCalledWith({
      name: 'アサイン',
      description: 'Issue/PRにアサインされた時',
      reasons: ['assign'],
      enableDesktopNotification: true,
      enableSound: true,
      soundType: 'soft',
    });
  });

  it('重要な通知テンプレートをクリックすると正しいテンプレートが渡されること', async () => {
    const user = userEvent.setup();
    const onAddFilter = vi.fn();
    render(<FilterTemplates onAddFilter={onAddFilter} />);

    await user.click(screen.getByText('⭐ 重要な通知'));

    expect(onAddFilter).toHaveBeenCalledWith({
      name: '重要な通知',
      description: 'レビュー依頼・メンション・アサイン',
      reasons: ['review_requested', 'mention', 'team_mention', 'assign'],
      enableDesktopNotification: true,
      enableSound: true,
      soundType: 'default',
    });
  });
});
