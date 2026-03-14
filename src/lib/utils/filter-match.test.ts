import { describe, expect, it } from 'vitest';
import type { InboxItem } from '@/types';
import type { CustomFilter } from '@/types/settings';
import { matchesCustomFilter } from './filter-match';

const baseItem: InboxItem = {
  id: '1',
  title: 'Test',
  url: null,
  reason: 'review_requested',
  unread: true,
  updatedAt: '2025-01-01T00:00:00Z',
  itemType: 'PullRequest',
  repositoryName: 'repo',
  repositoryFullName: 'owner/repo',
  ownerLogin: 'owner',
  ownerAvatar: '',
};

const baseFilter: CustomFilter = {
  id: 'test',
  name: 'Test',
  reasons: [],
  enableDesktopNotification: false,
  enableSound: false,
  soundType: 'default',
};

describe('matchesCustomFilter', () => {
  it('reasonが空のフィルタは全アイテムにマッチ', () => {
    expect(matchesCustomFilter(baseItem, baseFilter)).toBe(true);
  });

  it('reasonにアイテムのreasonが含まれていればマッチ', () => {
    const filter = { ...baseFilter, reasons: ['review_requested' as const] };
    expect(matchesCustomFilter(baseItem, filter)).toBe(true);
  });

  it('reasonにアイテムのreasonが含まれていなければ不一致', () => {
    const filter = { ...baseFilter, reasons: ['mention' as const] };
    expect(matchesCustomFilter(baseItem, filter)).toBe(false);
  });

  it('repositoriesが空ならリポジトリフィルタなし', () => {
    const filter = { ...baseFilter, repositories: [] };
    expect(matchesCustomFilter(baseItem, filter)).toBe(true);
  });

  it('repositoriesにマッチすれば通過', () => {
    const filter = { ...baseFilter, repositories: ['owner/repo'] };
    expect(matchesCustomFilter(baseItem, filter)).toBe(true);
  });

  it('repositoriesにマッチしなければ不一致', () => {
    const filter = { ...baseFilter, repositories: ['other/repo'] };
    expect(matchesCustomFilter(baseItem, filter)).toBe(false);
  });

  it('reason + repository の複合条件: 両方マッチ', () => {
    const filter = {
      ...baseFilter,
      reasons: ['review_requested' as const],
      repositories: ['owner/repo'],
    };
    expect(matchesCustomFilter(baseItem, filter)).toBe(true);
  });

  it('reason + repository の複合条件: reasonのみマッチ', () => {
    const filter = {
      ...baseFilter,
      reasons: ['review_requested' as const],
      repositories: ['other/repo'],
    };
    expect(matchesCustomFilter(baseItem, filter)).toBe(false);
  });

  it('repositoriesがundefinedならリポジトリフィルタなし', () => {
    const filter = { ...baseFilter, repositories: undefined };
    expect(matchesCustomFilter(baseItem, filter)).toBe(true);
  });
});
