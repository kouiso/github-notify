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
});
