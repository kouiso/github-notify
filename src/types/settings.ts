export type NotificationReason =
  | 'review_requested'
  | 'mention'
  | 'team_mention'
  | 'assign'
  | 'author'
  | 'ci_activity'
  | 'comment'
  | 'state_change'
  | 'subscribed'
  | 'security_alert'
  | 'manual'
  | 'push'
  | 'your_activity';

export const REASON_LABELS: Record<NotificationReason, string> = {
  review_requested: 'レビュー依頼',
  mention: 'メンション',
  team_mention: 'チームメンション',
  assign: 'アサイン',
  author: '作成者',
  ci_activity: 'CI',
  comment: 'コメント',
  state_change: '状態変更',
  subscribed: '購読中',
  security_alert: 'セキュリティ',
  manual: '手動',
  push: 'プッシュ',
  your_activity: '自分の操作',
};

export type SoundType = 'default' | 'soft' | 'chime';

export interface FilterTemplate {
  name: string;
  description: string;
  reasons: NotificationReason[];
  enableDesktopNotification: boolean;
  enableSound: boolean;
  soundType: SoundType;
}

export type Theme = 'light' | 'dark' | 'system';

export interface IssueStatusRule {
  repositoryPattern: string;
  requiredStatuses: string[];
  enabled: boolean;
}

export interface CustomFilter {
  id: string;
  name: string;
  reasons: NotificationReason[];
  enableDesktopNotification: boolean;
  enableSound: boolean;
  soundType: SoundType;
  repositories?: string[];
  // searchQueryが設定されている場合、通知reason絞り込みではなくGitHub GraphQL検索を使う
  searchQuery?: string;
  issueStatusRules?: IssueStatusRule[];
}

export function isSearchView(filter: CustomFilter): boolean {
  return typeof filter.searchQuery === 'string' && filter.searchQuery.trim().length > 0;
}

export interface RepositoryGroup {
  id: string;
  name: string;
  repositories: string[];
  color?: string | null;
  enableDesktopNotification?: boolean;
  notifyReasons?: NotificationReason[];
  enableSound?: boolean;
  soundType?: SoundType;
}

export interface AppSettings {
  theme: Theme;
  notificationPreset: string;
  customReasons: NotificationReason[];
  desktopNotifications: boolean;
  soundEnabled: boolean;
  customFilters: CustomFilter[];
  activeFilterId: string | null;
  onboardingCompleted?: boolean;
  repositoryGroups?: RepositoryGroup[];
  /** 全ビューから一括除外するreasons（Slack連携の subscribed 等） */
  globalExcludeReasons?: NotificationReason[];
}

// 初回ユーザー向けのデフォルトビュー定義
export const DEFAULT_INITIAL_FILTERS: CustomFilter[] = [
  {
    id: 'default-important',
    name: '重要な通知',
    reasons: ['review_requested', 'mention', 'team_mention', 'assign'],
    enableDesktopNotification: true,
    enableSound: true,
    soundType: 'default',
    repositories: [],
  },
  {
    id: 'default-needs-review',
    name: 'レビュー待ち',
    reasons: [],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
    searchQuery: 'is:open is:pr review-requested:@me -reviewed-by:@me',
  },
  {
    id: 'default-my-prs',
    name: '自分のPR',
    reasons: [],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
    searchQuery: 'is:open is:pr author:@me',
  },
];

const ALL_DEFAULT_IDS = ['default-important', 'default-needs-review', 'default-my-prs'];

// デフォルトビューの正式名称マップ（旧英語名からのリネームに使う）
const DEFAULT_NAMES: Record<string, string> = {
  'default-important': '重要な通知',
  'default-needs-review': 'レビュー待ち',
  'default-my-prs': '自分のPR',
};

/**
 * 設定フィルタを現在のデフォルト体系にマイグレーションする。
 * - 旧4分割デフォルトを統合「重要な通知」ビューに集約
 * - 新デフォルトの部分集合となる冗長フィルタを除去
 * - 検索ベースのデフォルトビュー（Needs My Review, My PRs）の存在を保証
 */
