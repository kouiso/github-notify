import type { FilterType } from './inbox-filter';

interface EmptyStateProps {
  isSearchMode: boolean;
  filter: FilterType;
  searchQuery: string;
  onSetFilter: (f: FilterType) => void;
}

export function EmptyState({ isSearchMode, filter, searchQuery, onSetFilter }: EmptyStateProps) {
  const title = isSearchMode
    ? '検索に一致する通知はありません'
    : filter === 'unread'
      ? '未読の通知はありません'
      : '通知はありません';

  const description = isSearchMode
    ? searchQuery
      ? '検索語を変えるか、対象のリポジトリを広げると見つかる場合があります。'
      : '検索語や対象のリポジトリを指定すると、過去の通知を探せます。'
    : filter === 'unread'
      ? '今すぐ対応が必要な未読はありません。既読も確認する場合は全件表示に切り替えてください。'
      : searchQuery
        ? '検索語に一致する通知はありません。検索を消すと他の通知を確認できます。'
        : 'GitHub から取得した通知が 0 件です。更新すると新しい通知を再確認できます。';

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="text-base text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
      {!isSearchMode && filter === 'unread' && (
        <button
          type="button"
          className="mt-3 px-3 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
          onClick={() => onSetFilter('all')}
        >
          全件を見る
        </button>
      )}
    </div>
  );
}
