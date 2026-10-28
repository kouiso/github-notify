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
- 次にやる物を決める・課題を起票する・Status を動かす・繰り越す時は、必ず先に `.agents/skills/scrum-board/SKILL.md`（`.claude/skills/scrum-board/`）を読んでから手を付ける
- 読めない・見つからない場合の要点: 次にやる物=盤の「今週の Iteration」で Wait 空の先頭（無ければ「無し」と答える・issue一覧や open PR から選ばない）・課題は題の頭に `[PBI]`/`[SBI]` を付け sub-issue と盤登録と項目（Iteration・Priority・Estimate・Size）までやる・繰り越しは `kouiso/.github` の `scripts/scrum_keeper/scrum_keeper.py --job carryover|okawari` を使う
- Status は Backlog / In progress / In review / Done の 4 つ。Todo は作らん
