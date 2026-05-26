#!/usr/bin/env node

const ENGLISH_PLACEHOLDER_PATTERN = /\b(tbd|todo|n\/a|none)\b/i;
const JAPANESE_PLACEHOLDER_PATTERN = /^(?:未定|なし|後で|あとで|未実施)$/;
const TEMPLATE_PROMPT_PATTERNS = [
  /^How this change moves github-notify toward zero missed GitHub notifications, review requests, mentions, or CI results:$/i,
  /^Expected:$/i,
  /^Actual:$/i,
  /^Filters\/search\/groups:$/i,
  /^Empty\/error\/polling states:$/i,
  /^Bot\/human\/CI\/review separation:$/i,
  /^Commands, logs, screenshots, or PR status evidence:$/i,
  /^Bot comments:$/i,
  /^CI:$/i,
];

const REQUIRED_SECTIONS = [
  {
    key: 'contribution',
    label: 'notification-loss prevention contribution',
    headingPattern:
      /(?:notification-loss prevention contribution|取り溢しゼロへの寄与|通知漏れ防止への寄与)/i,
  },
  {
    key: 'expectedActual',
    label: 'expected vs actual evidence',
    headingPattern: /(?:expected vs actual|期待\s*vs\s*実測|期待値と実測)/i,
    validate: (section) => /expected|期待/i.test(section) && /actual|実測/i.test(section),
  },
  {
    key: 'regression',
    label: 'adjacent regression proof',
    headingPattern: /(?:adjacent regression|隣接 regression|隣接回帰|回帰確認)/i,
  },
  {
    key: 'verification',
    label: 'test/log/screenshot evidence',
    headingPattern: /(?:verification|test\/log\/screenshot|検証|証跡|evidence)/i,
    validate: (section) =>
      /\b(pnpm|cargo|gh|curl|npm|yarn|bun)\b/.test(section) ||
      /https?:\/\/\S+/.test(section) ||
      /(?:\.log|\.png|\.jpg|\.webp|screenshot|スクリーンショット)/i.test(section),
  },
];

export function validatePrEvidenceGate(body) {
  const normalizedBody = (body ?? '').trim();
  const errors = [];

  if (!normalizedBody) {
    return ['PR body is empty; merge evidence gate cannot verify notification-loss coverage.'];
  }

  for (const section of REQUIRED_SECTIONS) {
    const content = extractSection(normalizedBody, section.headingPattern);
    if (!content) {
      errors.push(`Missing ${section.label} section.`);
      continue;
    }
    if (isPlaceholderOnly(content)) {
      errors.push(`${section.label} section still contains only placeholder text.`);
      continue;
    }
    if (section.validate && !section.validate(content)) {
      errors.push(`${section.label} section does not include required evidence detail.`);
    }
  }

  return errors;
}

export function formatGateErrors(errors) {
  return [
    'Merge evidence gate failed. Before merge, every github-notify PR must show:',
    '- notification-loss prevention contribution',
    '- expected vs actual evidence',
    '- adjacent regression proof',
    '- test/log/screenshot evidence',
    '',
    ...errors.map((error) => `- ${error}`),
  ].join('\n');
}

function extractSection(body, headingPattern) {
  const lines = body.split(/\r?\n/);
  const startIndex = lines.findIndex(
    (line) => isMarkdownHeading(line) && headingPattern.test(stripMarkdownHeading(line)),
  );
  if (startIndex === -1) return null;

  const sectionLines = [];
  for (const line of lines.slice(startIndex + 1)) {
    if (/^\s{0,3}#{1,6}\s+\S/.test(line)) break;
    sectionLines.push(line);
  }
  return sectionLines.join('\n').trim();
}

function stripMarkdownHeading(line) {
  return line.replace(/^\s{0,3}#{1,6}\s+/, '').trim();
}

function isMarkdownHeading(line) {
  return /^\s{0,3}#{1,6}\s+\S/.test(line);
}

function isPlaceholderOnly(section) {
  const meaningful = section
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^[-*]\s*\[[ x]\]\s*/i, '')
        .replace(/^[-*]\s*/, '')
        .trim(),
    )
    .filter(Boolean);

  return meaningful.length === 0 || meaningful.every(isPlaceholderLine);
}

function isPlaceholderLine(line) {
  return (
    ENGLISH_PLACEHOLDER_PATTERN.test(line) ||
    JAPANESE_PLACEHOLDER_PATTERN.test(line) ||
    TEMPLATE_PROMPT_PATTERNS.some((pattern) => pattern.test(line))
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const body = process.env.PR_BODY ?? '';
  const errors = validatePrEvidenceGate(body);
  if (errors.length > 0) {
    process.stderr.write(`${formatGateErrors(errors)}\n`);
    process.exit(1);
  }
  process.stdout.write('Merge evidence gate passed.\n');
}
