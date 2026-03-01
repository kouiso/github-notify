export type ItemState = 'open' | 'closed' | 'merged';
export type NotificationType = 'issue' | 'pullrequest';

export interface GitHubUser {
  login: string;
  avatarUrl?: string;
}

export interface Repository {
  name: string;
  owner: {
    login: string;
  };
}

export interface Label {
  name: string;
  color: string;
}

export interface NotificationItem {
  id: string;
  number: number;
  title: string;
  url: string;
  state: ItemState;
  itemType: NotificationType;
  createdAt: string;
  updatedAt: string;
  author?: GitHubUser;
  repository: Repository;
  labels: Label[];
  isRead: boolean;
  isDraft?: boolean;
  reviewDecision?: string | null;
}

// Inbox item from REST API (no query needed!)
export interface InboxItem {
  id: string;
  title: string;
  url: string | null;
  reason: string;
  unread: boolean;
  updatedAt: string;
  itemType: string;
  repositoryName: string;
  repositoryFullName: string;
  ownerLogin: string;
  ownerAvatar: string;
}
