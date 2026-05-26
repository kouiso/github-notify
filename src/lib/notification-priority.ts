import type { InboxItem } from '@/types';

export type NotificationPriorityKind = 'review' | 'ci' | 'bot_comment' | 'human_comment' | null;

const BOT_NAME_PATTERN =
  /\b(coderabbit|gemini|dependabot|renovate|github-actions|deepsource|snyk|codeql|devin|bot)\b/i;

export function classifyNotificationPriority(item: InboxItem): NotificationPriorityKind {
  if (item.reason === 'review_requested') return 'review';
  if (item.reason === 'ci_activity') return 'ci';
  if (item.reason === 'comment') {
    const text = `${item.title} ${item.ownerLogin}`.toLowerCase();
    return BOT_NAME_PATTERN.test(text) ? 'bot_comment' : 'human_comment';
  }
  return null;
}

export const NOTIFICATION_PRIORITY_LABELS: Record<
  Exclude<NotificationPriorityKind, null>,
  string
> = {
  review: 'Review',
  ci: 'CI alert',
  bot_comment: 'Bot',
  human_comment: 'Human',
};
