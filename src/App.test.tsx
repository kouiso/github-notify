import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { CustomFilter, Settings } from './types/settings';
import { DEFAULT_SETTINGS } from './types/settings';

const mockCancelDeviceFlow = vi.fn();
const mockStartDeviceFlow = vi.fn();
const mockLoginWithToken = vi.fn();
const mockSetTheme = vi.fn();
const mockFetchSearchView = vi.fn();
const mockSetSelectedIndex = vi.fn();
const mockRefreshInbox = vi.fn();
const mockMarkAsRead = vi.fn();
const mockLogout = vi.fn();

let mockIsAuthenticated = false;
let mockAuthLoading = false;
let mockSettingsLoading = false;
let mockTheme = 'light';
let mockSettings: Settings = { ...DEFAULT_SETTINGS, onboardingCompleted: true };

const searchFilter: CustomFilter = {
  id: 'search-review',
  name: 'Review search',
  type: 'search',
  searchQuery: 'review-requested:@me',
};

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: vi.fn().mockResolvedValue(vi.fn()),
    hide: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/components/dashboard/dashboard', () => ({
  Dashboard: ({ onOpenReviewSettings }: { onOpenReviewSettings: () => void }) => (
    <button type="button" onClick={onOpenReviewSettings}>
      Dashboard
    </button>
  ),
}));

vi.mock('@/components/settings/settings-dialog', () => ({
  SettingsDialog: ({
    open,
    onOpenChange,
    initialEditFilterId,
    initialTab,
    knownRepos,
    onOpenConnect,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialEditFilterId: string | null;
    initialTab: string | null;
    knownRepos: string[];
    onOpenConnect: () => void;
  }) => (
    <div>
      <div>settings-open:{String(open)}</div>
      <div>initial-filter:{initialEditFilterId ?? 'none'}</div>
      <div>initial-tab:{initialTab ?? 'none'}</div>
      <div>known-repos:{knownRepos.join(',')}</div>
      <button type="button" onClick={() => onOpenChange(false)}>
        Close settings
      </button>
      <button type="button" onClick={onOpenConnect}>
        Open connect
      </button>
    </div>
  ),
}));

vi.mock('@/components/onboarding/onboarding-dialog', () => ({
  OnboardingDialog: ({ open, onComplete }: { open: boolean; onComplete: () => void }) =>
    open ? (
      <button type="button" onClick={onComplete}>
        Onboarding
      </button>
    ) : null,
}));

vi.mock('@/components/inbox', () => ({
  InboxList: ({ isSearchMode }: { isSearchMode?: boolean }) => (
    <div>{isSearchMode ? 'Search inbox' : 'Inbox'}</div>
  ),
}));

vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: ({
    onOpenSettings,
    onOpenProjectSettings,
    onSelectFilter,
    onSelectGroup,
  }: {
    onOpenSettings: () => void;
    onOpenProjectSettings: () => void;
    onSelectFilter: (id: string) => void;
    onSelectGroup: (id: string) => void;
  }) => (
    <nav>
      <button type="button" onClick={onOpenSettings}>
        Open settings
      </button>
      <button type="button" onClick={onOpenProjectSettings}>
        Open projects
      </button>
      <button type="button" onClick={() => onSelectFilter('search-review')}>
        Select search
      </button>
      <button type="button" onClick={() => onSelectGroup('frontend')}>
        Select group
      </button>
    </nav>
  ),
}));

vi.mock('@/hooks', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: mockAuthLoading,
    user: mockIsAuthenticated ? { login: 'octocat' } : null,
    deviceFlow: {
      deviceCode: 'device-code-123',
      userCode: 'ABCD-1234',
      verificationUri: 'https://github.com/login/device',
      expiresIn: 900,
      interval: 5,
    },
    isPolling: true,
    error: null,
    startDeviceFlow: mockStartDeviceFlow,
    loginWithToken: mockLoginWithToken,
    cancelDeviceFlow: mockCancelDeviceFlow,
    logout: mockLogout,
  }),
  useInbox: () => ({
    items: [{ id: '1', repositoryFullName: 'kouiso/github-notify', reason: 'mention' }],
    isLoading: false,
    error: null,
    lastUpdated: null,
    refresh: mockRefreshInbox,
    markAsRead: mockMarkAsRead,
    selectedIndex: 0,
    setSelectedIndex: mockSetSelectedIndex,
    ingressDiagnostics: null,
  }),
  useSettings: () => ({
    settings: mockSettings,
    isLoading: mockSettingsLoading,
  }),
  useSearchView: () => ({
    items: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    fetch: mockFetchSearchView,
    refresh: vi.fn(),
  }),
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    mockAuthLoading = false;
    mockSettingsLoading = false;
    mockTheme = 'light';
    mockSettings = { ...DEFAULT_SETTINGS, onboardingCompleted: true };
  });

  it('shows the auth loading screen while authentication is loading', () => {
    mockAuthLoading = true;

    const { container } = render(<App />);

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('Xボタンで接続ダイアログを閉じるとデバイスフローをキャンセルする', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: '接続画面を閉じる' }));

    expect(mockCancelDeviceFlow).toHaveBeenCalledTimes(1);
  });

  it('onOpenChange経由で接続ダイアログを閉じるとデバイスフローをキャンセルする', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('button', { name: '接続画面を閉じる' });

    await user.keyboard('{Escape}');

    expect(mockCancelDeviceFlow).toHaveBeenCalledTimes(1);
  });

  it('cycles the theme with the keyboard shortcut', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard('{Control>}{Shift>}T{/Shift}{/Control}');

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('opens settings from dashboard review settings and resets initial state on close', async () => {
    const user = userEvent.setup();
    mockIsAuthenticated = true;
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Dashboard' }));
    expect(screen.getByText('settings-open:true')).toBeInTheDocument();
    expect(screen.getByText('initial-filter:default-needs-review')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(screen.getByText('initial-filter:none')).toBeInTheDocument();
  });

  it('opens the projects tab and can reopen the connect dialog from settings', async () => {
    const user = userEvent.setup();
    mockIsAuthenticated = true;
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Open projects' }));
    expect(screen.getByText('initial-tab:projects')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open connect' }));
    expect(screen.getByText('settings-open:false')).toBeInTheDocument();
  });

  it('fetches search view with @me and active group repositories resolved', async () => {
    const user = userEvent.setup();
    mockIsAuthenticated = true;
    mockSettings = {
      ...DEFAULT_SETTINGS,
      onboardingCompleted: true,
      customFilters: [searchFilter],
      repositoryGroups: [
        { id: 'frontend', name: 'Frontend', repositories: ['kouiso/github-notify'] },
      ],
    };
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Select group' }));
    await user.click(screen.getByRole('button', { name: 'Select search' }));

    expect(await screen.findByText('Search inbox')).toBeInTheDocument();
    await waitFor(() =>
      expect(mockFetchSearchView).toHaveBeenCalledWith(
        'review-requested:octocat repo:kouiso/github-notify',
      ),
    );
  });

  it('shows and dismisses onboarding for authenticated first-run users', async () => {
    const user = userEvent.setup();
    mockIsAuthenticated = true;
    mockSettings = { ...DEFAULT_SETTINGS, onboardingCompleted: false };
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Onboarding' }));

    expect(screen.queryByRole('button', { name: 'Onboarding' })).not.toBeInTheDocument();
  });
});
