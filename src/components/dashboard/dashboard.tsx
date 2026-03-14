import { open } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui';
import { useSearchView } from '@/hooks/use-search-view';
import { cn } from '@/lib/utils/cn';
import type { InboxItem, NotificationItem } from '@/types';
import type { CustomFilter } from '@/types/settings';
import { isSearchView, REASON_LABELS } from '@/types/settings';

const DEFAULT_VISIBLE = 5;

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

const REVIEW_DECISION_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  APPROVED: {
    label: 'Approved',
    color: 'text-[var(--color-gh-done)]',
    dotColor: 'bg-[var(--color-gh-done)]',
  },
  CHANGES_REQUESTED: {
    label: 'Changes requested',
    color: 'text-[var(--color-gh-fail)]',
    dotColor: 'bg-[var(--color-gh-fail)]',
  },
  REVIEW_REQUIRED: {
    label: 'Review pending',
    color: 'text-[var(--color-gh-review)]',
    dotColor: 'bg-[var(--color-gh-review)]',
  },
};

const URGENCY_WARNING_MS = 3 * 24 * 60 * 60 * 1000;
const URGENCY_CRITICAL_MS = 7 * 24 * 60 * 60 * 1000;

function getUrgencyLevel(dateString: string): 'normal' | 'warning' | 'critical' {
  const diffMs = Date.now() - new Date(dateString).getTime();
  if (diffMs >= URGENCY_CRITICAL_MS) return 'critical';
  if (diffMs >= URGENCY_WARNING_MS) return 'warning';
  return 'normal';
}

interface DashboardProps {
  inboxItems: InboxItem[];
  filters: CustomFilter[];
  onMarkInboxRead: (threadId: string) => void;
  onRefresh: () => void;
  isInboxLoading: boolean;
  userLogin?: string;
}

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
  const { fetch: fetchNeedsReview, refresh: refreshNeedsReview } = needsReviewView;
  const { fetch: fetchMyPrs, refresh: refreshMyPrs } = myPrsView;

  const needsReviewFilter = filters.find((f) => f.id === 'default-needs-review');
  const myPrsFilter = filters.find((f) => f.id === 'default-my-prs');

  useEffect(() => {
    if (needsReviewFilter && isSearchView(needsReviewFilter) && needsReviewFilter.searchQuery) {
      fetchNeedsReview(resolveQuery(needsReviewFilter.searchQuery, userLogin));
    }
  }, [needsReviewFilter, userLogin, fetchNeedsReview]);

  useEffect(() => {
    if (myPrsFilter && isSearchView(myPrsFilter) && myPrsFilter.searchQuery) {
      fetchMyPrs(resolveQuery(myPrsFilter.searchQuery, userLogin));
    }
  }, [myPrsFilter, userLogin, fetchMyPrs]);

  const handleRefreshAll = useCallback(() => {
    onRefresh();
    refreshNeedsReview();
    refreshMyPrs();
  }, [onRefresh, refreshNeedsReview, refreshMyPrs]);

  const notificationFilters = filters.filter((f) => !isSearchView(f));
  const unreadInboxItems = inboxItems.filter((item) => {
    if (!item.unread) return false;
    if (notificationFilters.length === 0) return true;
    return notificationFilters.some((filter) => {
      if (filter.reasons.length > 0 && !filter.reasons.includes(item.reason)) {
        return false;
      }
      if (filter.repositories && filter.repositories.length > 0) {
        if (!filter.repositories.includes(item.repositoryFullName)) return false;
      }
      return true;
    });
  });

  const isAnyLoading = isInboxLoading || needsReviewView.isLoading || myPrsView.isLoading;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
        <h2 className="text-base font-semibold">Dashboard</h2>
        <button
          onClick={handleRefreshAll}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
          title="Refresh all"
        >
          <RefreshIcon
            className={cn('w-4 h-4 text-muted-foreground', isAnyLoading && 'animate-spin')}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
        {needsReviewFilter && (
          <HeroSection
            title="Review these PRs"
            subtitle="These PRs are waiting for your review"
            count={needsReviewView.items.length}
            isLoading={needsReviewView.isLoading}
            error={needsReviewView.error}
            icon={<EyeIcon className="w-4 h-4" />}
          >
            {needsReviewView.items.length > 0 && (
              <SearchItemList items={needsReviewView.items} showReviewDecision showUrgency />
            )}
          </HeroSection>
        )}

        {myPrsFilter && (
          <DashboardSection
            title="Your open PRs"
            subtitle="Track review status of your pull requests"
            count={myPrsView.items.length}
            isLoading={myPrsView.isLoading}
            error={myPrsView.error}
            icon={<PRIcon className="w-3.5 h-3.5" />}
          >
            {myPrsView.items.length > 0 && (
              <SearchItemList items={myPrsView.items} showReviewDecision />
            )}
          </DashboardSection>
        )}

        <DashboardSection
          title="New notifications"
          subtitle="Unread notifications from your repositories"
          count={unreadInboxItems.length}
          isLoading={isInboxLoading && inboxItems.length === 0}
          icon={<BellIcon className="w-3.5 h-3.5" />}
        >
          {unreadInboxItems.length > 0 && (
            <InboxItemList items={unreadInboxItems} onMarkAsRead={onMarkInboxRead} />
          )}
        </DashboardSection>
      </div>
    </div>
  );
}

