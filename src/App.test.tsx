import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { DEFAULT_SETTINGS } from './types/settings';

const mockCancelDeviceFlow = vi.fn();
const mockStartDeviceFlow = vi.fn();
const mockLoginWithToken = vi.fn();

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onCloseRequested: vi.fn().mockResolvedValue(vi.fn()),
    hide: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/components/dashboard/dashboard', () => ({
  Dashboard: () => <div>Dashboard</div>,
}));

vi.mock('@/components/settings/settings-dialog', () => ({
  SettingsDialog: () => null,
}));

vi.mock('@/components/onboarding/onboarding-dialog', () => ({
  OnboardingDialog: () => null,
}));

vi.mock('@/components/inbox', () => ({
  InboxList: () => <div>Inbox</div>,
}));

vi.mock('@/components/layout/sidebar', () => ({
  Sidebar: () => <nav>Sidebar</nav>,
}));

vi.mock('@/hooks', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
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
    logout: vi.fn(),
  }),
  useInbox: () => ({
    items: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    refresh: vi.fn(),
    markAsRead: vi.fn(),
    selectedIndex: 0,
    setSelectedIndex: vi.fn(),
    ingressDiagnostics: null,
  }),
  useSettings: () => ({
    settings: { ...DEFAULT_SETTINGS, onboardingCompleted: true },
    isLoading: false,
  }),
  useSearchView: () => ({
    items: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    fetch: vi.fn(),
    refresh: vi.fn(),
  }),
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
}));

describe('App connect dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
