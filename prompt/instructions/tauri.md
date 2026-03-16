---
applyTo: "**"
---

# Tauri Desktop App Autonomous Verification Protocol

## 1. Zero Delegation Mandate for Tauri Tasks

"Tauri desktop verification is not possible" is NEVER an acceptable conclusion before exhausting the tool ladder below.
NEVER report a task as complete based on lint/test/build alone WHEN the change affects Tauri app behavior (UI, IPC, auth, window state) BECAUSE "tests pass" ≠ "desktop app works correctly."

**Prohibited completion reports**:
- ❌ 「lint 0エラー、テスト全272件パス」→ 完了報告（デスクトップ動作未確認）
- ❌ 「デスクトップアプリの確認はできないので、コードレベルの修正のみ行いました」
- ❌ 「Tauriアプリの動作確認はユーザーにお願いします」
- ❌ 「ブラウザ側のテストが通っているので問題ないと判断しました」
- ❌ 「Playwrightが既存Chromeセッションとの融合で起動できなかったから、実機確認はユーザーにお願いしたい」

**Playwright が失敗したら → 即 screencapture へ。1手段の失敗 = 委譲の理由にならない。**

---

## 2. Tauri App Verification Tool Ladder

### Priority 1: Playwright via Vite Dev Server (Most Accessible)

Tauri apps run a Vite dev server that is accessible via browser.
Use `mcp__playwright__*` tools to verify the webview content:

```bash
# Step 1: Start Tauri dev (if not already running)
npm run tauri dev 2>&1 &
sleep 10  # wait for Vite server to start

# Step 2: Find which port Vite is using
lsof -i :1420 -i :5173 -i :3000 2>/dev/null | grep LISTEN

# Step 3: Use Playwright to verify
# mcp__playwright__browser_navigate → http://localhost:1420 (or detected port)
# mcp__playwright__browser_take_screenshot
# mcp__playwright__browser_snapshot (for accessibility tree)
```

**Important**: Playwright verifies the webview HTML/JS. For IPC (Tauri commands), also verify the Rust-side behavior via logs.

### Priority 2: macOS screencapture for Native Window

```bash
# Capture all screens
screencapture -x /tmp/tauri_screenshot.png

# Capture specific window
WINDOW_ID=$(osascript -e 'tell application "System Events" to tell process "github-notify" to get id of window 1' 2>/dev/null)
[ -n "$WINDOW_ID" ] && screencapture -l "$WINDOW_ID" /tmp/tauri_window.png

# Check if app window exists
osascript -e 'tell application "System Events"
  tell process "github-notify"
    get {name, visible, size, position} of window 1
  end tell
end tell' 2>&1
```

### Priority 3: Tauri IPC / Backend Verification

```bash
# Check Rust compilation
cd src-tauri && cargo check 2>&1 | tail -20

# Read Tauri app logs
cat ~/Library/Logs/github-notify/*.log 2>/dev/null | tail -50

# Check if Tauri process is running
pgrep -f "github-notify" && echo "Tauri process running"

# Read backend output from running dev process
# (check background task output that launched tauri dev)
```

### Priority 4: IPC Command Testing via Browser Console

```bash
# After Playwright navigates to the app:
# mcp__playwright__browser_evaluate → invoke Tauri commands via window.__TAURI__
# Example: window.__TAURI__.invoke('verify_token', {token: '...'})
```

---

## 3. Auth Flow Verification (github-notify specific)

When modifying authentication code (`use-auth.ts`, device flow, token handling):

```
NEVER report auth fix as complete without verifying BOTH:
1. Unit tests pass (existing: 272 tests)
2. Actual auth flow works in the running app

Verification sequence:
1. npm run tauri dev (launch app)
2. Playwright: navigate to app → trigger auth flow → screenshot result
3. Check Tauri logs for actual IPC errors vs expected errors
4. Verify isTauriEnv() guard works: browser mode should skip invoke()
```

**For the isTauriEnv() guard specifically**: Verify in browser mode that `isLoading` becomes `false` without calling `invoke()`. Use Playwright + browser_evaluate to check this.

---

## 4. Completion Criteria for Tauri App Tasks

A task is NOT complete until ALL of the following are confirmed:

| Check | Method | Required |
|-------|--------|---------|
| TypeScript compiles | `npm run build` or lint | YES |
| Unit tests pass | `npm run test` | YES |
| Vite dev server starts | `lsof -i :1420` or Playwright | YES |
| Webview renders correctly | Playwright screenshot | YES (for UI changes) |
| Native window visible | screencapture / osascript | YES (for window changes) |
| IPC commands work | Playwright browser_evaluate | YES (for IPC changes) |
| Auth flow works | Full Playwright flow | YES (for auth changes) |

**Minimum for any code change**: TypeScript + tests + Playwright screenshot of running app.

---

## 5. "Cannot verify desktop" Is Prohibited

IF you find yourself about to write "デスクトップアプリの確認は..." THEN stop and use the tool ladder above.

The Tauri app's webview IS accessible via Playwright through the Vite dev server.
The native window IS capturable via screencapture.
"Cannot verify" means "have not found the method yet" — keep looking.

Escalation threshold: ONLY after all 4 priorities in §2 have been attempted and failed, report the specific technical reason each failed.
