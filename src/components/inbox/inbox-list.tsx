import { open } from '@tauri-apps/plugin-shell';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/components/ui';
import { useSettings } from '@/hooks';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import type { InboxItem, NotificationItem } from '@/types';
import type { CustomFilter, NotificationReason } from '@/types/settings';
import { EmptyState } from './inbox-empty-state';
import type { FilterType } from './inbox-filter';
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
}

function matchesCustomFilter(item: InboxItem, filter: CustomFilter): boolean {
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

function applySidebarFilterLogic(
  items: InboxItem[],
  sidebarFilter: CustomFilter | null,
  selectedFilterId: string | null,
  customFilters: CustomFilter[],
): InboxItem[] {
  if (sidebarFilter) {
    return items.filter((item) => matchesCustomFilter(item, sidebarFilter));
  }
  if (selectedFilterId === null) {
    return items.filter((item) => customFilters.some((f) => matchesCustomFilter(item, f)));
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
    return items.filter((item) => matchesCustomFilter(item, activeCustomFilter));
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
}: InboxListProps) {
  const { settings } = useSettings();
  const [filter, setFilter] = useState<FilterType>('unread');
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
    if (!searchQuery.trim()) return searchItems;
    const query = searchQuery.toLowerCase();
    return searchItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        `${item.repository.owner.login}/${item.repository.name}`.toLowerCase().includes(query),
    );
  }, [isSearchMode, searchItems, searchQuery]);

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

  return (
    <div className="flex flex-col h-full">
      <InboxListHeader
        isAllSelected={isAllSelected}
        hasSelection={hasSelection}
        filter={filter}
        searchQuery={searchQuery}
        isLoading={isLoading}
        onSelectAll={handleSelectAll}
        onMarkSelectedAsDone={handleMarkSelectedAsDone}
        onFilterChange={setFilter}
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
            ? `${selectedIds.size} selected`
            : isSearchMode
              ? `${displayCount} results`
              : `${displayCount} notifications`}
        </span>
        {lastUpdated && <span>{formatTime(lastUpdated)}</span>}
      </div>

      <InboxListContent
        isSearchMode={isSearchMode}
        isLoading={isLoading}
        error={error}
        filter={filter}
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
        onCheckboxChange={handleCheckboxChange}
        onMarkAsRead={onMarkAsRead}
      />

      {!isSearchMode && (
        <div className="px-4 py-1.5 border-t border-border/50 text-[0.8125rem] text-muted-foreground/60">
          <kbd className="px-1 py-0.5 bg-accent rounded text-xs font-mono">e</kbd>
          <span className="ml-1.5">to mark done</span>
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
  onCheckboxChange,
  onMarkAsRead,
}: {
  isSearchMode: boolean;
  isLoading: boolean;
  error: string | null;
  filter: FilterType;
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
            Retry
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
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {isSearchMode
        ? filteredSearchItems.map((item) => (
            <SearchRow key={item.id} item={item} onClick={() => onSearchItemClick(item)} />
          ))
        : filteredItems.map((item, index) => (
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
          ))}
    </div>
  );
}