interface HeroSectionProps {
  title: string;
  subtitle: string;
  count: number;
  isLoading: boolean;
  error?: string | null;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function HeroSection({
  title,
  subtitle,
  count,
  isLoading,
  error,
  icon,
  children,
}: HeroSectionProps) {
  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/[0.03] overflow-hidden">
      <div className="px-4 py-3 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <div className="text-primary">{icon}</div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {!isLoading && count > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {count}
            </span>
          )}
          {isLoading && <Spinner size="sm" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 ml-6">{subtitle}</p>
      </div>

      <div>
        {error && <div className="px-4 py-3 text-sm text-destructive">{error}</div>}
        {!isLoading && !error && count === 0 && (
          <div className="px-4 py-5 text-sm text-muted-foreground text-center">
            All caught up! No PRs need your review.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

interface DashboardSectionProps {
  title: string;
  subtitle: string;
  count: number;
  isLoading: boolean;
  error?: string | null;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function DashboardSection({
  title,
  subtitle,
  count,
  isLoading,
  error,
  icon,
  children,
}: DashboardSectionProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {!isLoading && (
            <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
          )}
          {isLoading && <Spinner size="sm" />}
        </div>
        <p className="text-xs text-muted-foreground/70 mt-0.5 ml-[1.375rem]">{subtitle}</p>
      </div>

      <div>
        {error && <div className="px-4 py-3 text-sm text-destructive">{error}</div>}
        {!isLoading && !error && count === 0 && (
          <div className="px-4 py-4 text-sm text-muted-foreground text-center">None</div>
        )}
        {children}
      </div>
    </div>
  );
}

function SearchItemList({
  items,
  showReviewDecision,
  showUrgency = false,
}: {
  items: NotificationItem[];
  showReviewDecision: boolean;
  showUrgency?: boolean;
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
          showUrgency={showUrgency}
          onClick={() => handleClick(item)}
        />
      ))}
      {items.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors text-center"
        >
          {expanded ? 'Show less' : `Show ${items.length - DEFAULT_VISIBLE} more`}
        </button>
      )}
    </div>
  );
}

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
          {expanded ? 'Show less' : `Show ${items.length - DEFAULT_VISIBLE} more`}
        </button>
      )}
    </div>
  );
}

