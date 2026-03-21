import { Button } from '@/components/ui';
import type { CustomFilter } from '@/types';
import { IssueStatusRulesEditor } from './notification-filter-editor';
import { XIcon } from './settings-icons';

const SEARCH_VIEW_DESCRIPTIONS: Record<string, string> = {
  'default-needs-review': 'レビュワーに指定されていて、まだレビューしていないPR',
  'default-my-prs': '自分が作成したオープン中のPR',
};

export function SearchViewEditor({
  filter,
  onUpdate,
  onSave,
  onCancel,
}: {
  filter: CustomFilter;
  onUpdate: (filter: CustomFilter) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const description = SEARCH_VIEW_DESCRIPTIONS[filter.id];

  return (
    <div className="space-y-4 p-4 border-2 border-primary/30 rounded-lg bg-primary/5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[0.9375rem]">{filter.name} の設定</h3>
          {description && (
            <p className="text-[0.8125rem] text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {filter.id === 'default-needs-review' && (
        <div className="space-y-3">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-[0.875rem] leading-relaxed">
              特定の組織では、GitHub Projectのステータスでレビュー対象を判定できます。
              ルールを追加すると、そのリポジトリのPRは紐づくissueのステータスが条件に合う場合のみ表示されます。
            </p>
            <p className="text-[0.8125rem] text-muted-foreground mt-1.5">
              ルール未設定の組織のPRは、通常通りレビュワーに割り当てられたものが全て表示されます。
            </p>
          </div>

          <IssueStatusRulesEditor
            rules={filter.issueStatusRules || []}
            onChange={(rules) => onUpdate({ ...filter, issueStatusRules: rules })}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onSave} className="flex-1">
          保存
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}
