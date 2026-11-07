<!-- AUTO-GENERATED from AGENTS.md by scripts/sync-ai-rules.sh -->
<!-- DO NOT HAND-EDIT — changes will be overwritten on next sync -->
<!-- To update: edit AGENTS.md, then run: bash scripts/sync-ai-rules.sh -->

# github-notify

Desktop notification app for GitHub events. Built with Tauri (Rust + TypeScript/Vite).

> ⚠️ `.gemini/styleguide.md` and `.github/copilot-instructions.md` are auto-generated from this file
> by `scripts/sync-ai-rules.sh`. Do NOT edit them directly.

## Repository Instructions

- This file is the single entry point. Also read the repository-root `AGENTS.private.md`
  and the instruction files it references before working on this repository.
- `AGENTS.private.md` preserves the existing repository instructions under git-crypt.
  Use the existing authorized key to read it; if it is still encrypted, report the
  access limitation instead of treating those instructions as absent.
- Keep its contents encrypted in Git. Do not copy them into public documentation,
  generated bridge files, logs, or PR descriptions.
- The current stack, commands, and GitHub Project workflow below take precedence
  over older descriptions in the preserved instructions.

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

- この repo のボードの設定は `.github/scrum-board.yml` にある
- 手順は global skill `scrum-board` に従う
