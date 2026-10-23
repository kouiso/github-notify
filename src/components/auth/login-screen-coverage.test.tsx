import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceFlowInfo } from '@/types';
import { LoginScreen } from './login-screen';

const demoDataMock = vi.hoisted(() => ({
  getDemoModeHref: vi.fn(() => '/?demo=1'),
  isBrowserPreviewEnvironment: vi.fn(() => false),
}));

vi.mock('@/lib/demo-data', () => demoDataMock);

const deviceFlow: DeviceFlowInfo = {
  deviceCode: 'device-code',
  userCode: 'ABCD-EFGH',
  verificationUri: 'https://github.com/login/device',
  expiresIn: 900,
  interval: 5,
};

let writeTextMock: ReturnType<typeof vi.fn>;

function renderLoginScreen(props: Partial<React.ComponentProps<typeof LoginScreen>> = {}) {
  const defaultProps: React.ComponentProps<typeof LoginScreen> = {
    onStartDeviceFlow: vi.fn(async () => deviceFlow),
    onLoginWithToken: vi.fn(async () => true),
    deviceFlow: null,
    isLoading: false,
    isPolling: false,
    error: null,
    onCancelDeviceFlow: vi.fn(),
  };

  return render(<LoginScreen {...defaultProps} {...props} />);
}

describe('LoginScreen coverage supplement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeTextMock = vi.fn(async () => undefined);

    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: {},
        configurable: true,
      });
    }

    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: writeTextMock,
      configurable: true,
    });
  });

  it('初期画面はエラー表示、device flow 開始、loading 表示を扱う', async () => {
    const user = userEvent.setup();
    const onStartDeviceFlow = vi.fn(async () => deviceFlow);
    const { rerender } = renderLoginScreen({
      error: '認証に失敗しました',
      onStartDeviceFlow,
    });

    expect(screen.getByText('認証に失敗しました')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'GitHubでログイン' }));
    expect(onStartDeviceFlow).toHaveBeenCalledTimes(1);

    rerender(
      <LoginScreen
        onStartDeviceFlow={onStartDeviceFlow}
        onLoginWithToken={vi.fn(async () => true)}
        deviceFlow={null}
        isLoading={true}
        isPolling={false}
        error={null}
        onCancelDeviceFlow={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '' })).toBeDisabled();
  });

  it('PAT 入力画面は空文字 submit を止め、trim した token を送信し、戻れる', async () => {
    const user = userEvent.setup();
    const onLoginWithToken = vi.fn(async () => true);
    renderLoginScreen({
      onLoginWithToken,
      error: 'token が無効です',
    });

    await user.click(screen.getByRole('button', { name: 'Personal Access Tokenでログイン' }));

    expect(screen.getByText('token が無効です')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx'), '  ghp_token  ');
    await user.click(screen.getByRole('button', { name: 'ログイン' }));

    await waitFor(() => expect(onLoginWithToken).toHaveBeenCalledWith('ghp_token'));

    await user.click(screen.getByRole('button', { name: '戻る' }));
    expect(screen.getByRole('button', { name: 'GitHubでログイン' })).toBeInTheDocument();
  });

  it('device flow 待機画面は user code コピーとキャンセルを扱う', async () => {
    const user = userEvent.setup();
    const onCancelDeviceFlow = vi.fn();
    renderLoginScreen({
      deviceFlow,
      isPolling: true,
      onCancelDeviceFlow,
    });

    await user.click(screen.getByRole('button', { name: deviceFlow.userCode }));

    expect(writeTextMock).toHaveBeenCalledWith(deviceFlow.userCode);
    expect(screen.getByText('コピーしました!')).toBeInTheDocument();
    expect(screen.getByText(deviceFlow.verificationUri)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancelDeviceFlow).toHaveBeenCalledTimes(1);
  });
});
