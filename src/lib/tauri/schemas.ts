import * as v from 'valibot';

const DeviceFlowInfoSchema = v.object({
  deviceCode: v.string(),
  userCode: v.string(),
  verificationUri: v.string(),
  expiresIn: v.number(),
  interval: v.number(),
});

const TokenVerificationSchema = v.object({
  valid: v.boolean(),
  login: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
});

const ItemStateSchema = v.picklist(['open', 'closed', 'merged']);

const NotificationTypeSchema = v.picklist(['issue', 'pullrequest']);

const GitHubUserSchema = v.object({
  login: v.string(),
  avatarUrl: v.optional(v.string()),
});

const RepositorySchema = v.object({
  name: v.string(),
  owner: v.object({ login: v.string() }),
});

const LabelSchema = v.object({
  name: v.string(),
  color: v.string(),
});

const NotificationItemSchema = v.object({
  id: v.string(),
  number: v.number(),
  title: v.string(),
  url: v.string(),
  state: ItemStateSchema,
  itemType: NotificationTypeSchema,
  createdAt: v.string(),
  updatedAt: v.string(),
  author: v.optional(GitHubUserSchema),
  repository: RepositorySchema,
  labels: v.array(LabelSchema),
  isRead: v.boolean(),
  isDraft: v.optional(v.boolean()),
  reviewDecision: v.optional(v.nullable(v.string())),
});

const NotificationReasonSchema = v.picklist([
  'review_requested',
  'mention',
  'team_mention',
  'assign',
  'author',
  'ci_activity',
  'comment',
  'state_change',
  'subscribed',
  'security_alert',
  'manual',
  'push',
  'your_activity',
]);

const InboxItemSchema = v.object({
  id: v.string(),
  title: v.string(),
  url: v.nullable(v.string()),
  reason: NotificationReasonSchema,
  unread: v.boolean(),
  updatedAt: v.string(),
  itemType: v.string(),
  repositoryName: v.string(),
  repositoryFullName: v.string(),
  ownerLogin: v.string(),
  ownerAvatar: v.string(),
});

const SoundTypeSchema = v.picklist(['default', 'soft', 'chime']);
const ThemeSchema = v.picklist(['light', 'dark', 'system']);

const IssueStatusRuleSchema = v.object({
  repositoryPattern: v.string(),
  requiredStatuses: v.array(v.string()),
  enabled: v.boolean(),
});

const CustomFilterSchema = v.object({
  id: v.string(),
  name: v.string(),
  reasons: v.array(NotificationReasonSchema),
  enableDesktopNotification: v.boolean(),
  enableSound: v.boolean(),
  soundType: SoundTypeSchema,
  repositories: v.optional(v.array(v.string())),
  searchQuery: v.optional(v.string()),
  issueStatusRules: v.optional(v.array(IssueStatusRuleSchema)),
});

const AppSettingsSchema = v.object({
  theme: ThemeSchema,
  notificationPreset: v.string(),
  customReasons: v.array(NotificationReasonSchema),
  desktopNotifications: v.boolean(),
  soundEnabled: v.boolean(),
  customFilters: v.array(CustomFilterSchema),
  activeFilterId: v.nullable(v.string()),
  onboardingCompleted: v.optional(v.boolean()),
});

export {
  AppSettingsSchema,
  DeviceFlowInfoSchema,
  InboxItemSchema,
  NotificationItemSchema,
  TokenVerificationSchema,
};
