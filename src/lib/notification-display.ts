export const REASON_COLORS: Record<string, { text: string; bg: string }> = {
  review_requested: { text: 'text-[var(--color-gh-pr)]', bg: 'bg-[var(--color-gh-review-bg)]' },
  mention: { text: 'text-[var(--color-gh-mention)]', bg: 'bg-[var(--color-gh-mention-bg)]' },
  team_mention: { text: 'text-[var(--color-gh-mention)]', bg: 'bg-[var(--color-gh-mention-bg)]' },
  assign: { text: 'text-[var(--color-gh-assign)]', bg: 'bg-[var(--color-gh-assign-bg)]' },
  author: { text: 'text-muted-foreground', bg: 'bg-accent' },
  ci_activity: { text: 'text-[var(--color-gh-ci)]', bg: 'bg-[var(--color-gh-ci-bg)]' },
  comment: { text: 'text-muted-foreground', bg: 'bg-accent' },
  state_change: { text: 'text-muted-foreground', bg: 'bg-accent' },
};

export const REVIEW_DECISION_CONFIG: Record<
  string,
  { label: string; color: string; dotColor?: string }
> = {
  APPROVED: {
    label: 'Approved',
    color: 'text-[var(--color-gh-done)]',
    dotColor: 'bg-[var(--color-gh-done)]',
  },
  CHANGES_REQUESTED: {
    label: 'Changes',
    color: 'text-[var(--color-gh-fail)]',
    dotColor: 'bg-[var(--color-gh-fail)]',
  },
  REVIEW_REQUIRED: {
    label: 'Pending',
    color: 'text-[var(--color-gh-review)]',
    dotColor: 'bg-[var(--color-gh-review)]',
  },
};
