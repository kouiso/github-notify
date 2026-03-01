import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as commands from '@/lib/tauri/commands';
import { logger } from '@/lib/utils/logger';
import type { InboxItem } from '@/types';
import {
  type CustomFilter,
  DEFAULT_INITIAL_FILTERS,
  migrateDefaultFilters,
  type NotificationReason,
} from '@/types/settings';

export function useInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Smart batching: track previous item IDs and first load flag
  const previousIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const settingsRef = useRef<{
    desktopNotifications: boolean;
    soundEnabled: boolean;
    customFilters: CustomFilter[];
  }>({
    desktopNotifications: true,
    soundEnabled: true,
    customFilters: DEFAULT_INITIAL_FILTERS,
  });

  // Load settings on mount (outside of SettingsProvider context)
  useEffect(() => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      commands
        .getAppSettings()
        .then((settings) => {
          const { filters } = migrateDefaultFilters(settings.customFilters as CustomFilter[]);
          settingsRef.current = {
            desktopNotifications: settings.desktopNotifications,
            soundEnabled: settings.soundEnabled ?? true,
            customFilters: filters,
          };
        })
        .catch((err) => logger.error('Failed to load settings', err))
        .finally(() => setSettingsLoaded(true));
    } else {
      setSettingsLoaded(true);
    }
  }, []);

  // Check if an item matches any of the custom filters
  const checkFilterMatch = useCallback((item: InboxItem, filter: CustomFilter): boolean => {
    const reasonMatches =
      filter.reasons.length === 0 || filter.reasons.includes(item.reason as NotificationReason);
    if (!reasonMatches) {
      return false;
    }

    const hasRepoFilter = filter.repositories && filter.repositories.length > 0;
    if (hasRepoFilter && !filter.repositories?.includes(item.repositoryFullName)) {
      return false;
    }

    return true;
  }, []);

  const shouldShowItem = useCallback(
    (item: InboxItem): boolean => {
      const { customFilters } = settingsRef.current;

      if (customFilters.length === 0) {
        return false;
      }

      return customFilters.some((filter) => checkFilterMatch(item, filter));
    },
    [checkFilterMatch],
  );

  // Check if a notification item matches a custom filter
  const matchesFilter = useCallback(
    (item: InboxItem, filter: CustomFilter): boolean => {
      return checkFilterMatch(item, filter);
    },
    [checkFilterMatch],
  );

  // Get matching filter that should trigger desktop notification
  const getMatchingFilter = useCallback(
    (item: InboxItem): CustomFilter | null => {
      const { customFilters } = settingsRef.current;

      // Find the first filter with desktop notifications enabled that matches this item
      return (
        customFilters.find(
          (filter) => filter.enableDesktopNotification && matchesFilter(item, filter),
        ) || null
      );
    },
    [matchesFilter],
  );

  // Send desktop notification with smart batching and sound support
  const getNotifiableItems = useCallback(
    (newItems: InboxItem[]): Array<{ item: InboxItem; filter: CustomFilter }> => {
      const items: Array<{ item: InboxItem; filter: CustomFilter }> = [];
      for (const item of newItems) {
        const filter = getMatchingFilter(item);
        if (filter) {
          items.push({ item, filter });
        }
      }
      return items;
    },
    [getMatchingFilter],
  );

  const getSoundSettings = useCallback(
    (notifiableItems: Array<{ item: InboxItem; filter: CustomFilter }>) => {
      const shouldPlaySound =
        settingsRef.current.soundEnabled &&
        notifiableItems.some(({ filter }) => filter.enableSound);
      const soundFilter = notifiableItems.find(({ filter }) => filter.enableSound);
      const soundType = soundFilter?.filter.soundType || 'default';
      return { shouldPlaySound, soundType };
    },
    [],
  );

  const sendSingleNotification = useCallback(
    async (item: InboxItem, shouldPlaySound: boolean, soundType: string) => {
      await commands.sendNotificationWithSound(
        item.title,
        item.repositoryFullName,
        shouldPlaySound,
        soundType,
      );
    },
    [],
  );

  const sendBatchNotification = useCallback(
    async (
      notifiableItems: Array<{ item: InboxItem; filter: CustomFilter }>,
      shouldPlaySound: boolean,
      soundType: string,
    ) => {
      await commands.sendNotificationWithSound(
        `${notifiableItems.length}件の新しい通知`,
        notifiableItems
          .slice(0, 3)
          .map(({ item }) => item.title)
          .join('\n'),
        shouldPlaySound,
        soundType,
      );
    },
    [],
  );

  const sendDesktopNotification = useCallback(
    async (newItems: InboxItem[]) => {
      if (!settingsRef.current.desktopNotifications || isFirstLoadRef.current) {
        return;
      }

      const notifiableItems = getNotifiableItems(newItems);
      if (notifiableItems.length === 0) {
        return;
      }

      if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
        return;
      }

      try {
        const { shouldPlaySound, soundType } = getSoundSettings(notifiableItems);

        if (notifiableItems.length === 1) {
          await sendSingleNotification(notifiableItems[0].item, shouldPlaySound, soundType);
        } else {
          await sendBatchNotification(notifiableItems, shouldPlaySound, soundType);
        }
      } catch (err) {
        logger.error('Failed to send notification', err);
      }
    },
    [getNotifiableItems, getSoundSettings, sendSingleNotification, sendBatchNotification],
  );

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await commands.fetchInbox(showAll);

      // Filter items based on active notification reasons
      const filteredData = data.filter(shouldShowItem);

      // Detect new unread items (not in previous set)
      const previousIds = previousIdsRef.current;
      const newUnreadItems = filteredData.filter(
        (item) => item.unread && !previousIds.has(item.id),
      );

      // Send desktop notification for new items
      if (newUnreadItems.length > 0) {
        await sendDesktopNotification(newUnreadItems);
      }

      // Update previous IDs (use filtered data)
      previousIdsRef.current = new Set(filteredData.map((item) => item.id));

      // Mark first load as complete
      isFirstLoadRef.current = false;

      setItems(filteredData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inbox');
    } finally {
      setIsLoading(false);
    }
  }, [showAll, sendDesktopNotification, shouldShowItem]);

  useEffect(() => {
    if (settingsLoaded) {
      fetchItems();
    }
  }, [settingsLoaded, fetchItems]);

  // Listen for backend push events (from background polling service)
  useEffect(() => {
    // Skip if not in Tauri context
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return;
    }

    const setupListener = async () => {
      const unlisten = await listen<InboxItem[]>('inbox-updated', (event) => {
        const newItems = event.payload;

        // Filter items based on active notification reasons
        const filteredItems = newItems.filter(shouldShowItem);

        // Detect new unread items
        const previousIds = previousIdsRef.current;
        const newUnreadItems = filteredItems.filter(
          (item) => item.unread && !previousIds.has(item.id),
        );

        // Send desktop notification for new items
        if (newUnreadItems.length > 0 && !isFirstLoadRef.current) {
          sendDesktopNotification(newUnreadItems);
        }

        // Update previous IDs (use filtered data)
        previousIdsRef.current = new Set(filteredItems.map((item) => item.id));

        // Mark first load as complete
        isFirstLoadRef.current = false;

        // Update state
        setItems(filteredItems);
        setLastUpdated(new Date());
        setIsLoading(false);
      });

      return unlisten;
    };

    const unlistenPromise = setupListener();

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [sendDesktopNotification, shouldShowItem]);

  // Reload settings periodically to pick up changes
  useEffect(() => {
    const loadSettings = async () => {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        try {
          const settings = await commands.getAppSettings();
          settingsRef.current = {
            desktopNotifications: settings.desktopNotifications,
            soundEnabled: settings.soundEnabled ?? true,
            customFilters: settings.customFilters as CustomFilter[],
          };

          // Re-filter items when settings change
          setItems((prev) => prev.filter(shouldShowItem));
        } catch (err) {
          logger.error('Failed to load settings', err);
        }
      }
    };

    // Reload settings every 30 seconds
    const interval = setInterval(loadSettings, 30 * 1000);
    return () => clearInterval(interval);
  }, [shouldShowItem]);

  const markAsRead = useCallback(async (threadId: string) => {
    try {
      await commands.markInboxRead(threadId);
      setItems((prev) =>
        prev.map((item) => (item.id === threadId ? { ...item, unread: false } : item)),
      );
    } catch (err) {
      logger.error('Failed to mark as read', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await commands.markAllInboxRead();
      setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
    } catch (err) {
      logger.error('Failed to mark all as read', err);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchItems();
  }, [fetchItems]);

  const unreadCount = items.filter((item) => item.unread).length;

  // Update tray badge when unread count changes
  useEffect(() => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      commands.updateTrayBadge(unreadCount).catch((err) => {
        logger.error('Failed to update tray badge', err);
      });
    }
  }, [unreadCount]);

  return {
    items,
    isLoading,
    error,
    lastUpdated,
    showAll,
    setShowAll,
    markAsRead,
    markAllAsRead,
    refresh,
    unreadCount,
    selectedIndex,
    setSelectedIndex,
  };
}
