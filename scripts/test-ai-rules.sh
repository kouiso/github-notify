#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT

test -z "$(git -C "$root" ls-files -- 'CLAUDE.md' '**/CLAUDE.md')"
test -f "$root/AGENTS.private.md"
grep -q 'repository-root `AGENTS.private.md`' "$root/AGENTS.md"
git -C "$root" check-attr filter diff -- AGENTS.private.md > "$fixture/attributes"
grep -qx 'AGENTS.private.md: filter: git-crypt' "$fixture/attributes"
grep -qx 'AGENTS.private.md: diff: git-crypt' "$fixture/attributes"

# 復号済みの作業ツリーでも、公開される index 内の暗号文を検査する。
git -C "$root" show :AGENTS.private.md | node -e '
const fs = require("node:fs");
const assert = require("node:assert/strict");
assert.ok(fs.readFileSync(0).subarray(0, 10).equals(Buffer.from("\0GITCRYPT\0")));
'
node -e '
const fs = require("node:fs");
const assert = require("node:assert/strict");
const root = process.argv[1];
assert.ok(JSON.parse(fs.readFileSync(`${root}/biome.json`)).files.includes.includes("!AGENTS.private.md"));
assert.ok(!fs.readFileSync(`${root}/AGENTS.md`).includes(0));
' "$root"
echo 'PASS: canonical entry, encrypted index, attributes and linter exclusion'

mkdir -p "$fixture/scripts"
cp "$root/scripts/sync-ai-rules.sh" "$fixture/scripts/"
cp "$root/AGENTS.md" "$fixture/AGENTS.md"
printf '%s\n' 'PRIVATE_TEST_SENTINEL' > "$fixture/AGENTS.private.md"
bash "$fixture/scripts/sync-ai-rules.sh" > /dev/null
cmp "$root/.gemini/styleguide.md" "$fixture/.gemini/styleguide.md"
cmp "$root/.github/copilot-instructions.md" "$fixture/.github/copilot-instructions.md"
if grep -q 'PRIVATE_TEST_SENTINEL' "$fixture/.gemini/styleguide.md" "$fixture/.github/copilot-instructions.md"; then
  echo 'FAIL: private instructions leaked into bridge files'
  exit 1
fi
bash "$fixture/scripts/sync-ai-rules.sh" > /dev/null
cmp "$root/.gemini/styleguide.md" "$fixture/.gemini/styleguide.md"
cmp "$root/.github/copilot-instructions.md" "$fixture/.github/copilot-instructions.md"
rm "$fixture/AGENTS.md"
if bash "$fixture/scripts/sync-ai-rules.sh" > /dev/null 2>&1; then
  echo 'FAIL: missing canonical entry was accepted'
  exit 1
fi
echo 'PASS: bridge sync, idempotence, private-content isolation and missing-entry failure'
