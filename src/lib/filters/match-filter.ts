import type { InboxItem } from '@/types';
import type { CustomFilter, NotificationReason, RepositoryGroup } from '@/types/settings';
import { isSearchView } from '@/types/settings';

const KNOWN_REASONS = [
  'review_requested',
  'mention',
  'team_mention',
  'assign',
  'author',
  'ci_activity',
  'comment',
  'state_change',
  'subscribed',
  'security_alert',
  'manual',
  'push',
  'your_activity',
] as const satisfies readonly NotificationReason[];

function normalizeReason(reason: string): NotificationReason {
  return KNOWN_REASONS.includes(reason as (typeof KNOWN_REASONS)[number])
    ? (reason as NotificationReason)
    : 'other';
}

/**
 * グローバル除外reasonsを最優先で適用し、その後フィルタ条件を判定する。
 * - reasons空配列 = 全reason許可（既存仕様維持）
 * - repositories空/undefined = 全リポジトリ許可（既存仕様維持）
 */
export function matchesFilter(
  item: InboxItem,
  filter: CustomFilter,
  globalExcludeReasons: NotificationReason[] = [],
): boolean {
  const reason = normalizeReason(item.reason);
  if (globalExcludeReasons.includes(reason)) {
    return false;
  }
  if (filter.reasons.length === 0 && reason === 'other') {
    return false;
  }
  if (filter.reasons.length > 0 && !filter.reasons.includes(reason)) {
    return false;
  }
  if (filter.repositories && filter.repositories.length > 0) {
    if (!filter.repositories.includes(item.repositoryFullName)) {
      return false;
    }
  }
  return true;
}

/** グローバル除外単独の判定（フィルタなしの場面用） */
export function isGloballyExcluded(
  item: InboxItem,
  globalExcludeReasons: NotificationReason[],
): boolean {
  return globalExcludeReasons.includes(normalizeReason(item.reason));
}

export function matchesRepositoryGroup(item: InboxItem, group: RepositoryGroup): boolean {
  return group.repositories.includes(item.repositoryFullName);
}

/**
 * アイテムがいずれかの通知フィルタ（searchViewを除く）にマッチするか判定する。
 * searchViewはGitHub API検索で取得するため、Inbox絞り込みには使わない。
 * プロジェクトグループ所属の通知は、保存済みビュー設定に依存せず受信トレイに残す。
 */
export function shouldShowItem(
  item: InboxItem,
  customFilters: CustomFilter[],
  globalExcludeReasons: NotificationReason[] = [],
  repositoryGroups: RepositoryGroup[] = [],
): boolean {
  if (isGloballyExcluded(item, globalExcludeReasons)) {
    return false;
  }
  if (repositoryGroups.some((group) => matchesRepositoryGroup(item, group))) {
    return true;
  }
  const inboxFilters = customFilters.filter((f) => !isSearchView(f));
  if (inboxFilters.length === 0) {
    return false;
  }
  return inboxFilters.some((filter) => matchesFilter(item, filter, globalExcludeReasons));
}
