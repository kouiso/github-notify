import { invoke } from '@tauri-apps/api/core';
import * as v from 'valibot';
import type {
  AppSettings,
  DeviceFlowInfo,
  InboxItem,
  NotificationItem,
  TokenVerification,
} from '@/types';
import type { IssueStatusRule } from '@/types/settings';
import {
  AppSettingsSchema,
  DeviceFlowInfoSchema,
  InboxItemSchema,
  NotificationItemSchema,
  TokenVerificationSchema,
} from './schemas';

function parse<T>(schema: v.GenericSchema<T>, data: unknown): T {
  return v.parse(schema, data);
}

export async function startDeviceFlow(): Promise<DeviceFlowInfo> {
  const raw = await invoke('start_device_flow');
  return parse(DeviceFlowInfoSchema, raw);
}

export async function pollDeviceFlow(deviceCode: string): Promise<TokenVerification> {
  const raw = await invoke('poll_device_flow', { deviceCode });
  return parse(TokenVerificationSchema, raw);
}

export async function saveGitHubToken(token: string): Promise<TokenVerification> {
  const raw = await invoke('save_github_token', { token });
  return parse(TokenVerificationSchema, raw);
}

export async function verifyGitHubToken(): Promise<TokenVerification> {
  const raw = await invoke('verify_github_token');
  return parse(TokenVerificationSchema, raw);
}

export async function clearGitHubToken(): Promise<void> {
  return invoke<void>('clear_github_token');
}

export async function fetchNotifications(
  query: string,
  issueStatusRules?: IssueStatusRule[],
): Promise<NotificationItem[]> {
  const raw = await invoke('fetch_notifications', {
    query,
    issueStatusRules: issueStatusRules ?? null,
  });
  return parse(v.array(NotificationItemSchema), raw);
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
  const raw = await invoke('fetch_inbox', { all });
  return parse(v.array(InboxItemSchema), raw);
}

export async function markInboxRead(threadId: string): Promise<void> {
  return invoke<void>('mark_inbox_read', { threadId });
}

export async function markAllInboxRead(): Promise<void> {
  return invoke<void>('mark_all_inbox_read');
}

export async function getAppSettings(): Promise<AppSettings> {
  const raw = await invoke('get_app_settings');
  return parse(AppSettingsSchema, raw);
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  return invoke<void>('save_app_settings', { settings });
}

export async function updateTrayBadge(count: number): Promise<void> {
  return invoke<void>('update_tray_badge', { count });
}

export async function checkKeychainStatus(): Promise<boolean> {
  return invoke<boolean>('check_keychain_status');
}
