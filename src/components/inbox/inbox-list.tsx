import { open } from '@tauri-apps/plugin-shell';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/components/ui';
import { useSettings } from '@/hooks';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { matchesFilter } from '@/lib/filters/match-filter';
import { cn } from '@/lib/utils/cn';
import { formatRelativeTime } from '@/lib/utils/format-relative-time';
import type { InboxItem, NotificationItem } from '@/types';
import type { CustomFilter, NotificationReason } from '@/types/settings';
import { REASON_LABELS } from '@/types/settings';
import { EmptyState } from './inbox-empty-state';
import type { FilterType, InboxViewMode } from './inbox-filter';
import { InboxListHeader, ReasonTabs } from './inbox-filter';
import { InboxRow, SearchRow } from './inbox-item';

interface InboxListProps {
  items: InboxItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  onMarkAsRead: (threadId: string) => void;
  onRefresh: () => void;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  selectedFilterId: string | null;
  isSearchMode?: boolean;
  searchItems?: NotificationItem[];
  activeRepositories?: string[] | null;
}

function applySidebarFilterLogic(
  items: InboxItem[],
  sidebarFilter: CustomFilter | null,
  selectedFilterId: string | null,
  customFilters: CustomFilter[],
): InboxItem[] {
  if (sidebarFilter) {
    return items.filter((item) => matchesFilter(item, sidebarFilter));
  }
  if (selectedFilterId === null) {
    return items.filter((item) => customFilters.some((f) => matchesFilter(item, f)));
  }
  return items;
}

function applyViewFilterLogic(
  items: InboxItem[],
  filter: FilterType,
  activeCustomFilter: CustomFilter | null,
): InboxItem[] {
  if (filter === 'unread') {
    return items.filter((item) => item.unread);
  }
  if (activeCustomFilter) {
    return items.filter((item) => matchesFilter(item, activeCustomFilter));
  }
  return items;
}

