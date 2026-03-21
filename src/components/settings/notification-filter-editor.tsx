import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import type { CustomFilter, IssueStatusRule, NotificationReason, SoundType } from '@/types';
import { REASON_LABELS } from '@/types';
import { TrashIcon, XIcon } from './settings-icons';
import { ToggleSwitch } from './toggle-switch';

const ALL_REASONS: NotificationReason[] = [
  'review_requested',
  'mention',
  'team_mention',
  'assign',
  'author',
  'ci_activity',
  'comment',
  'state_change',
];

export function NotificationFilterEditor({
  filter,
  isCreating,
  onUpdate,
  onSave,
  onCancel,
  onToggleReason,
}: {
  filter: CustomFilter;
  isCreating: boolean;
  onUpdate: (filter: CustomFilter) => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleReason: (reason: NotificationReason) => void;
}) {
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{isCreating ? 'フィルターを作成' : 'フィルターを編集'}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      <Input
        placeholder="フィルター名"
        value={filter.name}
        onChange={(e) => onUpdate({ ...filter, name: e.target.value })}
      />

      <div className="space-y-2">
        <p className="text-[0.9375rem] font-medium text-muted-foreground">通知の種類を選択:</p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_REASONS.map((reason) => (
            <label key={reason} className="flex items-center gap-2 text-[0.9375rem] cursor-pointer">
              <input
                type="checkbox"
                checked={filter.reasons.includes(reason)}
                onChange={() => onToggleReason(reason)}
                className="rounded"
              />
              <span>{REASON_LABELS[reason]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[0.9375rem] font-medium text-muted-foreground">
          リポジトリで絞り込み（オプション）:
        </p>
        <textarea
          placeholder="owner/repo（1行に1つ）"
          value={(filter.repositories || []).join('\n')}
          onChange={(e) => {
            const repos = e.target.value
              .split('\n')
              .map((r) => r.trim())
              .filter((r) => r.length > 0);
            onUpdate({ ...filter, repositories: repos });
          }}
          className="w-full min-h-[80px] px-3 py-2 text-[0.9375rem] border rounded-md bg-background resize-none"
        />
        <p className="text-[0.8125rem] text-muted-foreground">
          空の場合はすべてのリポジトリが対象になります
        </p>
      </div>

      <label className="flex items-center gap-2 text-[0.9375rem] cursor-pointer">
        <input
          type="checkbox"
          checked={filter.enableDesktopNotification}
          onChange={() =>
            onUpdate({
              ...filter,
              enableDesktopNotification: !filter.enableDesktopNotification,
            })
          }
          className="rounded"
        />
        <span>デスクトップ通知を有効にする</span>
        {filter.enableDesktopNotification && (
          <span className="text-[0.75rem] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-semibold">
            🔔
          </span>
        )}
      </label>

      <label className="flex items-center gap-2 text-[0.9375rem] cursor-pointer">
        <input
          type="checkbox"
          checked={filter.enableSound}
          onChange={() =>
            onUpdate({
              ...filter,
              enableSound: !filter.enableSound,
            })
          }
          className="rounded"
          disabled={!filter.enableDesktopNotification}
        />
        <span className={!filter.enableDesktopNotification ? 'text-muted-foreground' : ''}>
          通知音を鳴らす
        </span>
        {filter.enableSound && filter.enableDesktopNotification && (
          <span className="text-[0.75rem] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">
            🔊
          </span>
        )}
      </label>

      {filter.enableSound && filter.enableDesktopNotification && (
        <div className="ml-6 space-y-1">
          <p className="text-[0.8125rem] text-muted-foreground font-medium">サウンドの種類:</p>
          <div className="flex gap-2">
            {(
              [
                { value: 'default', label: '標準' },
                { value: 'soft', label: 'ソフト' },
                { value: 'chime', label: 'チャイム' },
              ] satisfies { value: SoundType; label: string }[]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onUpdate({ ...filter, soundType: option.value })}
                className={cn(
                  'px-2 py-1 text-[0.8125rem] rounded border',
                  filter.soundType === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent hover:bg-accent',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
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

export function IssueStatusRulesEditor({
  rules,
  onChange,
}: {
  rules: IssueStatusRule[];
  onChange: (rules: IssueStatusRule[]) => void;
}) {
  const handleAddRule = () => {
    onChange([...rules, { repositoryPattern: '', requiredStatuses: [], enabled: true }]);
  };

  const handleUpdateRule = (index: number, updated: Partial<IssueStatusRule>) => {
    const newRules = rules.map((r, i) => (i === index ? { ...r, ...updated } : r));
    onChange(newRules);
  };

  const handleDeleteRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <p className="text-[0.9375rem] font-medium">組織別レビュー対象ルール</p>

      {rules.map((rule, index) => (
        <div
          key={rule.repositoryPattern || `new-rule-${index}`}
          className="p-3 border rounded-md space-y-2 bg-muted/30"
        >
          <div className="flex items-center justify-between gap-2">
            <Input
              placeholder="getozinc/mypappy-*（ワイルドカード対応）"
              value={rule.repositoryPattern}
              onChange={(e) => handleUpdateRule(index, { repositoryPattern: e.target.value })}
              className="flex-1"
            />
            <ToggleSwitch
              enabled={rule.enabled}
              onToggle={() => handleUpdateRule(index, { enabled: !rule.enabled })}
            />
            <button
              type="button"
              onClick={() => handleDeleteRule(index)}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
              title="ルールを削除"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
          <Input
            placeholder="レビュー対象のステータス名（例: コードレビュー）"
            value={rule.requiredStatuses.join(', ')}
            onChange={(e) =>
              handleUpdateRule(index, {
                requiredStatuses: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0),
              })
            }
          />
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={handleAddRule} className="w-full">
        + ルールを追加
      </Button>
    </div>
  );
}
