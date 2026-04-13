import { useCallback } from 'react';
import { matchesFilter } from '@/lib/filters/match-filter';
import * as commands from '@/lib/tauri/commands';
import { logger } from '@/lib/utils/logger';
import type { InboxItem } from '@/types';
import type {
  CustomFilter,
  NotificationReason,
  RepositoryGroup,
  SoundType,
} from '@/types/settings';

export { shouldShowItem } from '@/lib/filters/match-filter';

interface NotifiableResult {
  item: InboxItem;
  soundEnabled: boolean;
  soundType: SoundType;
}

/**
 * プロジェクト単位の通知判定。
 * アイテムが属するグループの通知設定を確認し、通知すべきかを返す。
 */
export function shouldNotifyByGroup(
  item: InboxItem,
  groups: RepositoryGroup[],
): { notify: boolean; soundEnabled: boolean; soundType: SoundType } | null {
  const group = groups.find((g) => g.repositories.includes(item.repositoryFullName));
  if (!group) return null;

  if (!group.enableDesktopNotification) {
    return { notify: false, soundEnabled: false, soundType: 'default' };
  }

  const reasons = group.notifyReasons ?? [];
  if (reasons.length > 0 && !reasons.includes(item.reason as NotificationReason)) {
    return { notify: false, soundEnabled: false, soundType: 'default' };
  }

  return {
    notify: true,
    soundEnabled: group.enableSound ?? false,
    soundType: (group.soundType as SoundType) ?? 'default',
  };
}

export function getNotifiableItems(
  newItems: InboxItem[],
  customFilters: CustomFilter[],
  globalExcludeReasons: NotificationReason[],
  repositoryGroups: RepositoryGroup[],
): NotifiableResult[] {
  const result: NotifiableResult[] = [];

  for (const item of newItems) {
    // 0. グローバル除外は全経路で最優先適用
    if (globalExcludeReasons.includes(item.reason as NotificationReason)) {
      continue;
    }

    // 1. プロジェクトグループに属する場合はグループの通知設定を優先
    const groupResult = shouldNotifyByGroup(item, repositoryGroups);
    if (groupResult) {
      if (groupResult.notify) {
        result.push({
          item,
          soundEnabled: groupResult.soundEnabled,
          soundType: groupResult.soundType,
        });
      }
      continue;
    }

    // 2. グループに属さない場合はビュー（CustomFilter）の通知設定で判定
    const filter = customFilters.find(
      (f) => f.enableDesktopNotification && matchesFilter(item, f, globalExcludeReasons),
    );
    if (filter) {
      result.push({
        item,
        soundEnabled: filter.enableSound,
        soundType: filter.soundType,
      });
    }
  }

  return result;
}

function getSoundSettings(notifiableItems: NotifiableResult[], globalSoundEnabled: boolean) {
  const shouldPlaySound = globalSoundEnabled && notifiableItems.some((r) => r.soundEnabled);
  const soundItem = notifiableItems.find((r) => r.soundEnabled);
  const soundType = soundItem?.soundType || 'default';
  return { shouldPlaySound, soundType };
}

export interface NotificationSettings {
  desktopNotifications: boolean;
  soundEnabled: boolean;
  customFilters: CustomFilter[];
  globalExcludeReasons: NotificationReason[];
  repositoryGroups: RepositoryGroup[];
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

      const notifiableItems = getNotifiableItems(
        newItems,
        settingsRef.current.customFilters,
        settingsRef.current.globalExcludeReasons,
        settingsRef.current.repositoryGroups,
      );
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
