import { describe, expect, it } from 'vitest';
import type { InboxItem } from '@/types';
import type { CustomFilter, RepositoryGroup } from '@/types/settings';
import { getNotifiableItems, shouldNotifyByGroup } from './use-inbox-notification';

function makeItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: '1',
    title: 'Test PR',
    reason: 'review_requested',
    unread: true,
    updatedAt: new Date().toISOString(),
    repositoryFullName: 'org/repo-1',
    url: '',
    type: 'PullRequest',
    ...overrides,
  };
}

function makeGroup(overrides: Partial<RepositoryGroup> = {}): RepositoryGroup {
  return {
    id: 'group-1',
    name: 'Project A',
    repositories: ['org/repo-1', 'org/repo-2'],
    color: '#3b82f6',
    enableDesktopNotification: true,
    notifyReasons: [],
    enableSound: false,
    soundType: 'default',
    ...overrides,
  };
}

describe('shouldNotifyByGroup', () => {
  it('returns null when item does not belong to any group', () => {
    const item = makeItem({ repositoryFullName: 'org/unknown' });
    const result = shouldNotifyByGroup(item, [makeGroup()]);
    expect(result).toBeNull();
  });

  it('returns notify=true when group has desktop notification enabled and no reason filter', () => {
    const item = makeItem({ reason: 'comment' });
    const result = shouldNotifyByGroup(item, [makeGroup()]);
    expect(result).toEqual({ notify: true, soundEnabled: false, soundType: 'default' });
  });

  it('returns notify=false when group has desktop notification disabled', () => {
    const item = makeItem();
    const group = makeGroup({ enableDesktopNotification: false });
    const result = shouldNotifyByGroup(item, [group]);
    expect(result).toEqual({ notify: false, soundEnabled: false, soundType: 'default' });
  });

  it('returns notify=true when item reason matches group notifyReasons', () => {
    const item = makeItem({ reason: 'mention' });
    const group = makeGroup({ notifyReasons: ['mention', 'assign'] });
    const result = shouldNotifyByGroup(item, [group]);
    expect(result).toEqual({ notify: true, soundEnabled: false, soundType: 'default' });
  });

  it('returns notify=false when item reason does not match group notifyReasons', () => {
    const item = makeItem({ reason: 'comment' });
    const group = makeGroup({ notifyReasons: ['mention', 'assign'] });
    const result = shouldNotifyByGroup(item, [group]);
    expect(result).toEqual({ notify: false, soundEnabled: false, soundType: 'default' });
  });

  it('returns sound settings from the group', () => {
    const item = makeItem();
    const group = makeGroup({ enableSound: true, soundType: 'chime' });
    const result = shouldNotifyByGroup(item, [group]);
    expect(result).toEqual({ notify: true, soundEnabled: true, soundType: 'chime' });
  });

  it('matches the first group that contains the repository', () => {
    const item = makeItem({ repositoryFullName: 'org/repo-2' });
    const groupA = makeGroup({
      id: 'a',
      repositories: ['org/repo-2'],
      enableDesktopNotification: false,
    });
    const groupB = makeGroup({
      id: 'b',
      repositories: ['org/repo-2'],
      enableDesktopNotification: true,
    });
    const result = shouldNotifyByGroup(item, [groupA, groupB]);
    expect(result).toEqual({ notify: false, soundEnabled: false, soundType: 'default' });
  });

  it('handles empty notifyReasons as notify-all (no filter)', () => {
    const item = makeItem({ reason: 'security_alert' });
    const group = makeGroup({ notifyReasons: [] });
    const result = shouldNotifyByGroup(item, [group]);
    expect(result).toEqual({ notify: true, soundEnabled: false, soundType: 'default' });
  });
});

