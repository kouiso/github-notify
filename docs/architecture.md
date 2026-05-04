# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Notify App                     │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              React Frontend (WebView)              │  │
│  │                                                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────┐│  │
│  │  │  Inbox   │ │Dashboard │ │ Settings Dialog     ││  │
│  │  │  View    │ │  View    │ │ (Filters, Sound,    ││  │
│  │  │          │ │ (PR      │ │  Polling, Account)  ││  │
│  │  │ useInbox │ │ Review)  │ │  useSettings       ││  │
│  │  └────┬─────┘ └────┬─────┘ └────────┬───────────┘│  │
│  │       │             │                │            │  │
│  │       ▼             ▼                ▼            │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │          Tauri Command Bridge                │ │  │
│  │  │          (@tauri-apps/api invoke)             │ │  │
│  │  └────────────────────┬─────────────────────────┘ │  │
│  └───────────────────────┼───────────────────────────┘  │
│                          │ IPC                           │
│  ┌───────────────────────┼───────────────────────────┐  │
│  │              Rust Backend (Tauri Core)             │  │
│  │                       │                            │  │
│  │  ┌────────────────────▼──────────────────────┐    │  │
│  │  │            commands/ (Tauri Commands)      │    │  │
│  │  │  auth.rs  │ notifications.rs │ settings.rs │    │  │
│  │  └─────┬─────┴────────┬─────────┴──────┬─────┘    │  │
│  │        │              │                │           │  │
│  │        ▼              ▼                ▼           │  │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐   │  │
│  │  │ github/  │  │background/│  │  storage/     │   │  │
│  │  │client.rs │  │polling.rs │  │  config.rs    │   │  │
│  │  │          │  │           │  │  (keyring +   │   │  │
│  │  │ OAuth +  │  │ Timer +   │  │   store.bin)  │   │  │
│  │  │ REST API │  │ OS Notify │  │              │   │  │
│  │  └─────┬────┘  └─────┬────┘  └──────────────┘   │  │
│  │        │              │                           │  │
│  └────────┼──────────────┼───────────────────────────┘  │
│           │              │                               │
│  ┌────────▼──────────────▼──┐                           │
│  │      System Tray         │                           │
│  │   (show/hide/quit/badge) │                           │
│  └──────────────────────────┘                           │
└─────────────────────────────────────────────────────────┘
           │              │
           ▼              ▼
   ┌──────────────┐ ┌───────────────────┐
   │ GitHub API   │ │ OS Services       │
   │ api.github.  │ │ - Keychain        │
   │ com          │ │ - Notifications   │
   │              │ │ - Default Browser │
   │ - /notifs    │ │ - Audio Playback  │
   │ - /search    │ └───────────────────┘
   │ - /threads   │
   │ - /device    │
   └──────────────┘
```

## Data Flow

### Authentication (OAuth Device Flow)

```
User → Login Button → use-auth.ts → invoke("start_device_flow")
  → auth.rs → GitHubClient::start_device_flow() → POST github.com/login/device/code
  → Returns { user_code, verification_uri }
  → Frontend shows code, user opens browser
  → Polling: invoke("poll_device_flow") → POST github.com/login/oauth/access_token
  → Token saved to OS Keychain (keyring crate) → Session established
```

### Notification Polling

```
start_polling (Tauri command)
  → Spawns tokio::spawn background loop
  → Every N seconds: GitHubClient::get_notifications()
    → GET api.github.com/notifications
    → Compare with previous set → detect new notifications
    → New found → tauri-plugin-notification → OS notification + audio.rs sound
    → Frontend receives updated list via Tauri event
```

### Mark as Read

```
User clicks "Mark read" → useInbox.markAsRead(threadId)
  → invoke("mark_inbox_read", { threadId })
  → PATCH api.github.com/notifications/threads/{id}
  → Local state update → UI reflects immediately
```

## Directory Structure

```
github-notify/
├── src/                          # React frontend
│   ├── components/
│   │   ├── inbox/                # Notification inbox UI
│   │   ├── dashboard/            # PR review dashboard
│   │   ├── settings/             # Settings dialog
│   │   └── ui/                   # Shared UI primitives (shadcn-style)
│   ├── hooks/                    # React hooks (useInbox, useAuth, useSettings, ...)
│   ├── lib/                      # Utilities (cn, tauri-commands wrapper)
│   └── types/                    # TypeScript type definitions
├── src-tauri/
│   └── src/
│       ├── commands/             # Tauri IPC command handlers
│       │   ├── auth.rs           # OAuth Device Flow
│       │   ├── notifications.rs  # Inbox CRUD + filtering
│       │   └── settings.rs       # App settings + keychain check
│       ├── background/           # Background polling + OS notifications
│       │   └── polling.rs
│       ├── github/               # GitHub API client
│       │   ├── client.rs         # REST client (reqwest)
│       │   └── secrets.rs        # OAuth client ID (git-crypt encrypted)
│       ├── storage/              # Persistence layer
│       │   └── config.rs         # Keychain token + store.bin fallback
│       ├── audio.rs              # Notification sound playback (rodio)
│       ├── error.rs              # Unified error types (thiserror)
│       └── lib.rs                # Tauri app builder + plugin setup
├── .github/workflows/
│   ├── ci.yml                    # Lint, typecheck, test, build, audit
│   └── release.yml               # Multi-platform release builds
└── docs/
    ├── architecture.md           # This file
    └── completion-criteria-*.md  # Acceptance criteria tracking
```

## Security Model

| Concern | Implementation |
|---------|---------------|
| Token storage | OS Keychain via `keyring` crate (macOS Keychain, Windows Credential, Linux Secret Service). Falls back to `store.bin` with warning. |
| Client secret | `secrets.rs` encrypted with git-crypt. Never committed in plaintext. |
| CSP | `default-src 'self'; connect-src 'self' https://api.github.com https://github.com; img-src 'self' data: https://avatars.githubusercontent.com; style-src 'self' 'unsafe-inline'` |
| Capabilities | Minimal Tauri permissions. `shell:open` restricted to `https://github.com/**` and `https://api.github.com/**`. |
| External comms | Only `api.github.com` and `github.com`. No telemetry, no third-party services. |
