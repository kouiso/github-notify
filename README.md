# GitHub Notify

A desktop application for managing GitHub notifications, built with React and Tauri.

## Features

- Real-time GitHub notification polling with background monitoring
- OAuth Device Flow authentication (no browser redirect needed)
- Inbox view with notification filtering and search
- PR review dashboard (PRs to review, your PRs)
- Notification sound alerts with customizable settings
- System tray integration (show / hide / quit / unread badge)
- Cross-platform support (macOS, Windows, Linux)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 |
| Backend | Rust + Tauri 2 |
| UI | shadcn/ui-style components + CVA + clsx + tailwind-merge |
| Code Quality | Biome 2.3 + ESLint 9 + Husky |
| Test | Vitest 4 + @testing-library/react + cargo test |

## Quick Start (5 steps)

### 1. Install prerequisites

- [Rust](https://www.rust-lang.org/tools/install) >= 1.77.2
- [mise](https://mise.jdx.dev/) (manages Node.js + pnpm)

<details>
<summary>OS-specific dependencies for Tauri</summary>

**macOS:**
```bash
xcode-select --install
```

**Windows:**
- Microsoft Visual Studio C++ Build Tools
- WebView2 (pre-installed on Windows 10/11)

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libasound2-dev
```

See [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) for details.
</details>

### 2. Clone and install

```bash
git clone https://github.com/kouiso/github-notify.git
cd github-notify
pnpm install
```

### 3. Set up GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) and create a new OAuth App
2. Enable **Device Flow** in the app settings
3. Create the secrets file:
   ```bash
   cp src-tauri/src/github/secrets.rs.example src-tauri/src/github/secrets.rs
   ```
4. Edit `src-tauri/src/github/secrets.rs` with your Client ID:
   ```rust
   pub const GITHUB_CLIENT_ID: &str = "your-client-id-here";
   ```

> `secrets.rs` is encrypted with [git-crypt](https://github.com/AGWA/git-crypt) in the upstream repository.

### 4. Launch

```bash
pnpm tauri dev
```

### 5. Log in and configure

1. Click **Login with GitHub** on the welcome screen
2. Copy the device code shown and enter it at the GitHub URL
3. Authorize the app on GitHub
4. Notifications start polling automatically
5. Open **Settings** (gear icon) to adjust polling interval, notification sound, and filters

## Development

```bash
pnpm run dev              # Frontend dev server only
pnpm run build            # Production frontend build
pnpm run lint             # Biome + ESLint check
pnpm run typecheck        # TypeScript type check
pnpm test                 # Run Vitest (405 tests)
pnpm run test:coverage    # Coverage report (>80% all metrics)
cargo test -p github-notify  # Rust backend tests
pnpm tauri build          # Build desktop app for distribution
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Login fails | Verify your OAuth App has Device Flow enabled. Check Client ID matches. |
| No notifications | Ensure GitHub token has `notifications` scope. Check Settings > Polling interval. |
| No sound | Check Settings > Notification sound is enabled. Verify OS notification permissions. |
| Build fails (Linux) | Install all system dependencies listed in prerequisites above. |
| Token warning in Settings | Your OS keychain is unavailable. Token is stored in encrypted `store.bin` as fallback. |

## File Locations

| Item | Path |
|------|------|
| Logs | `~/Library/Logs/github-notify/` (macOS) |
| Settings | Managed by `tauri-plugin-store` in app data directory |
| Token | OS Keychain (preferred) or `store.bin` in app data directory |

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full system diagram and data flow.

## License

[MIT](LICENSE)
