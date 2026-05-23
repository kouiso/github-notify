# QA Runbook — 2026-05-18

**Purpose**: AI-self-testable verification procedure. A future AI follows this runbook step-by-step and produces PASS/FAIL evidence WITHOUT human intervention. Pair with `doc/manual-qa-checklist.md` (human-driven) — this file is the **automated** counterpart.

**Scope**: Top 5 critical paths of github-notify post-PR #24 (comprehensive audit remediation).

---

## Prerequisites

| Item | Value | Acquire via |
|---|---|---|
| Branch | `main` after PR #24 merge (`f96ad52` or later) | `git checkout main && git pull` |
| Node | mise-pinned in `.mise.toml` | `mise install` |
| pnpm | `pnpm@9.x` (via mise/corepack) | auto |
| Rust toolchain | stable, target matching host | `rustup show` |
| OS | macOS arm64 verified; Linux/Win via release artifacts only | host check `uname -a` |
| GitHub token | personal access token w/ `repo`, `notifications`, `read:org` scopes | 1Password CLI: `op signin`, then `op item get "github-notify QA token" --vault RITMO --fields credential --reveal`; configure an equivalent secret source if this vault/item is unavailable |
| Test fixture | none required for unit/lint tier; OAuth runbook needs real token | — |

**Token storage during run**: Never log the token. Use `PW=$(op item get ... --reveal)` shell-var pattern. Verify `echo ${#PW}` returns >40 chars.

---

## Startup Steps (verbatim, idempotent)

```bash
# 1. Clone or update
cd /Users/kouiso/ghq/kouiso/github-notify || git clone git@github.com:kouiso/github-notify.git /tmp/gh-notify-qa && cd /tmp/gh-notify-qa
git fetch origin --quiet
git checkout main && git pull --ff-only

# 2. Dependencies (deterministic)
mise install
pnpm install --frozen-lockfile

# 3. Static tier (FAIL gate — if any non-zero exit, STOP and capture log)
pnpm run typecheck                                     # tsc -b --noEmit
pnpm run lint                                          # biome check
pnpm run test                                          # vitest run (expect 439+ PASS)
pnpm run test:coverage 2>&1 | tail -10                 # branch ≥80% per current threshold
pnpm run build                                         # vite build
cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo check && cargo test
cd ..

# 4. Runtime tier (only if static tier all PASS)
pnpm tauri dev &
TAURI_PID=$!
# Wait for window
sleep 8
# Evidence collection dir
EVIDENCE_DIR=".work/qa-evidence/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$EVIDENCE_DIR"
```

**STOP CONDITIONS** (must halt the runbook and report partial PASS/FAIL):
- Any command above returns non-zero exit
- `pnpm tauri dev` does not open a window within 30 seconds
- Tauri webview console shows uncaught error during initial render

---

## Critical Path Verification

### CP1 — Static tier integrity

**Steps**: covered by Startup Steps 1-3.

