import { open } from '@tauri-apps/plugin-shell';
import type React from 'react';
import { useState } from 'react';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import type { NotificationItem } from '@/types';
import { GearIcon, IssueIcon, PRIcon } from './dashboard-icons';

const DEFAULT_VISIBLE = 5;

const REVIEW_DECISION_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  APPROVED: {
    label: '承認済み',
    color: 'text-[var(--color-gh-done)]',
    dotColor: 'bg-[var(--color-gh-done)]',
  },
  CHANGES_REQUESTED: {
    label: '修正リクエスト',
    color: 'text-[var(--color-gh-fail)]',
    dotColor: 'bg-[var(--color-gh-fail)]',
  },
  REVIEW_REQUIRED: {
    label: 'レビュー待ち',
    color: 'text-[var(--color-gh-review)]',
    dotColor: 'bg-[var(--color-gh-review)]',
  },
};

const URGENCY_WARNING_MS = 3 * 24 * 60 * 60 * 1000;
const URGENCY_CRITICAL_MS = 7 * 24 * 60 * 60 * 1000;

const getUrgencyLevel = (dateString: string): 'normal' | 'warning' | 'critical' => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  if (diffMs >= URGENCY_CRITICAL_MS) return 'critical';
  if (diffMs >= URGENCY_WARNING_MS) return 'warning';
  return 'normal';
};

const formatRelativeTime = (dateString: string): string => {
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
};

interface HeroSectionProps {
  title: string;
  subtitle: string;
  count: number;
  isLoading: boolean;
  error?: string | null;
  icon: React.ReactNode;
  children: React.ReactNode;
  onSettings?: () => void;
}

export const HeroSection = ({
  title,
  subtitle,
  count,
  isLoading,
  error,
  icon,
  children,
  onSettings,
}: HeroSectionProps) => {
  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary/[0.03] overflow-hidden">
      <div className="px-4 py-3 border-b border-primary/10 sticky top-0 z-10 bg-primary/[0.03] backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="text-primary">{icon}</div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {!isLoading && count > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {count}
            </span>
          )}
          {isLoading && <Spinner size="sm" />}
          {onSettings && (
            <button
              type="button"
              onClick={onSettings}
              className="ml-auto p-1 rounded-md hover:bg-accent/50 transition-colors"
              title="レビュー対象ルールを設定"
            >
              <GearIcon className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 ml-6">{subtitle}</p>
        {!isLoading && count > 0 && (
          <div className="flex items-center gap-3 mt-1.5 ml-6">
            <span className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive inline-block" />
              7日以上
            </span>
            <span className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gh-review)] inline-block" />
              3日以上
            </span>
          </div>
        )}
      </div>

      <div>
        {error && <div className="px-4 py-3 text-sm text-destructive">{error}</div>}
        {!isLoading && !error && count === 0 && (
          <div className="px-4 py-5 text-sm text-muted-foreground text-center">
            レビュー待ちのPRはありません
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

interface DashboardSectionProps {
  title: string;
  subtitle: string;
  count: number;
  isLoading: boolean;
  error?: string | null;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export const DashboardSection = ({
  title,
  subtitle,
  count,
  isLoading,
  error,
  icon,
  children,
}: DashboardSectionProps) => {
  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/30 sticky top-0 z-10 bg-card backdrop-blur-sm">
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
          <div className="px-4 py-4 text-sm text-muted-foreground text-center">なし</div>
        )}
        {children}
      </div>
    </div>
  );
};

export const SearchItemList = ({
  items,
  showReviewDecision,
  showUrgency = false,
}: {
  items: NotificationItem[];
  showReviewDecision: boolean;
  showUrgency?: boolean;
}) => {
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
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors text-center"
        >
          {expanded ? '折りたたむ' : `他 ${items.length - DEFAULT_VISIBLE} 件を表示`}
        </button>
      )}
    </div>
  );
};

const handleKeyDown = (onClick: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onClick();
  }
};

const SearchRow = ({
  item,
  showReviewDecision,
  showUrgency = false,
  onClick,
}: {
  item: NotificationItem;
  showReviewDecision: boolean;
  showUrgency?: boolean;
  onClick: () => void;
}) => {
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
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown(onClick)}
    >
      {showUrgency && (
        <div className="w-1.5 flex-shrink-0">
          {urgency === 'critical' && (
            <span
              className="block w-1.5 h-1.5 rounded-full bg-destructive"
              title="7日以上レビュー待ち"
            />
          )}
          {urgency === 'warning' && (
            <span
              className="block w-1.5 h-1.5 rounded-full bg-[var(--color-gh-review)]"
              title="3日以上レビュー待ち"
            />
          )}
        </div>
      )}

      {item.author?.avatarUrl ? (
        <img
          src={item.author.avatarUrl}
          alt={item.author.login}
          className="w-6 h-6 rounded-full flex-shrink-0"
        />
      ) : (
        <div className="flex-shrink-0">
          {isPR ? (
            <PRIcon className="w-4 h-4 text-[var(--color-gh-pr)]" />
          ) : (
            <IssueIcon className="w-4 h-4 text-[var(--color-gh-issue)]" />
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[0.9375rem] text-foreground truncate leading-snug">
            {item.title}
          </span>
          {item.isDraft && (
            <span className="text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded flex-shrink-0">
              下書き
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
};

const LabelChip = ({ name, color }: { name: string; color: string }) => {
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
};
