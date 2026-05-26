export type NotificationIngressCause =
  | 'polling_pending'
  | 'token_or_scope'
  | 'communication_failure'
  | 'true_empty'
  | 'filtered_empty'
  | 'ok';

export interface NotificationIngressDiagnostics {
  cause: NotificationIngressCause;
  title: string;
  detail: string;
  rawCount: number;
  visibleCount: number;
}

interface DiagnosticInput {
  rawCount: number;
  visibleCount: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const TOKEN_ERROR_PATTERN = /token|scope|auth|credential|permission|401|403/i;
const COMMUNICATION_ERROR_PATTERN = /network|fetch|timeout|rate limit|429|api|github/i;

export function classifyNotificationIngress({
  rawCount,
  visibleCount,
  isLoading,
  error,
  lastUpdated,
}: DiagnosticInput): NotificationIngressDiagnostics {
  if (error) {
    if (TOKEN_ERROR_PATTERN.test(error)) {
      return {
        cause: 'token_or_scope',
        title: 'Notification access needs attention',
        detail:
          'Check the GitHub token and notification scope before assuming there are no notifications.',
        rawCount,
        visibleCount,
      };
    }

    if (COMMUNICATION_ERROR_PATTERN.test(error)) {
      return {
        cause: 'communication_failure',
        title: 'GitHub notification fetch failed',
        detail:
          'Retry after checking network/API status; the inbox may not reflect GitHub right now.',
        rawCount,
        visibleCount,
      };
    }

    return {
      cause: 'communication_failure',
      title: 'Notification fetch failed',
      detail: 'The inbox did not refresh successfully; use Retry before marking the queue clear.',
      rawCount,
      visibleCount,
    };
  }

  if (isLoading && !lastUpdated) {
    return {
      cause: 'polling_pending',
      title: 'Checking GitHub notifications',
      detail: 'Initial polling is still running; notification count is not final yet.',
      rawCount,
      visibleCount,
    };
  }

  if (!isLoading && rawCount === 0) {
    return {
      cause: 'true_empty',
      title: 'No GitHub notifications returned',
      detail: 'GitHub returned zero inbox items for the current token.',
      rawCount,
      visibleCount,
    };
  }

  if (!isLoading && rawCount > 0 && visibleCount === 0) {
    return {
      cause: 'filtered_empty',
      title: 'Notifications are hidden by filters',
      detail: `${rawCount} GitHub notification(s) were fetched, but the current filters hide all of them.`,
      rawCount,
      visibleCount,
    };
  }

  return {
    cause: 'ok',
    title: 'Notifications loaded',
    detail: `${visibleCount} of ${rawCount} GitHub notification(s) are visible.`,
    rawCount,
    visibleCount,
  };
}
