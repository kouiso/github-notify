#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT
mkdir "$fixture/scripts" "$fixture/bin"
if [ ! -f "$root/scripts/ci.sh" ]; then
  echo 'FAIL local and cloud shared entry is missing'
  exit 1
fi
cp "$root/scripts/ci.sh" "$fixture/scripts/ci.sh"
cp "$root/Taskfile.yml" "$fixture/Taskfile.yml"
for tool in pnpm cargo; do
  cat > "$fixture/bin/$tool" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
command="${0##*/} $*"
printf '%s\n' "$command" >> "$COMMAND_LOG"
test "$CI" = true || exit 99
if [[ "$command" == 'pnpm exec playwright test '* ]]; then
  test "$VITE_E2E_AUTHENTICATED" = true || exit 99
fi
if [ "$command" = "$FAIL_COMMAND" ]; then exit 42; fi
MOCK
  chmod +x "$fixture/bin/$tool"
done
export PATH="$fixture/bin:$PATH"
export COMMAND_LOG="$fixture/commands" FAIL_COMMAND=never
cat > "$fixture/expected" <<'EXPECTED'
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm vitest run --coverage
pnpm run build
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test -c e2e/playwright.config.ts a11y.spec.ts
pnpm audit --prod --audit-level=high
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo build --manifest-path src-tauri/Cargo.toml
cargo audit --file src-tauri/Cargo.lock
EXPECTED
task --taskfile "$fixture/Taskfile.yml" ci > "$fixture/output" 2>&1
diff -u "$fixture/expected" "$COMMAND_LOG"
: > "$COMMAND_LOG"
task --taskfile "$fixture/Taskfile.yml" ci:fast > "$fixture/output" 2>&1
head -5 "$fixture/expected" > "$fixture/fast-expected"
diff -u "$fixture/fast-expected" "$COMMAND_LOG"
# なぜ: 一部の検査失敗を別の検査の成功で上書きしない。
while IFS= read -r command; do
  : > "$COMMAND_LOG"
  export FAIL_COMMAND="$command"
  if bash "$fixture/scripts/ci.sh" all > "$fixture/output" 2>&1; then exit 1; fi
  test "$(tail -1 "$COMMAND_LOG")" = "$command"
done < "$fixture/expected"
: > "$COMMAND_LOG"
if bash "$fixture/scripts/ci.sh" invalid > "$fixture/output" 2>&1; then exit 1; fi
test ! -s "$COMMAND_LOG"
echo 'OK local CI preserves frontend, authenticated a11y, Rust, audits and failures'
