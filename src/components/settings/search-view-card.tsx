import { Button } from '@/components/ui';
import type { CustomFilter } from '@/types';

const SEARCH_VIEW_DESCRIPTIONS: Record<string, string> = {
  'default-needs-review': 'レビュワーに指定されていて、まだレビューしていないPR',
  'default-my-prs': '自分が作成したオープン中のPR',
};

export function SearchViewCard({ filter, onEdit }: { filter: CustomFilter; onEdit: () => void }) {
  const description = SEARCH_VIEW_DESCRIPTIONS[filter.id];
  const activeRules = filter.issueStatusRules?.filter((r) => r.enabled) || [];

  return (
    <div className="p-3 border rounded-lg hover:bg-muted/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[0.9375rem]">{filter.name}</p>
          {description && (
            <p className="text-[0.8125rem] text-muted-foreground mt-0.5">{description}</p>
          )}
          {activeRules.length > 0 && (
            <div className="mt-2 space-y-1">
              {activeRules.map((rule) => (
                <div
                  key={rule.repositoryPattern}
                  className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground"
                >
                  <span className="text-green-500">●</span>
                  <span className="font-medium">{rule.repositoryPattern}</span>
                  <span>→</span>
                  <span>ステータスが「{rule.requiredStatuses.join('」「')}」のみ表示</span>
                </div>
              ))}
            </div>
          )}
          {activeRules.length === 0 && filter.id === 'default-needs-review' && (
            <p className="text-[0.8125rem] text-amber-500 mt-1">
              組織別のレビュー対象条件を設定できます
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit} className="flex-shrink-0">
          設定
        </Button>
      </div>
    </div>
  );
}
