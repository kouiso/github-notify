# github-notify

Desktop notification app for GitHub events. Built with Tauri (Rust + TypeScript/Vite).

> ⚠️ `.gemini/styleguide.md` and `.github/copilot-instructions.md` are auto-generated from this file
> by `scripts/sync-ai-rules.sh`. Do NOT edit them directly.

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Tauri (Rust + TypeScript) |
| Frontend | Vite + TypeScript |
| Linter | Biome + ESLint |
| Runtime | Node.js ≥25 (frontend) + Rust (backend) |

## Commands

```bash
pnpm install             # Install dependencies
pnpm dev                 # Start Tauri dev server
pnpm build               # Build Tauri desktop app
pnpm lint                # Biome + ESLint lint
pnpm lint:fix            # Auto-fix lint issues
cargo build              # Build Rust backend
cargo test               # Run Rust tests
```

## Coding Rules

- Comments: Japanese, explain *why* only (not what)
- Commit messages: English, Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- No `any` types / No `@ts-ignore` / No `eslint-disable` (fix root cause)
- `git reset --hard/--soft/--mixed` forbidden
- `--no-verify` forbidden / `--force` forbidden (use `--force-with-lease` only)

## GitHub Project での作業管理

- この repo の作業は GitHub Project（`.github/scrum-board.yml` の番号）で管理する
- 次にやる物と、課題の起こし方は `.agents/skills/scrum-board/SKILL.md`
- Status は Backlog / In progress / In review / Done の 4 つ。Todo は作らん