function applySearchFilterLogic(items: InboxItem[], searchQuery: string): InboxItem[] {
  if (!searchQuery.trim()) {
    return items;
  }
  const query = searchQuery.toLowerCase();
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(query) ||
      item.repositoryFullName.toLowerCase().includes(query),
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

export function InboxList({
  items,
  isLoading,
  error,
  lastUpdated,
  onMarkAsRead,
  onRefresh,
  selectedIndex,
  setSelectedIndex,
  selectedFilterId,
  isSearchMode = false,
  searchItems,
  activeRepositories = null,
}: InboxListProps) {
  const { settings } = useSettings();
  const [filter, setFilter] = useState<FilterType>('unread');
  const [viewMode, setViewMode] = useState<InboxViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reasonFilter, setReasonFilter] = useState<NotificationReason | null>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const sidebarFilter: CustomFilter | null = selectedFilterId
    ? (settings.customFilters.find((f) => f.id === selectedFilterId) ?? null)
    : null;
  const activeCustomFilter: CustomFilter | null =
    settings.customFilters.find((f) => f.id === filter) ?? null;

  useEffect(() => {
    setReasonFilter(null);
  }, [selectedFilterId]);

  // アクティブなビューに含まれる理由種別を収集してクイックタブに表示する
  const activeReasons = useMemo((): NotificationReason[] => {
    if (isSearchMode) return [];
    if (sidebarFilter) return sidebarFilter.reasons;
    const allReasons = new Set<NotificationReason>();
    for (const f of settings.customFilters) {
      for (const r of f.reasons) {
        allReasons.add(r);
      }
    }
    return [...allReasons];
  }, [isSearchMode, sidebarFilter, settings.customFilters]);

  const filteredItems = useMemo(() => {
    if (isSearchMode) return [];
    let result = items;
    result = applySidebarFilterLogic(
      result,
      sidebarFilter,
      selectedFilterId,
      settings.customFilters,
    );
    result = applyViewFilterLogic(result, filter, activeCustomFilter);
    result = applySearchFilterLogic(result, searchQuery);
    if (reasonFilter) {
      result = result.filter((item) => item.reason === reasonFilter);
    }
    return result;
  }, [
    isSearchMode,
    items,
    sidebarFilter,
    selectedFilterId,
    settings.customFilters,
    filter,
    activeCustomFilter,
    searchQuery,
    reasonFilter,
  ]);

  const filteredSearchItems = useMemo(() => {
    if (!isSearchMode || !searchItems) return [];
    const scopedItems =
      activeRepositories && activeRepositories.length > 0
        ? searchItems.filter((item) =>
            activeRepositories.includes(`${item.repository.owner.login}/${item.repository.name}`),
          )
        : searchItems;
    if (!searchQuery.trim()) return scopedItems;
    const query = searchQuery.toLowerCase();
    return scopedItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        `${item.repository.owner.login}/${item.repository.name}`.toLowerCase().includes(query),
    );
  }, [isSearchMode, searchItems, searchQuery, activeRepositories]);

  // 理由クイックフィルター適用前のベース件数を集計してタブに表示する
  const reasonCounts = useMemo(() => {
    if (isSearchMode) return {};
    let base = items;
    base = applySidebarFilterLogic(base, sidebarFilter, selectedFilterId, settings.customFilters);
    base = applyViewFilterLogic(base, filter, activeCustomFilter);
    base = applySearchFilterLogic(base, searchQuery);

    const counts: Record<string, number> = {};
    for (const item of base) {
      if (item.unread) {
        counts[item.reason] = (counts[item.reason] || 0) + 1;
      }
    }
    return counts;
  }, [
    isSearchMode,
    items,
    sidebarFilter,
    selectedFilterId,
    settings.customFilters,
    filter,
    activeCustomFilter,
    searchQuery,
  ]);

  const displayItems = isSearchMode ? filteredSearchItems : filteredItems;
  const displayCount = displayItems.length;

  useEffect(() => {
    if (isSearchMode) return;
    if (filteredItems.length === 0) return;
    if (selectedIndex < 0) {
      setSelectedIndex(0);
      return;
    }
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(filteredItems.length - 1);
    }
  }, [isSearchMode, filteredItems.length, selectedIndex, setSelectedIndex]);

  useKeyboardShortcuts({
    items: isSearchMode ? [] : filteredItems,
    selectedIndex,
    setSelectedIndex,
    onMarkAsRead,
  });

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleClick = async (item: InboxItem) => {
    if (item.url) {
      await open(item.url);
    }
    if (item.unread) {
      onMarkAsRead(item.id);
    }
  };

  const handleSearchItemClick = async (item: NotificationItem) => {
    if (item.url) {
      await open(item.url);
    }
  };

  const handleCheckboxChange = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (isSearchMode) return;
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((item) => item.id)));
    }
  };

  const handleMarkSelectedAsDone = () => {
    for (const id of selectedIds) {
      onMarkAsRead(id);
    }
    setSelectedIds(new Set());
  };

  const isAllSelected =
    !isSearchMode && filteredItems.length > 0 && selectedIds.size === filteredItems.length;
  const hasSelection = selectedIds.size > 0;

  useEffect(() => {
    if (isSearchMode) {
      setSelectedIds(new Set());
      return;
    }
    const visibleIds = new Set(filteredItems.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [isSearchMode, filteredItems]);

  return (
    <div className="flex flex-col h-full">
      <InboxListHeader
        isAllSelected={isAllSelected}
        hasSelection={hasSelection}
        filter={filter}
        viewMode={viewMode}
        searchQuery={searchQuery}
        isLoading={isLoading}
        onSelectAll={handleSelectAll}
        onMarkSelectedAsDone={handleMarkSelectedAsDone}
        onFilterChange={setFilter}
        onViewModeChange={setViewMode}
        onSearchChange={setSearchQuery}
        onRefresh={onRefresh}
        isSearchMode={isSearchMode}
      />

      {!isSearchMode && (
        <ReasonTabs
          reasons={activeReasons}
          activeReason={reasonFilter}
          onSelect={setReasonFilter}
          counts={reasonCounts}
        />
      )}

      <div className="flex items-center justify-between px-4 py-1.5 text-[0.8125rem] text-muted-foreground">
        <span>
          {hasSelection
            ? `${selectedIds.size}件を選択中`
            : isSearchMode
              ? `${displayCount}件`
              : `${displayCount}件の通知`}
        </span>
        {lastUpdated && <span>{formatTime(lastUpdated)}</span>}
      </div>

      <InboxListContent
        isSearchMode={isSearchMode}
        isLoading={isLoading}
        error={error}
        filter={filter}
        viewMode={isSearchMode ? 'list' : viewMode}
        searchQuery={searchQuery}
        displayCount={displayCount}
        filteredSearchItems={filteredSearchItems}
        filteredItems={filteredItems}
        selectedIndex={selectedIndex}
        selectedIds={selectedIds}
        selectedRef={selectedRef}
        onRefresh={onRefresh}
        onSetFilter={setFilter}
        onSearchItemClick={handleSearchItemClick}
        onInboxItemClick={(item, index) => {
          setSelectedIndex(index);
          handleClick(item);
        }}
        onSelectInboxItem={setSelectedIndex}
        onCheckboxChange={handleCheckboxChange}
        onMarkAsRead={onMarkAsRead}
      />

      {!isSearchMode && (
        <div className="px-4 py-1.5 border-t border-border/50 text-[0.8125rem] text-muted-foreground/60">
          <kbd className="px-1 py-0.5 bg-accent rounded text-xs font-mono">e</kbd>
          <span className="ml-1.5">で完了</span>
        </div>
      )}
    </div>
  );
}

function InboxListContent({
  isSearchMode,
  isLoading,
  error,
  filter,
  viewMode,
  searchQuery,
  displayCount,
  filteredSearchItems,
  filteredItems,
  selectedIndex,
  selectedIds,
  selectedRef,
  onRefresh,
  onSetFilter,
  onSearchItemClick,
  onInboxItemClick,
  onSelectInboxItem,
  onCheckboxChange,
  onMarkAsRead,
}: {
  isSearchMode: boolean;
  isLoading: boolean;
  error: string | null;
  filter: FilterType;
  viewMode: InboxViewMode;
  searchQuery: string;
  displayCount: number;
  filteredSearchItems: NotificationItem[];
  filteredItems: InboxItem[];
  selectedIndex: number;
  selectedIds: Set<string>;
  selectedRef: React.RefObject<HTMLDivElement | null>;
  onRefresh: () => void;
  onSetFilter: (f: FilterType) => void;
  onSearchItemClick: (item: NotificationItem) => void;
  onInboxItemClick: (item: InboxItem, index: number) => void;
  onSelectInboxItem: (index: number) => void;
  onCheckboxChange: (id: string, checked: boolean) => void;
  onMarkAsRead: (id: string) => void;
}) {
  if (error) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6 text-center text-destructive">
          <p className="text-base">{error}</p>
          <button
            type="button"
            onClick={onRefresh}
            className="mt-2 px-3 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (isLoading && displayCount === 0) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (!isLoading && displayCount === 0) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <EmptyState
          isSearchMode={isSearchMode}
          filter={filter}
          searchQuery={searchQuery}
          onSetFilter={onSetFilter}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto scrollbar-thin">
      {isSearchMode ? (
        filteredSearchItems.map((item) => (
          <SearchRow key={item.id} item={item} onClick={() => onSearchItemClick(item)} />
        ))
      ) : viewMode === 'board' ? (
        <InboxBoard
          items={filteredItems}
          selectedIndex={selectedIndex}
          selectedIds={selectedIds}
          onInboxItemClick={onInboxItemClick}
          onCheckboxChange={onCheckboxChange}
          onMarkAsRead={onMarkAsRead}
        />
      ) : viewMode === 'focus' ? (
        <InboxFocus
          items={filteredItems}
          selectedIndex={selectedIndex}
          selectedIds={selectedIds}
          onSelectIndex={onSelectInboxItem}
          onInboxItemClick={onInboxItemClick}
          onCheckboxChange={onCheckboxChange}
          onMarkAsRead={onMarkAsRead}
        />
      ) : (
        filteredItems.map((item, index) => (
          <InboxRow
            key={item.id}
            ref={index === selectedIndex ? selectedRef : undefined}
            item={item}
            isSelected={index === selectedIndex}
            isChecked={selectedIds.has(item.id)}
            onCheckChange={(checked) => onCheckboxChange(item.id, checked)}
            onClick={() => onInboxItemClick(item, index)}
            onMarkAsDone={() => onMarkAsRead(item.id)}
          />
        ))
      )}
    </div>
  );
}