describe('shouldNotifyByGroup — integration scenarios', () => {
  it('item in a group with notification disabled → should NOT notify', () => {
    const item = makeItem({ repositoryFullName: 'org/repo-1', reason: 'review_requested' });
    const group = makeGroup({
      repositories: ['org/repo-1'],
      enableDesktopNotification: false,
      notifyReasons: [],
    });
    const result = shouldNotifyByGroup(item, [group]);
    expect(result).not.toBeNull();
    expect(result?.notify).toBe(false);
  });

  it('item in a group with notification enabled but reason not in notifyReasons → should NOT notify', () => {
    const item = makeItem({ repositoryFullName: 'org/repo-1', reason: 'comment' });
    const group = makeGroup({
      repositories: ['org/repo-1'],
      enableDesktopNotification: true,
      notifyReasons: ['mention', 'assign'],
    });
    const result = shouldNotifyByGroup(item, [group]);
    expect(result).not.toBeNull();
    expect(result?.notify).toBe(false);
  });

  it('item in a group with notification enabled and reason in notifyReasons → should notify', () => {
    const item = makeItem({ repositoryFullName: 'org/repo-1', reason: 'assign' });
    const group = makeGroup({
      repositories: ['org/repo-1'],
      enableDesktopNotification: true,
      notifyReasons: ['mention', 'assign'],
    });
    const result = shouldNotifyByGroup(item, [group]);
    expect(result).not.toBeNull();
    expect(result?.notify).toBe(true);
  });

  it('item NOT in any group → returns null (falls back to CustomFilter logic)', () => {
    const item = makeItem({ repositoryFullName: 'org/untracked-repo' });
    const groups = [
      makeGroup({ id: 'g1', repositories: ['org/repo-1'] }),
      makeGroup({ id: 'g2', repositories: ['org/repo-2'] }),
    ];
    const result = shouldNotifyByGroup(item, groups);
    expect(result).toBeNull();
  });

  it('group with empty notifyReasons → notifies for ALL reasons (no filter)', () => {
    const reasons = ['review_requested', 'mention', 'comment', 'ci_activity', 'push'] as const;
    const group = makeGroup({
      repositories: ['org/repo-1'],
      enableDesktopNotification: true,
      notifyReasons: [],
    });
    for (const reason of reasons) {
      const item = makeItem({ repositoryFullName: 'org/repo-1', reason });
      const result = shouldNotifyByGroup(item, [group]);
      expect(result?.notify).toBe(true);
    }
  });

  it('group sound settings are correctly propagated', () => {
    const item = makeItem({ repositoryFullName: 'org/repo-1', reason: 'mention' });
    const group = makeGroup({
      repositories: ['org/repo-1'],
      enableDesktopNotification: true,
      notifyReasons: [],
      enableSound: true,
      soundType: 'chime',
    });
    const result = shouldNotifyByGroup(item, [group]);
    expect(result).toEqual({
      notify: true,
      soundEnabled: true,
      soundType: 'chime',
    });
  });

  it('first group match wins when item belongs to multiple groups', () => {
    const item = makeItem({ repositoryFullName: 'org/shared-repo' });
    const firstGroup = makeGroup({
      id: 'first',
      repositories: ['org/shared-repo'],
      enableDesktopNotification: true,
      enableSound: true,
      soundType: 'soft',
      notifyReasons: [],
    });
    const secondGroup = makeGroup({
      id: 'second',
      repositories: ['org/shared-repo'],
      enableDesktopNotification: false,
      enableSound: false,
      soundType: 'chime',
      notifyReasons: [],
    });
    const result = shouldNotifyByGroup(item, [firstGroup, secondGroup]);
    expect(result).toEqual({
      notify: true,
      soundEnabled: true,
      soundType: 'soft',
    });
  });

  it('group with undefined/optional fields uses defaults correctly', () => {
    const item = makeItem({ repositoryFullName: 'org/repo-1', reason: 'comment' });
    const group: RepositoryGroup = {
      id: 'minimal',
      name: 'Minimal Group',
      repositories: ['org/repo-1'],
    };
    const result = shouldNotifyByGroup(item, [group]);
    expect(result).toEqual({
      notify: false,
      soundEnabled: false,
      soundType: 'default',
    });
  });
});

describe('getNotifiableItems — globalExcludeReasons', () => {
  const baseFilter: CustomFilter = {
    id: 'f1',
    name: 'Test',
    reasons: ['review_requested', 'mention', 'subscribed'],
    enableDesktopNotification: true,
    enableSound: false,
    soundType: 'default',
  };

  it('globalExcludeReasons blocks items even when group notification is enabled', () => {
    const item = makeItem({ repositoryFullName: 'org/repo-1', reason: 'subscribed' });
    const group = makeGroup({
      repositories: ['org/repo-1'],
      enableDesktopNotification: true,
      notifyReasons: [],
    });
    const result = getNotifiableItems([item], [baseFilter], ['subscribed'], [group]);
    expect(result).toHaveLength(0);
  });

  it('globalExcludeReasons blocks items in filter-based path too', () => {
    const item = makeItem({ repositoryFullName: 'org/unknown', reason: 'subscribed' });
    const result = getNotifiableItems([item], [baseFilter], ['subscribed'], []);
    expect(result).toHaveLength(0);
  });

  it('non-excluded reason passes through group notification', () => {
    const item = makeItem({ repositoryFullName: 'org/repo-1', reason: 'mention' });
    const group = makeGroup({
      repositories: ['org/repo-1'],
      enableDesktopNotification: true,
      notifyReasons: [],
    });
    const result = getNotifiableItems([item], [baseFilter], ['subscribed'], [group]);
    expect(result).toHaveLength(1);
    expect(result[0].item.id).toBe(item.id);
  });

  it('non-excluded reason passes through filter-based path', () => {
    const item = makeItem({ repositoryFullName: 'org/unknown', reason: 'review_requested' });
    const result = getNotifiableItems([item], [baseFilter], ['subscribed'], []);
    expect(result).toHaveLength(1);
  });
});
