import { open } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui';
import { useSearchView } from '@/hooks/use-search-view';
import { cn } from '@/lib/utils/cn';
import type { InboxItem, NotificationItem } from '@/types';
import type { CustomFilter } from '@/types/settings';
import { isSearchView, type NotificationReason, REASON_LABELS } from '@/types/settings';

const DEFAULT_VISIBLE = 3;

// Reason → color mapping (same as inbox-list)
const REASON_COLORS: Record<string, { text: string; bg: string }> = {
  review_requested: { text: 'text-[var(--color-gh-pr)]', bg: 'bg-[var(--color-gh-review-bg)]' },
  mention: { text: 'text-[var(--color-gh-mention)]', bg: 'bg-[var(--color-gh-mention-bg)]' },
  team_mention: { text: 'text-[var(--color-gh-mention)]', bg: 'bg-[var(--color-gh-mention-bg)]' },
  assign: { text: 'text-[var(--color-gh-assign)]', bg: 'bg-[var(--color-gh-assign-bg)]' },
  author: { text: 'text-muted-foreground', bg: 'bg-accent' },
  ci_activity: { text: 'text-[var(--color-gh-ci)]', bg: 'bg-[var(--color-gh-ci-bg)]' },
  comment: { text: 'text-muted-foreground', bg: 'bg-accent' },
  state_change: { text: 'text-muted-foreground', bg: 'bg-accent' },
};

// Review decision display config
const REVIEW_DECISION_CONFIG: Record<string, { label: string; color: string }> = {
  APPROVED: { label: 'Approved', color: 'text-[var(--color-gh-done)]' },
  CHANGES_REQUESTED: { label: 'Changes', color: 'text-[var(--color-gh-fail)]' },
  REVIEW_REQUIRED: { label: 'Pending', color: 'text-[var(--color-gh-review)]' },
};

interface DashboardProps {
  inboxItems: InboxItem[];
  filters: CustomFilter[];
  onMarkInboxRead: (threadId: string) => void;
  onRefresh: () => void;
  isInboxLoading: boolean;
  userLogin?: string;
}

/** Replace @me placeholder with actual GitHub login */
function resolveQuery(query: string, userLogin?: string): string {
  if (!userLogin) return query;
  return query.replace(/@me\b/g, userLogin);
}

