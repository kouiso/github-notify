import { getCurrentWindow } from '@tauri-apps/api/window';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ConnectGitHubPanel } from '@/components/auth/connect-github-panel';
import { InboxList } from '@/components/inbox';
import { Sidebar } from '@/components/layout/sidebar';
import { Button, Dialog, DialogContent, DialogTitle } from '@/components/ui';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useAuth, useInbox, useSearchView, useSettings, useTheme } from '@/hooks';
import { isGloballyExcluded } from '@/lib/filters/match-filter';
import { DEFAULT_GLOBAL_EXCLUDE_REASONS, isSearchView } from '@/types/settings';

const Dashboard = lazy(() =>
  import('@/components/dashboard/dashboard').then((m) => ({ default: m.Dashboard })),
);
const SettingsDialog = lazy(() =>
  import('@/components/settings/settings-dialog').then((m) => ({ default: m.SettingsDialog })),
);
const OnboardingDialog = lazy(() =>
  import('@/components/onboarding/onboarding-dialog').then((m) => ({
    default: m.OnboardingDialog,
  })),
);

const LazyFallback = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
  </div>
);

export default function App() {
  const auth = useAuth();
  const inbox = useInbox({ enabled: auth.isAuthenticated });
  const { settings, isLoading: settingsLoading } = useSettings();
  const searchView = useSearchView();
  const { fetch: fetchSearchView } = searchView;

  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialFilterId, setSettingsInitialFilterId] = useState<string | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | null>(null);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>('dashboard');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [connectDialogDismissed, setConnectDialogDismissed] = useState(false);

  const showOnboarding =
    auth.isAuthenticated &&
    !settingsLoading &&
    !settings.onboardingCompleted &&
    !onboardingDismissed;
  const showConnectDialog = !auth.isAuthenticated && !connectDialogDismissed;

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

  const globalExcludeReasons = settings.globalExcludeReasons ?? DEFAULT_GLOBAL_EXCLUDE_REASONS;

  const visibleItems = useMemo(
    () => inbox.items.filter((item) => !isGloballyExcluded(item, globalExcludeReasons)),
    [inbox.items, globalExcludeReasons],
  );

  const activeGroup = activeGroupId
    ? (settings.repositoryGroups ?? []).find((g) => g.id === activeGroupId)
    : null;

  useEffect(() => {
    if (activeGroupId && !activeGroup) {
      setActiveGroupId(null);
    }
  }, [activeGroupId, activeGroup]);

  const activeRepositories = activeGroup?.repositories ?? null;

  const scopedItems = activeGroup
    ? visibleItems.filter((item) => activeGroup.repositories.includes(item.repositoryFullName))
    : visibleItems;

  const knownRepos = useMemo(() => {
    const repos = new Set<string>();
    for (const item of inbox.items) {
      if (item.repositoryFullName) repos.add(item.repositoryFullName);
    }
    return [...repos].sort();
  }, [inbox.items]);

  const userLogin = auth.user?.login;

  useEffect(() => {
    if (!auth.isAuthenticated) return;

    if (selectedFilter && isSearchView(selectedFilter) && selectedFilter.searchQuery) {
      const resolved = userLogin
        ? selectedFilter.searchQuery.replace(/@me\b/g, userLogin)
        : selectedFilter.searchQuery;
      const scopedQuery =
        activeGroup && activeGroup.repositories.length > 0
          ? `${resolved} ${activeGroup.repositories.map((repo) => `repo:${repo}`).join(' ')}`
          : resolved;
      fetchSearchView(scopedQuery);
    }
  }, [
    auth.isAuthenticated,
    selectedFilterId,
    userLogin,
    selectedFilter,
    activeGroup,
    fetchSearchView,
  ]);

  if (auth.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isDashboard = selectedFilterId === 'dashboard';
  const isSearchMode = selectedFilter && isSearchView(selectedFilter);

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background">
        <aside className="w-56 flex-shrink-0">
          <Sidebar
            items={scopedItems}
            allItems={inbox.items}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenProjectSettings={() => {
              setSettingsInitialTab('projects');
              setSettingsOpen(true);
            }}
            user={auth.user}
            selectedFilterId={selectedFilterId}
            onSelectFilter={setSelectedFilterId}
            repositoryGroups={settings.repositoryGroups ?? []}
            activeGroupId={activeGroupId}
            onSelectGroup={setActiveGroupId}
          />
        </aside>

        <main className="flex-1 min-w-0">
          <Suspense fallback={<LazyFallback />}>
            {isDashboard ? (
              <Dashboard
                filters={settings.customFilters}
                onRefresh={inbox.refresh}
                userLogin={userLogin}
                activeGroup={activeGroup ?? undefined}
                onOpenReviewSettings={() => {
                  setSettingsInitialFilterId('default-needs-review');
                  setSettingsOpen(true);
                }}
              />
            ) : isSearchMode ? (
              <InboxList
                items={scopedItems}
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
                activeRepositories={activeRepositories}
              />
            ) : (
              <InboxList
                items={scopedItems}
                isLoading={inbox.isLoading}
                error={inbox.error}
                lastUpdated={inbox.lastUpdated}
                onMarkAsRead={inbox.markAsRead}
                onRefresh={inbox.refresh}
                selectedIndex={inbox.selectedIndex}
                setSelectedIndex={inbox.setSelectedIndex}
                selectedFilterId={selectedFilterId}
                activeRepositories={activeRepositories}
                ingressDiagnostics={inbox.ingressDiagnostics}
              />
            )}
          </Suspense>
        </main>

        <Suspense fallback={null}>
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={(open) => {
              setSettingsOpen(open);
              if (!open) {
                setSettingsInitialFilterId(null);
                setSettingsInitialTab(null);
              }
            }}
            user={auth.user}
            onLogout={auth.logout}
            initialEditFilterId={settingsInitialFilterId}
            initialTab={settingsInitialTab}
            knownRepos={knownRepos}
            onOpenConnect={() => {
              setSettingsOpen(false);
              setConnectDialogDismissed(false);
            }}
          />

          <Dialog
            open={showConnectDialog}
            onOpenChange={(open) => setConnectDialogDismissed(!open)}
          >
            <DialogContent className="w-auto border-0 bg-transparent p-0 shadow-none">
              <div className="relative">
                <DialogTitle className="sr-only">GitHubアカウントを連携</DialogTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="接続画面を閉じる"
                  className="absolute right-2 top-2 z-10 h-8 w-8"
                  onClick={() => setConnectDialogDismissed(true)}
                >
                  ×
                </Button>
                <ConnectGitHubPanel
                  onStartDeviceFlow={auth.startDeviceFlow}
                  onLoginWithToken={auth.loginWithToken}
                  deviceFlow={auth.deviceFlow}
                  isLoading={auth.isLoading}
                  isPolling={auth.isPolling}
                  error={auth.error}
                  onCancelDeviceFlow={auth.cancelDeviceFlow}
                />
              </div>
            </DialogContent>
          </Dialog>

          <OnboardingDialog open={showOnboarding} onComplete={() => setOnboardingDismissed(true)} />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
