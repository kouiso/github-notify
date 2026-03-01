import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/hooks/use-auth';
import type { TokenVerification } from '@/types/auth';

// Mock Tauri commands
const mockVerifyToken = vi.fn();
const mockGetToken = vi.fn();
const mockStartDeviceFlow = vi.fn();
const mockPollDeviceFlow = vi.fn();
const mockSaveToken = vi.fn();
const mockClearToken = vi.fn();

vi.mock('@/lib/tauri/commands', () => ({
  verifyGitHubToken: () => mockVerifyToken(),
  getGitHubToken: () => mockGetToken(),
  startDeviceFlow: () => mockStartDeviceFlow(),
  pollDeviceFlow: (code: string) => mockPollDeviceFlow(code),
  saveGitHubToken: (token: string) => mockSaveToken(token),
  clearGitHubToken: () => mockClearToken(),
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    mockGetToken.mockResolvedValue(null);
    mockVerifyToken.mockResolvedValue({ valid: false });

    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(true);
  });

  it('should set authenticated when valid token exists', async () => {
    const mockUser: TokenVerification = {
      valid: true,
      login: 'testuser',
      avatarUrl: 'https://example.com/avatar.png',
    };

    mockGetToken.mockResolvedValue('test-token');
    mockVerifyToken.mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user?.login).toEqual(mockUser.login);
    expect(result.current.isLoading).toBe(false);
  });

  it('should provide login and logout functions', () => {
    mockGetToken.mockResolvedValue(null);
    mockVerifyToken.mockResolvedValue({ valid: false });

    const { result } = renderHook(() => useAuth());

    expect(typeof result.current.startDeviceFlow).toBe('function');
    expect(typeof result.current.logout).toBe('function');
  });
});
