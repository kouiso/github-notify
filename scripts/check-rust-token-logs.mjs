#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const rustFiles = process.argv.slice(2).filter((file) => file.endsWith('.rs'));
const riskyWords = /(token|Authorization|Bearer)/i;
const interpolation = /\{[^\n}]*\}/;
const namedInterpolation =
  /\{\s*(?:[a-zA-Z_][a-zA-Z0-9_]*(?:token|secret|credential|authorization|bearer)[a-zA-Z0-9_]*|err|error)\s*(?::[^}\n]*)?\}/i;
const sensitiveArgument =
  /,(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*&?(?:[a-zA-Z_][a-zA-Z0-9_]*(?:token|secret|credential|authorization|bearer)[a-zA-Z0-9_]*|err|error)\b/i;
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
    const literalState = { blockComment: false, quote: null, rawStringEnd: null };
    let balance = parenBalance(line, literalState);

    while (balance > 0 && index + 1 < lines.length) {
      index += 1;
      parts.push(lines[index]);
      balance += parenBalance(lines[index], literalState);
    }

    invocations.push({ text: parts.join('\n'), lineNumber: startLine });
  }

  return invocations;
}

function parenBalance(
  line,
  literalState = { blockComment: false, quote: null, rawStringEnd: null },
) {
  let balance = 0;
  for (const char of stripRustLiterals(line, literalState)) {
    if (char === '(') balance += 1;
    if (char === ')') balance -= 1;
  }
  return balance;
}

function stripRustLiterals(line, literalState) {
  let result = '';

  for (let index = 0; index < line.length; index += 1) {
    const activeLiteral = consumeActiveLiteral(line, index, literalState);
    if (activeLiteral) {
      if (activeLiteral.open) return result;
      index = activeLiteral.end;
      continue;
    }

    const char = line[index];
    const newComment = consumeNewComment(line, index, literalState);
    if (newComment) {
      if (newComment.open) return result;
      index = newComment.end;
      continue;
    }

    const newLiteral = consumeNewLiteral(line, index, literalState);
    if (newLiteral) {
      if (newLiteral.literalChar) result += newLiteral.literalChar;
      if (newLiteral.open) return result;
      index = newLiteral.end;
      continue;
    }

    result += char;
  }

  return result;
}

function consumeActiveLiteral(line, index, literalState) {
  if (literalState.blockComment) {
    const endIndex = line.indexOf('*/', index);
    if (endIndex === -1) return { open: true };
    literalState.blockComment = false;
    return { open: false, end: endIndex + 1 };
  }

  if (literalState.rawStringEnd) {
    const endIndex = line.indexOf(literalState.rawStringEnd, index);
    if (endIndex === -1) return { open: true };
    const end = endIndex + literalState.rawStringEnd.length - 1;
    literalState.rawStringEnd = null;
    return { open: false, end };
  }

  if (literalState.quote) {
    const quoted = skipQuotedLiteral(line, index - 1, literalState.quote);
    if (!quoted.closed) return { open: true };
    literalState.quote = null;
    return { open: false, end: quoted.end };
  }

  return null;
}

function consumeNewComment(line, index, literalState) {
  if (line[index] !== '/') return null;
  if (line[index + 1] === '/') return { open: true };
  if (line[index + 1] !== '*') return null;

  const endIndex = line.indexOf('*/', index + 2);
  if (endIndex === -1) {
    literalState.blockComment = true;
    return { open: true };
  }
  return { open: false, end: endIndex + 1 };
}

function consumeNewLiteral(line, index, literalState) {
  const rawString = rawStringDelimiter(line, index);
  if (rawString) {
    const endIndex = line.indexOf(rawString.end, rawString.contentStart);
    if (endIndex === -1) {
      literalState.rawStringEnd = rawString.end;
      return { open: true };
    }
    return { open: false, end: endIndex + rawString.end.length - 1 };
  }

  const char = line[index];
  if (char !== '"' && char !== "'") return null;

  const quoted = skipQuotedLiteral(line, index, char);
  if (quoted.closed) return { open: false, end: quoted.end };
  if (char === '"') {
    literalState.quote = char;
    return { open: true };
  }
  return { open: false, end: index, literalChar: char };
}

function rawStringDelimiter(line, startIndex) {
  if (line[startIndex] !== 'r') return null;

  let index = startIndex + 1;
  while (line[index] === '#') index += 1;
  if (line[index] !== '"') return null;

  const hashes = line.slice(startIndex + 1, index);
  return {
    contentStart: index + 1,
    end: `"${hashes}`,
  };
}

function skipQuotedLiteral(line, startIndex, quote) {
  for (let index = startIndex + 1; index < line.length; index += 1) {
    if (line[index] === '\\') {
      index += 1;
      continue;
    }
    if (line[index] === quote) return { closed: true, end: index };
  }

  return { closed: false, end: startIndex };
}
