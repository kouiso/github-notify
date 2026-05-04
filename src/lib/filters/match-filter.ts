import type { InboxItem } from '@/types';
import type { CustomFilter, NotificationReason } from '@/types/settings';
import { isSearchView } from '@/types/settings';

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
  if (globalExcludeReasons.includes(item.reason as NotificationReason)) {
    return false;
  }
  if (filter.reasons.length > 0 && !filter.reasons.includes(item.reason)) {
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
  return globalExcludeReasons.includes(item.reason as NotificationReason);
}

/**
 * アイテムがいずれかの通知フィルタ（searchViewを除く）にマッチするか判定する。
 * searchViewはGitHub API検索で取得するため、Inbox絞り込みには使わない。
 */
export function shouldShowItem(
  item: InboxItem,
  customFilters: CustomFilter[],
  globalExcludeReasons: NotificationReason[] = [],
): boolean {
  const inboxFilters = customFilters.filter((f) => !isSearchView(f));
  if (inboxFilters.length === 0) {
    return false;
  }
  return inboxFilters.some((filter) => matchesFilter(item, filter, globalExcludeReasons));
}
