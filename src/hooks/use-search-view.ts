import { useCallback, useRef, useState } from 'react';
import { createDemoSearchItems, isDemoMode } from '@/lib/demo-data';
import * as commands from '@/lib/tauri/commands';
import { logger } from '@/lib/utils/logger';
import type { NotificationItem } from '@/types';
import type { IssueStatusRule } from '@/types/settings';

interface SearchViewState {
  items: NotificationItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useSearchView() {
  const [state, setState] = useState<SearchViewState>({
    items: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
  });
  const lastQueryRef = useRef<string | null>(null);
  const lastRulesRef = useRef<IssueStatusRule[] | undefined>(undefined);

  const fetch = useCallback(async (query: string, issueStatusRules?: IssueStatusRule[]) => {
    lastQueryRef.current = query;
    lastRulesRef.current = issueStatusRules;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      if (isDemoMode()) {
        const items = createDemoSearchItems(query);
        if (lastQueryRef.current === query) {
          setState({
            items,
            isLoading: false,
            error: null,
            lastUpdated: new Date(),
          });
        }
        return;
      }

      const items = await commands.fetchNotifications(query, issueStatusRules);
      // 後発のクエリで上書きされた場合は古い結果を反映しない
      if (lastQueryRef.current === query) {
        setState({
          items,
          isLoading: false,
          error: null,
          lastUpdated: new Date(),
        });
      }
    } catch (err) {
      if (lastQueryRef.current === query) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : '検索結果の取得に失敗しました',
        }));
      }
    }
  }, []);

  const refresh = useCallback(() => {
    if (lastQueryRef.current) {
      fetch(lastQueryRef.current, lastRulesRef.current);
    }
  }, [fetch]);

  const markAsRead = useCallback(async (itemId: string) => {
    if (isDemoMode()) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === itemId ? { ...item, isRead: true } : item)),
      }));
      return;
    }

    try {
      await commands.markAsRead(itemId);
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === itemId ? { ...item, isRead: true } : item)),
      }));
    } catch (err) {
      logger.error('Failed to mark search item as read', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (isDemoMode()) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({ ...item, isRead: true })),
      }));
      return;
    }

    try {
      const itemIds = state.items.map((item) => item.id);
      await commands.markAllAsRead(itemIds);
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({ ...item, isRead: true })),
      }));
    } catch (err) {
      logger.error('Failed to mark all search items as read', err);
    }
  }, [state.items]);

  return {
    items: state.items,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    fetch,
    refresh,
    markAsRead,
    markAllAsRead,
  };
}
