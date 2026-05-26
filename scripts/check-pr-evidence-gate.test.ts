import { describe, expect, it } from 'vitest';
import { validatePrEvidenceGate } from './check-pr-evidence-gate.mjs';

const validBody = `## Summary

Adds a guardrail.

## Notification-loss prevention contribution

Keeps review request, mention, and CI notification fixes from merging without proof.

## Expected vs actual

- Expected: PR includes a concrete ingress or processing evidence line.
- Actual: PR body includes command output and observed notification count.

## Adjacent regression proof

Custom filters, unread empty state, and bot comment labels were checked.

## Verification

- pnpm test -- run src/lib/notification-priority.test.ts
- gh pr view 43 --json statusCheckRollup
`;

describe('validatePrEvidenceGate', () => {
  it('accepts a PR body with all required merge evidence sections', () => {
    expect(validatePrEvidenceGate(validBody)).toEqual([]);
  });

  it('rejects missing expected vs actual evidence', () => {
    const errors = validatePrEvidenceGate(validBody.replace('## Expected vs actual', '## Notes'));

    expect(errors).toContain('Missing expected vs actual evidence section.');
  });

  it('rejects placeholder-only verification evidence', () => {
    const errors = validatePrEvidenceGate(
      validBody.replace(
        '- pnpm test -- run src/lib/notification-priority.test.ts\n- gh pr view 43 --json statusCheckRollup',
        'TBD',
      ),
    );

    expect(errors).toContain(
      'test/log/screenshot evidence section still contains only placeholder text.',
    );
  });

  it('rejects Japanese placeholder-only evidence', () => {
    const errors = validatePrEvidenceGate(validBody.replace('## Verification', '## Verification'));
    const japanesePlaceholderBody = validBody.replace(
      '- pnpm test -- run src/lib/notification-priority.test.ts\n- gh pr view 43 --json statusCheckRollup',
      '未実施',
    );

    expect(errors).toEqual([]);
    expect(validatePrEvidenceGate(japanesePlaceholderBody)).toContain(
      'test/log/screenshot evidence section still contains only placeholder text.',
    );
  });

  it('requires both expected and actual detail in expected-vs-actual evidence', () => {
    const errors = validatePrEvidenceGate(
      validBody.replace(
        '- Expected: PR includes a concrete ingress or processing evidence line.\n- Actual: PR body includes command output and observed notification count.',
        '- Expected: PR includes a concrete ingress or processing evidence line.',
      ),
    );

    expect(errors).toContain(
      'expected vs actual evidence section does not include required evidence detail.',
    );
  });

  it('rejects the unchanged PR template prompts', () => {
    const unchangedTemplateBody = `## Summary

-

## Notification-loss Prevention Contribution

- How this change moves github-notify toward zero missed GitHub notifications, review requests, mentions, or CI results:

## Expected vs Actual

- Expected:
- Actual:

## Adjacent Regression Proof

- Filters/search/groups:
- Empty/error/polling states:
- Bot/human/CI/review separation:

## Verification

- Commands, logs, screenshots, or PR status evidence:

## Bot and CI Resolution

- Bot comments:
- CI:
`;

    expect(validatePrEvidenceGate(unchangedTemplateBody)).toEqual([
      'notification-loss prevention contribution section still contains only placeholder text.',
      'expected vs actual evidence section still contains only placeholder text.',
      'adjacent regression proof section still contains only placeholder text.',
      'test/log/screenshot evidence section still contains only placeholder text.',
    ]);
  });
});
