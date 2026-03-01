import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from '@/components/ui';
import { useSettings, useTheme } from '@/hooks';
import { cn } from '@/lib/utils/cn';
import {
  type CustomFilter,
  type FILTER_TEMPLATES,
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

export function SettingsDialog(props: SettingsDialogProps) {
  return <SettingsDialogContent {...props} />;
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-11 h-6 rounded-full transition-colors relative',
        enabled ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

function SettingsDialogContent({ open, onOpenChange, user, onLogout }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('filters');
  const [editingFilter, setEditingFilter] = useState<CustomFilter | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleLogout = () => {
    onLogout();
    onOpenChange(false);
  };

  // Filter management
  const handleAddFilter = (template?: (typeof FILTER_TEMPLATES)[0]) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
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

        <div className="py-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {/* Filters Tab */}
          {activeTab === 'filters' && (
            <div className="space-y-4">
              {/* Desktop notifications toggle */}
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

              {/* Sound notifications toggle */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-semibold text-[0.9375rem]">通知音</p>
                  <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
                    新着通知時にサウンドを再生
                  </p>
                </div>
                <ToggleSwitch enabled={settings.soundEnabled} onToggle={handleSoundToggle} />
              </div>

              {/* Philosophy explanation */}
              <div className="p-4 border-l-4 border-primary bg-primary/5 rounded">
                <p className="font-semibold mb-1.5 text-[0.9375rem]">💡 通知の考え方</p>
                <p className="text-[0.875rem] text-muted-foreground leading-relaxed">
                  デフォルトでは<span className="font-semibold">全ての通知がOFF</span>です。
                  下の「通知フィルター」で、受け取りたい通知だけを追加してください。
                </p>
              </div>

              {/* Notification Filters Section */}
              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[0.9375rem]">通知フィルター</p>
                    <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
                      受け取りたい通知を追加してください
                    </p>
                  </div>
                </div>

                {/* Quick filter templates */}
                {!editingFilter && settings.customFilters.length === 0 && (
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

                {/* Editing filter */}
                {editingFilter ? (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">
                        {isCreating ? 'フィルターを作成' : 'フィルターを編集'}
                      </h3>
                      <button
                        onClick={() => {
                          setEditingFilter(null);
                          setIsCreating(false);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <Input
                      placeholder="フィルター名"
                      value={editingFilter.name}
                      onChange={(e) => setEditingFilter({ ...editingFilter, name: e.target.value })}
                    />

                    <div className="space-y-2">
                      <p className="text-[0.9375rem] font-medium text-muted-foreground">
                        通知の種類を選択:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_REASONS.map((reason) => (
                          <label
                            key={reason}
                            className="flex items-center gap-2 text-[0.9375rem] cursor-pointer"
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
                      <p className="text-[0.9375rem] font-medium text-muted-foreground">
                        リポジトリで絞り込み（オプション）:
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
                        className="w-full min-h-[80px] px-3 py-2 text-[0.9375rem] border rounded-md bg-background resize-none"
                      />
                      <p className="text-[0.8125rem] text-muted-foreground">
                        空の場合はすべてのリポジトリが対象になります
                      </p>
                    </div>

                    <label className="flex items-center gap-2 text-[0.9375rem] cursor-pointer">
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
                      <span>デスクトップ通知を有効にする</span>
                      {editingFilter.enableDesktopNotification && (
                        <span className="text-[0.75rem] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-semibold">
                          🔔
                        </span>
                      )}
                    </label>

                    {/* Sound notification toggle */}
                    <label className="flex items-center gap-2 text-[0.9375rem] cursor-pointer">
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
                        className={
                          !editingFilter.enableDesktopNotification ? 'text-muted-foreground' : ''
                        }
                      >
                        通知音を鳴らす
                      </span>
                      {editingFilter.enableSound && editingFilter.enableDesktopNotification && (
                        <span className="text-[0.75rem] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">
                          🔊
                        </span>
                      )}
                    </label>

                    {/* Sound type selector */}
                    {editingFilter.enableSound && editingFilter.enableDesktopNotification && (
                      <div className="ml-6 space-y-1">
                        <p className="text-[0.8125rem] text-muted-foreground font-medium">
                          サウンドの種類:
                        </p>
                        <div className="flex gap-2">
                          {[
                            { value: 'default' as SoundType, label: '標準' },
                            { value: 'soft' as SoundType, label: 'ソフト' },
                            { value: 'chime' as SoundType, label: 'チャイム' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={() =>
                                setEditingFilter({ ...editingFilter, soundType: option.value })
                              }
                              className={cn(
                                'px-2 py-1 text-[0.8125rem] rounded border',
                                editingFilter.soundType === option.value
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
                      <Button onClick={handleSaveFilter} className="flex-1">
                        保存
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditingFilter(null);
                          setIsCreating(false);
                        }}
                      >
                        キャンセル
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Existing filters */}
                    {settings.customFilters.length > 0 && (
                      <div className="space-y-2">
                        {settings.customFilters.map((filter) => (
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
                                <div className="flex flex-wrap gap-1 mb-1">
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
                                  <div className="text-[0.8125rem] text-muted-foreground font-medium">
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

                    {/* Add filter button */}
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

          {/* Appearance Tab */}
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

              {/* About section */}
              <div className="space-y-2 pt-4 border-t">
                <h3 className="text-[0.9375rem] font-semibold">このアプリについて</h3>
                <div className="text-[0.9375rem] text-muted-foreground space-y-1">
                  <p>GitHub Notify v0.1.0</p>
                  <p>GitHub通知を管理するデスクトップアプリ</p>
                </div>
              </div>
            </div>
          )}

          {/* Account Tab */}
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
