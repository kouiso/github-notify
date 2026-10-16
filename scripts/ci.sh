#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
export CI=true
mode="${1:-all}"
case "$mode" in
  frontend-lint) pnpm run lint ;;
  frontend-typecheck) pnpm run typecheck ;;
  frontend-test) pnpm vitest run --coverage ;;
  frontend-build) pnpm run build ;;
  frontend-browser-setup) pnpm exec playwright install --with-deps chromium ;;
  frontend-a11y-e2e)
    VITE_E2E_AUTHENTICATED=true pnpm exec playwright test -c e2e/playwright.config.ts a11y.spec.ts
    ;;
  audit-frontend) pnpm audit --prod --audit-level=high ;;
  rust-fmt) cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check ;;
  rust-clippy) cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings ;;
  rust-test) cargo test --manifest-path src-tauri/Cargo.toml ;;
  rust-build) cargo build --manifest-path src-tauri/Cargo.toml ;;
  audit-rust) cargo audit --file src-tauri/Cargo.lock ;;
  fast|all)
    pnpm install --frozen-lockfile
    for check in frontend-lint frontend-typecheck frontend-test frontend-build; do
      bash scripts/ci.sh "$check"
    done
    if [ "$mode" = all ]; then
      # なぜ: ローカルの full CI から a11y・Rust・監査だけが抜けると検査範囲が変わる。
      for check in frontend-browser-setup frontend-a11y-e2e audit-frontend rust-fmt rust-clippy rust-test rust-build audit-rust; do
        bash scripts/ci.sh "$check"
      done
    fi
    ;;
  *) echo "Unknown CI mode: $mode" >&2; exit 2 ;;
esac
