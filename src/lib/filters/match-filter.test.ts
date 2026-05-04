import { describe, expect, it } from 'vitest';
import type { InboxItem } from '@/types';
import type { CustomFilter, NotificationReason } from '@/types/settings';
import { isGloballyExcluded, matchesFilter, shouldShowItem } from './match-filter';

function makeItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: '1',
    title: 'Test',
    url: null,
    reason: 'mention',
    unread: true,
    updatedAt: '2024-01-01T00:00:00Z',
    itemType: 'PullRequest',
    repositoryName: 'repo',
    repositoryFullName: 'owner/repo',
    ownerLogin: 'owner',
    ownerAvatar: '',
    ...overrides,
  };
}

function makeFilter(overrides: Partial<CustomFilter> = {}): CustomFilter {
  return {
    id: 'f1',
    name: 'Test',
    reasons: [],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
    ...overrides,
  };
}

describe('matchesFilter', () => {
  it('globalExcludeReasons に含まれる reason は除外される', () => {
    const item = makeItem({ reason: 'subscribed' });
    const filter = makeFilter({ reasons: [] });
    expect(matchesFilter(item, filter, ['subscribed'])).toBe(false);
  });

  it('globalExcludeReasons が空なら除外されない', () => {
    const item = makeItem({ reason: 'subscribed' });
    const filter = makeFilter({ reasons: [] });
    expect(matchesFilter(item, filter, [])).toBe(true);
  });

  it('filter.reasons が空なら全 reason を許可', () => {
    const item = makeItem({ reason: 'comment' });
    const filter = makeFilter({ reasons: [] });
    expect(matchesFilter(item, filter)).toBe(true);
  });

  it('filter.reasons に含まれない reason は除外', () => {
    const item = makeItem({ reason: 'comment' });
    const filter = makeFilter({ reasons: ['mention'] });
    expect(matchesFilter(item, filter)).toBe(false);
  });

  it('filter.reasons に含まれる reason は通過', () => {
    const item = makeItem({ reason: 'mention' });
    const filter = makeFilter({ reasons: ['mention', 'assign'] });
    expect(matchesFilter(item, filter)).toBe(true);
  });

  it('filter.repositories に含まれないリポジトリは除外', () => {
    const item = makeItem({ repositoryFullName: 'owner/other' });
    const filter = makeFilter({ reasons: [], repositories: ['owner/repo'] });
    expect(matchesFilter(item, filter)).toBe(false);
  });

  it('filter.repositories に含まれるリポジトリは通過', () => {
    const item = makeItem({ repositoryFullName: 'owner/repo' });
    const filter = makeFilter({ reasons: [], repositories: ['owner/repo'] });
    expect(matchesFilter(item, filter)).toBe(true);
  });

  it('filter.repositories が空なら全リポジトリ許可', () => {
    const item = makeItem({ repositoryFullName: 'owner/any' });
    const filter = makeFilter({ reasons: [], repositories: [] });
    expect(matchesFilter(item, filter)).toBe(true);
  });

  it('グローバル除外が reason とリポジトリの両方より優先される', () => {
    const item = makeItem({ reason: 'subscribed', repositoryFullName: 'owner/repo' });
    const filter = makeFilter({ reasons: [], repositories: ['owner/repo'] });
    expect(matchesFilter(item, filter, ['subscribed'])).toBe(false);
  });
});

describe('isGloballyExcluded', () => {
  it('除外リストに含まれる reason は true', () => {
    const item = makeItem({ reason: 'subscribed' });
    expect(isGloballyExcluded(item, ['subscribed', 'author'])).toBe(true);
  });

  it('除外リストに含まれない reason は false', () => {
    const item = makeItem({ reason: 'mention' });
    expect(isGloballyExcluded(item, ['subscribed'])).toBe(false);
  });
});

describe('shouldShowItem', () => {
  it('いずれかのフィルタにマッチすれば true', () => {
    const item = makeItem({ reason: 'mention' });
    const filters = [
      makeFilter({ id: 'f1', reasons: ['assign'] }),
      makeFilter({ id: 'f2', reasons: ['mention'] }),
    ];
    expect(shouldShowItem(item, filters)).toBe(true);
  });

  it('どのフィルタにもマッチしなければ false', () => {
    const item = makeItem({ reason: 'subscribed' });
    const filters = [makeFilter({ id: 'f1', reasons: ['mention'] })];
    expect(shouldShowItem(item, filters)).toBe(false);
  });

  it('グローバル除外が適用される', () => {
    const item = makeItem({ reason: 'mention' });
    const filters = [makeFilter({ id: 'f1', reasons: ['mention'] })];
    expect(shouldShowItem(item, filters, ['mention'])).toBe(false);
  });

  it('searchView フィルタは除外される', () => {
    const item = makeItem({ reason: 'mention' });
    const filters = [makeFilter({ id: 'search', reasons: [], searchQuery: 'is:open' })];
    expect(shouldShowItem(item, filters)).toBe(false);
  });
});
