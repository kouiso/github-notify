import type { ComponentType } from 'react';
import { Input } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import type { NotificationReason } from '@/types/settings';
import { REASON_LABELS } from '@/types/settings';
import { BoardIcon, FocusIcon, ListIcon, RefreshIcon } from './inbox-icons';

export type FilterType = 'all' | 'unread' | string;
export type InboxViewMode = 'list' | 'board' | 'focus';

const DEFAULT_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'unread', label: '未読' },
];

const VIEW_MODES: {
  value: InboxViewMode;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { value: 'list', label: '一覧', icon: ListIcon },
  { value: 'board', label: 'カンバン', icon: BoardIcon },
  { value: 'focus', label: '集中', icon: FocusIcon },
];

interface InboxListHeaderProps {
  isAllSelected: boolean;
  hasSelection: boolean;
  filter: FilterType;
  viewMode: InboxViewMode;
  searchQuery: string;
  isLoading: boolean;
  onSelectAll: () => void;
  onMarkSelectedAsDone: () => void;
  onFilterChange: (filter: FilterType) => void;
  onViewModeChange: (mode: InboxViewMode) => void;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  isSearchMode?: boolean;
}

export function InboxListHeader({
  isAllSelected,
  hasSelection,
  filter,
  viewMode,
  searchQuery,
  isLoading,
  onSelectAll,
  onMarkSelectedAsDone,
  onFilterChange,
  onViewModeChange,
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
          title="すべて選択"
        />
      )}
      {!isSearchMode && hasSelection ? (
        <button
          type="button"
          onClick={onMarkSelectedAsDone}
          className="px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
        >
          完了
        </button>
      ) : !isSearchMode ? (
        <div className="flex items-center gap-0.5">
          {DEFAULT_FILTERS.map((option) => (
            <button
              type="button"
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
      {!isSearchMode && (
        <div className="flex items-center rounded-md bg-accent/50 p-0.5">
          {VIEW_MODES.map(({ value, label, icon: Icon }) => (
            <button
              type="button"
              key={value}
              onClick={() => onViewModeChange(value)}
              className={cn(
                'flex h-7 min-w-7 items-center justify-center gap-1.5 rounded px-2 text-xs transition-colors',
                viewMode === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
              title={label}
              aria-label={label}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="max-w-52">
        <Input
          type="search"
          placeholder="検索..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 text-sm border-0 bg-accent/50 focus-visible:ring-1"
        />
      </div>
      <button
        type="button"
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

export function ReasonTabs({ reasons, activeReason, onSelect, counts }: ReasonTabsProps) {
  if (reasons.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border/30 overflow-x-auto">
      <button
        type="button"
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
            type="button"
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
