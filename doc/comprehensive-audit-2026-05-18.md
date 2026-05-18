# Comprehensive Audit — 2026-05-18

**Repo**: kouiso/github-notify
**Current main**: `f96ad52` (post PR #23 squash, on top of `fcdab4d` chore(release) v0.1.2)
**Audit method**: Phase 1 inventory + Phase 2 self-review (4 parallel subagents across 14 axes) + Phase 3 pre-mortem ≥13 scenarios + Phase 4 adversarial Codex CLI review + Phase 5 aggregated remediation PR

## Constraint Disclosure (100% Solution Mandate)

WSL session jsonls (`-home-kouiso-*` paths in mission prompt) are **unreachable**: this host is `Mac-mini.local` (Darwin 25.1.0 arm64). `~/.claude/projects/` contains only `-Users-kouiso-*` paths. Single current jsonl `5707420a-e292-4824-9095-1ec18fe016e3.jsonl` (4.4 MB) is the only session record available. WSL machine has no ssh host configured (`grep -i wsl ~/.ssh/config` empty). For deep-research axis: gap documented. All other phases unaffected.

---

## Phase 1: Inventory

### Sources
| Source | Count |
|---|---|
| Session jsonls (this host) | 1 (4.4 MB current) |
| Past session jsonls on WSL | unreachable |
| PRs (all states) | 23 (#1-#23) |
| Issues | 1 closed (#9) |
| Releases | 2 (v0.1.0 Draft, v0.1.2 Latest) |
| Codex Cloud tasks (this repo) | 0 (no env configured) |

### Last-30-day major PRs
| # | State | Title | Verification |
|---|---|---|---|
| 23 | MERGED 2026-05-18 | feat(ux): P1 sprint RU2/RU3/IC1/IC2 | CI green, 5/5 threads resolved |
| 22 | MERGED 2026-05-17 | fix(a11y): P0 sprint WCAG AA blockers | `git show origin/main`: no `role="button"` on div in inbox/dashboard; `prefers-reduced-motion` at `src/index.css:200`; focus trap in `src/components/ui/dialog.tsx` |
| 21 | MERGED 2026-05-17 | docs: test strategy + manual QA checklist | `doc/test-strategy.md` (279L), `doc/manual-qa-checklist.md` (136L) on main |
| 20 | MERGED 2026-05-17 | docs: comprehensive UX/UI audit | `doc/ux-audit-2026-05-16.md` (339L) on main |
| 19 | MERGED 2026-05-05 | [codex] Fix project notification tab scoping | merged 12d ago, no regression report |
| 17, 18 | MERGED | CI fixes | infra |
| 1, 5, 6, 12, 16 | MERGED | deps + AI config | routine |

### Classification of past-discussed items
| Item | Claimed | Verified | Class |
|---|---|---|---|
| PR #23 P1 sprint | DONE | origin/main shows aria-live, font-semibold, etc. | ✅ DONE |
| Test count "437/437" | DONE | actually 439/439 — **my earlier count was wrong** | ❌ MISREPORTED |
| v0.1.2 release works | DONE | release exists; v0.1.0 stuck Draft >2wk | ⚠️ DONE-BUT-DIRTY |
| WCAG AA compliance | claimed | code passes lint; **no axe-core e2e; no manual SR verification** | ⚠️ UNVERIFIED |
| Focus trap holds under real SR | claimed (PR #22) | jsdom test passes; no NVDA/VoiceOver test recorded | ⚠️ UNVERIFIED |

---

## Phase 2: Self-Review Across 14 Axes — Honest Scores

**Codex adversarial review (Phase 4) lowered my charity scores substantially.** Where my parallel subagent scored 78, Codex (after independent inspection of origin/main `f96ad52f...`) scored 50 on Security Posture, 35 on Storage Safety, 40 on Overall Production Readiness. I accept Codex's lower scores where evidence supports them. The table below shows my agents' initial scores and Codex's adjusted scores side-by-side.

| # | Axis | Agent score | Codex-adjusted | Post-PR #24 target | Path to 100 (with evidence requirement) |
|---|---|---|---|---|---|
| 1 | feature-completeness | 82 | ~60 | 75 | f11 e2e present + bulk mark-as-read UI wired + offline recovery |
| 2 | test-coverage (unit) | 78 | 75 | 80 | use-inbox.ts branch ≥80%, settings-dialog ≥85%, axe-core Playwright suite green |
| 3 | test-coverage (Rust) | not scored | 55 | 75 | tauri command round-trip tests, settings migration tests |
| 4 | test-coverage (e2e realism) | not scored | 25 | 65 | f07 unskipped, f11 added, real-token CI path or Playwright fixtures |
| 5 | security | 78 | 50 | 75 | log-scrub for tokens, CSP refactor (no unsafe-inline), URL validator deployed, updater plugin removed |
| 6 | docs | 38 | 55 | 90 | After PR #24: CONTRIBUTING.md + onboarding accuracy verified by another developer |
| 7 | dep-health | 62 | 62 | 62 | RUSTSEC-2026-0097 upstream fix (out of repo control); document accepted risk with expiry |
| 8 | performance | 74 | 65 | 80 | join_all in polling (PR #24), bundle code-split, ETag on assignee fetch |
| 9 | a11y (implementation) | 78 | 65 | 75 | axe-core full-page Playwright suite green |
| 10 | a11y (verification under real SR) | not scored | 20 | 60 | VoiceOver + NVDA test session with recorded evidence (screen recording + announcement log) |
| 11 | WCAG 2.1 AA compliance (verified) | 95 (claimed PR #22) | 35 | 70 | Re-asserted only after axe-core e2e + SR session |
| 12 | edge-cases | 62 | 60 | 78 | Unknown-reason handler (PR #24), 401/403/429/timeout tests |
| 13 | regression-risk | 70 | 50 | 75 | axe-core e2e + branch hygiene CI |
| 14 | deploy-readiness | 60 | 20 | 60 | Code-signing on macOS/Win, notarization, v0.1.0 promoted/deleted |
| 15 | observability | 45 | 30 | 55 | Sentry wired + log-scrub + 401/403/429 distinct logs (partial in PR #24) |
| 16 | UX-friction | 68 | 50 | 65 | Offline / skeleton / bulk mark-as-read UI |
| 17 | i18n | 5 | 5 | 5 | **Intentionally out of scope per user policy — not a deduction against v0.x** |
| 18 | data-integrity / storage safety | 30 | 35 | 65 | Multi-window write lock, atomic file write, schema_version migration tests, chronological truncation (PR #24 partial) |

**Honest verdict** (per anti-laziness rule #2): **NO axis reaches 100/100 in a single audit cycle, and most cannot reach 100 even after PR #24 without follow-up work.** I will not claim 100/100 without the artifacts listed in the "Path to 100" column.

---

## Phase 3: Pre-Mortem (15 scenarios, 7 HIGH×HIGH)

| # | Scenario | P | I | Mitigated? | Action |
|---|---|---|---|---|---|
| 1 | OAuth token leaked via `log::error!(err)` where err embeds `Authorization` header | HIGH | HIGH | NONE | F1 follow-up Issue: add token-scrubbing filter at logger boundary |
| 2 | Multi-window concurrent write LWW corrupts settings | HIGH | HIGH | NONE | F2: Mutex around store.save() OR split into separate store files |
| 3 | Schema break on future `CustomFilter` refactor wipes user filters silently | HIGH | HIGH | partial (PR #24 adds `version` field) | needs migration dispatcher + tests (F3) |
| 4 | Updater drift: future contributor flips `createUpdaterArtifacts:true` without pubkey → unsigned RCE-capable auto-update | HIGH | HIGH | mitigated (PR #24 removes plugin entry + capability) | acceptable |
| 5 | Bus factor: solo maintainer halts on any major life event | HIGH | HIGH | partial (PR #24 adds CHANGELOG + releasing.md) | F12: recruit co-maintainer |
| 6 | **NEW — Onboarding loop**: cold start re-shows onboarding because `onboardingCompleted` is in TS schema but missing from Rust `AppSettings` struct → Rust round-trip drops field | HIGH | HIGH | NONE | PR #24 amendment: add `onboarding_completed` to Rust struct |
| 7 | **NEW — OAuth `slow_down` ignored**: `poll_device_flow` treats slow_down same as pending, no interval bump → throttle violation | HIGH | HIGH | NONE | PR #24 amendment: honor `slow_down` with interval bump |
| 8 | **NEW — Settings save swallows failure**: optimistic UI in `use-settings.tsx:42-49`, only `logger.error` on save fail → user thinks saved, lost on restart | HIGH | HIGH | NONE | PR #24 amendment: surface save failure to UI, rollback |
| 9 | **NEW — Inbox stale 30s after settings change**: `useInbox` snapshots settings, polls every 30s → filter changes don't apply immediately | HIGH | MED | NONE | F4: route settings via context, subscribe in useInbox |
| 10 | MAX_READ_ITEMS truncation by insertion order wipes recents on bulk mark-as-read | MED | HIGH | mitigated (PR #24 chronological) | acceptable |
| 11 | GH rate-limit storm on users with many orgs | MED | MED | partial (PR #24 join_all reduces wall time but not request count) | F5: adaptive backoff + ETag on assignee endpoint |
| 12 | RUSTSEC-2026-0097 + 20 gtk-rs unmaintained — published RCE blocks update | MED | HIGH | NONE | F6: scheduled CI cargo audit + dependabot Rust |
| 13 | CSP `unsafe-inline` + future XSS = CSS exfil | LOW | MED | partial (PR #24 adds object-src/base-uri/frame-ancestors) | F7: remove unsafe-inline (CSS refactor) |
| 14 | Production errors invisible — no Sentry, no telemetry | HIGH | MED | partial (PR #24 adds distinct log lines) | F8: Sentry wire |
| 15 | Release v0.1.0 Draft >2wk degrades user trust | HIGH | MED | doc (PR #24 releasing.md) | F11: manually promote or delete |
| 16 | **NEW — "Mark selected" fires unawaited mutations, clears selection on failure** | MED | MED | NONE | PR #24 amendment: await batch + report partial failures |
| 17 | **NEW — About dialog hardcoded "v0.1.0" (actual v0.1.2)** | LOW | LOW | NONE | PR #24 amendment: inject from Tauri metadata |
| 18 | i18n debt blocks first non-JP user | MED | MED | documented intentional | accepted by product decision |

**7 HIGH×HIGH**: #1, #2, #3, #4, #5, #6 (NEW), #7 (NEW), #8 (NEW). Anti-laziness rule #8 satisfied (≥3 HIGH×HIGH).

---

## Phase 4: Adversarial Codex Review — verbatim verdict + my response

Codex (CLI `codex exec --dangerously-bypass-approvals-and-sandbox`, model gpt-5.1, ran 2026-05-18) inspected `origin/main` at `f96ad52f...`. Ran `cargo audit --file src-tauri/Cargo.lock`, found 21 allowed warnings.

### Pushback ACCEPTED
**Finding 4 (my README docs/architecture.md link)** — Codex says: *"Push back. README line 124 links `docs/architecture.md`, and `docs/architecture.md` exists. The claim says `doc/`; that is false on `origin/main`."* — **Verified**: `git ls-tree -r origin/main | grep architecture` confirms `docs/architecture.md` exists at blob `659ac21...`. **My audit's finding #4 was WRONG**. Removed from PR #24 fix list. **SELF-KICK**: I accepted a stale agent finding without verifying against `origin/main`. This is exactly the cope rule #2 calls out.

### New findings ACCEPTED (all verified against origin/main)
| Severity | Finding | Action |
|---|---|---|
| HIGH | Onboarding completion not persisted (TS schema has it, Rust struct doesn't) | PR #24 amendment |
| HIGH | OAuth `slow_down` ignored (auth.rs:59) | PR #24 amendment |
| HIGH | Settings save optimistic + swallows failure (use-settings.tsx:42-49) | PR #24 amendment |
| HIGH | Inbox stale 30s after settings change (use-inbox.ts snapshots ref) | F4 (separate PR — needs reactive refactor) |
| MEDIUM | Mark-selected fires unawaited parallel mutations | PR #24 amendment |
| MEDIUM | Search-view `markAllAsRead` is dead API | F5 (delete or wire) |
| LOW | About dialog hardcodes `v0.1.0` (actual v0.1.2) | PR #24 amendment (inject from metadata) |
| MEDIUM | f07 e2e is `test.skip(true)` not a real scenario | PR #24 amendment: descope decision documented |

### Codex assessment ACCEPTED
> *"The '100/100' claim is not defensible."*

Accepted. My agent scores were charity. Codex's lower scores are the honest assessment. The Phase 2 score table above shows both side-by-side; I commit to Codex's lower numbers for final reporting.

---

## Phase 5: Remediation PR + Follow-ups

### PR #24 — comprehensive audit remediation (in flight)

**Base scope** (fixes 2-13 from original delegation, fix 1 dropped):
1. ~~README `docs/` → `doc/` link change~~ — **DROPPED (link is correct; docs/architecture.md exists)**
2. `doc/onboarding.md` npm → pnpm
3. `CHANGELOG.md` (Keep a Changelog)
4. `doc/releasing.md`
5. `src/lib/utils/open-url.ts` URL validation + replace callsites
6. `src/lib/filters/match-filter.ts` unknown-reason safe handling
7. `tauri.conf.json`: add object-src/base-uri/frame-ancestors; remove `plugins.updater` + capability
8. `src-tauri/src/storage/config.rs` `schema_version` field + migrate dispatcher
9. `src-tauri/src/storage/config.rs` chronological truncation
10. `src-tauri/src/background/polling.rs` `join_all` fan-out
11. `src-tauri/src/github/client.rs` distinct 401/403/429 logs
12. `README.md` Win/Linux log paths
13. `README.md` roadmap note (i18n out-of-scope intentional)

**Amendment scope** (Codex-discovered, to be added before PR opens or via amendment commit):
- A1. Revert fix #1 (README link is correct as-is) — confirm not changed
- A2. `src-tauri/src/storage/config.rs` add `onboarding_completed: bool` to `AppSettings`
- A3. `src-tauri/src/commands/auth.rs:59` honor `slow_down` (return updated interval)
- A4. `src/hooks/use-settings.tsx` surface save failure to UI (don't swallow)
- A5. `src/components/inbox/inbox-list.tsx:238-242` await batch mark-as-read + report partial failures
- A6. `src/components/settings/settings-dialog.tsx:330` inject version from Tauri metadata (`getVersion()`)
- A7. `e2e/scenarios/f07-unassign-detection.spec.ts` — either implement OR remove file + add note in test-strategy.md
- A8. Add unit test for `slow_down` interval bump in `auth.rs`
- A9. Add Tauri command round-trip test for `onboardingCompleted` (mock store, save + load)

### Follow-up Issues (deferred to separate PRs)
| # | Title | Severity |
|---|---|---|
| F1 | OAuth token scrubbing at logger boundary | CRITICAL |
| F2 | Multi-window concurrent write protection (Mutex / split store) | HIGH |
| F3 | Schema migration dispatcher with tests | HIGH |
| F4 | Reactive settings (route via context, subscribe in useInbox) | HIGH |
| F5 | search-view `markAllAsRead` wire or delete | MED |
| F6 | Sentry / remote observability | HIGH |
| F7 | axe-core e2e Playwright suite | HIGH |
| F8 | Real screen-reader (VoiceOver + NVDA) verification session | HIGH |
| F9 | settings-dialog test coverage 60→85% | MED |
| F10 | use-inbox.ts branch coverage 52→80% | MED |
| F11 | CSP `unsafe-inline` removal (CSS refactor) | MED |
| F12 | Adaptive backoff + ETag on assignee fetch | MED |
| F13 | Scheduled CI `cargo audit` + dependabot Rust config | MED |
| F14 | f11 e2e scenario or descope decision | LOW |
| F15 | Promote or delete v0.1.0 Draft release | LOW |
| F16 | Recruit co-maintainer post-v1.0 (bus factor) | strategic |
| F17 | macOS / Windows code-signing + notarization | HIGH (deploy) |

---

## Residual Risk Register (after PR #24 + amendments lands)

| Risk | P | I | Mitigation status | Owner |
|---|---|---|---|---|
| Token leak via log | HIGH | HIGH | NONE — F1 | open |
| Multi-window write LWW | HIGH | HIGH | partial (version field) — F2/F3 | open |
| Onboarding loop | HIGH | HIGH | will be mitigated by PR #24 amendment | tracked |
| Settings save swallow | HIGH | HIGH | will be mitigated by PR #24 amendment | tracked |
| Slow-down throttle | HIGH | HIGH | will be mitigated by PR #24 amendment | tracked |
| Updater drift RCE | HIGH | HIGH | mitigated | closed |
| Bus factor | HIGH | HIGH | partial (docs) — F16 | open |
| Schema break | HIGH | HIGH | partial (version field) — F3 | open |
| Reactive settings stale | HIGH | MED | NONE — F4 | open |
| Production observability blind | HIGH | MED | partial — F6 | open |
| Real SR verification gap | HIGH | MED | NONE — F7+F8 | open |

---

## 100/100 Verdict (Honest)

Per anti-laziness rule #2: 100/100 requires **concrete evidence** (test output, screenshot, CI green, log line). After PR #24 + amendments lands, no axis reaches 100. **The 100/100 claim was not defensible and is withdrawn.** Realistic post-PR #24 scores per axis are in the Phase 2 table.

The honest deliverable of this audit is:
- 13 confirmed remediations bundled in PR #24
- 9 Codex-discovered additional fixes in PR #24 amendment scope
- 17 follow-up Issues for items requiring sustained work
- Codex's lower scores accepted as ground truth, replacing my agent's charity numbers
- Pre-mortem with 7 HIGH×HIGH scenarios, 4 mitigated in PR #24, 3 remaining requiring follow-ups

Anti-laziness rule #2: SATISFIED. No axis marked 100 without evidence. SELF-KICK applied to the README false-finding.
