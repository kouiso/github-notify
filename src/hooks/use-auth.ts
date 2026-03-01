import { open } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect, useState } from 'react';
import * as commands from '@/lib/tauri/commands';
import { logger } from '@/lib/utils/logger';
import type { DeviceFlowInfo } from '@/types';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    login: string;
    avatarUrl?: string;
  } | null;
  deviceFlow: DeviceFlowInfo | null;
  isPolling: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    deviceFlow: null,
    isPolling: false,
    error: null,
  });

  const verifyToken = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const result = await commands.verifyGitHubToken();

      setState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: result.valid,
        user:
          result.valid && result.login
            ? { login: result.login, avatarUrl: result.avatarUrl }
            : null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        error: err instanceof Error ? err.message : 'Failed to verify token',
      }));
    }
  }, []);

  // Verify token on mount
  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  // Poll for token during device flow
  useEffect(() => {
    if (!state.deviceFlow || !state.isPolling) return;

    const interval = (state.deviceFlow.interval || 5) * 1000;
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      try {
        const result = await commands.pollDeviceFlow(state.deviceFlow!.deviceCode);

        if (result.valid && result.login) {
          setState((prev) => ({
            ...prev,
            isAuthenticated: true,
            isPolling: false,
            deviceFlow: null,
            user: {
              login: result.login!,
              avatarUrl: result.avatarUrl,
            },
            error: null,
          }));
          return;
        }

        // Continue polling
        timeoutId = setTimeout(poll, interval);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isPolling: false,
          error: err instanceof Error ? err.message : 'Authentication failed',
        }));
      }
    };

    timeoutId = setTimeout(poll, interval);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [state.deviceFlow, state.isPolling]);

  const startDeviceFlow = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const deviceFlow = await commands.startDeviceFlow();

      setState((prev) => ({
        ...prev,
        isLoading: false,
        deviceFlow,
        isPolling: true,
      }));

      // Open the verification URL in browser
      await open(deviceFlow.verificationUri);

      return deviceFlow;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to start authentication',
      }));
      throw err;
    }
  }, []);

  const cancelDeviceFlow = useCallback(() => {
    setState((prev) => ({
      ...prev,
      deviceFlow: null,
      isPolling: false,
    }));
  }, []);

  const loginWithToken = useCallback(async (token: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await commands.saveGitHubToken(token);

      if (result.valid && result.login) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: true,
          user: {
            login: result.login!,
            avatarUrl: result.avatarUrl,
          },
        }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Invalid token',
        }));
        return false;
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to save token',
      }));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await commands.clearGitHubToken();
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        user: null,
      }));
    } catch (err) {
      logger.error('Failed to logout', err);
    }
  }, []);

  return {
    ...state,
    verifyToken,
    startDeviceFlow,
    cancelDeviceFlow,
    loginWithToken,
    logout,
  };
}
