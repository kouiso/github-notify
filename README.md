# GitHub Notify

A desktop application for managing GitHub notifications, built with React and Tauri.

## Features

- Real-time GitHub notification polling with background monitoring
- OAuth Device Flow authentication (no browser redirect needed)
- Inbox view with notification filtering and search
- Notification sound alerts
- System tray integration
- Cross-platform support (macOS, Windows, Linux)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript 5.9 + Vite 7 |
| Backend | Rust + Tauri 2.9 |
| Styling | Tailwind CSS 4 |
| Code Quality | ESLint 9 + Biome + Husky |

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) >= 1.77.2
- [Node.js](https://nodejs.org/) >= 25.x (LTS recommended)
- npm (included with Node.js)

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
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

See [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) for details.

</details>

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (Frontend + Tauri)
npm run tauri dev
```

### GitHub OAuth App Setup

This app uses GitHub's OAuth Device Flow for authentication. To run your own instance:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Enable **Device Flow** in the app settings
4. Copy the example secrets file and set your Client ID:
   ```bash
   cp src-tauri/src/github/secrets.rs.example src-tauri/src/github/secrets.rs
   ```
5. Edit `src-tauri/src/github/secrets.rs` and replace with your Client ID:
   ```rust
   pub const GITHUB_CLIENT_ID: &str = "your-client-id-here";
   ```

> **Note:** `secrets.rs` is encrypted with [git-crypt](https://github.com/AGWA/git-crypt) and not readable without the decryption key. Contributors must create their own OAuth App and `secrets.rs` file.

## Development

```bash
npm run dev              # Frontend dev server only
npm run build            # Production build
npm run lint             # ESLint + Biome check
npm run lint:fix         # Auto-fix lint issues
npm run format           # Format with Biome
npm run test             # Run tests (Vitest)
npm run test:coverage    # Coverage report
npm run tauri build      # Build desktop app
cargo build -p app-lib   # Build Rust backend only
```

## License

[MIT](LICENSE)
