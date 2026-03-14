import { open } from '@tauri-apps/plugin-shell';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Input, Spinner } from '@/components/ui';
import { useSettings } from '@/hooks';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils/cn';
import type { InboxItem, NotificationItem } from '@/types';
import type { CustomFilter, NotificationReason } from '@/types/settings';
import { REASON_LABELS } from '@/types/settings';

type FilterType = 'all' | 'unread' | string;

const REVIEW_DECISION_CONFIG: Record<string, { label: string; color: string }> = {
  APPROVED: { label: 'Approved', color: 'text-[var(--color-gh-done)]' },
  CHANGES_REQUESTED: { label: 'Changes', color: 'text-[var(--color-gh-fail)]' },
  REVIEW_REQUIRED: { label: 'Pending', color: 'text-[var(--color-gh-review)]' },
};

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

const DEFAULT_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'unread', label: '未読' },
];

const REASON_COLORS: Record<string, { text: string; bg: string }> = {
  review_requested: { text: 'text-[var(--color-gh-pr)]', bg: 'bg-[var(--color-gh-review-bg)]' },
  mention: { text: 'text-[var(--color-gh-mention)]', bg: 'bg-[var(--color-gh-mention-bg)]' },
  team_mention: { text: 'text-[var(--color-gh-mention)]', bg: 'bg-[var(--color-gh-mention-bg)]' },
  assign: { text: 'text-[var(--color-gh-assign)]', bg: 'bg-[var(--color-gh-assign-bg)]' },
  author: { text: 'text-muted-foreground', bg: 'bg-accent' },
  ci_activity: { text: 'text-[var(--color-gh-ci)]', bg: 'bg-[var(--color-gh-ci-bg)]' },
  comment: { text: 'text-muted-foreground', bg: 'bg-accent' },
  state_change: { text: 'text-muted-foreground', bg: 'bg-accent' },
};

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

interface InboxListHeaderProps {
  isAllSelected: boolean;
  hasSelection: boolean;
  filter: FilterType;
  searchQuery: string;
  isLoading: boolean;
  onSelectAll: () => void;
  onMarkSelectedAsDone: () => void;
  onFilterChange: (filter: FilterType) => void;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  isSearchMode?: boolean;
}

