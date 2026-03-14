import { invoke } from '@tauri-apps/api/core';
import type {
  AppSettings,
  DeviceFlowInfo,
  InboxItem,
  NotificationItem,
  TokenVerification,
} from '@/types';

export async function startDeviceFlow(): Promise<DeviceFlowInfo> {
  return invoke<DeviceFlowInfo>('start_device_flow');
}

export async function pollDeviceFlow(deviceCode: string): Promise<TokenVerification> {
  return invoke<TokenVerification>('poll_device_flow', { deviceCode });
}

export async function saveGitHubToken(token: string): Promise<TokenVerification> {
  return invoke<TokenVerification>('save_github_token', { token });
}

export async function verifyGitHubToken(): Promise<TokenVerification> {
  return invoke<TokenVerification>('verify_github_token');
}

export async function clearGitHubToken(): Promise<void> {
  return invoke<void>('clear_github_token');
}

export async function fetchNotifications(query: string): Promise<NotificationItem[]> {
  return invoke<NotificationItem[]>('fetch_notifications', { query });
}

export async function markAsRead(itemId: string): Promise<void> {
  return invoke<void>('mark_as_read', { itemId });
}

export async function markAllAsRead(itemIds: string[]): Promise<void> {
  return invoke<void>('mark_all_as_read', { itemIds });
}

export async function sendNotificationWithSound(
  title: string,
  body: string,
  playSound: boolean,
  soundType?: string,
): Promise<void> {
  return invoke<void>('send_notification_with_sound', { title, body, playSound, soundType });
}

export async function fetchInbox(all?: boolean): Promise<InboxItem[]> {
  return invoke<InboxItem[]>('fetch_inbox', { all });
}

export async function markInboxRead(threadId: string): Promise<void> {
  return invoke<void>('mark_inbox_read', { threadId });
}

export async function markAllInboxRead(): Promise<void> {
  return invoke<void>('mark_all_inbox_read');
}

export async function getAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('get_app_settings');
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  return invoke<void>('save_app_settings', { settings });
}

export async function updateTrayBadge(count: number): Promise<void> {
  return invoke<void>('update_tray_badge', { count });
}
