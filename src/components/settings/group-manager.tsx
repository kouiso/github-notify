import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import type { NotificationReason, RepositoryGroup, SoundType } from '@/types/settings';
import { REASON_LABELS } from '@/types/settings';
import { ToggleSwitch } from './toggle-switch';

interface GroupManagerProps {
  groups: RepositoryGroup[];
  knownRepos: string[];
  onSave: (groups: RepositoryGroup[]) => void;
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

const NOTIFY_REASONS: NotificationReason[] = [
  'review_requested',
  'mention',
  'team_mention',
  'assign',
  'author',
  'ci_activity',
  'comment',
  'state_change',
];

export function GroupManager({ groups, knownRepos, onSave }: GroupManagerProps) {
  const [editingGroup, setEditingGroup] = useState<RepositoryGroup | null>(null);

  const handleNew = () => {
    setEditingGroup({
      id: crypto.randomUUID(),
      name: '',
      repositories: [],
      color: COLORS[groups.length % COLORS.length],
      enableDesktopNotification: false,
      notifyReasons: [],
      enableSound: false,
      soundType: 'default',
    });
  };

  const handleSave = () => {
    if (!editingGroup || !editingGroup.name.trim()) return;
    const exists = groups.some((g) => g.id === editingGroup.id);
    const updated = exists
      ? groups.map((g) => (g.id === editingGroup.id ? editingGroup : g))
      : [...groups, editingGroup];
    onSave(updated);
    setEditingGroup(null);
  };

  const handleDelete = (id: string) => {
    onSave(groups.filter((g) => g.id !== id));
    if (editingGroup?.id === id) setEditingGroup(null);
  };

  const toggleRepo = (repo: string) => {
    if (!editingGroup) return;
    const has = editingGroup.repositories.includes(repo);
    setEditingGroup({
      ...editingGroup,
      repositories: has
        ? editingGroup.repositories.filter((r) => r !== repo)
        : [...editingGroup.repositories, repo],
    });
  };

  if (editingGroup) {
    return (
      <div className="space-y-4">
        <Input
          placeholder="プロジェクト名"
          value={editingGroup.name}
          onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
        />

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">カラー:</p>
          <div className="flex gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setEditingGroup({ ...editingGroup, color })}
                className="w-6 h-6 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: color,
                  borderColor: editingGroup.color === color ? 'white' : 'transparent',
                  transform: editingGroup.color === color ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            リポジトリ ({editingGroup.repositories.length}件選択):
          </p>
          {knownRepos.length > 0 ? (
            <div className="max-h-48 overflow-y-auto space-y-1 border border-border/50 rounded-md p-2">
              {knownRepos.map((repo) => (
                <label key={repo} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={editingGroup.repositories.includes(repo)}
                    onChange={() => toggleRepo(repo)}
                    className="rounded"
                  />
                  <span>{repo}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              通知を受信するとリポジトリが候補に表示されます
            </p>
          )}
        </div>

        <div className="border-t border-border/50 pt-4 space-y-3">
          <p className="text-sm font-medium">通知設定</p>

          <div className="flex items-center justify-between">
            <span className="text-sm">デスクトップ通知</span>
            <ToggleSwitch
              enabled={editingGroup.enableDesktopNotification ?? false}
              onToggle={() =>
                setEditingGroup({
                  ...editingGroup,
                  enableDesktopNotification: !editingGroup.enableDesktopNotification,
                })
              }
            />
          </div>

          {editingGroup.enableDesktopNotification && (
            <>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  通知する種類（未選択 = すべて通知）:
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {NOTIFY_REASONS.map((reason) => (
                    <label key={reason} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(editingGroup.notifyReasons ?? []).includes(reason)}
                        onChange={() => {
                          const current = editingGroup.notifyReasons ?? [];
                          const next = current.includes(reason)
                            ? current.filter((r) => r !== reason)
                            : [...current, reason];
                          setEditingGroup({ ...editingGroup, notifyReasons: next });
                        }}
                        className="rounded"
                      />
                      <span>{REASON_LABELS[reason]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">通知音</span>
                <ToggleSwitch
                  enabled={editingGroup.enableSound ?? false}
                  onToggle={() =>
                    setEditingGroup({ ...editingGroup, enableSound: !editingGroup.enableSound })
                  }
                />
              </div>

              {editingGroup.enableSound && (
                <div className="ml-4 flex gap-2">
                  {(['default', 'soft', 'chime'] satisfies SoundType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditingGroup({ ...editingGroup, soundType: type })}
                      className={cn(
                        'px-2 py-1 text-xs rounded border',
                        (editingGroup.soundType ?? 'default') === type
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent hover:bg-accent',
                      )}
                    >
                      {type === 'default' ? '標準' : type === 'soft' ? 'ソフト' : 'チャイム'}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={!editingGroup.name.trim()} className="flex-1">
            保存
          </Button>
          <Button variant="ghost" onClick={() => setEditingGroup(null)}>
            キャンセル
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          プロジェクトを作成すると、案件ごとに通知を分けて表示できます
        </p>
      ) : (
        <div className="space-y-1">
          {groups.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent/50"
            >
              <div className="flex items-center gap-2">
                {group.color && (
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                )}
                <span className="text-sm">{group.name}</span>
                <span className="text-xs text-muted-foreground">
                  {group.repositories.length}リポ
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditingGroup(group)}
                >
                  編集
                </Button>
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => handleDelete(group.id)}
                >
                  削除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={handleNew}>
        + プロジェクトを追加
      </Button>
    </div>
  );
}