const BOARD_COLUMNS: {
  id: string;
  title: string;
  reasons: NotificationReason[];
}[] = [
  {
    id: 'review',
    title: 'レビュー',
    reasons: ['review_requested', 'assign'],
  },
  {
    id: 'mention',
    title: 'メンション',
    reasons: ['mention', 'team_mention'],
  },
  {
    id: 'activity',
    title: '作業中',
    reasons: ['author', 'comment', 'state_change', 'your_activity'],
  },
  {
    id: 'system',
    title: 'システム',
    reasons: ['ci_activity', 'security_alert', 'subscribed', 'manual', 'push'],
  },
];

function getBoardColumn(item: InboxItem): string {
  return BOARD_COLUMNS.find((column) => column.reasons.includes(item.reason))?.id ?? 'system';
}

function InboxBoard({
  items,
  selectedIndex,
  selectedIds,
  onInboxItemClick,
  onCheckboxChange,
  onMarkAsRead,
}: {
  items: InboxItem[];
  selectedIndex: number;
  selectedIds: Set<string>;
  onInboxItemClick: (item: InboxItem, index: number) => void;
  onCheckboxChange: (id: string, checked: boolean) => void;
  onMarkAsRead: (id: string) => void;
}) {
  const indexedItems = items.map((item, index) => ({ item, index }));

  return (
    <div className="grid h-full min-w-[52rem] grid-cols-4 gap-3 p-3">
      {BOARD_COLUMNS.map((column) => {
        const columnItems = indexedItems.filter(({ item }) => getBoardColumn(item) === column.id);
        const unreadCount = columnItems.filter(({ item }) => item.unread).length;

        return (
          <section
            key={column.id}
            className="flex min-h-0 flex-col rounded-lg border border-border/50 bg-muted/20"
          >
            <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
              <h3 className="text-sm font-semibold">{column.title}</h3>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {unreadCount}/{columnItems.length}
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 scrollbar-thin">
              {columnItems.length > 0 ? (
                columnItems.map(({ item, index }) => (
                  <InboxBoardCard
                    key={item.id}
                    item={item}
                    isSelected={index === selectedIndex}
                    isChecked={selectedIds.has(item.id)}
                    onCheckChange={(checked) => onCheckboxChange(item.id, checked)}
                    onClick={() => onInboxItemClick(item, index)}
                    onMarkAsDone={() => onMarkAsRead(item.id)}
                  />
                ))
              ) : (
                <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground">
                  なし
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function InboxBoardCard({
  item,
  isSelected,
  isChecked,
  onCheckChange,
  onClick,
  onMarkAsDone,
}: {
  item: InboxItem;
  isSelected: boolean;
  isChecked: boolean;
  onCheckChange: (checked: boolean) => void;
  onClick: () => void;
  onMarkAsDone: () => void;
}) {
  const reasonLabel = REASON_LABELS[item.reason] || item.reason;

  return (
    <div
      className={cn(
        'rounded-md border bg-background p-2.5 shadow-sm transition-colors hover:border-primary/40',
        isSelected ? 'border-primary/70 ring-2 ring-primary/20' : 'border-border/50',
      )}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(event) => onCheckChange(event.target.checked)}
          className="mt-0.5 flex-shrink-0"
        />
        <button
          type="button"
          onClick={onClick}
          className="min-w-0 flex-1 text-left"
          aria-current={isSelected ? 'true' : undefined}
        >
          <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{item.repositoryFullName}</p>
        </button>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="mt-2 flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="truncate rounded bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">
          {reasonLabel}
        </span>
        <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatRelativeTime(item.updatedAt)}
        </span>
      </button>
      {item.unread && <div className="mt-2 h-1 rounded-full bg-primary/70" />}
      <button
        type="button"
        className="mt-2 w-full rounded border border-border/50 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={onMarkAsDone}
      >
        完了
      </button>
    </div>
  );
}

function InboxFocus({
  items,
  selectedIndex,
  selectedIds,
  onSelectIndex,
  onInboxItemClick,
  onCheckboxChange,
  onMarkAsRead,
}: {
  items: InboxItem[];
  selectedIndex: number;
  selectedIds: Set<string>;
  onSelectIndex: (index: number) => void;
  onInboxItemClick: (item: InboxItem, index: number) => void;
  onCheckboxChange: (id: string, checked: boolean) => void;
  onMarkAsRead: (id: string) => void;
}) {
  const focusedIndex =
    selectedIndex >= 0 && selectedIndex < items.length ? selectedIndex : items.length > 0 ? 0 : -1;
  const focusedItem = focusedIndex >= 0 ? items[focusedIndex] : null;

  if (!focusedItem) return null;

  return (
    <div className="grid h-full min-w-[42rem] grid-cols-[17rem_1fr]">
      <div className="min-h-0 overflow-y-auto border-r border-border/50 bg-muted/20 scrollbar-thin">
        {items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelectIndex(index)}
            className={cn(
              'block w-full border-b border-border/30 px-3 py-2.5 text-left transition-colors',
              index === focusedIndex ? 'bg-background' : 'hover:bg-accent/40',
            )}
          >
            <span
              className={cn(
                'block truncate text-sm',
                item.unread ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {item.title}
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {item.repositoryFullName}
            </span>
          </button>
        ))}
      </div>

      <article className="min-h-0 overflow-y-auto p-6 scrollbar-thin">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {focusedItem.unread && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    未読
                  </span>
                )}
                <span className="rounded bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                  {REASON_LABELS[focusedItem.reason] || focusedItem.reason}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(focusedItem.updatedAt)}
                </span>
              </div>
              <h2 className="text-xl font-semibold leading-snug">{focusedItem.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{focusedItem.repositoryFullName}</p>
            </div>
            <input
              type="checkbox"
              checked={selectedIds.has(focusedItem.id)}
              onChange={(event) => onCheckboxChange(focusedItem.id, event.target.checked)}
              className="mt-1 flex-shrink-0"
              title="選択"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 border-y border-border/50 py-4 text-sm">
            <div>
              <span className="block text-xs text-muted-foreground">種別</span>
              <span>{focusedItem.itemType}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">所有者</span>
              <span>{focusedItem.ownerLogin}</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onInboxItemClick(focusedItem, focusedIndex)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              GitHubで開く
            </button>
            <button
              type="button"
              onClick={() => onMarkAsRead(focusedItem.id)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              完了にする
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
