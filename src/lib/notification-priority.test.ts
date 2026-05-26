import { describe, expect, it } from 'vitest';
import type { InboxItem } from '@/types';
import { classifyNotificationPriority } from './notification-priority';

const baseItem: InboxItem = {
  id: 'thread-1',
  title: 'Comment on pull request',
  url: 'https://github.com/owner/repo/pull/1',
  reason: 'comment',
  unread: true,
  updatedAt: '2026-05-26T00:00:00Z',
  itemType: 'PullRequest',
  repositoryName: 'repo',
  repositoryFullName: 'owner/repo',
  ownerLogin: 'owner',
  ownerAvatar: '',
};

describe('classifyNotificationPriority', () => {
  it('separates review requests and CI activity into dedicated lanes', () => {
    expect(classifyNotificationPriority({ ...baseItem, reason: 'review_requested' })).toBe(
      'review',
    );
    expect(classifyNotificationPriority({ ...baseItem, reason: 'ci_activity' })).toBe('ci');
  });

  it('labels known bot comments without hiding them', () => {
    expect(
      classifyNotificationPriority({
        ...baseItem,
        title: 'CodeRabbit review comment on pull request',
      }),
    ).toBe('bot_comment');
    expect(
      classifyNotificationPriority({
        ...baseItem,
        title: 'Dependabot commented on dependency update',
      }),
    ).toBe('bot_comment');
    expect(
      classifyNotificationPriority({
        ...baseItem,
        title: 'release-helper-bot commented on deployment status',
      }),
    ).toBe('bot_comment');
  });

  it('keeps ordinary comments as human comments', () => {
    expect(
      classifyNotificationPriority({
        ...baseItem,
        title: 'alice commented on notification triage',
      }),
    ).toBe('human_comment');
    expect(
      classifyNotificationPriority({
        ...baseItem,
        title: 'alice commented on notification triage',
        ownerLogin: 'robot-platform',
        repositoryFullName: 'robot-platform/repo',
      }),
    ).toBe('human_comment');
    expect(
      classifyNotificationPriority({
        ...baseItem,
        title: 'alice mentioned a bot policy in review',
      }),
    ).toBe('human_comment');
  });

  it('returns null for reasons without a priority lane', () => {
    expect(classifyNotificationPriority({ ...baseItem, reason: 'mention' })).toBeNull();
  });
});
