import type { FilterType } from './inbox-filter';

interface EmptyStateProps {
  isSearchMode: boolean;
  filter: FilterType;
  searchQuery: string;
  onSetFilter: (f: FilterType) => void;
}

export function EmptyState({ isSearchMode, filter, searchQuery, onSetFilter }: EmptyStateProps) {
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
          type="button"
          className="mt-3 px-3 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
          onClick={() => onSetFilter('all')}
        >
          View all
        </button>
      )}
    </div>
  );
}