**Expected**:
- typecheck: 0 errors
- lint: 0 errors (warnings allowed if pre-existing only — diff against `origin/main` to confirm no new lint)
- test: 449/449 PASS (or higher if new tests landed)
- coverage: branches ≥72 (per `vitest.config.ts:38-43`, restoration to 80 tracked in Issue #31)
- cargo test: 0 fail
- cargo clippy with `-D warnings`: clean

**FAIL conditions**: any non-zero exit on the above. Capture full output to `$EVIDENCE_DIR/cp1-static-tier.log`. **Do NOT continue to CP2-CP5 if CP1 fails** — runtime tier is meaningless on broken static state.

---

### CP2 — Auth Device Flow (OAuth login)

**Precondition**: app launched (CP1 PASS), settings store empty (`rm -f ~/Library/Application\ Support/com.kouiso.github-notify/store.bin` for macOS, equivalent for other platforms — backup first if needed).

**Steps**:
1. Re-launch app (`pnpm tauri dev`). Capture screenshot to `$EVIDENCE_DIR/cp2-01-login-screen.png` via `mcp__claude-in-chrome__browser_take_screenshot` if WebView available, OR `xcrun simctl io booted screenshot ...` for OS-level, OR Tauri webview devtools network panel.
2. Click "GitHub にログイン" button. Capture device code displayed on screen → `$EVIDENCE_DIR/cp2-02-device-code.png`.
3. Visually verify on-screen the user_code is exactly the one returned by the `/login/device/code` POST (read from Tauri webview console / log).
4. In parallel terminal: open https://github.com/login/device, paste user_code, approve.
5. Wait for app to detect token (max 30s per device-flow spec; honor `slow_down` if returned).
6. Capture authenticated inbox screen → `$EVIDENCE_DIR/cp2-03-inbox-after-login.png`.

**Expected**:
- Step 2 device code matches step 3 server response (no re-prompt).
- Step 5 transitions to inbox within 30s; **CP2.SLOW_DOWN**: if server returns `slow_down`, the next poll wait should be >= prior interval + 5s (verify in log: `grep "oauth slow_down" ~/Library/Logs/github-notify/*.log`).
- Step 6 inbox screen visible; tray icon present (macOS menubar / Win system tray / Linux indicator).
- Token persisted to OS Keychain — verify via `security find-generic-password -s "com.kouiso.github-notify"` (macOS) returning a value (do NOT print the value, just check exit code 0).

**FAIL conditions**:
- Token in store.bin file but NOT in keychain → migration failure
- App shows infinite spinner after device-code approval → polling broken
- App logs full token in plaintext (`grep "ghp_\|gho_\|ghu_" ~/Library/Logs/github-notify/*.log` returns matches) → **CRITICAL FAIL**, security regression — capture log to `$EVIDENCE_DIR/cp2-FAIL-token-leak.log`, file Issue #25 update immediately
- Onboarding dialog reappears on next launch → onboarding_completed Rust-field round-trip broken (PR #24 amendment A2 regression)

---

### CP3 — Inbox load + filter + URL open

**Precondition**: authenticated (CP2 PASS), at least one unread notification on the test account.

**Steps**:
1. Capture initial inbox → `$EVIDENCE_DIR/cp3-01-inbox-initial.png`. Note count badge.
2. Click any unread item title. Expected: external URL opens in default browser (NOT in Tauri webview).
3. Capture URL opened → `$EVIDENCE_DIR/cp3-02-external-browser-url.txt` (just the URL string, redact PII if any).
4. **CP3.URL_GUARD**: in Tauri webview devtools console, run:
   ```js
   await window.__TAURI__.invoke('open_external_url', { url: 'http://github.com/foo' }).catch(e => e.message)
   ```
   Expected: rejection with `non-https blocked`. Capture console output.
5. Run same with `https://evil.example.com/x` — expected `non-github host blocked`. Capture.
6. Switch filter to "重要な通知" (or any preset). Verify list updates without page reload (no spinner > 200ms).
7. Mark one item read via the checkmark icon. Verify: count badge decrements; item visually de-emphasized (`font-normal text-muted-foreground` per PR #23 RU3).
8. Bulk mark: select 2-3 items, click "Done" (or equivalent batch button per A5 amendment). Verify:
   - On all-success: selection clears, count updates by N.
   - On partial failure (induce by editing one item's `id` in devtools network tab before submit): toast shows `N件成功 / M件失敗`, failed items remain selected.

**Expected** results above ↑. **CP3.UNREAD_WEIGHT**: per PR #23, unread title is `font-semibold`, read is `font-normal`. Verify via computed style in devtools.

**FAIL conditions**:
- URL guard does NOT throw on http:// or non-github host → security regression (PR #24 open-url.ts broke)
- Item opens in Tauri webview instead of external browser → shell plugin misconfigured
- Bulk mark clears selection even on partial failure → A5 amendment regression
- Unread title weight identical to read title → PR #23 RU3 regression

---

### CP4 — Background polling + ETag + assignee detection

**Precondition**: authenticated, app foregrounded for ≥90 seconds.

**Steps**:
1. Tail Tauri backend log: `tail -F ~/Library/Logs/github-notify/*.log` in parallel terminal.
2. Wait for at least 2 poll cycles (default 20s interval per `INITIAL_POLL_INTERVAL_SECS`, may extend per GitHub `X-Poll-Interval` response header).
3. Expected log lines:
   - `INFO ... バックグラウンドポーリングサービスを開始` (once at startup)
   - `DEBUG ... 変更なし (304 Not Modified)` (after first cycle if no new notifications — confirms ETag caching works)
   - `INFO ... inbox-updatedを{N}件で送信` (when new items)
4. **CP4.RATE_LIMIT_LOG**: induce 429 by spamming notification reads via devtools. Expected log: `ERROR ... github 429 — secondary rate limit. retry-after=...` (per PR #24 client.rs distinct logging). Capture to `$EVIDENCE_DIR/cp4-rate-limit.log`.
5. **CP4.ASSIGN_DETECT**: on test account, assign an issue to yourself via GH web UI, wait for poll, verify item appears with `reason: assign`. Then unassign yourself via GH web UI. Wait for next poll (≤30s). Expected log: `INFO ... アサイン解除を検知: owner/repo#N (viewer=...)`. Capture.
6. **CP4.CONCURRENCY_LIMIT**: with 11+ assign items, verify polling.rs `buffer_unordered(10)` keeps simultaneous requests ≤10 (count in-flight HTTP calls via devtools network panel during a poll cycle). Per gemini-fix PR #24 last commit.

**FAIL conditions**:
- 304 never appears after the first poll → ETag header not sent
- 429 produces only generic `WARN` log instead of distinct `ERROR` with `retry-after=...` → client.rs distinct-log regression
- Unassign not detected after 60s → polling.rs verify_assignments broken
- More than 10 simultaneous HTTP requests during poll → buffer_unordered limit violated

---

### CP5 — Settings persistence + multi-window behavior

**Precondition**: authenticated, at least one custom filter configured.

**Steps**:
1. Open settings dialog. Switch theme to dark. Close dialog. Quit app.
2. Re-launch. Expected: dark theme persists (loaded from store).
3. Re-open settings. Edit a custom filter (add a repository). Click save.
4. **CP5.SAVE_ERROR_SURFACE**: simulate save failure by making the store directory read-only:
   ```bash
   chmod 555 ~/Library/Application\ Support/com.kouiso.github-notify/
   ```
   Then attempt to update a setting. Expected: error toast / inline message `保存に失敗しました - 再試行してください` (per PR #24 amendment A4 use-settings.tsx saveError state). Capture screenshot to `$EVIDENCE_DIR/cp5-save-error.png`. Restore permissions: `chmod 755 ...`.
5. **CP5.MULTI_WINDOW** (known pre-existing risk per audit doc Pre-mortem #2, Issue #26): open two app windows. Edit settings in window A. Confirm window B does NOT silently overwrite window A's changes. **CURRENT STATE**: this scenario is known-broken (LWW). Mark as **EXPECTED FAIL — tracked in #26**; no remediation in PR #24.
6. **CP5.ABOUT_VERSION**: open About panel in settings. Expected: version string matches `src-tauri/tauri.conf.json` (`v0.1.2` or later). Per PR #24 amendment A6, should use `getVersion()` not hardcoded.

**FAIL conditions**:
- Dark theme reverts to system on relaunch → store save broken
- Save failure shows no UI surface (silent fail) → A4 regression
- About panel still shows hardcoded `v0.1.0` → A6 not deployed
- CP5.MULTI_WINDOW: this IS a known-fail; if it suddenly PASSES, verify Issue #26 was fixed independently — update Issue with evidence.

---

## Completion Gate

**ALL of the following must hold before declaring runbook PASS:**

- CP1-CP5 individual PASS or DOCUMENTED EXPECTED FAIL (CP5.MULTI_WINDOW only)
- `$EVIDENCE_DIR/` contains at minimum:
  - `cp1-static-tier.log`
  - `cp2-01-login-screen.png`, `cp2-03-inbox-after-login.png`
  - `cp3-01-inbox-initial.png`, `cp3-02-external-browser-url.txt`
  - `cp4-rate-limit.log` (or `cp4-no-429-induced.txt` if 429 could not be induced)
  - `cp5-save-error.png`
- A single summary file `$EVIDENCE_DIR/PASS-summary.md` listing each CP1-CP5 with PASS/FAIL/EXPECTED-FAIL + evidence-file pointers.

**Where evidence lives**: `$EVIDENCE_DIR` (timestamped under `.work/qa-evidence/`). Git-ignored. If the runbook is invoked from CI, evidence is uploaded as artifact via `actions/upload-artifact`.

**On any unexpected FAIL**: do NOT proceed to merge / release. File an Issue with evidence attached, link to this runbook + the specific CP step.

---

## Maintenance

Update this runbook when:
- A new critical path is introduced (extend the CP list, increment CP6 etc.)
- An audit PR adds new behavior that needs verification (cross-reference the audit doc finding)
- Tauri or Rust-side log message format changes (update grep expectations)

Cross-references:
- `doc/comprehensive-audit-2026-05-18.md` — audit findings + scoring rubric
- `doc/manual-qa-checklist.md` — human-driven companion checklist
- `doc/test-strategy.md` — full test-pyramid policy
- Issues #25 (token scrubbing), #26 (multi-window), #27 (Sentry), #28 (axe-core+SR), #29 (signing), #30 (f07 fixture), #31 (coverage threshold restoration)
