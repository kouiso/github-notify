import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as commands from '@/lib/tauri/commands';
import { logger } from '@/lib/utils/logger';
import type { InboxItem } from '@/types';
import {
  DEFAULT_GLOBAL_EXCLUDE_REASONS,
  DEFAULT_INITIAL_FILTERS,
  migrateDefaultFilters,
} from '@/types/settings';
import {
  type NotificationSettings,
  shouldShowItem,
  useSendDesktopNotification,
} from './use-inbox-notification';

export function useInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const previousIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const settingsRef = useRef<NotificationSettings>({
    desktopNotifications: true,
    soundEnabled: true,
    customFilters: DEFAULT_INITIAL_FILTERS,
    globalExcludeReasons: DEFAULT_GLOBAL_EXCLUDE_REASONS,
    repositoryGroups: [],
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      commands
        .getAppSettings()
        .then((settings) => {
          const { filters } = migrateDefaultFilters(settings.customFilters);
          settingsRef.current = {
            desktopNotifications: settings.desktopNotifications,
            soundEnabled: settings.soundEnabled ?? true,
            customFilters: filters,
            globalExcludeReasons: settings.globalExcludeReasons ?? DEFAULT_GLOBAL_EXCLUDE_REASONS,
            repositoryGroups: settings.repositoryGroups ?? [],
          };
        })
        .catch((err) => logger.error('Failed to load settings', err))
        .finally(() => setSettingsLoaded(true));
    } else {
      setSettingsLoaded(true);
    }
  }, []);

  const filterItem = useCallback((item: InboxItem): boolean => {
    return shouldShowItem(
      item,
      settingsRef.current.customFilters,
      settingsRef.current.globalExcludeReasons,
    );
  }, []);

  const sendDesktopNotification = useSendDesktopNotification(settingsRef, isFirstLoadRef);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await commands.fetchInbox(false);

      if (!isMountedRef.current) return;

      const filteredData = data.filter(filterItem);

      const previousIds = previousIdsRef.current;
      const newUnreadItems = filteredData.filter(
        (item) => item.unread && !previousIds.has(item.id),
      );

      if (newUnreadItems.length > 0) {
        await sendDesktopNotification(newUnreadItems);
      }

      if (!isMountedRef.current) return;

      previousIdsRef.current = new Set(filteredData.map((item) => item.id));
      isFirstLoadRef.current = false;

      setItems(filteredData);
      setLastUpdated(new Date());
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch inbox');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [sendDesktopNotification, filterItem]);

  useEffect(() => {
    if (settingsLoaded) {
      fetchItems();
    }
  }, [settingsLoaded, fetchItems]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return;
    }

    const setupListener = async () => {
      const unlisten = await listen<InboxItem[]>('inbox-updated', (event) => {
        const newItems = event.payload;

        const filteredItems = newItems.filter(filterItem);

        const previousIds = previousIdsRef.current;
        const newUnreadItems = filteredItems.filter(
          (item) => item.unread && !previousIds.has(item.id),
        );

        if (newUnreadItems.length > 0 && !isFirstLoadRef.current) {
          sendDesktopNotification(newUnreadItems);
        }

        previousIdsRef.current = new Set(filteredItems.map((item) => item.id));
        isFirstLoadRef.current = false;

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
  }, [sendDesktopNotification, filterItem]);

  useEffect(() => {
    const loadSettings = async () => {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        try {
          const settings = await commands.getAppSettings();
          settingsRef.current = {
            desktopNotifications: settings.desktopNotifications,
            soundEnabled: settings.soundEnabled ?? true,
            customFilters: settings.customFilters,
            globalExcludeReasons: settings.globalExcludeReasons ?? DEFAULT_GLOBAL_EXCLUDE_REASONS,
            repositoryGroups: settings.repositoryGroups ?? [],
          };

          setItems((prev) => prev.filter(filterItem));
        } catch (err) {
          logger.error('Failed to load settings', err);
        }
      }
    };

    const interval = setInterval(loadSettings, 30 * 1000);
    return () => clearInterval(interval);
  }, [filterItem]);

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
    markAsRead,
    markAllAsRead,
    refresh,
    unreadCount,
    selectedIndex,
    setSelectedIndex,
  };
}
