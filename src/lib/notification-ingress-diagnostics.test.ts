import { describe, expect, it } from 'vitest';
import { classifyNotificationIngress } from './notification-ingress-diagnostics';

describe('classifyNotificationIngress', () => {
  it('classifies token or scope errors separately from an empty inbox', () => {
    const result = classifyNotificationIngress({
      rawCount: 0,
      visibleCount: 0,
      isLoading: false,
      error: 'No GitHub token configured',
      lastUpdated: null,
    });

    expect(result.cause).toBe('token_or_scope');
    expect(result.detail).toContain('token');
  });

  it('classifies GitHub API and network errors as communication failures', () => {
    const result = classifyNotificationIngress({
      rawCount: 0,
      visibleCount: 0,
      isLoading: false,
      error: 'GitHub API rate limit 429',
      lastUpdated: null,
    });

    expect(result.cause).toBe('communication_failure');
  });

  it('classifies the first unresolved load as polling pending', () => {
    const result = classifyNotificationIngress({
      rawCount: 0,
      visibleCount: 0,
      isLoading: true,
      error: null,
      lastUpdated: null,
    });

    expect(result.cause).toBe('polling_pending');
  });

  it('distinguishes a true empty GitHub response from filtered hidden notifications', () => {
    expect(
      classifyNotificationIngress({
        rawCount: 0,
        visibleCount: 0,
        isLoading: false,
        error: null,
        lastUpdated: new Date('2026-05-25T00:00:00Z'),
      }).cause,
    ).toBe('true_empty');

    const filtered = classifyNotificationIngress({
      rawCount: 3,
      visibleCount: 0,
      isLoading: false,
      error: null,
      lastUpdated: new Date('2026-05-25T00:00:00Z'),
    });

    expect(filtered.cause).toBe('filtered_empty');
    expect(filtered.detail).toContain('3 GitHub notification');
  });
});
