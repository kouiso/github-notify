import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from '@/components/ui';
import { useSettings, useTheme } from '@/hooks';
import { cn } from '@/lib/utils/cn';
import {
  type CustomFilter,
  type FilterTemplate,
  type IssueStatusRule,
  isSearchView,
  type NotificationReason,
  REASON_LABELS,
  type SoundType,
  type Theme,
} from '@/types';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { login: string; avatarUrl?: string } | null;
  onLogout: () => void;
  initialEditFilterId?: string | null;
}

type TabId = 'appearance' | 'filters' | 'account';

const TABS: { id: TabId; label: string }[] = [
  { id: 'filters', label: 'フィルター' },
  { id: 'appearance', label: '外観' },
  { id: 'account', label: 'アカウント' },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'ライト', icon: '☀️' },
  { value: 'dark', label: 'ダーク', icon: '🌙' },
  { value: 'system', label: 'システム', icon: '💻' },
];

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

const SEARCH_VIEW_DESCRIPTIONS: Record<string, string> = {
  'default-needs-review': 'レビュワーに指定されていて、まだレビューしていないPR',
  'default-my-prs': '自分が作成したオープン中のPR',
};

export function SettingsDialog(props: SettingsDialogProps) {
  return <SettingsDialogContent {...props} />;
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-10 h-[1.375rem] rounded-full transition-colors relative flex-shrink-0',
        enabled ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'absolute top-[0.1875rem] w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
          enabled ? 'translate-x-[1.25rem]' : 'translate-x-[0.1875rem]',
        )}
      />
    </button>
  );
}

