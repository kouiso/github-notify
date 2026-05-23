#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const rustFiles = process.argv.slice(2).filter((file) => file.endsWith('.rs'));
const riskyWords = /(token|Authorization|Bearer)/i;
const interpolation = /\{[^\n}]*\}/;
const namedInterpolation =
  /\{[^}\n]*(token|github_token|access_token|bearer|authorization|err|error|e)[^}\n]*\}/i;
const sensitiveArgument =
  /,\s*&?[a-zA-Z_][a-zA-Z0-9_]*(token|secret|credential|authorization|bearer|err|error|e)\b/i;
const riskyMacroStart = /(format!|println!|log::(?:trace|debug|info|warn|error)!)\s*\(/;

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
  const invocations = collectInvocations(source);
  for (const { text, lineNumber } of invocations) {
    if (isRiskyLine(text)) {
      violations.push(`${file}:${lineNumber}: direct token logging: ${text.trim()}`);
    }
  }
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

function collectInvocations(source) {
  const lines = source.split(/\r?\n/);
  const invocations = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!riskyMacroStart.test(line)) {
      invocations.push({ text: line, lineNumber: index + 1 });
      continue;
    }

    const startLine = index + 1;
    const parts = [line];
    let balance = parenBalance(line);

    while (balance > 0 && index + 1 < lines.length) {
      index += 1;
      parts.push(lines[index]);
      balance += parenBalance(lines[index]);
    }

    invocations.push({ text: parts.join('\n'), lineNumber: startLine });
  }

  return invocations;
}

function parenBalance(line) {
  let balance = 0;
  for (const char of line) {
    if (char === '(') balance += 1;
    if (char === ')') balance -= 1;
  }
  return balance;
}
