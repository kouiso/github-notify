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
    avatarUrl?: string | null;
  } | null;
  deviceFlow: DeviceFlowInfo | null;
  isPolling: boolean;
  error: string | null;
}

const isTauriEnv = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Tauri IPCはエラーをstring型で返すため、instanceof Errorだけでは不十分
const extractErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
};

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
    if (!isTauriEnv()) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

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
        error: extractErrorMessage(err, 'Failed to verify token'),
      }));
    }
  }, []);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  // デバイスフロー認証中にポーリングでトークン取得を試みる
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

        timeoutId = setTimeout(poll, interval);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isPolling: false,
          error: extractErrorMessage(err, 'Authentication failed'),
        }));
      }
    };

    timeoutId = setTimeout(poll, interval);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [state.deviceFlow, state.isPolling]);

  const startDeviceFlow = useCallback(async () => {
    if (!isTauriEnv()) {
      setState((prev) => ({ ...prev, error: 'Tauri環境でのみ利用可能です' }));
      throw new Error('Tauri環境でのみ利用可能です');
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const deviceFlow = await commands.startDeviceFlow();

      setState((prev) => ({
        ...prev,
        isLoading: false,
        deviceFlow,
        isPolling: true,
      }));

      await open(deviceFlow.verificationUri);

      return deviceFlow;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: extractErrorMessage(err, 'Failed to start authentication'),
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
    if (!isTauriEnv()) {
      setState((prev) => ({ ...prev, error: 'Tauri環境でのみ利用可能です' }));
      return false;
    }

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
        error: extractErrorMessage(err, 'Failed to save token'),
      }));
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    if (!isTauriEnv()) return;

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
