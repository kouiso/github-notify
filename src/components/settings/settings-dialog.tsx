import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui';
import { useSettings, useTheme } from '@/hooks';
import { cn } from '@/lib/utils/cn';
import {
  type CustomFilter,
  type FilterTemplate,
  isSearchView,
  type NotificationReason,
  type Theme,
} from '@/types';
import { FilterTemplates } from './filter-templates';
import { GroupManager } from './group-manager';
import { NotificationFilterEditor } from './notification-filter-editor';
import { NotificationFilterList } from './notification-filter-list';
import { SearchViewCard } from './search-view-card';
import { SearchViewEditor } from './search-view-editor';
import { ToggleSwitch } from './toggle-switch';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { login: string; avatarUrl?: string | null } | null;
  onLogout: () => void;
  initialEditFilterId?: string | null;
  knownRepos?: string[];
}

type TabId = 'projects' | 'filters' | 'appearance' | 'account';

const TABS: { id: TabId; label: string }[] = [
  { id: 'projects', label: 'プロジェクト' },
  { id: 'filters', label: 'フィルター' },
  { id: 'appearance', label: '外観' },
  { id: 'account', label: 'アカウント' },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'ライト', icon: '☀️' },
  { value: 'dark', label: 'ダーク', icon: '🌙' },
  { value: 'system', label: 'システム', icon: '💻' },
];

export function SettingsDialog(props: SettingsDialogProps) {
  return <SettingsDialogContent {...props} />;
}

function SettingsDialogContent({
  open,
  onOpenChange,
  user,
  onLogout,
  initialEditFilterId,
  knownRepos = [],
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

  const clearEditing = () => {
    setEditingFilter(null);
    setIsCreating(false);
  };

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
              type="button"
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
          {activeTab === 'projects' && (
            <GroupManager
              groups={settings.repositoryGroups ?? []}
              knownRepos={knownRepos}
              onSave={(groups) => updateSettings({ repositoryGroups: groups })}
            />
          )}

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
                      onCancel={clearEditing}
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

              <div className="p-4 border rounded-lg space-y-3">
                <div>
                  <p className="font-semibold text-[0.9375rem]">通知フィルター</p>
                  <p className="text-[0.8125rem] text-muted-foreground leading-relaxed">
                    受け取りたい通知を追加してください
                  </p>
                </div>

                {!editingFilter && notificationFilters.length === 0 && (
                  <FilterTemplates onAddFilter={handleAddFilter} />
                )}

                {editingFilter && !isSearchView(editingFilter) ? (
                  <NotificationFilterEditor
                    filter={editingFilter}
                    isCreating={isCreating}
                    onUpdate={setEditingFilter}
                    onSave={handleSaveFilter}
                    onCancel={clearEditing}
                    onToggleReason={handleToggleReason}
                  />
                ) : (
                  <>
                    {notificationFilters.length > 0 && (
                      <NotificationFilterList
                        filters={notificationFilters}
                        onEdit={(filter) => {
                          setEditingFilter(filter);
                          setIsCreating(false);
                        }}
                        onDelete={handleDeleteFilter}
                      />
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
                      type="button"
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
