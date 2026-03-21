import { forwardRef, type KeyboardEvent, memo } from 'react';
import { cn } from '@/lib/utils/cn';
import type { InboxItem, NotificationItem } from '@/types';
import { REASON_LABELS } from '@/types/settings';
import { CheckIcon, IssueIcon, NotificationIcon, PRIcon } from './inbox-icons';

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

const REVIEW_DECISION_CONFIG: Record<string, { label: string; color: string }> = {
  APPROVED: { label: 'Approved', color: 'text-[var(--color-gh-done)]' },
  CHANGES_REQUESTED: { label: 'Changes', color: 'text-[var(--color-gh-fail)]' },
  REVIEW_REQUIRED: { label: 'Pending', color: 'text-[var(--color-gh-review)]' },
};

export function formatRelativeTime(dateString: string): string {
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

interface InboxRowProps {
  item: InboxItem;
  isSelected: boolean;
  isChecked: boolean;
  onCheckChange: (checked: boolean) => void;
  onClick: () => void;
  onMarkAsDone: () => void;
}

const handleDivKeyDown = (onClick: () => void) => (e: KeyboardEvent<HTMLDivElement>) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onClick();
  }
};

export const InboxRow = memo(
  forwardRef<HTMLDivElement, InboxRowProps>(
    ({ item, isSelected, isChecked, onCheckChange, onClick, onMarkAsDone }, ref) => {
      const isPR = item.itemType === 'PullRequest';
      const isIssue = item.itemType === 'Issue';
      const reasonLabel = REASON_LABELS[item.reason] || item.reason;
      const colors = REASON_COLORS[item.reason] || {
        text: 'text-muted-foreground',
        bg: 'bg-accent',
      };

      return (
        <div
          ref={ref}
          className={cn(
            'inbox-row flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer group border-b border-border/30',
            item.unread ? 'bg-background' : 'bg-background/60',
            isSelected && 'bg-accent',
            !isSelected && 'hover:bg-accent/30',
          )}
        >
          <div className="w-1.5 flex-shrink-0">
            {item.unread && <span className="block w-1.5 h-1.5 rounded-full bg-primary" />}
          </div>

          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              onCheckChange(e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          />

          <div className="flex-shrink-0">
            {isPR && <PRIcon className="w-4.5 h-4.5 text-[var(--color-gh-pr)]" />}
            {isIssue && <IssueIcon className="w-4.5 h-4.5 text-[var(--color-gh-issue)]" />}
            {!isPR && !isIssue && (
              <NotificationIcon className="w-4.5 h-4.5 text-muted-foreground" />
            )}
          </div>

          <div
            className="flex-1 min-w-0"
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={handleDivKeyDown(onClick)}
          >
            <span
              className={cn(
                'text-[0.9375rem] truncate block leading-snug',
                item.unread ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {item.title}
            </span>
            <div className="flex items-center gap-2 mt-1">
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

          <div className="row-actions flex-shrink-0">
            <button
              type="button"
              className="p-1 rounded hover:bg-accent transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsDone();
              }}
            >
              <CheckIcon className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      );
    },
  ),
);

InboxRow.displayName = 'InboxRow';

interface SearchRowProps {
  item: NotificationItem;
  onClick: () => void;
}

export const SearchRow = memo(({ item, onClick }: SearchRowProps) => {
  const isPR = item.itemType === 'pullrequest';
  const reviewConfig = item.reviewDecision ? REVIEW_DECISION_CONFIG[item.reviewDecision] : null;

  return (
    <div
      className="inbox-row flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-b border-border/30 hover:bg-accent/30"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleDivKeyDown(onClick)}
    >
      <div className="flex-shrink-0">
        {isPR ? (
          <PRIcon className="w-4.5 h-4.5 text-[var(--color-gh-pr)]" />
        ) : (
          <IssueIcon className="w-4.5 h-4.5 text-[var(--color-gh-issue)]" />
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
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[0.8125rem] text-muted-foreground truncate">
            {item.repository.owner.login}/{item.repository.name}
          </span>
          {item.author && (
            <span className="text-[0.8125rem] text-muted-foreground/70 flex-shrink-0">
              by @{item.author.login}
            </span>
          )}
          {reviewConfig && (
            <span className={cn('text-xs font-medium flex-shrink-0', reviewConfig.color)}>
              {reviewConfig.label}
            </span>
          )}
        </div>
      </div>

      <span className="text-[0.8125rem] text-muted-foreground flex-shrink-0 tabular-nums">
        {formatRelativeTime(item.updatedAt)}
      </span>
    </div>
  );
});

SearchRow.displayName = 'SearchRow';
