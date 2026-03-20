import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceFlowInfo, TokenVerification } from '@/types';

const mockVerifyGitHubToken = vi.fn<() => Promise<TokenVerification>>();
const mockStartDeviceFlow = vi.fn<() => Promise<DeviceFlowInfo>>();
const mockPollDeviceFlow = vi.fn<(deviceCode: string) => Promise<TokenVerification>>();
const mockSaveGitHubToken = vi.fn<(token: string) => Promise<TokenVerification>>();
const mockClearGitHubToken = vi.fn<() => Promise<void>>();

vi.mock('@/lib/tauri/commands', () => ({
  verifyGitHubToken: (...args: Parameters<typeof mockVerifyGitHubToken>) =>
    mockVerifyGitHubToken(...args),
  startDeviceFlow: (...args: Parameters<typeof mockStartDeviceFlow>) =>
    mockStartDeviceFlow(...args),
  pollDeviceFlow: (...args: Parameters<typeof mockPollDeviceFlow>) => mockPollDeviceFlow(...args),
  saveGitHubToken: (...args: Parameters<typeof mockSaveGitHubToken>) =>
    mockSaveGitHubToken(...args),
  clearGitHubToken: (...args: Parameters<typeof mockClearGitHubToken>) =>
    mockClearGitHubToken(...args),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockOpen = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (url: string) => mockOpen(url),
}));

import { useAuth } from '@/hooks/use-auth';

const mockDeviceFlow: DeviceFlowInfo = {
  deviceCode: 'device-code-123',
  userCode: 'ABCD-1234',
  verificationUri: 'https://github.com/login/device',
  expiresIn: 900,
  interval: 5,
};

const mockVerifiedUser: TokenVerification = {
  valid: true,
  login: 'testuser',
  avatarUrl: 'https://avatars.githubusercontent.com/testuser',
};

