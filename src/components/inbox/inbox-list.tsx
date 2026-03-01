import { open } from '@tauri-apps/plugin-shell';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Input, Spinner } from '@/components/ui';
import { useSettings } from '@/hooks';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils/cn';
import type { InboxItem } from '@/types';
import type { CustomFilter, NotificationReason } from '@/types/settings';
import { REASON_LABELS } from '@/types/settings';

type FilterType = 'all' | 'unread' | string;

interface InboxListProps {
  items: InboxItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  onMarkAsRead: (threadId: string) => void;
  onMarkAllAsRead: () => void;
  onRefresh: () => void;
  unreadCount: number;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  selectedFilterId: string | null;
}

const DEFAULT_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'unread', label: '未読' },
];

function matchesCustomFilter(item: InboxItem, filter: CustomFilter): boolean {
  if (filter.reasons.length > 0 && !filter.reasons.includes(item.reason as NotificationReason)) {
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
}: InboxListHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
      <input
        type="checkbox"
        checked={isAllSelected}
        onChange={onSelectAll}
        className="flex-shrink-0"
        title="Select all"
      />
      {hasSelection ? (
        <button
          onClick={onMarkSelectedAsDone}
          className="px-2.5 py-1 text-[0.8125rem] text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
        >
          Done
        </button>
      ) : (
        <div className="flex items-center gap-0.5">
          {DEFAULT_FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              className={cn(
                'px-2.5 py-1 text-[0.8125rem] rounded-md transition-colors',
                filter === option.value
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1" />
      <div className="max-w-48">
        <Input
          type="search"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-7 text-[0.8125rem] border-0 bg-accent/50 focus-visible:ring-1"
        />
      </div>
      <button
        onClick={onRefresh}
        disabled={isLoading}
        className="p-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
      >
        <RefreshIcon
          className={cn('w-3.5 h-3.5 text-muted-foreground', isLoading && 'animate-spin')}
        />
      </button>
    </div>
  );
}

export function InboxList({
  items,
  isLoading,
  error,
  lastUpdated,
  onMarkAsRead,
  onMarkAllAsRead: _onMarkAllAsRead,
  onRefresh,
  unreadCount: _unreadCount,
  selectedIndex,
  setSelectedIndex,
  selectedFilterId,
}: InboxListProps) {
  // Prefixed with _ to indicate intentionally unused (available for future use)
  void _onMarkAllAsRead;
  void _unreadCount;
  const { settings } = useSettings();
  const [filter, setFilter] = useState<FilterType>('unread');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedRef = useRef<HTMLDivElement>(null);

  const sidebarFilter: CustomFilter | null = selectedFilterId
    ? (settings.customFilters.find((f) => f.id === selectedFilterId) ?? null)
    : null;
  const activeCustomFilter: CustomFilter | null =
    settings.customFilters.find((f) => f.id === filter) ?? null;

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items;
    result = applySidebarFilterLogic(
      result,
      sidebarFilter,
      selectedFilterId,
      settings.customFilters,
    );
    result = applyViewFilterLogic(result, filter, activeCustomFilter);
    result = applySearchFilterLogic(result, searchQuery);
    return result;
  }, [
    items,
    sidebarFilter,
    selectedFilterId,
    settings.customFilters,
    filter,
    activeCustomFilter,
    searchQuery,
  ]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    items: filteredItems,
    selectedIndex,
    setSelectedIndex,
    onMarkAsRead,
  });

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  const handleClick = async (item: InboxItem) => {
    if (item.url) {
      await open(item.url);
    }
    if (item.unread) {
      onMarkAsRead(item.id);
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

  const isAllSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;
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
      />

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 text-[0.75rem] text-muted-foreground">
        <span>
          {hasSelection ? `${selectedIds.size} selected` : `${filteredItems.length} notifications`}
        </span>
        {lastUpdated && <span>{formatTime(lastUpdated)}</span>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {error && (
          <div className="p-6 text-center text-destructive">
            <p>{error}</p>
            <button
              onClick={onRefresh}
              className="mt-2 px-3 py-1 text-[0.8125rem] text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading && items.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Spinner size="lg" />
          </div>
        )}

        {!isLoading && filteredItems.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <p className="text-[0.9375rem] text-muted-foreground">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
            </p>
            <p className="text-[0.8125rem] text-muted-foreground/60 mt-1 max-w-xs">
              {filter === 'unread'
                ? "You're all caught up."
                : searchQuery
                  ? 'No notifications match your search.'
                  : 'New notifications will appear here.'}
            </p>
            {filter === 'unread' && (
              <button
                className="mt-3 px-3 py-1 text-[0.8125rem] text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
                onClick={() => setFilter('all')}
              >
                View all
              </button>
            )}
          </div>
        )}

        {filteredItems.length > 0 && (
          <div>
            {filteredItems.map((item, index) => (
              <InboxRow
                key={item.id}
                ref={index === selectedIndex ? selectedRef : undefined}
                item={item}
                isSelected={index === selectedIndex}
                isChecked={selectedIds.has(item.id)}
                onCheckChange={(checked) => handleCheckboxChange(item.id, checked)}
                onClick={() => {
                  setSelectedIndex(index);
                  handleClick(item);
                }}
                onMarkAsDone={() => onMarkAsRead(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ProTip footer */}
      <div className="px-4 py-1.5 border-t border-border/50 text-[0.75rem] text-muted-foreground/60">
        <kbd className="px-1 py-0.5 bg-accent rounded text-[0.6875rem] font-mono">e</kbd>
        <span className="ml-1.5">to mark done</span>
      </div>
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
    const reasonLabel = REASON_LABELS[item.reason as NotificationReason] || item.reason;

    return (
      <div
        ref={ref}
        className={cn(
          'inbox-row flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer group border-b border-border/30',
          item.unread ? 'bg-background' : 'bg-background/60',
          isSelected && 'bg-accent',
          !isSelected && 'hover:bg-accent/30',
        )}
      >
        {/* Unread indicator */}
        <div className="w-1.5 flex-shrink-0">
          {item.unread && <span className="block w-1.5 h-1.5 rounded-full bg-primary" />}
        </div>

        {/* Checkbox */}
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

        {/* Status icon */}
        <div className="flex-shrink-0">
          {isPR && <PRIcon className="w-4 h-4 text-[var(--color-gh-pr)]" />}
          {isIssue && <IssueIcon className="w-4 h-4 text-[var(--color-gh-issue)]" />}
          {!isPR && !isIssue && <NotificationIcon className="w-4 h-4 text-muted-foreground" />}
        </div>

        {/* Content — 2-line layout */}
        <div className="flex-1 min-w-0" onClick={onClick}>
          <span
            className={cn(
              'text-[0.875rem] truncate block',
              item.unread ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {item.title}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[0.75rem] text-muted-foreground truncate">
              {item.repositoryFullName}
            </span>
            <span className="text-[0.75rem] text-muted-foreground/60">{reasonLabel}</span>
          </div>
        </div>

        {/* Timestamp */}
        <span className="text-[0.75rem] text-muted-foreground flex-shrink-0 tabular-nums">
          {formatRelativeTime(item.updatedAt)}
        </span>

        {/* Row actions (show on hover) */}
        <div className="row-actions flex-shrink-0">
          <button
            className="p-1 rounded hover:bg-accent transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsDone();
            }}
          >
            <CheckIcon className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  },
);

InboxRow.displayName = 'InboxRow';

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

// Icons
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
