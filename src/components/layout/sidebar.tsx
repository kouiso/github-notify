import { useMemo, useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from '@/components/ui';
import { useSettings } from '@/hooks';
import { cn } from '@/lib/utils/cn';
import type { InboxItem } from '@/types';
import type { CustomFilter, NotificationReason, SoundType } from '@/types/settings';
import { isSearchView, REASON_LABELS } from '@/types/settings';
import { SidebarFooter } from './sidebar-footer';
import {
  CloseIcon,
  DashboardIcon,
  InboxIcon,
  PlusIcon,
  SearchIcon,
  ViewIcon,
} from './sidebar-icons';
import { SidebarItem } from './sidebar-item';

interface SidebarProps {
  items: InboxItem[];
  onOpenSettings: () => void;
  user: { login: string; avatarUrl?: string } | null;
  selectedFilterId: string | null;
  onSelectFilter: (filterId: string | null) => void;
}

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

const VIEW_DESCRIPTIONS: Record<string, string> = {
  'default-important': 'レビュー依頼・メンション・アサインなど重要な通知',
  'default-needs-review': 'レビュワーに指定されていて、まだレビューしていないPR',
  'default-my-prs': '自分が作成したオープン中のPR',
};

function matchesFilter(item: InboxItem, filter: CustomFilter): boolean {
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

export function Sidebar({
  items,
  onOpenSettings,
  user,
  selectedFilterId,
  onSelectFilter,
}: SidebarProps) {
  const { settings, updateSettings } = useSettings();
  const [editingFilter, setEditingFilter] = useState<CustomFilter | null>(null);
  const [repoInput, setRepoInput] = useState('');

  const knownRepos = useMemo(() => {
    const repos = new Set<string>();
    for (const item of items) {
      if (item.repositoryFullName) repos.add(item.repositoryFullName);
    }
    return [...repos].sort();
  }, [items]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const filter of settings.customFilters) {
      counts[filter.id] = items.filter((item) => item.unread && matchesFilter(item, filter)).length;
    }
    return counts;
  }, [items, settings.customFilters]);

  const totalFilteredCount = useMemo(() => {
    return items.filter((item) => {
      if (!item.unread) return false;
      return settings.customFilters.some((filter) => matchesFilter(item, filter));
    }).length;
  }, [items, settings.customFilters]);

  const handleNewView = () => {
    setEditingFilter({
      id: crypto.randomUUID(),
      name: '',
      reasons: [],
      enableDesktopNotification: false,
      enableSound: false,
      soundType: 'default',
      repositories: [],
    });
  };

  const handleSaveFilter = async () => {
    if (!editingFilter) return;

    const exists = settings.customFilters.some((f) => f.id === editingFilter.id);
    const newFilters = exists
      ? settings.customFilters.map((f) => (f.id === editingFilter.id ? editingFilter : f))
      : [...settings.customFilters, editingFilter];

    await updateSettings({ customFilters: newFilters });
    setEditingFilter(null);
  };

  const handleDeleteFilter = async (id: string) => {
    await updateSettings({
      customFilters: settings.customFilters.filter((f) => f.id !== id),
    });
    if (selectedFilterId === id) {
      onSelectFilter(null);
    }
  };

  const handleToggleReason = (reason: NotificationReason) => {
    if (!editingFilter) return;
    const newReasons = editingFilter.reasons.includes(reason)
      ? editingFilter.reasons.filter((r) => r !== reason)
      : [...editingFilter.reasons, reason];
    setEditingFilter({ ...editingFilter, reasons: newReasons });
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/50">
      <div className="px-4 py-2.5" data-tauri-drag-region>
        <h1 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          GitHub Notify
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-2 py-1 space-y-0.5">
          <SidebarItem
            icon={<DashboardIcon className="w-[1.125rem] h-[1.125rem]" />}
            label="ダッシュボード"
            description="レビュー待ちPRと自分のPRの状況をまとめて表示"
            active={selectedFilterId === 'dashboard'}
            onClick={() => onSelectFilter('dashboard')}
          />
          <SidebarItem
            icon={<InboxIcon className="w-[1.125rem] h-[1.125rem]" />}
            label="受信トレイ"
            description="GitHub通知の一覧"
            count={totalFilteredCount}
            active={selectedFilterId === null}
            onClick={() => onSelectFilter(null)}
          />
        </div>

        <div className="px-2 py-1">
          <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            ビュー
          </p>
          <div className="space-y-0.5">
            {settings.customFilters.map((filter) => (
              <SidebarItem
                key={filter.id}
                icon={
                  isSearchView(filter) ? (
                    <SearchIcon className="w-[1.125rem] h-[1.125rem]" />
                  ) : (
                    <ViewIcon className="w-[1.125rem] h-[1.125rem]" />
                  )
                }
                label={filter.name}
                description={VIEW_DESCRIPTIONS[filter.id]}
                count={isSearchView(filter) ? undefined : filterCounts[filter.id] || undefined}
                active={selectedFilterId === filter.id}
                onClick={() => onSelectFilter(filter.id)}
                onEdit={isSearchView(filter) ? undefined : () => setEditingFilter(filter)}
                hasNotification={filter.enableDesktopNotification}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleNewView}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[0.9375rem] text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>ビューを追加</span>
          </button>
        </div>
      </div>

      <SidebarFooter user={user} onOpenSettings={onOpenSettings} />

      <Dialog
        open={editingFilter !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingFilter(null);
            setRepoInput('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingFilter && settings.customFilters.some((f) => f.id === editingFilter.id)
                ? 'ビューを編集'
                : 'ビューを作成'}
            </DialogTitle>
          </DialogHeader>
          {editingFilter && (
            <div className="space-y-4">
              <Input
                placeholder="ビュー名"
                value={editingFilter.name}
                onChange={(e) => setEditingFilter({ ...editingFilter, name: e.target.value })}
              />

              <div className="space-y-2">
                <p className="text-[0.875rem] text-muted-foreground">通知の種類:</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className="flex items-center gap-2 text-[0.875rem] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={editingFilter.reasons.includes(reason)}
                        onChange={() => handleToggleReason(reason)}
                        className="rounded"
                      />
                      <span>{REASON_LABELS[reason]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[0.875rem] text-muted-foreground">
                  リポジトリで絞り込み（空 = すべて）:
                </p>

                {editingFilter.repositories && editingFilter.repositories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {editingFilter.repositories.map((repo) => (
                      <span
                        key={repo}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.8125rem] bg-accent rounded-md"
                      >
                        {repo.split('/')[1] || repo}
                        <button
                          type="button"
                          onClick={() =>
                            setEditingFilter({
                              ...editingFilter,
                              repositories: editingFilter.repositories?.filter((r) => r !== repo),
                            })
                          }
                          className="text-muted-foreground hover:text-foreground ml-0.5"
                        >
                          <CloseIcon className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5">
                  <Input
                    placeholder="owner/repo"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = repoInput.trim();
                        if (val && !(editingFilter.repositories || []).includes(val)) {
                          setEditingFilter({
                            ...editingFilter,
                            repositories: [...(editingFilter.repositories || []), val],
                          });
                          setRepoInput('');
                        }
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const val = repoInput.trim();
                      if (val && !(editingFilter.repositories || []).includes(val)) {
                        setEditingFilter({
                          ...editingFilter,
                          repositories: [...(editingFilter.repositories || []), val],
                        });
                        setRepoInput('');
                      }
                    }}
                    className="px-2 text-[0.8125rem]"
                  >
                    追加
                  </Button>
                </div>

                {(() => {
                  const selectedRepos = new Set(editingFilter.repositories || []);
                  const suggestions = knownRepos.filter((r) => !selectedRepos.has(r));
                  if (suggestions.length === 0) return null;
                  return (
                    <div className="space-y-1">
                      <p className="text-[0.6875rem] text-muted-foreground">
                        通知のあるリポジトリ:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {suggestions.map((repo) => (
                          <button
                            key={repo}
                            type="button"
                            onClick={() =>
                              setEditingFilter({
                                ...editingFilter,
                                repositories: [...(editingFilter.repositories || []), repo],
                              })
                            }
                            className="px-2 py-0.5 text-[0.75rem] border border-border/50 rounded hover:bg-accent transition-colors"
                          >
                            + {repo.split('/')[1]}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <label className="flex items-center gap-2 text-[0.875rem] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingFilter.enableDesktopNotification}
                  onChange={() =>
                    setEditingFilter({
                      ...editingFilter,
                      enableDesktopNotification: !editingFilter.enableDesktopNotification,
                    })
                  }
                  className="rounded"
                />
                <span>デスクトップ通知</span>
              </label>

              <label className="flex items-center gap-2 text-[0.875rem] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingFilter.enableSound}
                  onChange={() =>
                    setEditingFilter({
                      ...editingFilter,
                      enableSound: !editingFilter.enableSound,
                    })
                  }
                  className="rounded"
                  disabled={!editingFilter.enableDesktopNotification}
                />
                <span
                  className={cn(
                    !editingFilter.enableDesktopNotification && 'text-muted-foreground',
                  )}
                >
                  通知音
                </span>
              </label>

              {editingFilter.enableSound && editingFilter.enableDesktopNotification && (
                <div className="ml-6 flex gap-2">
                  {(['default', 'soft', 'chime'] satisfies SoundType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditingFilter({ ...editingFilter, soundType: type })}
                      className={cn(
                        'px-2 py-1 text-[0.8125rem] rounded border',
                        editingFilter.soundType === type
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent hover:bg-accent',
                      )}
                    >
                      {type === 'default' ? '標準' : type === 'soft' ? 'ソフト' : 'チャイム'}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveFilter} className="flex-1">
                  保存
                </Button>
                {settings.customFilters.some((f) => f.id === editingFilter.id) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      handleDeleteFilter(editingFilter.id);
                      setEditingFilter(null);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    削除
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setEditingFilter(null)}>
                  キャンセル
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
