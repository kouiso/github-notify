import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const demoDataMock = vi.hoisted(() => ({
  getDemoModeHref: vi.fn(() => '/preview?foo=bar&demo=1#inbox'),
  isBrowserPreviewEnvironment: vi.fn(() => true),
}));

vi.mock('@/lib/demo-data', () => demoDataMock);

import { LoginScreen } from './login-screen';

function renderLoginScreen() {
  return render(
    <LoginScreen
      onStartDeviceFlow={vi.fn()}
      onLoginWithToken={vi.fn()}
      deviceFlow={null}
      isLoading={false}
      isPolling={false}
      error={null}
      onCancelDeviceFlow={vi.fn()}
    />,
  );
}

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    demoDataMock.getDemoModeHref.mockReturnValue('/preview?foo=bar&demo=1#inbox');
    demoDataMock.isBrowserPreviewEnvironment.mockReturnValue(true);
  });

  it('ブラウザプレビューでは demo=1 への導線を表示する', () => {
    renderLoginScreen();

    expect(screen.getByRole('link', { name: 'デモプレビューを開く' })).toHaveAttribute(
      'href',
      '/preview?foo=bar&demo=1#inbox',
    );
  });

  it('Tauri 環境では demo preview 導線を表示しない', () => {
    demoDataMock.isBrowserPreviewEnvironment.mockReturnValue(false);

    renderLoginScreen();

    expect(screen.queryByRole('link', { name: 'デモプレビューを開く' })).not.toBeInTheDocument();
  });
});