function SearchRow({
  item,
  showReviewDecision,
  showUrgency = false,
  onClick,
}: {
  item: NotificationItem;
  showReviewDecision: boolean;
  showUrgency?: boolean;
  onClick: () => void;
}) {
  const isPR = item.itemType === 'pullrequest';
  const reviewConfig = item.reviewDecision ? REVIEW_DECISION_CONFIG[item.reviewDecision] : null;
  const urgency = showUrgency ? getUrgencyLevel(item.updatedAt) : 'normal';
  const visibleLabels = item.labels.slice(0, 3);

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 cursor-pointer transition-colors border-b border-border/20 last:border-b-0',
        urgency === 'critical' && 'bg-destructive/[0.04]',
        urgency === 'warning' && 'bg-[var(--color-gh-review)]/[0.04]',
      )}
      onClick={onClick}
    >
      {showUrgency && (
        <div className="w-1.5 flex-shrink-0">
          {urgency === 'critical' && (
            <span
              className="block w-1.5 h-1.5 rounded-full bg-destructive"
              title="7+ days waiting"
            />
          )}
          {urgency === 'warning' && (
            <span
              className="block w-1.5 h-1.5 rounded-full bg-[var(--color-gh-review)]"
              title="3+ days waiting"
            />
          )}
        </div>
      )}

      <div className="flex-shrink-0">
        {isPR ? (
          <PRIcon className="w-4 h-4 text-[var(--color-gh-pr)]" />
        ) : (
          <IssueIcon className="w-4 h-4 text-[var(--color-gh-issue)]" />
        )}
      </div>

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
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[0.8125rem] text-muted-foreground">
            {item.repository.owner.login}/{item.repository.name}
            <span className="text-muted-foreground/50">#{item.number}</span>
          </span>
          {item.author && (
            <span className="text-[0.8125rem] text-muted-foreground/70 flex-shrink-0">
              @{item.author.login}
            </span>
          )}
          {visibleLabels.map((label) => (
            <LabelChip key={label.name} name={label.name} color={label.color} />
          ))}
          {item.labels.length > 3 && (
            <span className="text-xs text-muted-foreground/50">+{item.labels.length - 3}</span>
          )}
        </div>
      </div>

      {showReviewDecision && reviewConfig && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', reviewConfig.dotColor)} />
          <span className={cn('text-xs font-medium', reviewConfig.color)}>
            {reviewConfig.label}
          </span>
        </div>
      )}

      <span className="text-[0.8125rem] text-muted-foreground flex-shrink-0 tabular-nums">
        {formatRelativeTime(item.updatedAt)}
      </span>
    </div>
  );
}

function InboxRow({ item, onClick }: { item: InboxItem; onClick: () => void }) {
  const isPR = item.itemType === 'PullRequest';
  const isIssue = item.itemType === 'Issue';
  const reasonLabel = REASON_LABELS[item.reason] || item.reason;
  const colors = REASON_COLORS[item.reason] || { text: 'text-muted-foreground', bg: 'bg-accent' };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/30 cursor-pointer transition-colors border-b border-border/20 last:border-b-0"
      onClick={onClick}
    >
      <div className="w-1.5 flex-shrink-0">
        {item.unread && <span className="block w-1.5 h-1.5 rounded-full bg-primary" />}
      </div>

      <div className="flex-shrink-0">
        {isPR && <PRIcon className="w-4 h-4 text-[var(--color-gh-pr)]" />}
        {isIssue && <IssueIcon className="w-4 h-4 text-[var(--color-gh-issue)]" />}
        {!isPR && !isIssue && <BellIcon className="w-4 h-4 text-muted-foreground" />}
      </div>

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

      <span className="text-[0.8125rem] text-muted-foreground flex-shrink-0 tabular-nums">
        {formatRelativeTime(item.updatedAt)}
      </span>
    </div>
  );
}

function LabelChip({ name, color }: { name: string; color: string }) {
  // GitHubのラベルカラーは#なしのhexで渡されるため補完する
  const hex = color.startsWith('#') ? color : `#${color}`;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.6875rem] font-medium leading-none flex-shrink-0 max-w-[8rem] truncate"
      style={{
        backgroundColor: `${hex}20`,
        color: hex,
        border: `1px solid ${hex}40`,
      }}
    >
      {name}
    </span>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

function EyeIcon({ className }: { className?: string }) {
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
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
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
