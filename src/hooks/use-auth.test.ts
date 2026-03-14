import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceFlowInfo, TokenVerification } from '@/types';

// Tauri コマンドをモック
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

// Tauri shell プラグインをモック
const mockOpen = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (url: string) => mockOpen(url),
}));

import { useAuth } from '@/hooks/use-auth';

// テスト用の共通データ
const mockDeviceFlow: DeviceFlowInfo = {
  deviceCode: 'device-code-123',
  userCode: 'ABCD-1234',
  verificationUri: 'https://github.com/login/device',
  expiresIn: 900,
  interval: 5,
} as const;

const mockVerifiedUser: TokenVerification = {
  valid: true,
  login: 'testuser',
  avatarUrl: 'https://avatars.githubusercontent.com/testuser',
} as const;

const mockInvalidToken: TokenVerification = {
  valid: false,
} as const;

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // shouldAdvanceTime: true で waitFor が実時間でタイムアウトできるようにする
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // デフォルトでトークン検証は無効を返す
    mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('初期状態', () => {
    it('マウント時に isLoading が true になる', () => {
      // verifyToken が解決するまで待たずに状態を確認するため pending な Promise を返す
      mockVerifyGitHubToken.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(true);
    });

    it('初期状態では isAuthenticated が false', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
    });

    it('初期状態では user が null', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('初期状態では deviceFlow が null', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.deviceFlow).toBeNull();
    });

    it('初期状態では isPolling が false', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isPolling).toBe(false);
    });

    it('初期状態では error が null', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('マウント時のトークン検証', () => {
    it('マウント時に verifyGitHubToken が呼ばれる', async () => {
      renderHook(() => useAuth());

      await waitFor(() => {
        expect(mockVerifyGitHubToken).toHaveBeenCalledTimes(1);
      });
    });

    it('有効なトークンがある場合、isAuthenticated が true になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);

      // Act
      const { result } = renderHook(() => useAuth());

      // Assert
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('有効なトークンがある場合、ユーザー情報がセットされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);

      // Act
      const { result } = renderHook(() => useAuth());

      // Assert
      await waitFor(() => {
        expect(result.current.user).toEqual({
          login: 'testuser',
          avatarUrl: 'https://avatars.githubusercontent.com/testuser',
        });
      });
    });

    it('avatarUrl なしの有効なトークンでも user がセットされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue({ valid: true, login: 'testuser' });

      // Act
      const { result } = renderHook(() => useAuth());

      // Assert
      await waitFor(() => {
        expect(result.current.user).toEqual({
          login: 'testuser',
          avatarUrl: undefined,
        });
      });
    });

    it('無効なトークンの場合、isAuthenticated が false のまま', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);

      // Act
      const { result } = renderHook(() => useAuth());

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('トークン検証が完了すると isLoading が false になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);

      // Act
      const { result } = renderHook(() => useAuth());

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('verifyGitHubToken がエラーを投げた場合、error がセットされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockRejectedValue(new Error('Network error'));

      // Act
      const { result } = renderHook(() => useAuth());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('Error オブジェクト以外のエラーの場合、フォールバックメッセージが使われる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockRejectedValue('unexpected error');

      // Act
      const { result } = renderHook(() => useAuth());

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('Failed to verify token');
      });
    });
  });

  describe('startDeviceFlow', () => {
    it('デバイスフロー開始時に isLoading が true になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      act(() => {
        void result.current.startDeviceFlow();
      });

      // Assert
      expect(result.current.isLoading).toBe(true);
    });

    it('デバイスフロー開始成功時に deviceFlow がセットされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // Assert
      expect(result.current.deviceFlow).toEqual(mockDeviceFlow);
    });

    it('デバイスフロー開始成功時に isPolling が true になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // Assert
      expect(result.current.isPolling).toBe(true);
    });

    it('デバイスフロー開始成功時に検証URIがブラウザで開かれる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // Assert
      expect(mockOpen).toHaveBeenCalledWith('https://github.com/login/device');
    });

    it('デバイスフロー開始成功時に DeviceFlowInfo を返す', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      let returnValue: DeviceFlowInfo | undefined;
      await act(async () => {
        returnValue = await result.current.startDeviceFlow();
      });

      // Assert
      expect(returnValue).toEqual(mockDeviceFlow);
    });

    it('デバイスフロー開始失敗時に error がセットされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockRejectedValue(new Error('Device flow error'));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        try {
          await result.current.startDeviceFlow();
        } catch {
          // エラーは呼び出し元に再スローされるため握りつぶす
        }
      });

      // Assert
      expect(result.current.error).toBe('Device flow error');
      expect(result.current.isLoading).toBe(false);
    });

    it('デバイスフロー開始失敗時にエラーが再スローされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      const expectedError = new Error('Device flow failed');
      mockStartDeviceFlow.mockRejectedValue(expectedError);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act & Assert
      await act(async () => {
        await expect(result.current.startDeviceFlow()).rejects.toThrow('Device flow failed');
      });
    });

    it('Error 以外のエラーでフォールバックメッセージが使われる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockRejectedValue('string error');

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        try {
          await result.current.startDeviceFlow();
        } catch {
          // 再スローされたエラーを握りつぶす
        }
      });

      // Assert
      expect(result.current.error).toBe('Failed to start authentication');
    });
  });

  describe('cancelDeviceFlow', () => {
    it('cancelDeviceFlow で deviceFlow が null になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });
      expect(result.current.deviceFlow).not.toBeNull();

      // Act
      act(() => {
        result.current.cancelDeviceFlow();
      });

      // Assert
      expect(result.current.deviceFlow).toBeNull();
    });

    it('cancelDeviceFlow で isPolling が false になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });
      expect(result.current.isPolling).toBe(true);

      // Act
      act(() => {
        result.current.cancelDeviceFlow();
      });

      // Assert
      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('デバイスフローポーリング', () => {
    it('ポーリング成功時に isAuthenticated が true になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      mockPollDeviceFlow.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // Act: interval 経過後にポーリングが実行される
      await act(async () => {
        vi.advanceTimersByTime(mockDeviceFlow.interval * 1000);
        await Promise.resolve();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('ポーリング成功時にユーザー情報がセットされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      mockPollDeviceFlow.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // Act
      await act(async () => {
        vi.advanceTimersByTime(mockDeviceFlow.interval * 1000);
        await Promise.resolve();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.user).toEqual({
          login: 'testuser',
          avatarUrl: 'https://avatars.githubusercontent.com/testuser',
        });
      });
    });

    it('ポーリング成功時に isPolling が false になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      mockPollDeviceFlow.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // Act
      await act(async () => {
        vi.advanceTimersByTime(mockDeviceFlow.interval * 1000);
        await Promise.resolve();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
    });

    it('ポーリング成功時に deviceFlow が null になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      mockPollDeviceFlow.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // Act
      await act(async () => {
        vi.advanceTimersByTime(mockDeviceFlow.interval * 1000);
        await Promise.resolve();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.deviceFlow).toBeNull();
      });
    });

    it('ポーリング結果が valid=false の場合、継続してポーリングする', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      // 1回目は pending、2回目で認証成功
      mockPollDeviceFlow
        .mockResolvedValueOnce(mockInvalidToken)
        .mockResolvedValueOnce(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // Act: 1回目のポーリング
      await act(async () => {
        vi.advanceTimersByTime(mockDeviceFlow.interval * 1000);
        await Promise.resolve();
      });

      // まだ認証されていない
      expect(result.current.isAuthenticated).toBe(false);

      // Act: 2回目のポーリング
      await act(async () => {
        vi.advanceTimersByTime(mockDeviceFlow.interval * 1000);
        await Promise.resolve();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('ポーリングエラー時に error がセットされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      mockPollDeviceFlow.mockRejectedValue(new Error('Poll failed'));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // Act
      await act(async () => {
        vi.advanceTimersByTime(mockDeviceFlow.interval * 1000);
        await Promise.resolve();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('Poll failed');
      });
      expect(result.current.isPolling).toBe(false);
    });

    it('ポーリングエラー時に Error 以外の場合フォールバックメッセージが使われる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(mockDeviceFlow);
      mockPollDeviceFlow.mockRejectedValue('unexpected');

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // Act
      await act(async () => {
        vi.advanceTimersByTime(mockDeviceFlow.interval * 1000);
        await Promise.resolve();
      });

      // Assert
      await waitFor(() => {
        expect(result.current.error).toBe('Authentication failed');
      });
    });

    it('deviceFlow の interval が 0 のとき、デフォルト 5 秒が使われる', async () => {
      // Arrange: interval が falsy な値（0）のデバイスフロー
      const flowWithZeroInterval: DeviceFlowInfo = {
        ...mockDeviceFlow,
        interval: 0,
      };
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockStartDeviceFlow.mockResolvedValue(flowWithZeroInterval);
      mockPollDeviceFlow.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.startDeviceFlow();
      });

      // 4999ms ではポーリングが発生しない（デフォルト 5 秒 = 5000ms）
      await act(async () => {
        vi.advanceTimersByTime(4999);
        await Promise.resolve();
      });
      expect(mockPollDeviceFlow).not.toHaveBeenCalled();

      // 5000ms でポーリングが発生する
      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(mockPollDeviceFlow).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('loginWithToken', () => {
    it('有効なトークンで loginWithToken が true を返す', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockSaveGitHubToken.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result.current.loginWithToken('ghp_valid_token');
      });

      // Assert
      expect(returnValue).toBe(true);
    });

    it('有効なトークンで isAuthenticated が true になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockSaveGitHubToken.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.loginWithToken('ghp_valid_token');
      });

      // Assert
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('有効なトークンでユーザー情報がセットされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockSaveGitHubToken.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.loginWithToken('ghp_valid_token');
      });

      // Assert
      expect(result.current.user).toEqual({
        login: 'testuser',
        avatarUrl: 'https://avatars.githubusercontent.com/testuser',
      });
    });

    it('無効なトークンで false が返される', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockSaveGitHubToken.mockResolvedValue(mockInvalidToken);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result.current.loginWithToken('ghp_invalid_token');
      });

      // Assert
      expect(returnValue).toBe(false);
    });

    it('無効なトークンで error メッセージがセットされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockSaveGitHubToken.mockResolvedValue(mockInvalidToken);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.loginWithToken('ghp_invalid_token');
      });

      // Assert
      expect(result.current.error).toBe('Invalid token');
    });

    it('saveGitHubToken がエラーを投げた場合、false が返される', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockSaveGitHubToken.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      let returnValue: boolean | undefined;
      await act(async () => {
        returnValue = await result.current.loginWithToken('ghp_token');
      });

      // Assert
      expect(returnValue).toBe(false);
    });

    it('saveGitHubToken がエラーを投げた場合、error がセットされる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockSaveGitHubToken.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.loginWithToken('ghp_token');
      });

      // Assert
      expect(result.current.error).toBe('Save failed');
    });

    it('loginWithToken 開始時に isLoading が true になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockSaveGitHubToken.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      act(() => {
        void result.current.loginWithToken('ghp_token');
      });

      // Assert
      expect(result.current.isLoading).toBe(true);
    });

    it('loginWithToken 開始時に以前の error がクリアされる', async () => {
      // Arrange: まずエラー状態を作る
      mockVerifyGitHubToken.mockRejectedValueOnce(new Error('Previous error'));
      mockSaveGitHubToken.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.error).toBe('Previous error'));

      // Act
      await act(async () => {
        await result.current.loginWithToken('ghp_token');
      });

      // Assert: 認証成功後はエラーがない
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('saveGitHubToken に正しいトークンが渡される', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      mockSaveGitHubToken.mockResolvedValue(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Act
      await act(async () => {
        await result.current.loginWithToken('ghp_test_token_xyz');
      });

      // Assert
      expect(mockSaveGitHubToken).toHaveBeenCalledWith('ghp_test_token_xyz');
    });
  });

  describe('logout', () => {
    it('logout で isAuthenticated が false になる', async () => {
      // Arrange: 認証済み状態を作る
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);
      mockClearGitHubToken.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // Act
      await act(async () => {
        await result.current.logout();
      });

      // Assert
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('logout で user が null になる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);
      mockClearGitHubToken.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.user).not.toBeNull());

      // Act
      await act(async () => {
        await result.current.logout();
      });

      // Assert
      expect(result.current.user).toBeNull();
    });

    it('clearGitHubToken が呼ばれる', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);
      mockClearGitHubToken.mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // Act
      await act(async () => {
        await result.current.logout();
      });

      // Assert
      expect(mockClearGitHubToken).toHaveBeenCalledTimes(1);
    });

    it('clearGitHubToken がエラーを投げてもクラッシュしない', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);
      mockClearGitHubToken.mockRejectedValue(new Error('Clear failed'));

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // Act & Assert: エラーが表面に出ないこと
      await expect(
        act(async () => {
          await result.current.logout();
        }),
      ).resolves.not.toThrow();
    });

    it('clearGitHubToken がエラーを投げた場合、logger.error が呼ばれる', async () => {
      // Arrange
      const { logger } = await import('@/lib/utils/logger');
      const loggerError = vi.mocked(logger.error);
      mockVerifyGitHubToken.mockResolvedValue(mockVerifiedUser);
      const clearError = new Error('Clear failed');
      mockClearGitHubToken.mockRejectedValue(clearError);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

      // Act
      await act(async () => {
        await result.current.logout();
      });

      // Assert
      expect(loggerError).toHaveBeenCalledWith('Failed to logout', clearError);
    });
  });

  describe('verifyToken (手動呼び出し)', () => {
    it('verifyToken を手動で呼び出すと再検証が実行される', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mockVerifyGitHubToken).toHaveBeenCalledTimes(1);

      // Act
      await act(async () => {
        await result.current.verifyToken();
      });

      // Assert
      expect(mockVerifyGitHubToken).toHaveBeenCalledTimes(2);
    });

    it('verifyToken 手動呼び出しで認証状態が更新される', async () => {
      // Arrange: 最初は無効、2回目は有効
      mockVerifyGitHubToken
        .mockResolvedValueOnce(mockInvalidToken)
        .mockResolvedValueOnce(mockVerifiedUser);

      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.isAuthenticated).toBe(false);

      // Act
      await act(async () => {
        await result.current.verifyToken();
      });

      // Assert
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('返り値の構造', () => {
    it('必要なプロパティが全て返される', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Assert
      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('deviceFlow');
      expect(result.current).toHaveProperty('isPolling');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('verifyToken');
      expect(result.current).toHaveProperty('startDeviceFlow');
      expect(result.current).toHaveProperty('cancelDeviceFlow');
      expect(result.current).toHaveProperty('loginWithToken');
      expect(result.current).toHaveProperty('logout');
    });

    it('返されるメソッドは全て関数である', async () => {
      // Arrange
      mockVerifyGitHubToken.mockResolvedValue(mockInvalidToken);
      const { result } = renderHook(() => useAuth());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Assert
      expect(typeof result.current.verifyToken).toBe('function');
      expect(typeof result.current.startDeviceFlow).toBe('function');
      expect(typeof result.current.cancelDeviceFlow).toBe('function');
      expect(typeof result.current.loginWithToken).toBe('function');
      expect(typeof result.current.logout).toBe('function');
    });
  });
});