function InboxListHeader({
  isAllSelected,
  hasSelection,
  filter,
  searchQuery,
  isLoading,
  onSelectAll,
  onMarkSelectedAsDone,
  onFilterChange,
  onSearchChange,
  onRefresh,
  isSearchMode = false,
}: InboxListHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
      {!isSearchMode && (
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={onSelectAll}
          className="flex-shrink-0"
          title="Select all"
        />
      )}
      {!isSearchMode && hasSelection ? (
        <button
          onClick={onMarkSelectedAsDone}
          className="px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
        >
          Done
        </button>
      ) : !isSearchMode ? (
        <div className="flex items-center gap-0.5">
          {DEFAULT_FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              className={cn(
                'px-2.5 py-1 text-sm rounded-md transition-colors',
                filter === option.value
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex-1" />
      <div className="max-w-52">
        <Input
          type="search"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 text-sm border-0 bg-accent/50 focus-visible:ring-1"
        />
      </div>
      <button
        onClick={onRefresh}
        disabled={isLoading}
        className="p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
      >
        <RefreshIcon className={cn('w-4 h-4 text-muted-foreground', isLoading && 'animate-spin')} />
      </button>
    </div>
  );
}

interface ReasonTabsProps {
  reasons: NotificationReason[];
  activeReason: NotificationReason | null;
  onSelect: (reason: NotificationReason | null) => void;
  counts: Record<string, number>;
}

function ReasonTabs({ reasons, activeReason, onSelect, counts }: ReasonTabsProps) {
  if (reasons.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border/30 overflow-x-auto">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-2.5 py-1 text-[0.8125rem] rounded-md transition-colors whitespace-nowrap',
          !activeReason
            ? 'bg-accent text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
        )}
      >
        すべて
      </button>
      {reasons.map((reason) => {
        const count = counts[reason] || 0;
        return (
          <button
            key={reason}
            onClick={() => onSelect(reason)}
            className={cn(
              'px-2.5 py-1 text-[0.8125rem] rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5',
              activeReason === reason
                ? 'bg-accent text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
            )}
          >
            {REASON_LABELS[reason]}
            {count > 0 && (
              <span className="text-xs text-muted-foreground/70 tabular-nums">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
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

function EmptyState({
  isSearchMode,
  filter,
  searchQuery,
  onSetFilter,
}: {
  isSearchMode: boolean;
  filter: FilterType;
  searchQuery: string;
  onSetFilter: (f: FilterType) => void;
}) {
  const title = isSearchMode
    ? 'No results'
    : filter === 'unread'
      ? 'No unread notifications'
      : 'No notifications';

  const description = isSearchMode
    ? searchQuery
      ? 'No items match your search.'
      : 'No items found for this query.'
    : filter === 'unread'
      ? "You're all caught up."
      : searchQuery
        ? 'No notifications match your search.'
        : 'New notifications will appear here.';

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="text-base text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground/60 mt-1 max-w-xs">{description}</p>
      {!isSearchMode && filter === 'unread' && (
        <button
          className="mt-3 px-3 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
          onClick={() => onSetFilter('all')}
        >
          View all
        </button>
      )}
    </div>
  );
}

interface InboxRowProps {
  item: InboxItem;
  isSelected: boolean;
  isChecked: boolean;
  onCheckChange: (checked: boolean) => void;
  onClick: () => void;
  onMarkAsDone: () => void;
}

const InboxRow = forwardRef<HTMLDivElement, InboxRowProps>(
  ({ item, isSelected, isChecked, onCheckChange, onClick, onMarkAsDone }, ref) => {
    const isPR = item.itemType === 'PullRequest';
    const isIssue = item.itemType === 'Issue';
    const reasonLabel = REASON_LABELS[item.reason] || item.reason;
    const colors = REASON_COLORS[item.reason] || { text: 'text-muted-foreground', bg: 'bg-accent' };

    return (
      <div
        ref={ref}
        className={cn(
          'inbox-row flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer group border-b border-border/30',
          item.unread ? 'bg-background' : 'bg-background/60',
          isSelected && 'bg-accent',
          !isSelected && 'hover:bg-accent/30',
        )}
      >
        <div className="w-1.5 flex-shrink-0">
          {item.unread && <span className="block w-1.5 h-1.5 rounded-full bg-primary" />}
        </div>

        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onCheckChange(e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
        />

        <div className="flex-shrink-0">
          {isPR && <PRIcon className="w-4.5 h-4.5 text-[var(--color-gh-pr)]" />}
          {isIssue && <IssueIcon className="w-4.5 h-4.5 text-[var(--color-gh-issue)]" />}
          {!isPR && !isIssue && <NotificationIcon className="w-4.5 h-4.5 text-muted-foreground" />}
        </div>

        <div className="flex-1 min-w-0" onClick={onClick}>
          <span
            className={cn(
              'text-[0.9375rem] truncate block leading-snug',
              item.unread ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {item.title}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[0.8125rem] text-muted-foreground truncate">
              {item.repositoryFullName}
            </span>
            <span
              className={cn(
                'inline-flex px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0',
                colors.text,
                colors.bg,
              )}
            >
              {reasonLabel}
            </span>
          </div>
        </div>

        <span className="text-[0.8125rem] text-muted-foreground flex-shrink-0 tabular-nums">
          {formatRelativeTime(item.updatedAt)}
        </span>

        <div className="row-actions flex-shrink-0">
          <button
            className="p-1 rounded hover:bg-accent transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsDone();
            }}
          >
            <CheckIcon className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  },
);

InboxRow.displayName = 'InboxRow';

function SearchRow({ item, onClick }: { item: NotificationItem; onClick: () => void }) {
  const isPR = item.itemType === 'pullrequest';
  const reviewConfig = item.reviewDecision ? REVIEW_DECISION_CONFIG[item.reviewDecision] : null;

  return (
    <div
      className="inbox-row flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-b border-border/30 hover:bg-accent/30"
      onClick={onClick}
    >
      <div className="flex-shrink-0">
        {isPR ? (
          <PRIcon className="w-4.5 h-4.5 text-[var(--color-gh-pr)]" />
        ) : (
          <IssueIcon className="w-4.5 h-4.5 text-[var(--color-gh-issue)]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[0.9375rem] text-foreground truncate leading-snug">
            {item.title}
          </span>
          {item.isDraft && (
            <span className="text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded flex-shrink-0">
              Draft
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[0.8125rem] text-muted-foreground truncate">
            {item.repository.owner.login}/{item.repository.name}
          </span>
          {item.author && (
            <span className="text-[0.8125rem] text-muted-foreground/70 flex-shrink-0">
              by @{item.author.login}
            </span>
          )}
          {reviewConfig && (
            <span className={cn('text-xs font-medium flex-shrink-0', reviewConfig.color)}>
              {reviewConfig.label}
            </span>
          )}
        </div>
      </div>

      <span className="text-[0.8125rem] text-muted-foreground flex-shrink-0 tabular-nums">
        {formatRelativeTime(item.updatedAt)}
      </span>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PRIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <line x1="6" x2="6" y1="9" y2="21" />
    </svg>
  );
}

function IssueIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function NotificationIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
