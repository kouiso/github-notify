import { open } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/components/ui';
import { useSearchView } from '@/hooks/use-search-view';
import { cn } from '@/lib/utils/cn';
import type { NotificationItem } from '@/types';
import type { CustomFilter } from '@/types/settings';
import { isSearchView } from '@/types/settings';

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

function getUrgencyLevel(dateString: string): 'normal' | 'warning' | 'critical' {
  const diffMs = Date.now() - new Date(dateString).getTime();
  if (diffMs >= URGENCY_CRITICAL_MS) return 'critical';
  if (diffMs >= URGENCY_WARNING_MS) return 'warning';
  return 'normal';
}

interface DashboardProps {
  filters: CustomFilter[];
  onRefresh: () => void;
  userLogin?: string;
  onOpenReviewSettings?: () => void;
}

function resolveQuery(query: string, userLogin?: string): string {
  if (!userLogin) return query;
  return query.replace(/@me\b/g, userLogin);
}

export function Dashboard({ filters, onRefresh, userLogin, onOpenReviewSettings }: DashboardProps) {
  const needsReviewView = useSearchView();
  const myPrsView = useSearchView();
  const { fetch: fetchNeedsReview, refresh: refreshNeedsReview } = needsReviewView;
  const { fetch: fetchMyPrs, refresh: refreshMyPrs } = myPrsView;

  // リポジトリフィルタ（"all" = 全リポジトリ, それ以外 = "owner/" プレフィックス）
  const [selectedRepo, setSelectedRepo] = useState('all');
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const needsReviewFilter = filters.find((f) => f.id === 'default-needs-review');
  const myPrsFilter = filters.find((f) => f.id === 'default-my-prs');

  // リポジトリフィルタ付きクエリを構築
  const buildQuery = useCallback(
    (baseQuery: string): string => {
      let q = resolveQuery(baseQuery, userLogin);
      if (selectedRepo !== 'all') {
        q += ` org:${selectedRepo}`;
      }
      return q;
    },
    [userLogin, selectedRepo],
  );

  useEffect(() => {
    if (needsReviewFilter && isSearchView(needsReviewFilter) && needsReviewFilter.searchQuery) {
      fetchNeedsReview(
        buildQuery(needsReviewFilter.searchQuery),
        needsReviewFilter.issueStatusRules,
      );
    }
  }, [needsReviewFilter, buildQuery, fetchNeedsReview]);

  useEffect(() => {
    if (myPrsFilter && isSearchView(myPrsFilter) && myPrsFilter.searchQuery) {
      fetchMyPrs(buildQuery(myPrsFilter.searchQuery));
    }
  }, [myPrsFilter, buildQuery, fetchMyPrs]);

  // org一覧は結果が増えたときだけ蓄積する（フィルタ切替で消えないように）
  const knownOrgsRef = useRef(new Set<string>());
  const repoOrgs = useMemo(() => {
    for (const item of [...needsReviewView.items, ...myPrsView.items]) {
      if (item.repository?.owner?.login) {
        knownOrgsRef.current.add(item.repository.owner.login);
      }
    }
    return [...knownOrgsRef.current].sort();
  }, [needsReviewView.items, myPrsView.items]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!repoDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        e.target instanceof Node &&
        !dropdownRef.current.contains(e.target)
      ) {
        setRepoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [repoDropdownOpen]);

  const handleRefreshAll = useCallback(() => {
    onRefresh();
    refreshNeedsReview();
    refreshMyPrs();
  }, [onRefresh, refreshNeedsReview, refreshMyPrs]);

  const isAnyLoading = needsReviewView.isLoading || myPrsView.isLoading;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">ダッシュボード</h2>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors border',
                selectedRepo === 'all'
                  ? 'text-muted-foreground border-border/50 hover:bg-accent/50'
                  : 'text-foreground border-primary/40 bg-primary/10',
              )}
            >
              <FunnelIcon className="w-3 h-3" />
              <span>{selectedRepo === 'all' ? 'すべて' : selectedRepo}</span>
              <ChevronIcon className="w-3 h-3" />
            </button>
            {repoDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 min-w-[10rem] rounded-md border border-border bg-popover shadow-lg z-20 py-1">
                <button
                  onClick={() => {
                    setSelectedRepo('all');
                    setRepoDropdownOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors',
                    selectedRepo === 'all' && 'font-medium text-primary',
                  )}
                >
                  すべて
                </button>
                {repoOrgs.map((org) => (
                  <button
                    key={org}
                    onClick={() => {
                      setSelectedRepo(org);
                      setRepoDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors',
                      selectedRepo === org && 'font-medium text-primary',
                    )}
                  >
                    {org}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleRefreshAll}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
          title="すべて更新"
        >
          <RefreshIcon
            className={cn('w-4 h-4 text-muted-foreground', isAnyLoading && 'animate-spin')}
          />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-4">
        {needsReviewFilter && (
          <HeroSection
            title="レビューするPR"
            subtitle="あなたがレビュワーに指定されていて、まだレビューしていないPRです"
            count={needsReviewView.items.length}
            isLoading={needsReviewView.isLoading}
            error={needsReviewView.error}
            icon={<EyeIcon className="w-4 h-4" />}
            onSettings={onOpenReviewSettings}
          >
            {needsReviewView.items.length > 0 && (
              <SearchItemList items={needsReviewView.items} showReviewDecision showUrgency />
            )}
          </HeroSection>
        )}

        {myPrsFilter && (
          <DashboardSection
            title="自分のPR"
            subtitle="自分が作成したオープン中のPRと、そのレビュー状況です"
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
  onSettings?: () => void;
}

function HeroSection({
  title,
  subtitle,
  count,
  isLoading,
  error,
  icon,
  children,
  onSettings,
}: HeroSectionProps) {
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
          {expanded ? '折りたたむ' : `他 ${items.length - DEFAULT_VISIBLE} 件を表示`}
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

function FunnelIcon({ className }: { className?: string }) {
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
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
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
