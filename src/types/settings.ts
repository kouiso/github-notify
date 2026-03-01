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

// Default initial filters (pre-configured for first-time users)
export const DEFAULT_INITIAL_FILTERS: CustomFilter[] = [
  {
    id: 'default-review',
    name: 'レビュー依頼',
    reasons: ['review_requested'],
    enableDesktopNotification: true,
    enableSound: true,
    soundType: 'default',
    repositories: [],
  },
  {
    id: 'default-mention',
    name: 'メンション',
    reasons: ['mention', 'team_mention'],
    enableDesktopNotification: true,
    enableSound: true,
    soundType: 'default',
    repositories: [],
  },
  {
    id: 'default-assign',
    name: 'アサイン',
    reasons: ['assign'],
    enableDesktopNotification: true,
    enableSound: true,
    soundType: 'soft',
    repositories: [],
  },
  {
    id: 'default-author',
    name: '自分のPR/Issue',
    reasons: ['author'],
    enableDesktopNotification: false,
    enableSound: false,
    soundType: 'default',
    repositories: [],
  },
];

/**
 * Ensure all default filters exist in loaded settings.
 * Adds any missing default filters (by id) without removing user-created filters.
 */
export function migrateDefaultFilters(filters: CustomFilter[]): {
  filters: CustomFilter[];
  changed: boolean;
} {
  const existingIds = new Set(filters.map((f) => f.id));
  const missing = DEFAULT_INITIAL_FILTERS.filter((d) => !existingIds.has(d.id));
  if (missing.length === 0) {
    return { filters, changed: false };
  }
  return { filters: [...filters, ...missing], changed: true };
}

// Default settings
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  notificationPreset: 'none',
  customReasons: [],
  desktopNotifications: true,
  soundEnabled: true,
  customFilters: DEFAULT_INITIAL_FILTERS,
  activeFilterId: null,
};
