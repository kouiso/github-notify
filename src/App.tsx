import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';
import { LoginScreen } from '@/components/auth/login-screen';
import { Dashboard } from '@/components/dashboard/dashboard';
import { InboxList } from '@/components/inbox';
import { Sidebar } from '@/components/layout/sidebar';
import { SettingsDialog } from '@/components/settings/settings-dialog';
import { useAuth, useInbox, useSearchView, useSettings, useTheme } from '@/hooks';
import { isSearchView } from '@/types/settings';

export default function App() {
  const auth = useAuth();
  const inbox = useInbox();
  const { settings } = useSettings();
  const searchView = useSearchView();

  // Apply theme on mount + keyboard shortcut
  const { theme, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState<string | null>('dashboard');

  // Cmd/Ctrl+Shift+T: cycle theme (light → dark → system → light)
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

  // Handle window close to hide instead of quit (only in Tauri context)
  useEffect(() => {
    // Check if we're in Tauri context
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

  // Fetch search view data when selecting a search-based filter
  const selectedFilter = selectedFilterId
    ? settings.customFilters.find((f) => f.id === selectedFilterId)
    : null;

  // Replace @me with actual login for GitHub search queries
  const userLogin = auth.user?.login;

  useEffect(() => {
    if (selectedFilter && isSearchView(selectedFilter) && selectedFilter.searchQuery) {
      const resolved = userLogin
        ? selectedFilter.searchQuery.replace(/@me\b/g, userLogin)
        : selectedFilter.searchQuery;
      searchView.fetch(resolved);
    }
  }, [selectedFilterId, userLogin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show login screen if not authenticated
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

  // Determine what main content to show
  const isDashboard = selectedFilterId === 'dashboard';
  const isSearchMode = selectedFilter && isSearchView(selectedFilter);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0">
        <Sidebar
          items={inbox.items}
          unreadCount={inbox.unreadCount}
          onOpenSettings={() => setSettingsOpen(true)}
          user={auth.user}
          selectedFilterId={selectedFilterId}
          onSelectFilter={setSelectedFilterId}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {isDashboard ? (
          <Dashboard
            inboxItems={inbox.items}
            filters={settings.customFilters}
            onMarkInboxRead={inbox.markAsRead}
            onRefresh={inbox.refresh}
            isInboxLoading={inbox.isLoading}
            userLogin={userLogin}
          />
        ) : isSearchMode ? (
          <InboxList
            items={inbox.items}
            isLoading={searchView.isLoading}
            error={searchView.error}
            lastUpdated={searchView.lastUpdated}
            onMarkAsRead={inbox.markAsRead}
            onMarkAllAsRead={inbox.markAllAsRead}
            onRefresh={searchView.refresh}
            unreadCount={inbox.unreadCount}
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
            onMarkAllAsRead={inbox.markAllAsRead}
            onRefresh={inbox.refresh}
            unreadCount={inbox.unreadCount}
            selectedIndex={inbox.selectedIndex}
            setSelectedIndex={inbox.setSelectedIndex}
            selectedFilterId={selectedFilterId}
          />
        )}
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        user={auth.user}
        onLogout={auth.logout}
      />
    </div>
  );
}