export function Dashboard({
  inboxItems,
  filters,
  onMarkInboxRead,
  onRefresh,
  isInboxLoading,
  userLogin,
}: DashboardProps) {
  const needsReviewView = useSearchView();
  const myPrsView = useSearchView();

  // Find search view filters
  const needsReviewFilter = filters.find((f) => f.id === 'default-needs-review');
  const myPrsFilter = filters.find((f) => f.id === 'default-my-prs');

  // Fetch search views on mount
  useEffect(() => {
    if (needsReviewFilter && isSearchView(needsReviewFilter) && needsReviewFilter.searchQuery) {
      needsReviewView.fetch(resolveQuery(needsReviewFilter.searchQuery, userLogin));
    }
  }, [needsReviewFilter, userLogin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (myPrsFilter && isSearchView(myPrsFilter) && myPrsFilter.searchQuery) {
      myPrsView.fetch(resolveQuery(myPrsFilter.searchQuery, userLogin));
    }
  }, [myPrsFilter, userLogin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefreshAll = useCallback(() => {
    onRefresh();
    needsReviewView.refresh();
    myPrsView.refresh();
  }, [onRefresh, needsReviewView, myPrsView]);

  // Filter inbox to unread items that match notification filters
  const notificationFilters = filters.filter((f) => !isSearchView(f));
  const unreadInboxItems = inboxItems.filter((item) => {
    if (!item.unread) return false;
    if (notificationFilters.length === 0) return true;
    return notificationFilters.some((filter) => {
      if (
        filter.reasons.length > 0 &&
        !filter.reasons.includes(item.reason as NotificationReason)
      ) {
        return false;
      }
      if (filter.repositories && filter.repositories.length > 0) {
        if (!filter.repositories.includes(item.repositoryFullName)) return false;
      }
      return true;
    });
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
        <h2 className="text-base font-semibold">Dashboard</h2>
        <button
          onClick={handleRefreshAll}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
          title="Refresh all"
        >
          <RefreshIcon
            className={cn(
              'w-4 h-4 text-muted-foreground',
              (isInboxLoading || needsReviewView.isLoading || myPrsView.isLoading) &&
                'animate-spin',
            )}
          />
        </button>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-5">
        {/* Needs My Review section */}
        {needsReviewFilter && (
          <DashboardSection
            title={needsReviewFilter.name}
            count={needsReviewView.items.length}
            isLoading={needsReviewView.isLoading}
            error={needsReviewView.error}
          >
            {needsReviewView.items.length > 0 && (
              <SearchItemList items={needsReviewView.items} showReviewDecision={false} />
            )}
          </DashboardSection>
        )}

        {/* My PRs section */}
        {myPrsFilter && (
          <DashboardSection
            title={myPrsFilter.name}
            count={myPrsView.items.length}
            isLoading={myPrsView.isLoading}
            error={myPrsView.error}
          >
            {myPrsView.items.length > 0 && (
              <SearchItemList items={myPrsView.items} showReviewDecision />
            )}
          </DashboardSection>
        )}

        {/* Recent notifications section */}
        <DashboardSection
          title="新着通知"
          count={unreadInboxItems.length}
          isLoading={isInboxLoading && inboxItems.length === 0}
        >
          {unreadInboxItems.length > 0 && (
            <InboxItemList items={unreadInboxItems} onMarkAsRead={onMarkInboxRead} />
          )}
        </DashboardSection>
      </div>
    </div>
  );
}

// --- Section container ---

interface DashboardSectionProps {
  title: string;
  count: number;
  isLoading: boolean;
  error?: string | null;
  children: React.ReactNode;
}

function DashboardSection({ title, count, isLoading, error, children }: DashboardSectionProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {!isLoading && (
          <span className="text-xs text-muted-foreground tabular-nums">{count}件</span>
        )}
        {isLoading && <Spinner size="sm" />}
      </div>

      {/* Section content */}
      <div>
        {error && <div className="px-4 py-3 text-sm text-destructive">{error}</div>}
        {!isLoading && !error && count === 0 && (
          <div className="px-4 py-4 text-sm text-muted-foreground text-center">なし</div>
        )}
        {children}
      </div>
    </div>
  );
}

// --- Search item list with expand/collapse ---

function SearchItemList({
  items,
  showReviewDecision,
}: {
  items: NotificationItem[];
  showReviewDecision: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, DEFAULT_VISIBLE);

  const handleClick = async (item: NotificationItem) => {
    if (item.url) {
      await open(item.url);
    }
  };

  return (
    <div>
      {visibleItems.map((item) => (
        <SearchRow
          key={item.id}
          item={item}
          showReviewDecision={showReviewDecision}
          onClick={() => handleClick(item)}
        />
      ))}
      {items.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors text-center"
        >
          {expanded ? '折りたたむ' : `もっと見る (+${items.length - DEFAULT_VISIBLE})`}
        </button>
      )}
    </div>
  );
}

// --- Inbox item list with expand/collapse ---

function InboxItemList({
  items,
  onMarkAsRead,
}: {
  items: InboxItem[];
  onMarkAsRead: (threadId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, DEFAULT_VISIBLE);

  const handleClick = async (item: InboxItem) => {
    if (item.url) {
      await open(item.url);
    }
    if (item.unread) {
      onMarkAsRead(item.id);
    }
  };

  return (
    <div>
      {visibleItems.map((item) => (
        <InboxRow key={item.id} item={item} onClick={() => handleClick(item)} />
      ))}
      {items.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors text-center"
        >
          {expanded ? '折りたたむ' : `もっと見る (+${items.length - DEFAULT_VISIBLE})`}
        </button>
      )}
    </div>
  );
}

// --- Row components ---

function SearchRow({
  item,
  showReviewDecision,
  onClick,
}: {
  item: NotificationItem;
  showReviewDecision: boolean;
  onClick: () => void;
}) {
  const isPR = item.itemType === 'pullrequest';
  const reviewConfig = item.reviewDecision ? REVIEW_DECISION_CONFIG[item.reviewDecision] : null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 cursor-pointer transition-colors border-b border-border/20 last:border-b-0"
      onClick={onClick}
    >
      {/* Type icon */}
      <div className="flex-shrink-0">
        {isPR ? (
          <PRIcon className="w-4 h-4 text-[var(--color-gh-pr)]" />
        ) : (
          <IssueIcon className="w-4 h-4 text-[var(--color-gh-issue)]" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[0.9375rem] text-foreground truncate leading-snug">
            {item.title}
          </span>
          {item.isDraft && (
            <span className="text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded flex-shrink-0">
              Draft
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[0.8125rem] text-muted-foreground truncate">
            {item.repository.owner.login}/{item.repository.name}
          </span>
          {item.author && (
            <span className="text-[0.8125rem] text-muted-foreground/70 flex-shrink-0">
              by @{item.author.login}
            </span>
          )}
        </div>
      </div>

      {/* Review decision badge (for My PRs) */}
      {showReviewDecision && reviewConfig && (
        <span className={cn('text-xs font-medium flex-shrink-0', reviewConfig.color)}>
          {reviewConfig.label}
        </span>
      )}

      {/* Timestamp */}
      <span className="text-[0.8125rem] text-muted-foreground flex-shrink-0 tabular-nums">
        {formatRelativeTime(item.updatedAt)}
      </span>
    </div>
  );
}

function InboxRow({ item, onClick }: { item: InboxItem; onClick: () => void }) {
  const isPR = item.itemType === 'PullRequest';
  const isIssue = item.itemType === 'Issue';
  const reasonLabel = REASON_LABELS[item.reason as NotificationReason] || item.reason;
  const colors = REASON_COLORS[item.reason] || { text: 'text-muted-foreground', bg: 'bg-accent' };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 cursor-pointer transition-colors border-b border-border/20 last:border-b-0"
      onClick={onClick}
    >
      {/* Unread dot */}
      <div className="w-1.5 flex-shrink-0">
        {item.unread && <span className="block w-1.5 h-1.5 rounded-full bg-primary" />}
      </div>

      {/* Type icon */}
      <div className="flex-shrink-0">
        {isPR && <PRIcon className="w-4 h-4 text-[var(--color-gh-pr)]" />}
        {isIssue && <IssueIcon className="w-4 h-4 text-[var(--color-gh-issue)]" />}
        {!isPR && !isIssue && <NotificationIcon className="w-4 h-4 text-muted-foreground" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'text-[0.9375rem] truncate block leading-snug',
            item.unread ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {item.title}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[0.8125rem] text-muted-foreground truncate">
            {item.repositoryFullName}
          </span>
          <span
            className={cn(
              'inline-flex px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0',
              colors.text,
              colors.bg,
            )}
          >
            {reasonLabel}
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <span className="text-[0.8125rem] text-muted-foreground flex-shrink-0 tabular-nums">
        {formatRelativeTime(item.updatedAt)}
      </span>
    </div>
  );
}

// --- Utilities ---

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

// --- Icons ---

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function PRIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <line x1="6" x2="6" y1="9" y2="21" />
    </svg>
  );
}

function IssueIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function NotificationIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
