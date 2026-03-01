// Notification reason types from GitHub API
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
  | 'security_alert';

// Reason labels for display
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
};

// Notification preset definition
export interface NotificationPreset {
  id: string;
  name: string;
  description: string;
  reasons: NotificationReason[];
}

// Available presets (built-in) - Simplified to "none" only
export const PRESETS: NotificationPreset[] = [
  {
    id: 'none',
    name: '通知なし',
    description: '下の「通知フィルター」で必要な通知だけを追加してください',
    reasons: [],
  },
];

// Sound type for notifications
export type SoundType = 'default' | 'soft' | 'chime';

// Filter templates - commonly used filters that users can add
export interface FilterTemplate {
  name: string;
  description: string;
  reasons: NotificationReason[];
  enableDesktopNotification: boolean;
  enableSound: boolean;
  soundType: SoundType;
}

export const FILTER_TEMPLATES: FilterTemplate[] = [
  {
    name: 'レビュー依頼',
    description: 'PRのレビューを依頼された時',
    reasons: ['review_requested'],
    enableDesktopNotification: true,
    enableSound: true,
    soundType: 'default',
  },
  {
    name: 'メンション',
    description: '@で名前を呼ばれた時',
    reasons: ['mention', 'team_mention'],
    enableDesktopNotification: true,
    enableSound: true,
    soundType: 'default',
  },
  {
    name: 'アサイン',
    description: 'Issue/PRにアサインされた時',
    reasons: ['assign'],
    enableDesktopNotification: true,
    enableSound: true,
    soundType: 'soft',
  },
  {
    name: '自分のPR/Issue',
    description: '自分が作成したものへの反応',
    reasons: ['author'],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
  },
  {
    name: 'CI/CD（全リポジトリ）',
    description: 'CI/CDの実行結果',
    reasons: ['ci_activity'],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
  },
  {
    name: 'CI/CD（リポジトリ指定）',
    description: '特定リポジトリのCI/CD結果のみ',
    reasons: ['ci_activity'],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
  },
  {
    name: 'コメント',
    description: 'ディスカッションへのコメント',
    reasons: ['comment'],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
  },
  {
    name: 'ステータス変更',
    description: 'Open/Close/Mergeなどの状態変更',
    reasons: ['state_change'],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
  },
];

// Theme type
export type Theme = 'light' | 'dark' | 'system';

// Custom filter group (user-created)
export interface CustomFilter {
  id: string;
  name: string;
  reasons: NotificationReason[];
  enableDesktopNotification: boolean; // Whether to send desktop notifications for this filter
  enableSound: boolean; // Whether to play sound for this filter
  soundType: SoundType; // Type of sound to play
  repositories?: string[]; // Optional: filter by repository (owner/repo format)
  searchQuery?: string; // If set, this view uses GitHub GraphQL search instead of notification reasons
}

// Check if a filter is a search-based view (uses GitHub Search API)
export function isSearchView(filter: CustomFilter): boolean {
  return typeof filter.searchQuery === 'string' && filter.searchQuery.trim().length > 0;
}

// Application settings
export interface AppSettings {
  theme: Theme;
  notificationPreset: string;
  customReasons: NotificationReason[];
  desktopNotifications: boolean;
  soundEnabled: boolean; // Global sound toggle
  customFilters: CustomFilter[]; // User-created filter groups
  activeFilterId: string | null; // Currently active custom filter (null = use preset)
}

// Default initial views (pre-configured for first-time users)
export const DEFAULT_INITIAL_FILTERS: CustomFilter[] = [
  {
    id: 'default-important',
    name: '重要な通知',
    reasons: ['review_requested', 'mention', 'team_mention', 'assign', 'author'],
    enableDesktopNotification: true,
    enableSound: true,
    soundType: 'default',
    repositories: [],
  },
  {
    id: 'default-needs-review',
    name: 'Needs My Review',
    reasons: [],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
    searchQuery: 'is:open is:pr review-requested:@me -reviewed-by:@me',
  },
  {
    id: 'default-my-prs',
    name: 'My PRs',
    reasons: [],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
    searchQuery: 'is:open is:pr author:@me',
  },
];

// IDs of all current default views (used by migration)
const ALL_DEFAULT_IDS = ['default-important', 'default-needs-review', 'default-my-prs'];

/**
 * Migrate settings filters to the current default system.
 * - Consolidates old 4-filter defaults into 1 combined "重要な通知" view
 * - Removes filters that are redundant subsets of the new default
 * - Ensures the combined default view exists
 * - Ensures search-based default views (Needs My Review, My PRs) exist
 */
export function migrateDefaultFilters(filters: CustomFilter[]): {
  filters: CustomFilter[];
  changed: boolean;
} {
  const OLD_DEFAULT_IDS = ['default-review', 'default-mention', 'default-assign', 'default-author'];
  const hasNewDefault = filters.some((f) => f.id === 'default-important');
  const hasNeedsReview = filters.some((f) => f.id === 'default-needs-review');
  const hasMyPrs = filters.some((f) => f.id === 'default-my-prs');

  // Check if already fully migrated
  const hasOldDefaults = filters.some((f) => OLD_DEFAULT_IDS.includes(f.id));
  if (hasNewDefault && hasNeedsReview && hasMyPrs && !hasOldDefaults) {
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

  // Remove old system defaults AND redundant subset filters
  const kept = filters.filter((f) => {
    // Always keep all current defaults
    if (ALL_DEFAULT_IDS.includes(f.id)) return true;
    // Remove old system defaults
    if (OLD_DEFAULT_IDS.includes(f.id)) return false;
    // Keep search views (user-created search views are intentional)
    if (isSearchView(f)) return true;
    // Remove filters whose reasons are entirely a subset of the new default
    // (only if they have no repo scoping — those are intentionally narrow)
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

  // Add missing default views
  if (!hasNewDefault) {
    result = [DEFAULT_INITIAL_FILTERS[0], ...result];
  }
  if (!hasNeedsReview) {
    // Insert after default-important
    const importantIdx = result.findIndex((f) => f.id === 'default-important');
    result.splice(importantIdx + 1, 0, DEFAULT_INITIAL_FILTERS[1]);
  }
  if (!hasMyPrs) {
    // Insert after default-needs-review
    const reviewIdx = result.findIndex((f) => f.id === 'default-needs-review');
    result.splice(reviewIdx + 1, 0, DEFAULT_INITIAL_FILTERS[2]);
  }

  const changed =
    result.length !== filters.length || result.some((f, i) => f.id !== filters[i]?.id);
  return { filters: result, changed };
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  notificationPreset: 'none',
  customReasons: [],
  desktopNotifications: true,
  soundEnabled: true,
  customFilters: DEFAULT_INITIAL_FILTERS,
  activeFilterId: 'dashboard',
};