function SettingsDialogContent({
  open,
  onOpenChange,
  user,
  onLogout,
  initialEditFilterId,
}: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('filters');
  const [editingFilter, setEditingFilter] = useState<CustomFilter | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current && initialEditFilterId) {
      const target = settings.customFilters.find((f) => f.id === initialEditFilterId);
      if (target) {
        setEditingFilter(target);
        setIsCreating(false);
        setActiveTab('filters');
      }
    }
    prevOpenRef.current = open;
  }, [open, initialEditFilterId, settings.customFilters]);

  const handleLogout = () => {
    onLogout();
    onOpenChange(false);
  };

  const handleAddFilter = (template?: FilterTemplate) => {
    const newFilter: CustomFilter = {
      id: crypto.randomUUID(),
      name: template?.name || '新しいフィルター',
      reasons: template?.reasons || [],
      enableDesktopNotification: template?.enableDesktopNotification ?? true,
      enableSound: template?.enableSound ?? true,
      soundType: template?.soundType ?? 'default',
      repositories: [],
    };
    setEditingFilter(newFilter);
    setIsCreating(true);
  };

  const handleSoundToggle = async () => {
    await updateSettings({ soundEnabled: !settings.soundEnabled });
  };

  const handleSaveFilter = async () => {
    if (!editingFilter) return;

    const newFilters = isCreating
      ? [...settings.customFilters, editingFilter]
      : settings.customFilters.map((f) => (f.id === editingFilter.id ? editingFilter : f));

    await updateSettings({ customFilters: newFilters });
    setEditingFilter(null);
    setIsCreating(false);
  };

  const handleDeleteFilter = async (id: string) => {
    const newFilters = settings.customFilters.filter((f) => f.id !== id);
    await updateSettings({
      customFilters: newFilters,
      activeFilterId: settings.activeFilterId === id ? null : settings.activeFilterId,
    });
  };

  const handleToggleReason = (reason: NotificationReason) => {
    if (!editingFilter) return;
    const newReasons = editingFilter.reasons.includes(reason)
      ? editingFilter.reasons.filter((r) => r !== reason)
      : [...editingFilter.reasons, reason];
    setEditingFilter({ ...editingFilter, reasons: newReasons });
  };

  const handleDesktopNotificationsToggle = async () => {
    await updateSettings({ desktopNotifications: !settings.desktopNotifications });
  };

  // フィルタを通知フィルタと検索ビューに分離
  const notificationFilters = settings.customFilters.filter((f) => !isSearchView(f));
  const searchViewFilters = settings.customFilters.filter((f) => isSearchView(f));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 text-[0.9375rem] font-semibold transition-colors',
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="py-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {activeTab === 'filters' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-semibold text-[0.9375rem]">デスクトップ通知</p>
                  <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
                    新着通知をデスクトップに表示
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.desktopNotifications}
                  onToggle={handleDesktopNotificationsToggle}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-semibold text-[0.9375rem]">通知音</p>
                  <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
                    新着通知時にサウンドを再生
                  </p>
                </div>
                <ToggleSwitch enabled={settings.soundEnabled} onToggle={handleSoundToggle} />
              </div>

              {/* ── 検索ビュー設定（レビュー待ち・自分のPR） ── */}
              {searchViewFilters.length > 0 && (
                <div className="p-4 border rounded-lg space-y-3">
                  <div>
                    <p className="font-semibold text-[0.9375rem]">ダッシュボードビュー</p>
                    <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
                      レビュー待ち・自分のPRの表示条件
                    </p>
                  </div>

                  {editingFilter && isSearchView(editingFilter) ? (
                    <SearchViewEditor
                      filter={editingFilter}
                      onUpdate={setEditingFilter}
                      onSave={handleSaveFilter}
                      onCancel={() => {
                        setEditingFilter(null);
                        setIsCreating(false);
                      }}
                    />
                  ) : (
                    <div className="space-y-2">
                      {searchViewFilters.map((filter) => (
                        <SearchViewCard
                          key={filter.id}
                          filter={filter}
                          onEdit={() => {
                            setEditingFilter(filter);
                            setIsCreating(false);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 通知フィルター ── */}
              <div className="p-4 border rounded-lg space-y-3">
                <div>
                  <p className="font-semibold text-[0.9375rem]">通知フィルター</p>
                  <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
                    受け取りたい通知を追加してください
                  </p>
                </div>

                {!editingFilter && notificationFilters.length === 0 && (
                  <div className="space-y-2">
                    <p className="text-[0.8125rem] font-bold text-muted-foreground uppercase tracking-wide">
                      おすすめテンプレート:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleAddFilter({
                            name: 'レビュー依頼',
                            description: 'PRのレビューを依頼された時',
                            reasons: ['review_requested'],
                            enableDesktopNotification: true,
                            enableSound: true,
                            soundType: 'default',
                          })
                        }
                        className="h-auto py-3 flex flex-col items-start"
                      >
                        <span className="font-semibold text-[0.9375rem]">📝 レビュー依頼</span>
                        <span className="text-[0.8125rem] text-muted-foreground">
                          PRレビューが必要
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleAddFilter({
                            name: 'メンション',
                            description: '@で名前を呼ばれた時',
                            reasons: ['mention', 'team_mention'],
                            enableDesktopNotification: true,
                            enableSound: true,
                            soundType: 'default',
                          })
                        }
                        className="h-auto py-3 flex flex-col items-start"
                      >
                        <span className="font-semibold text-[0.9375rem]">💬 メンション</span>
                        <span className="text-[0.8125rem] text-muted-foreground">
                          @で呼ばれた時
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleAddFilter({
                            name: 'アサイン',
                            description: 'Issue/PRにアサインされた時',
                            reasons: ['assign'],
                            enableDesktopNotification: true,
                            enableSound: true,
                            soundType: 'soft',
                          })
                        }
                        className="h-auto py-3 flex flex-col items-start"
                      >
                        <span className="font-semibold text-[0.9375rem]">👤 アサイン</span>
                        <span className="text-[0.8125rem] text-muted-foreground">
                          担当になった時
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleAddFilter({
                            name: '重要な通知',
                            description: 'レビュー依頼・メンション・アサイン',
                            reasons: ['review_requested', 'mention', 'team_mention', 'assign'],
                            enableDesktopNotification: true,
                            enableSound: true,
                            soundType: 'default',
                          })
                        }
                        className="h-auto py-3 flex flex-col items-start border-primary/50"
                      >
                        <span className="font-semibold text-[0.9375rem]">⭐ 重要な通知</span>
                        <span className="text-[0.8125rem] text-muted-foreground">まとめて追加</span>
                      </Button>
                    </div>
                  </div>
                )}

                {editingFilter && !isSearchView(editingFilter) ? (
                  <NotificationFilterEditor
                    filter={editingFilter}
                    isCreating={isCreating}
                    onUpdate={setEditingFilter}
                    onSave={handleSaveFilter}
                    onCancel={() => {
                      setEditingFilter(null);
                      setIsCreating(false);
                    }}
                    onToggleReason={handleToggleReason}
                  />
                ) : (
                  <>
                    {notificationFilters.length > 0 && (
                      <div className="space-y-2">
                        {notificationFilters.map((filter) => (
                          <div key={filter.id} className="p-3 border rounded-lg hover:bg-muted/50">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-[0.9375rem]">
                                    {filter.name}
                                  </span>
                                  {filter.enableDesktopNotification && (
                                    <span className="text-[0.75rem] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-semibold">
                                      🔔
                                    </span>
                                  )}
                                  {filter.enableSound && filter.enableDesktopNotification && (
                                    <span className="text-[0.75rem] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">
                                      🔊
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {filter.reasons.map((reason) => (
                                    <span
                                      key={reason}
                                      className="inline-block px-2 py-0.5 text-[0.75rem] font-medium bg-muted text-muted-foreground rounded"
                                    >
                                      {REASON_LABELS[reason]}
                                    </span>
                                  ))}
                                </div>
                                {filter.repositories && filter.repositories.length > 0 && (
                                  <div className="text-[0.8125rem] text-muted-foreground font-medium mt-1">
                                    📦 {filter.repositories.join(', ')}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingFilter(filter);
                                    setIsCreating(false);
                                  }}
                                >
                                  編集
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteFilter(filter.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  削除
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {!editingFilter && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddFilter()}
                        className="w-full"
                      >
                        + 新しいフィルターを追加
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-[0.9375rem] font-semibold">テーマ</h3>
                <div className="flex gap-2">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors',
                        theme === option.value
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent bg-muted hover:bg-accent',
                      )}
                    >
                      <span className="text-lg">{option.icon}</span>
                      <span className="text-[0.8125rem] font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <h3 className="text-[0.9375rem] font-semibold">このアプリについて</h3>
                <div className="text-[0.9375rem] text-muted-foreground space-y-1">
                  <p>GitHub Notify v0.1.0</p>
                  <p>GitHub通知を管理するデスクトップアプリ</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-4">
              {user && (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.login} className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent" />
                  )}
                  <div>
                    <p className="font-medium text-[0.9375rem]">{user.login}</p>
                    <p className="text-[0.8125rem] text-muted-foreground">GitHub Account</p>
                  </div>
                </div>
              )}
              <Button variant="destructive" onClick={handleLogout} className="w-full">
                ログアウト
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── 検索ビュー（レビュー待ち・自分のPR）のカード表示 ── */
function SearchViewCard({ filter, onEdit }: { filter: CustomFilter; onEdit: () => void }) {
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

/* ── 検索ビューの編集フォーム ── */
function SearchViewEditor({
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
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
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

/* ── 通知フィルターの編集フォーム ── */
function NotificationFilterEditor({
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
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
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

/* ── 組織別レビュー対象ルールのエディタ ── */
function IssueStatusRulesEditor({
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

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