export function migrateDefaultFilters(filters: CustomFilter[]): {
  filters: CustomFilter[];
  changed: boolean;
} {
  const OLD_DEFAULT_IDS = ['default-review', 'default-mention', 'default-assign', 'default-author'];
  const hasNewDefault = filters.some((f) => f.id === 'default-important');
  const hasNeedsReview = filters.some((f) => f.id === 'default-needs-review');
  const hasMyPrs = filters.some((f) => f.id === 'default-my-prs');

  // searchQuery未設定で作成されたデフォルト検索ビューを検出して補完する
  const needsSearchQueryFix = filters.some((f) => {
    if (f.id === 'default-needs-review') {
      return !f.searchQuery && DEFAULT_INITIAL_FILTERS[1].searchQuery;
    }
    if (f.id === 'default-my-prs') {
      return !f.searchQuery && DEFAULT_INITIAL_FILTERS[2].searchQuery;
    }
    return false;
  });

  // デフォルトビューの旧英語名を日本語にリネームする必要があるか
  const needsNameFix = filters.some((f) => f.id in DEFAULT_NAMES && f.name !== DEFAULT_NAMES[f.id]);

  // default-important の reasons に author が残っているか（旧デフォルトからの移行が必要）
  const needsAuthorRemoval = filters.some(
    (f) => f.id === 'default-important' && f.reasons.includes('author'),
  );

  // マイグレーション済みなら早期リターン
  const hasOldDefaults = filters.some((f) => OLD_DEFAULT_IDS.includes(f.id));
  if (
    hasNewDefault &&
    hasNeedsReview &&
    hasMyPrs &&
    !hasOldDefaults &&
    !needsSearchQueryFix &&
    !needsNameFix &&
    !needsAuthorRemoval
  ) {
    const newDefaultReasons = new Set(DEFAULT_INITIAL_FILTERS[0].reasons);
    const hasRedundant = filters.some(
      (f) =>
        !ALL_DEFAULT_IDS.includes(f.id) &&
        !isSearchView(f) &&
        (!f.repositories || f.repositories.length === 0) &&
        f.reasons.length > 0 &&
        f.reasons.every((r) => newDefaultReasons.has(r)),
    );
    if (!hasRedundant) {
      return { filters, changed: false };
    }
  }

  const newDefaultReasons = new Set(DEFAULT_INITIAL_FILTERS[0].reasons);

  // 旧デフォルトと新デフォルトの部分集合フィルタを除去
  const kept = filters.filter((f) => {
    if (ALL_DEFAULT_IDS.includes(f.id)) return true;
    if (OLD_DEFAULT_IDS.includes(f.id)) return false;
    if (isSearchView(f)) return true;
    // リポジトリ指定なし＆reason全てが新デフォルトに包含される → 冗長なので除去
    if (
      (!f.repositories || f.repositories.length === 0) &&
      f.reasons.length > 0 &&
      f.reasons.every((r) => newDefaultReasons.has(r))
    ) {
      return false;
    }
    return true;
  });

  let result = [...kept];

  if (!hasNewDefault) {
    result = [DEFAULT_INITIAL_FILTERS[0], ...result];
  }
  if (!hasNeedsReview) {
    const importantIdx = result.findIndex((f) => f.id === 'default-important');
    result.splice(importantIdx + 1, 0, DEFAULT_INITIAL_FILTERS[1]);
  }
  if (!hasMyPrs) {
    const reviewIdx = result.findIndex((f) => f.id === 'default-needs-review');
    result.splice(reviewIdx + 1, 0, DEFAULT_INITIAL_FILTERS[2]);
  }

  // 旧デフォルト「重要な通知」に含まれていた author reason を除去
  // ユーザーがカスタマイズしていた場合は触らない
  const OLD_IMPORTANT_REASONS = new Set<NotificationReason>([
    'review_requested',
    'mention',
    'team_mention',
    'assign',
    'author',
  ]);

  // searchQuery未設定のデフォルト検索ビューを補完 + デフォルトビュー名を日本語に統一
  result = result.map((f) => {
    let updated = f;
    if (
      f.id === 'default-needs-review' &&
      !f.searchQuery &&
      DEFAULT_INITIAL_FILTERS[1].searchQuery
    ) {
      updated = { ...updated, searchQuery: DEFAULT_INITIAL_FILTERS[1].searchQuery };
    }
    if (f.id === 'default-my-prs' && !f.searchQuery && DEFAULT_INITIAL_FILTERS[2].searchQuery) {
      updated = { ...updated, searchQuery: DEFAULT_INITIAL_FILTERS[2].searchQuery };
    }
    // デフォルトビューの名前を正式名称に揃える
    if (f.id in DEFAULT_NAMES && f.name !== DEFAULT_NAMES[f.id]) {
      updated = { ...updated, name: DEFAULT_NAMES[f.id] };
    }
    // default-important の reasons が旧デフォルトと完全一致する場合のみ author を除去
    if (
      f.id === 'default-important' &&
      f.reasons.length === OLD_IMPORTANT_REASONS.size &&
      f.reasons.every((r) => OLD_IMPORTANT_REASONS.has(r))
    ) {
      updated = { ...updated, reasons: ['review_requested', 'mention', 'team_mention', 'assign'] };
    }
    return updated;
  });

  const changed =
    needsNameFix ||
    needsSearchQueryFix ||
    needsAuthorRemoval ||
    result.length !== filters.length ||
    result.some((f, i) => f.id !== filters[i]?.id);
  return { filters: result, changed };
}

export const DEFAULT_GLOBAL_EXCLUDE_REASONS: NotificationReason[] = ['subscribed'];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  notificationPreset: 'none',
  customReasons: [],
  desktopNotifications: true,
  soundEnabled: true,
  customFilters: DEFAULT_INITIAL_FILTERS,
  activeFilterId: 'dashboard',
  repositoryGroups: [],
  globalExcludeReasons: DEFAULT_GLOBAL_EXCLUDE_REASONS,
};
