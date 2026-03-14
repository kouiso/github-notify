import type { InboxItem } from '@/types';
import type { CustomFilter } from '@/types/settings';

export function matchesCustomFilter(item: InboxItem, filter: CustomFilter): boolean {
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
