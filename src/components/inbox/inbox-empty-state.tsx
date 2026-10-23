import type { FilterType } from './inbox-filter';

interface EmptyStateProps {
  isSearchMode: boolean;
  filter: FilterType;
  searchQuery: string;
  onSetFilter: (f: FilterType) => void;
}

export function EmptyState({ isSearchMode, filter, searchQuery, onSetFilter }: EmptyStateProps) {
  const title = isSearchMode
    ? '該当する項目はありません'
    : filter === 'unread'
      ? '未読通知はありません'
      : '通知はありません';

  const description = isSearchMode
    ? searchQuery
      ? '検索条件に一致する項目はありません。'
      : 'このビューに表示できる項目はありません。'
    : filter === 'unread'
      ? '対応が必要な通知はありません。'
      : searchQuery
        ? '検索条件に一致する通知はありません。'
        : '新しい通知がここに表示されます。';

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
          すべて表示
        </button>
      )}
    </div>
  );
}
