#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const rustFiles = process.argv.slice(2).filter((file) => file.endsWith('.rs'));
const riskyWords = /(token|Authorization|Bearer)/i;
const interpolation = /\{[^\n}]*\}/;
const namedInterpolation =
  /\{[^}\n]*(token|github_token|access_token|bearer|authorization|err|error|e)[^}\n]*\}/i;
const sensitiveArgument =
  /,\s*&?[a-zA-Z_][a-zA-Z0-9_]*(token|secret|credential|authorization|bearer|err|error|e)\b/i;

function isRiskyLine(line) {
  if (!riskyWords.test(line)) return false;
  if (line.includes('.header(')) return false;

  const usesRiskyMacro =
    /format!\s*\(/.test(line) ||
    /println!\s*\(/.test(line) ||
    /log::(?:trace|debug|info|warn|error)!\s*\(/.test(line);

  return (
    usesRiskyMacro &&
    interpolation.test(line) &&
    (sensitiveArgument.test(line) || namedInterpolation.test(line))
  );
}

const violations = [];

for (const file of rustFiles) {
  const source = readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isRiskyLine(line)) {
      violations.push(`${file}:${index + 1}: direct token logging: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  process.stderr.write(
    `${[
      'Potential token logging detected. Never log full tokens; use redacted values or last-4 chars only.',
      ...violations,
    ].join('\n')}\n`,
  );
  process.exit(1);
}
