import { invoke } from '@tauri-apps/api/core';
import type {
  AppSettings,
  DeviceFlowInfo,
  InboxItem,
  NotificationItem,
  Stream,
  TokenVerification,
} from '@/types';

// Auth commands
export async function startDeviceFlow(): Promise<DeviceFlowInfo> {
  return invoke<DeviceFlowInfo>('start_device_flow');
}

export async function pollDeviceFlow(deviceCode: string): Promise<TokenVerification> {
  return invoke<TokenVerification>('poll_device_flow', { deviceCode });
}

export async function saveGitHubToken(token: string): Promise<TokenVerification> {
  return invoke<TokenVerification>('save_github_token', { token });
}

export async function getGitHubToken(): Promise<string | null> {
  return invoke<string | null>('get_github_token');
}

export async function verifyGitHubToken(): Promise<TokenVerification> {
  return invoke<TokenVerification>('verify_github_token');
}

export async function clearGitHubToken(): Promise<void> {
  return invoke<void>('clear_github_token');
}

// Stream commands
export async function getStreams(): Promise<Stream[]> {
  return invoke<Stream[]>('get_streams');
}

export async function createStream(name: string, query: string): Promise<Stream> {
  return invoke<Stream>('create_stream', { name, query });
}

export async function updateStream(
  id: string,
  name: string,
  query: string,
  icon?: string,
  color?: string,
): Promise<Stream> {
  return invoke<Stream>('update_stream', { id, name, query, icon, color });
}

export async function deleteStream(id: string): Promise<void> {
  return invoke<void>('delete_stream', { id });
}

export async function reorderStreams(ids: string[]): Promise<Stream[]> {
  return invoke<Stream[]>('reorder_streams', { ids });
}

export async function updateStreamUnreadCount(id: string, count: number): Promise<void> {
  return invoke<void>('update_stream_unread_count', { id, count });
}

// Notification commands
export async function fetchNotifications(query: string): Promise<NotificationItem[]> {
  return invoke<NotificationItem[]>('fetch_notifications', { query });
}

export async function markAsRead(itemId: string): Promise<void> {
  return invoke<void>('mark_as_read', { itemId });
}

export async function markAllAsRead(itemIds: string[]): Promise<void> {
  return invoke<void>('mark_all_as_read', { itemIds });
}

export async function clearReadItems(): Promise<void> {
  return invoke<void>('clear_read_items');
}

export async function sendNotification(title: string, body: string): Promise<void> {
  return invoke<void>('send_notification', { title, body });
}

export async function sendNotificationWithSound(
  title: string,
  body: string,
  playSound: boolean,
  soundType?: string,
): Promise<void> {
  return invoke<void>('send_notification_with_sound', { title, body, playSound, soundType });
}

export async function playSound(soundType?: string): Promise<void> {
  return invoke<void>('play_sound', { soundType });
}

// Inbox commands (REST API - no query needed!)
export async function fetchInbox(all?: boolean): Promise<InboxItem[]> {
  return invoke<InboxItem[]>('fetch_inbox', { all });
}

export async function markInboxRead(threadId: string): Promise<void> {
  return invoke<void>('mark_inbox_read', { threadId });
}

export async function markAllInboxRead(): Promise<void> {
  return invoke<void>('mark_all_inbox_read');
}

// Settings commands
export async function getAppSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('get_app_settings');
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  return invoke<void>('save_app_settings', { settings });
}

// Tray commands
export async function updateTrayBadge(count: number): Promise<void> {
  return invoke<void>('update_tray_badge', { count });
}
