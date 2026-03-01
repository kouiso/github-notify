import { useMemo, useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from '@/components/ui';
import { useSettings } from '@/hooks';
import { cn } from '@/lib/utils/cn';
import type { InboxItem } from '@/types';
import type { CustomFilter, NotificationReason, SoundType } from '@/types/settings';
import { FILTER_TEMPLATES, REASON_LABELS } from '@/types/settings';
import { SidebarFooter } from './sidebar-footer';

interface SidebarProps {
  items: InboxItem[];
  unreadCount: number;
  onOpenSettings: () => void;
  user: { login: string; avatarUrl?: string } | null;
  selectedFilterId: string | null;
  onSelectFilter: (filterId: string | null) => void;
}

const REASON_ICONS: Partial<Record<NotificationReason, string>> = {
  review_requested: '📝',
  mention: '💬',
  team_mention: '👥',
  assign: '👤',
  author: '✍️',
  ci_activity: '🔧',
  comment: '💭',
  state_change: '🔄',
  subscribed: '🔔',
  security_alert: '🛡️',
};

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

function getFilterIcon(filter: CustomFilter): string {
  if (filter.reasons.length === 1) {
    return REASON_ICONS[filter.reasons[0]] || '📋';
  }
  if (
    filter.reasons.includes('ci_activity') &&
    filter.repositories &&
    filter.repositories.length > 0
  ) {
    return '🔧';
  }
  return '📋';
}

function matchesFilter(item: InboxItem, filter: CustomFilter): boolean {
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

export function Sidebar({
  items,
  unreadCount: _unreadCount,
  onOpenSettings,
  user,
  selectedFilterId,
  onSelectFilter,
}: SidebarProps) {
  void _unreadCount;
  const { settings, updateSettings } = useSettings();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<CustomFilter | null>(null);

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

  const handleAddFromTemplate = async (template: (typeof FILTER_TEMPLATES)[0]) => {
    const newFilter: CustomFilter = {
      id: crypto.randomUUID(),
      name: template.name,
      reasons: template.reasons,
      enableDesktopNotification: template.enableDesktopNotification,
      enableSound: template.enableSound,
      soundType: template.soundType,
      repositories: [],
    };

    if (template.name === 'CI/CD（リポジトリ指定）') {
      setEditingFilter(newFilter);
      setAddDialogOpen(false);
      return;
    }

    await updateSettings({
      customFilters: [...settings.customFilters, newFilter],
    });
    setAddDialogOpen(false);
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

  const availableTemplates = useMemo(() => {
    const existingNames = new Set(settings.customFilters.map((f) => f.name));
    return FILTER_TEMPLATES.filter((t) => !existingNames.has(t.name));
  }, [settings.customFilters]);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/50">
      {/* Header */}
      <div className="px-4 py-2.5" data-tauri-drag-region>
        <h1 className="text-[0.8125rem] font-semibold tracking-wide text-muted-foreground uppercase">
          GitHub Notify
        </h1>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* All notifications */}
        <div className="px-2 py-1 space-y-0.5">
          <SidebarItem
            icon={<InboxIcon className="w-4 h-4" />}
            label="Inbox"
            count={totalFilteredCount}
            active={selectedFilterId === null}
            onClick={() => onSelectFilter(null)}
          />
        </div>

        {/* User's filters */}
        <div className="px-2 py-1">
          <p className="px-3 py-1.5 text-[0.6875rem] font-medium text-muted-foreground uppercase tracking-wider">
            Filters
          </p>
          <div className="space-y-0.5">
            {settings.customFilters.map((filter) => (
              <SidebarItem
                key={filter.id}
                icon={<span className="w-4 text-center text-sm">{getFilterIcon(filter)}</span>}
                label={filter.name}
                sublabel={
                  filter.repositories && filter.repositories.length > 0
                    ? filter.repositories[0].split('/')[1]
                    : undefined
                }
                count={filterCounts[filter.id] || undefined}
                active={selectedFilterId === filter.id}
                onClick={() => onSelectFilter(filter.id)}
                onEdit={() => setEditingFilter(filter)}
                hasNotification={filter.enableDesktopNotification}
              />
            ))}
          </div>

          {/* Add filter — inline subtle link */}
          <button
            onClick={() => setAddDialogOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[0.875rem] text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add filter</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <SidebarFooter user={user} onOpenSettings={onOpenSettings} />

      {/* Add Filter Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>フィルターを追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-[0.875rem] text-muted-foreground">
              受け取りたい通知の種類を選んでください
            </p>
            <div className="grid grid-cols-2 gap-2">
              {availableTemplates.map((template) => (
                <button
                  key={template.name}
                  onClick={() => handleAddFromTemplate(template)}
                  className="p-3 text-left border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{REASON_ICONS[template.reasons[0]] || '📋'}</span>
                    <span className="font-semibold text-[0.9375rem]">{template.name}</span>
                  </div>
                  <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
            <div className="border-t pt-3">
              <button
                onClick={() => {
                  setEditingFilter({
                    id: crypto.randomUUID(),
                    name: '新しいフィルター',
                    reasons: [],
                    enableDesktopNotification: false,
                    enableSound: false,
                    soundType: 'default',
                    repositories: [],
                  });
                  setAddDialogOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                カスタムフィルターを作成
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Filter Dialog */}
      <Dialog
        open={editingFilter !== null}
        onOpenChange={(open) => !open && setEditingFilter(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {settings.customFilters.some((f) => f.id === editingFilter?.id)
                ? 'フィルターを編集'
                : 'フィルターを作成'}
            </DialogTitle>
          </DialogHeader>
          {editingFilter && (
            <div className="space-y-4">
              <Input
                placeholder="フィルター名"
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
                      <span>{REASON_ICONS[reason]}</span>
                      <span>{REASON_LABELS[reason]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[0.875rem] text-muted-foreground">
                  リポジトリで絞り込み（空欄 = すべて）:
                </p>
                <textarea
                  placeholder="owner/repo（1行に1つ）"
                  value={(editingFilter.repositories || []).join('\n')}
                  onChange={(e) => {
                    const repos = e.target.value
                      .split('\n')
                      .map((r) => r.trim())
                      .filter((r) => r.length > 0);
                    setEditingFilter({ ...editingFilter, repositories: repos });
                  }}
                  className="w-full min-h-[60px] px-3 py-2 text-[0.875rem] border rounded-md bg-background resize-none"
                />
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
                <span>🔔 デスクトップ通知</span>
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
                  🔊 通知音
                </span>
              </label>

              {editingFilter.enableSound && editingFilter.enableDesktopNotification && (
                <div className="ml-6 flex gap-2">
                  {(['default', 'soft', 'chime'] as SoundType[]).map((type) => (
                    <button
                      key={type}
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

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  hasNotification?: boolean;
}

function SidebarItem({
  icon,
  label,
  sublabel,
  count,
  active,
  onClick,
  onEdit,
  hasNotification,
}: SidebarItemProps) {
  return (
    <div className="group relative">
      <button
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-colors text-left text-[0.875rem]',
          active
            ? 'bg-accent text-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
        onClick={onClick}
      >
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="truncate block leading-tight">{label}</span>
          {sublabel && (
            <span className="text-[0.75rem] text-muted-foreground truncate block">{sublabel}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasNotification && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
          )}
          {count !== undefined && count > 0 && (
            <span className="text-[0.75rem] font-medium text-muted-foreground tabular-nums">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </div>
      </button>
      {onEdit && (
        <button
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Edit"
        >
          <EditIcon className="w-3 h-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

// Icons
function InboxIcon({ className }: { className?: string }) {
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
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