const mockInvalidToken: TokenVerification = {
  valid: false,
};

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
  });

  describe('初期状態', () => {
    it('マウント時に isLoading が true になる', () => {
      mockVerifyGitHubToken.mockReturnValue(new Promise(vi.fn()));
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(true);
    });

    it('初期状態では isAuthenticated が false', async () => {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('初期状態では user が null', async () => {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.user).toBeNull();
    });

    it('初期状態では deviceFlow が null', async () => {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.deviceFlow).toBeNull();
    });

    it('初期状態では error が null', async () => {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBeNull();
    });
  });

  describe('マウント時のトークン検証', () => {
    it('マウント時に verifyGitHubToken が呼ばれる', async () => {
      renderHook(() => useAuth());
      await waitFor(() => expect(mockVerifyGitHubToken).toHaveBeenCalledTimes(1));
    });

    it('有効なトークンがある場合、isAuthenticated が true になる', async () => {
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    });

    it('有効なトークンがある場合、ユーザー情報がセットされる', async () => {
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);
      const { result } = renderHook(() => useAuth());
      await waitFor(() =>
        expect(result.current.user).toEqual({
          login: 'testuser',
          avatarUrl: 'https://avatars.githubusercontent.com/testuser',
        }),
      );
    });

    it('無効なトークンの場合、isAuthenticated が false のまま', async () => {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('verifyGitHubToken がエラーを投げた場合、error がセットされる', async () => {
      mockVerifyGitHubToken.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.error).toBe('Network error'));
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('文字列エラーの場合、その文字列がそのまま表示される', async () => {
      mockVerifyGitHubToken.mockRejectedValue('unexpected');
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.error).toBe('unexpected'));
    });
  });

  describe('startDeviceFlow', () => {
    it('デバイスフロー開始成功時に deviceFlow がセットされる', async () => {
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      expect(result.current.deviceFlow).toEqual(mockDeviceFlow);
      expect(result.current.isPolling).toBe(true);
    });

    it('デバイスフロー開始成功時に検証URIがブラウザで開かれる', async () => {
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      expect(mockOpen).toHaveBeenCalledWith('https://github.com/login/device');
    });

    it('デバイスフロー開始失敗時に error がセットされる', async () => {
      mockStartDeviceFlow.mockRejectedValue(new Error('Device flow error'));
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.startDeviceFlow();
        } catch {
          // startDeviceFlowはエラーを再スローするため、テスト側でキャッチして未処理エラーを防ぐ
        }
      });

      expect(result.current.error).toBe('Device flow error');
      expect(result.current.isLoading).toBe(false);
    });

    it('文字列エラーの場合、その文字列がそのまま表示される', async () => {
      mockStartDeviceFlow.mockRejectedValue('string error');
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        try {
          await result.current.startDeviceFlow();
        } catch {
          // startDeviceFlowはエラーを再スローするため、テスト側でキャッチして未処理エラーを防ぐ
        }
      });

      expect(result.current.error).toBe('string error');
    });
  });

  describe('cancelDeviceFlow', () => {
    it('cancelDeviceFlow で deviceFlow と isPolling がリセットされる', async () => {
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });
      expect(result.current.deviceFlow).not.toBeNull();

      act(() => {
        result.current.cancelDeviceFlow();
      });

      expect(result.current.deviceFlow).toBeNull();
      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('デバイスフローポーリング', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('ポーリング成功時に isAuthenticated が true になる', async () => {
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      mockPollDeviceFlow.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      await act(async () => {
        vi.advanceTimersByTime(mockDeviceFlow.interval * 1000);
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
      expect(result.current.isPolling).toBe(false);
      expect(result.current.deviceFlow).toBeNull();
    });

    it('ポーリングエラー時に error がセットされる', async () => {
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      mockPollDeviceFlow.mockRejectedValue(new Error('Poll failed'));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      await act(async () => {
        vi.advanceTimersByTime(mockDeviceFlow.interval * 1000);
        await vi.advanceTimersByTimeAsync(0);
      });

      await waitFor(() => expect(result.current.error).toBe('Poll failed'));
      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('loginWithToken', () => {
    it('有効なトークンで true を返し認証状態が更新される', async () => {
      mockSaveGitHubToken.mockResolvedValue(mockVerifiedUser);
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result.current.loginWithToken('ghp_valid_token');
      });

      expect(returnValue).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual({
        login: 'testuser',
        avatarUrl: 'https://avatars.githubusercontent.com/testuser',
      });
    });

    it('無効なトークンで false を返し error がセットされる', async () => {
      mockSaveGitHubToken.mockResolvedValue(mockInvalidToken);
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result.current.loginWithToken('ghp_invalid');
      });

      expect(returnValue).toBe(false);
      expect(result.current.error).toBe('Invalid token');
    });

    it('saveGitHubToken がエラーを投げた場合、false が返され error がセットされる', async () => {
      mockSaveGitHubToken.mockRejectedValue(new Error('Save failed'));
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result.current.loginWithToken('ghp_token');
      });

      expect(returnValue).toBe(false);
      expect(result.current.error).toBe('Save failed');
    });

    it('saveGitHubToken に正しいトークンが渡される', async () => {
      mockSaveGitHubToken.mockResolvedValue(mockVerifiedUser);
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.loginWithToken('ghp_test_token_xyz');
      });

      expect(mockSaveGitHubToken).toHaveBeenCalledWith('ghp_test_token_xyz');
    });
  });

  describe('logout', () => {
    it('logout で認証状態がリセットされる', async () => {
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);
      mockClearGitHubToken.mockResolvedValue(undefined);
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(mockClearGitHubToken).toHaveBeenCalledTimes(1);
    });

    it('clearGitHubToken がエラーを投げてもクラッシュしない', async () => {
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);
      mockClearGitHubToken.mockRejectedValue(new Error('Clear failed'));
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      await expect(
        act(async () => {
          await result.current.logout();
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('verifyToken (手動呼び出し)', () => {
    it('verifyToken 手動呼び出しで再検証と認証状態更新が実行される', async () => {
      mockVerifyGitHubToken
        .mockResolvedValueOnce(mockInvalidToken)
        .mockResolvedValueOnce(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isAuthenticated).toBe(false);

      await act(async () => {
        await result.current.verifyToken();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(mockVerifyGitHubToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('返り値の構造', () => {
    it('必要なプロパティとメソッドが全て返される', async () => {
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('deviceFlow');
      expect(result.current).toHaveProperty('isPolling');
      expect(result.current).toHaveProperty('error');
      expect(typeof result.current.verifyToken).toBe('function');
      expect(typeof result.current.startDeviceFlow).toBe('function');
      expect(typeof result.current.cancelDeviceFlow).toBe('function');
      expect(typeof result.current.loginWithToken).toBe('function');
      expect(typeof result.current.logout).toBe('function');
    });
  });
});
