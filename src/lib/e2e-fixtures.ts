import type { InboxItem, NotificationItem } from '@/types';
import { DEFAULT_SETTINGS } from '@/types/settings';

export const isE2eAuthenticated = () => import.meta.env.VITE_E2E_AUTHENTICATED === 'true';

export const E2E_USER = {
  login: 'e2e-user',
};

export const E2E_SETTINGS = {
  ...DEFAULT_SETTINGS,
  theme: 'light' as const,
  onboardingCompleted: false,
  repositoryGroups: [
    {
      id: 'e2e-core',
      name: 'Core',
      repositories: ['kouiso/github-notify'],
      color: '#2563eb',
    },
  ],
};

export const E2E_INBOX_ITEMS: InboxItem[] = [
  {
    id: 'e2e-review-request',
    title: 'Review requested: fix unread notification regression',
    url: 'https://github.com/kouiso/github-notify/pull/100',
    reason: 'review_requested',
    unread: true,
    updatedAt: '2026-05-24T19:20:00Z',
    itemType: 'PullRequest',
    repositoryName: 'github-notify',
    repositoryFullName: 'kouiso/github-notify',
    ownerLogin: 'kouiso',
    ownerAvatar: '',
  },
  {
    id: 'e2e-mention',
    title: 'Mentioned in notification triage issue',
    url: 'https://github.com/kouiso/github-notify/issues/101',
    reason: 'mention',
    unread: true,
    updatedAt: '2026-05-24T19:10:00Z',
    itemType: 'Issue',
    repositoryName: 'github-notify',
    repositoryFullName: 'kouiso/github-notify',
    ownerLogin: 'kouiso',
    ownerAvatar: '',
  },
];

export const E2E_SEARCH_ITEMS: NotificationItem[] = [
  {
    id: 'e2e-search-review',
    number: 100,
    title: 'Fix unread notification regression',
    url: 'https://github.com/kouiso/github-notify/pull/100',
    state: 'open',
    itemType: 'pullrequest',
    createdAt: '2026-05-24T18:30:00Z',
    updatedAt: '2026-05-24T19:20:00Z',
    author: E2E_USER,
    repository: {
      name: 'github-notify',
      owner: { login: 'kouiso' },
    },
    labels: [{ name: 'bug', color: 'd73a4a' }],
    isRead: false,
    isDraft: false,
    reviewDecision: 'REVIEW_REQUIRED',
  },
];
