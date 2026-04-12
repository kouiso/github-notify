import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchView } from '@/hooks/use-search-view';
import { cn } from '@/lib/utils/cn';
import type { CustomFilter, RepositoryGroup } from '@/types/settings';
import { isSearchView } from '@/types/settings';
import { ChevronIcon, EyeIcon, FunnelIcon, PRIcon, RefreshIcon } from './dashboard-icons';
import { DashboardSection, HeroSection, SearchItemList } from './dashboard-section';

interface DashboardProps {
  filters: CustomFilter[];
  onRefresh: () => void;
  userLogin?: string;
  activeGroup?: RepositoryGroup;
  onOpenReviewSettings?: () => void;
}

const resolveQuery = (query: string, userLogin?: string): string => {
  if (!userLogin) return query;
  return query.replace(/@me\b/g, userLogin);
};

export const Dashboard = ({
  filters,
  onRefresh,
  userLogin,
  activeGroup,
  onOpenReviewSettings,
}: DashboardProps) => {
  const needsReviewView = useSearchView();
  const myPrsView = useSearchView();
  const { fetch: fetchNeedsReview, refresh: refreshNeedsReview } = needsReviewView;
  const { fetch: fetchMyPrs, refresh: refreshMyPrs } = myPrsView;

  const [selectedRepo, setSelectedRepo] = useState('all');
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const needsReviewFilter = filters.find((f) => f.id === 'default-needs-review');
  const myPrsFilter = filters.find((f) => f.id === 'default-my-prs');

  const buildQuery = useCallback(
    (baseQuery: string): string => {
      let q = resolveQuery(baseQuery, userLogin);
      if (selectedRepo !== 'all') {
        q += ` org:${selectedRepo}`;
      }
      if (activeGroup && activeGroup.repositories.length > 0) {
        q += ' ' + activeGroup.repositories.map((r) => `repo:${r}`).join(' ');
      }
      return q;
    },
    [userLogin, selectedRepo, activeGroup],
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

  const knownOrgsRef = useRef(new Set<string>());
  const repoOrgs = useMemo(() => {
    for (const item of [...needsReviewView.items, ...myPrsView.items]) {
      if (item.repository?.owner?.login) {
        knownOrgsRef.current.add(item.repository.owner.login);
      }
    }
    return [...knownOrgsRef.current].sort();
  }, [needsReviewView.items, myPrsView.items]);

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

  const handleDropdownKeyDown = (handler: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">ダッシュボード</h2>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
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
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedRepo('all');
                    setRepoDropdownOpen(false);
                  }}
                  onKeyDown={handleDropdownKeyDown(() => {
                    setSelectedRepo('all');
                    setRepoDropdownOpen(false);
                  })}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors cursor-pointer',
                    selectedRepo === 'all' && 'font-medium text-primary',
                  )}
                >
                  すべて
                </div>
                {repoOrgs.map((org) => (
                  <div
                    key={org}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedRepo(org);
                      setRepoDropdownOpen(false);
                    }}
                    onKeyDown={handleDropdownKeyDown(() => {
                      setSelectedRepo(org);
                      setRepoDropdownOpen(false);
                    })}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors cursor-pointer',
                      selectedRepo === org && 'font-medium text-primary',
                    )}
                  >
                    {org}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
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
};
