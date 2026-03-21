import { useCallback } from 'react';
import * as commands from '@/lib/tauri/commands';
import { logger } from '@/lib/utils/logger';
import type { InboxItem } from '@/types';
import type { CustomFilter } from '@/types/settings';

function checkFilterMatch(item: InboxItem, filter: CustomFilter): boolean {
  const reasonMatches = filter.reasons.length === 0 || filter.reasons.includes(item.reason);
  if (!reasonMatches) {
    return false;
  }

  const hasRepoFilter = filter.repositories && filter.repositories.length > 0;
  if (hasRepoFilter && !filter.repositories?.includes(item.repositoryFullName)) {
    return false;
  }

  return true;
}

export function shouldShowItem(item: InboxItem, customFilters: CustomFilter[]): boolean {
  if (customFilters.length === 0) {
    return false;
  }
  return customFilters.some((filter) => checkFilterMatch(item, filter));
}

function getMatchingFilter(item: InboxItem, customFilters: CustomFilter[]): CustomFilter | null {
  return (
    customFilters.find(
      (filter) => filter.enableDesktopNotification && checkFilterMatch(item, filter),
    ) || null
  );
}

function getNotifiableItems(
  newItems: InboxItem[],
  customFilters: CustomFilter[],
): Array<{ item: InboxItem; filter: CustomFilter }> {
  const result: Array<{ item: InboxItem; filter: CustomFilter }> = [];
  for (const item of newItems) {
    const filter = getMatchingFilter(item, customFilters);
    if (filter) {
      result.push({ item, filter });
    }
  }
  return result;
}

function getSoundSettings(
  notifiableItems: Array<{ item: InboxItem; filter: CustomFilter }>,
  soundEnabled: boolean,
) {
  const shouldPlaySound = soundEnabled && notifiableItems.some(({ filter }) => filter.enableSound);
  const soundFilter = notifiableItems.find(({ filter }) => filter.enableSound);
  const soundType = soundFilter?.filter.soundType || 'default';
  return { shouldPlaySound, soundType };
}

interface NotificationSettings {
  desktopNotifications: boolean;
  soundEnabled: boolean;
  customFilters: CustomFilter[];
}

export function useSendDesktopNotification(
  settingsRef: React.RefObject<NotificationSettings>,
  isFirstLoadRef: React.RefObject<boolean>,
) {
  return useCallback(
    async (newItems: InboxItem[]) => {
      if (!settingsRef.current.desktopNotifications || isFirstLoadRef.current) {
        return;
      }

      const notifiableItems = getNotifiableItems(newItems, settingsRef.current.customFilters);
      if (notifiableItems.length === 0) {
        return;
      }

      if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
        return;
      }

      try {
        const { shouldPlaySound, soundType } = getSoundSettings(
          notifiableItems,
          settingsRef.current.soundEnabled,
        );

        if (notifiableItems.length === 1) {
          const { item } = notifiableItems[0];
          await commands.sendNotificationWithSound(
            item.title,
            item.repositoryFullName,
            shouldPlaySound,
            soundType,
          );
        } else {
          await commands.sendNotificationWithSound(
            `${notifiableItems.length}件の新しい通知`,
            notifiableItems
              .slice(0, 3)
              .map(({ item }) => item.title)
              .join('\n'),
            shouldPlaySound,
            soundType,
          );
        }
      } catch (err) {
        logger.error('Failed to send notification', err);
      }
    },
    [settingsRef, isFirstLoadRef],
  );
}
