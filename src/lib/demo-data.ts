import type { InboxItem, NotificationItem } from '@/types';
import type { RepositoryGroup } from '@/types/settings';

export function isDemoMode(): boolean {
  if (!isBrowserPreviewEnvironment()) return false;
  return new URLSearchParams(window.location.search).get('demo') === '1';
}

export function isBrowserPreviewEnvironment(): boolean {
  return typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window);
}

export function getDemoModeHref(): string {
  if (typeof window === 'undefined') return '?demo=1';

  const searchParams = new URLSearchParams(window.location.search);
  searchParams.set('demo', '1');
  const query = searchParams.toString();
  const pathname = window.location.pathname || '';
  const hash = window.location.hash || '';

  return `${pathname}?${query}${hash}`;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export const DEMO_REPOSITORY_GROUPS: RepositoryGroup[] = [
  {
    id: 'project-a',
    name: '案件A',
    repositories: ['kouiso/github-notify', 'kouiso/design-system'],
    color: '#2f81f7',
    enableDesktopNotification: true,
    notifyReasons: ['review_requested', 'mention', 'assign'],
    enableSound: true,
    soundType: 'default',
  },
  {
    id: 'project-b',
    name: '案件B',
    repositories: ['ritmo-inc/horsemanager', 'kouiso/roentgen'],
    color: '#3fb950',
    enableDesktopNotification: false,
    notifyReasons: [],
    enableSound: false,
    soundType: 'soft',
  },
];

export function createDemoInboxItems(): InboxItem[] {
  return [
    {
      id: 'demo-review-1',
      title: 'UX spec v2.4 のカンバン表示を確認する',
      url: 'https://github.com/kouiso/github-notify/pull/101',
      reason: 'review_requested',
      unread: true,
      updatedAt: minutesAgo(8),
      itemType: 'PullRequest',
      repositoryName: 'github-notify',
      repositoryFullName: 'kouiso/github-notify',
      ownerLogin: 'kouiso',
      ownerAvatar: '',
    },
    {
      id: 'demo-mention-1',
      title: '集中モードの表示密度についてメンション',
      url: 'https://github.com/kouiso/github-notify/issues/42',
      reason: 'mention',
      unread: true,
      updatedAt: minutesAgo(22),
      itemType: 'Issue',
      repositoryName: 'github-notify',
      repositoryFullName: 'kouiso/github-notify',
      ownerLogin: 'kouiso',
      ownerAvatar: '',
    },
    {
      id: 'demo-ci-1',
      title: 'Windows packaging smoke の CI が失敗',
      url: 'https://github.com/kouiso/design-system/actions/runs/1',
      reason: 'ci_activity',
      unread: true,
      updatedAt: minutesAgo(45),
      itemType: 'CheckSuite',
      repositoryName: 'design-system',
      repositoryFullName: 'kouiso/design-system',
      ownerLogin: 'kouiso',
      ownerAvatar: '',
    },
    {
      id: 'demo-assign-1',
      title: 'クロスプラットフォーム起動導線の文言確認',
      url: 'https://github.com/ritmo-inc/horsemanager/issues/77',
      reason: 'assign',
      unread: true,
      updatedAt: minutesAgo(63),
      itemType: 'Issue',
      repositoryName: 'horsemanager',
      repositoryFullName: 'ritmo-inc/horsemanager',
      ownerLogin: 'ritmo-inc',
      ownerAvatar: '',
    },
    {
      id: 'demo-comment-1',
      title: 'Tauri tray 動作の Linux メモ',
      url: 'https://github.com/kouiso/roentgen/issues/12',
      reason: 'comment',
      unread: false,
      updatedAt: minutesAgo(130),
      itemType: 'Issue',
      repositoryName: 'roentgen',
      repositoryFullName: 'kouiso/roentgen',
      ownerLogin: 'kouiso',
      ownerAvatar: '',
    },
  ];
}

const DEMO_SEARCH_ITEMS: NotificationItem[] = [
  {
    id: 'demo-search-review-1',
    number: 101,
    title: 'UX spec v2.4 の集中モードをレビュー',
    url: 'https://github.com/kouiso/github-notify/pull/101',
    state: 'open',
    itemType: 'pullrequest',
    createdAt: daysAgo(4),
    updatedAt: minutesAgo(18),
    author: { login: 'design-lead' },
    repository: { owner: { login: 'kouiso' }, name: 'github-notify' },
    labels: [
      { name: 'ui', color: '2f81f7' },
      { name: 'review', color: 'bf8700' },
    ],
    isRead: false,
    isDraft: false,
    reviewDecision: 'REVIEW_REQUIRED',
  },
  {
    id: 'demo-search-review-2',
    number: 88,
    title: 'Windows 通知権限の状態差を整理',
    url: 'https://github.com/kouiso/design-system/pull/88',
    state: 'open',
    itemType: 'pullrequest',
    createdAt: daysAgo(8),
    updatedAt: daysAgo(3),
    author: { login: 'windows-ci' },
    repository: { owner: { login: 'kouiso' }, name: 'design-system' },
    labels: [
      { name: 'windows', color: '0969da' },
      { name: 'notification', color: '8250df' },
    ],
    isRead: false,
    isDraft: false,
    reviewDecision: 'CHANGES_REQUESTED',
  },
  {
    id: 'demo-search-mine-1',
    number: 77,
    title: 'クロスプラットフォーム起動導線を追加',
    url: 'https://github.com/ritmo-inc/horsemanager/pull/77',
    state: 'open',
    itemType: 'pullrequest',
    createdAt: daysAgo(2),
    updatedAt: minutesAgo(64),
    author: { login: 'demo-user' },
    repository: { owner: { login: 'ritmo-inc' }, name: 'horsemanager' },
    labels: [
      { name: 'desktop', color: '3fb950' },
      { name: 'linux', color: '6f42c1' },
    ],
    isRead: false,
    isDraft: false,
    reviewDecision: 'APPROVED',
  },
  {
    id: 'demo-search-mine-2',
    number: 12,
    title: 'macOS tray の再接続ログを改善',
    url: 'https://github.com/kouiso/roentgen/pull/12',
    state: 'open',
    itemType: 'pullrequest',
    createdAt: daysAgo(1),
    updatedAt: minutesAgo(130),
    author: { login: 'demo-user' },
    repository: { owner: { login: 'kouiso' }, name: 'roentgen' },
    labels: [
      { name: 'macos', color: '57606a' },
      { name: 'tray', color: 'd1242f' },
    ],
    isRead: false,
    isDraft: true,
    reviewDecision: null,
  },
];

export function createDemoSearchItems(query = ''): NotificationItem[] {
  let items = [...DEMO_SEARCH_ITEMS];

  if (query.includes('author:')) {
    items = items.filter((item) => item.author?.login === 'demo-user');
  } else if (query.includes('review-requested:')) {
    items = items.filter((item) => item.author?.login !== 'demo-user');
  }

  const repoFilters = [...query.matchAll(/\brepo:([^\s]+)/g)].map((match) => match[1]);
  if (repoFilters.length > 0) {
    const repos = new Set(repoFilters);
    items = items.filter((item) =>
      repos.has(`${item.repository.owner.login}/${item.repository.name}`),
    );
  }

  const orgFilters = [...query.matchAll(/\borg:([^\s]+)/g)].map((match) => match[1]);
  if (orgFilters.length > 0) {
    const orgs = new Set(orgFilters);
    items = items.filter((item) => orgs.has(item.repository.owner.login));
  }

  return items;
}
