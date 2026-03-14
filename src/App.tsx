import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';
import { LoginScreen } from '@/components/auth/login-screen';
import { Dashboard } from '@/components/dashboard/dashboard';
import { InboxList } from '@/components/inbox';
import { Sidebar } from '@/components/layout/sidebar';
import { OnboardingDialog } from '@/components/onboarding/onboarding-dialog';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { useAuth, useInbox, useSearchView, useSettings, useTheme } from '@/hooks';
import { isSearchView } from '@/types/settings';

export default function App() {
  const auth = useAuth();
  const inbox = useInbox();
  const { settings, isLoading: settingsLoading } = useSettings();
  const searchView = useSearchView();
  const { fetch: fetchSearchView } = searchView;

  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>('dashboard');
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const showOnboarding = !settingsLoading && !settings.onboardingCompleted && !onboardingDismissed;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
        setTheme(next);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [theme, setTheme]);

  // ウィンドウ閉じ操作をアプリ終了ではなく非表示にする（トレイ常駐のため）
  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return;
    }

    const appWindow = getCurrentWindow();

    const unlisten = appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      await appWindow.hide();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const selectedFilter = selectedFilterId
    ? settings.customFilters.find((f) => f.id === selectedFilterId)
    : null;

  // GitHub Search APIの@meプレースホルダを実ログイン名に置換する
  const userLogin = auth.user?.login;

  useEffect(() => {
    if (selectedFilter && isSearchView(selectedFilter) && selectedFilter.searchQuery) {
      const resolved = userLogin
        ? selectedFilter.searchQuery.replace(/@me\b/g, userLogin)
        : selectedFilter.searchQuery;
      fetchSearchView(resolved);
    }
  }, [selectedFilterId, userLogin, selectedFilter, fetchSearchView]);

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <LoginScreen
        onStartDeviceFlow={auth.startDeviceFlow}
        onLoginWithToken={auth.loginWithToken}
        deviceFlow={auth.deviceFlow}
        isLoading={auth.isLoading}
        isPolling={auth.isPolling}
        error={auth.error}
        onCancelDeviceFlow={auth.cancelDeviceFlow}
      />
    );
  }

  const isDashboard = selectedFilterId === 'dashboard';
  const isSearchMode = selectedFilter && isSearchView(selectedFilter);

  return (
    <div className="flex h-screen bg-background">
      <div className="w-56 flex-shrink-0">
        <Sidebar
          items={inbox.items}
          onOpenSettings={() => setSettingsOpen(true)}
          user={auth.user}
          selectedFilterId={selectedFilterId}
          onSelectFilter={setSelectedFilterId}
        />
      </div>

      <div className="flex-1 min-w-0">
        {isDashboard ? (
          <Dashboard
            filters={settings.customFilters}
            onRefresh={inbox.refresh}
            userLogin={userLogin}
          />
        ) : isSearchMode ? (
          <InboxList
            items={inbox.items}
            isLoading={searchView.isLoading}
            error={searchView.error}
            lastUpdated={searchView.lastUpdated}
            onMarkAsRead={inbox.markAsRead}
            onRefresh={searchView.refresh}
            selectedIndex={inbox.selectedIndex}
            setSelectedIndex={inbox.setSelectedIndex}
            selectedFilterId={selectedFilterId}
            isSearchMode
            searchItems={searchView.items}
          />
        ) : (
          <InboxList
            items={inbox.items}
            isLoading={inbox.isLoading}
            error={inbox.error}
            lastUpdated={inbox.lastUpdated}
            onMarkAsRead={inbox.markAsRead}
            onRefresh={inbox.refresh}
            selectedIndex={inbox.selectedIndex}
            setSelectedIndex={inbox.setSelectedIndex}
            selectedFilterId={selectedFilterId}
          />
        )}
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={auth.user}
        onLogout={auth.logout}
      />

      <OnboardingDialog open={showOnboarding} onComplete={() => setOnboardingDismissed(true)} />
    </div>
  );
}
