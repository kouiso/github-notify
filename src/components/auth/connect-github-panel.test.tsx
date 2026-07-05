import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceFlowInfo } from '@/types';
import { ConnectGitHubPanel } from './connect-github-panel';

const deviceFlow: DeviceFlowInfo = {
  deviceCode: 'device-code-123',
  userCode: 'ABCD-1234',
  verificationUri: 'https://github.com/login/device',
  expiresIn: 900,
  interval: 5,
};

function renderPanel(overrides: Partial<Parameters<typeof ConnectGitHubPanel>[0]> = {}) {
  const props = {
    onStartDeviceFlow: vi.fn<() => Promise<DeviceFlowInfo>>(),
    onLoginWithToken: vi.fn<(token: string) => Promise<boolean>>(),
    deviceFlow: null,
    isLoading: false,
    isPolling: false,
    error: null,
    onCancelDeviceFlow: vi.fn<() => void>(),
    ...overrides,
  };

  render(<ConnectGitHubPanel {...props} />);

  return props;
}

describe('ConnectGitHubPanel', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
  });

  it('starts device flow from the default login screen', async () => {
    const user = userEvent.setup();
    const onStartDeviceFlow = vi.fn<() => Promise<DeviceFlowInfo>>().mockResolvedValue(deviceFlow);
    renderPanel({ onStartDeviceFlow });

    await user.click(screen.getByRole('button', { name: 'GitHubでログイン' }));

    expect(onStartDeviceFlow).toHaveBeenCalledTimes(1);
  });

  it('shows a loading spinner instead of the device flow label while loading', () => {
    renderPanel({ isLoading: true });

    expect(screen.getByRole('button', { name: '' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'GitHubでログイン' })).not.toBeInTheDocument();
  });

  it('copies the user code and cancels polling from the device flow screen', async () => {
    const user = userEvent.setup();
    const onCancelDeviceFlow = vi.fn<() => void>();
    renderPanel({ deviceFlow, isPolling: true, onCancelDeviceFlow });

    await user.click(screen.getByRole('button', { name: deviceFlow.userCode }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(vi.mocked(navigator.clipboard.writeText)).toHaveBeenCalledWith(deviceFlow.userCode);
    expect(await screen.findByText('コピーしました!')).toBeInTheDocument();
    expect(onCancelDeviceFlow).toHaveBeenCalledTimes(1);
  });

  it('switches to token login, trims the token, and returns to the default screen', async () => {
    const user = userEvent.setup();
    const onLoginWithToken = vi.fn<(token: string) => Promise<boolean>>().mockResolvedValue(true);
    renderPanel({ onLoginWithToken, error: 'Invalid token' });

    expect(screen.getByText('Invalid token')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Personal Access Tokenでログイン' }));
    expect(screen.getByText('repo')).toBeInTheDocument();
    expect(screen.getByText('read:org')).toBeInTheDocument();
    expect(screen.getByText('Invalid token')).toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'ログイン' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx'), '  ghp_valid  ');
    expect(submit).toBeEnabled();

    await user.click(submit);
    await waitFor(() => expect(onLoginWithToken).toHaveBeenCalledWith('ghp_valid'));

    await user.click(screen.getByRole('button', { name: '戻る' }));
    expect(screen.getByRole('button', { name: 'GitHubでログイン' })).toBeInTheDocument();
  });

  it('shows a token-login loading spinner and keeps submit disabled', async () => {
    const user = userEvent.setup();
    renderPanel({ isLoading: true });

    await user.click(screen.getByRole('button', { name: 'Personal Access Tokenでログイン' }));

    expect(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx')).toBeDisabled();
    expect(screen.getByRole('button', { name: '' })).toBeDisabled();
  });
});
