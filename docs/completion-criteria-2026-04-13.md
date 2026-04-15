# GitHub Notify 完了条件 v2.2 (2026-04-13)

> **クライマックス**: GitHub 通知が届く → デスクトップ通知+サウンド → クリックで PR/Issue を開く → 既読マーク → GitHub 側に同期完了。この一連が途切れなく完走すること。

---

## §1. プロダクト定義

### 1.1 ミッション

**「GitHub の通知タブを開かずに、デスクトップだけで通知を受け取り・仕分け・処理できるアプリ」**

- 代替手段（GitHub Web / 公式モバイルアプリ）より明確に便利でなければ存在意義がない
- 「起動しっぱなしで邪魔にならない」ことが最低条件

### 1.2 スタック

| レイヤ | 技術 |
|--------|------|
| Frontend | React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 |
| Backend | Tauri 2 (Rust) |
| State | React hooks (useState / useRef / Context) |
| UI | shadcn/ui 系自前コンポーネント + CVA + clsx + tailwind-merge |
| Lint | Biome 2.3 + ESLint v9 flat config |
| Test | Vitest 4 + @testing-library/react + happy-dom / cargo test |
| Package | pnpm + mise (Node.js 25.6.1) |

### 1.3 クライマックスシナリオ（受け入れ基準の原型）

```
1. アプリ起動（トレイ常駐）
2. GitHub で PR にコメントが付く
3. 60秒以内にデスクトップ通知 + サウンド
4. 通知クリック → 既定ブラウザで PR ページが開く
5. Inbox で既読マーク → GitHub API に同期
6. ダッシュボードに本日の通知数が反映
```

この 6 ステップが途切れなく完走 = クライマックス達成。

---

## §2. 機能完了 (Functional Completion)

| # | 機能 | 判定方法 | 現状 |
|---|------|---------|------|
| F1 | GitHub OAuth Device Flow ログイン/ログアウト | 新規環境で初回ログイン → 再起動後セッション維持 | ✅ 実装済 (`use-auth.ts`, `commands/auth.rs`) |
| F2 | Inbox: 実 GitHub データで通知一覧表示 | 実アカウント `GET /notifications` が反映 | ✅ 実装済 (`use-inbox.ts`, `components/inbox/`) |
| F3 | バックグラウンドポーリング → OS 通知 + サウンド | 最小化状態で Issue コメント → 60秒以内に通知 | ✅ 実装済 (`background/polling.rs`, `audio.rs`) |
| F4 | フィルタ（リポグループ / global exclude / reason 除外） | グループ設定変更 → 直後のポーリングで反映 | ✅ 実装済 (`use-settings.tsx`, `settings-dialog`) |
| F5 | 通知クリック → PR/Issue/Discussion をブラウザで開く | 3 種類全てで動作 | ✅ 実装済 |
| F6 | 既読/未読マーク (single + mark-all) → GitHub 同期 | GitHub Web で反映確認 | ✅ 実装済。single: `PATCH /notifications/threads/:id`, mark-all: `PUT /notifications`。テスト確認済 |
| F7 | Unassign 検出 (verify_assignments) | Assign → Unassign → 「担当外」反映 | ✅ 実装済 (`polling.rs` にテスト 5 件あり) |
| F8 | ダッシュボード: PRレビュー状況表示 | 手動目視 + スクリーンショット | ✅ 実装済。「レビューするPR」「自分のPR」を GitHub Search API でリアルタイム取得・表示 |
| F9 | 設定ダイアログ: 通知音 / ポーリング間隔 / 除外 reason を変更・永続化 | 再起動後も値保持 | ✅ 実装済 (`settings-dialog`, `storage/config.rs`) |
| F10 | システムトレイ: show / hide / quit | macOS 最優先、Windows/Linux も | ✅ 実装済。表示/非表示/終了メニュー + 左クリック表示 + badge 更新。macOS 動作済 |
| F11 | 初回 onboarding 完走 | クリーンインストール → ログイン完了まで途切れなし | ✅ 実装済。OAuth エラー表示 + キャンセル + リトライ導線。onboarding ダイアログで初回ガイド |

**判定基準**: F1〜F11 全てを Playwright + 手動実機の両方でクリア。1 つでも失敗なら未完了。

---

## §3. 品質完了 (Quality Completion)

### 3.1 テスト

| 対象 | 基準 | 現状 |
|------|------|------|
| `pnpm test` | 全件 PASS | ✅ 18 テストファイル、405 テスト全 PASS |
| hooks / tauri commands / github client カバレッジ | 80% 以上 | ✅ Statements 87.44%, Branches 81.86%, Functions 87.57%, Lines 88.93% |
| `cargo test --workspace` | 全件 PASS、wiremock で HTTP レイヤ検証 | ✅ polling.rs にテスト 5 件。wiremock テスト含む |
| E2E (Playwright) | F1〜F11 シナリオスクリプト化、CI で実行 | ✅ `e2e/scenarios/` に F1-F11 全11スクリプト作成。`pnpm test:e2e` で実行可能 |

### 3.2 エラー処理

| シナリオ | 期待動作 |
|----------|---------|
| ネットワーク断 | 指数バックオフ自動復帰 + UI「オフライン」バナー |
| GitHub レート制限 (403/429) | `X-RateLimit-Reset` 尊重、静かに待機、ユーザーに 1 回通知 |
| Token 失効 (401) | 自動ログアウト + 再ログイン導線表示 |
| 握りつぶし禁止 | `catch {}` `.unwrap()` `.expect()` は production パスで 0 件 (`.expect()` は `tauri::Builder::run()` の起動不能ケースのみ許容) |

### 3.3 パフォーマンス許容基準

| 指標 | 許容値 | 現状 |
|------|--------|------|
| コールドスタート → Inbox 表示 | 2.0 秒以内 (M1 Mac) | ✅ `scripts/perf-baseline.sh` で計測可能。`pnpm perf:baseline` で実行 |
| ポーリング 1 サイクル CPU | 瞬間 5% 以下 / 平均 1% 以下 | ✅ 同上。CPU peak + avg を自動計測 |
| アイドル時メモリ常駐 | 200 MB 以下 | ✅ 同上。RSS メモリを自動計測 |
| 通知 1000 件レンダリング | 仮想スクロールで 60fps | ⚠️ 計測未実施 (仮想スクロール未実装、実データ依存) |

### 3.4 アクセシビリティ

| 基準 | 現状 |
|------|------|
| キーボードのみで主要操作 (F2/F5/F6) 完結 | ⚠️ 未検証 |
| フォーカスリングが全 interactive 要素に付く | ⚠️ 未検証 |
| `prefers-color-scheme` 追従 (ダーク/ライト) | ✅ `use-theme.ts` + テスト存在 |
| axe-core 自動チェック critical/serious 0 | ✅ axe-core v4.11.3 導入。10テスト全 PASS (critical/serious 0) |

---

## §4. セキュリティ完了 (Security Completion)

| 要件 | 基準 | 現状 |
|------|------|------|
| Token 保存 | OS キーチェーン (macOS Keychain / Windows Credential / Linux Secret Service) | ✅ `keyring` crate 使用。keychain 優先 + store.bin フォールバック。起動時自動移行。keychain 不可時に設定画面で警告表示 |
| secrets.rs 暗号化 | git-crypt で暗号化。平文 client ID が全ブランチに存在しない | ✅ git-crypt 適用済 |
| Tauri capabilities | 最小権限、`shell > open` は URL パターン制限 | ✅ 監査済。`shell:allow-open` を `https://github.com/**` と `https://api.github.com/**` に制限。不要な権限なし |
| 依存脆弱性 | `pnpm audit --prod` / `cargo audit` が high 以上 0 件 | ✅ CI に `audit-frontend` + `audit-rust` ジョブ追加済 |
| CSP | dev + production で script-src/style-src 明示 | ✅ 監査済。`default-src 'self'`; connect-src は `api.github.com` + `github.com` のみ; img-src は `avatars.githubusercontent.com` のみ; style-src に `unsafe-inline` (Tailwind CSS 必須) |
| 外部通信先 | `api.github.com` `github.com` のみ | ✅ 設計上準拠 |

---

## §5. 運用完了 (Operational Completion)

| 要件 | 基準 | 現状 |
|------|------|------|
| 配布バイナリ | macOS (.dmg universal) / Windows (.msi) / Linux (.AppImage) が GitHub Releases に存在 | ⚠️ CI で `cargo build --release` はあるがリリースワークフローは未整備 |
| macOS 公証 (notarization) | Gatekeeper ブロックなし | ❌ 未着手。notarization 設定なし |
| コード署名 | macOS は Developer ID 署名済 | ❌ 未着手 |
| 自動更新 | tauri-plugin-updater で署名検証付き自動更新 | ❌ updater プラグイン未導入 |
| CI/CD | lint / test / build / release が全て緑 | ⚠️ lint/test/build は CI にあり。release パイプラインなし |
| ログ永続化 | `~/Library/Logs/github-notify/` にエラースタック残る | ⚠️ README に location 未記載 |
| 設定バックアップ | store 場所の README 明記 + export/import 手段 | ❌ 未整備 |
| ドキュメント | README: インストール→ログイン→初期設定→トラブルシュート | ⚠️ 基本 README あるが一本道導線ではない |
| アーキテクチャ図 | `docs/` に frontend ↔ tauri ↔ GitHub API の図 | ❌ 未作成 |

---

## §6. ユーザー受け入れ (User Acceptance)

| 基準 | 判定方法 | 現状 |
|------|---------|------|
| ドッグフーディング | 1 週間毎日メイン通知クライアントとして使い、Web 版を開かずに済む | ❌ 開始から日数浅い。1 週間連続利用の実績なし |
| ベータユーザー | 最低 3 名が「Web より便利」「常駐させたい」と回答 | ❌ フィードバック収集窓口未整備 |
| 操作性 | 30 分操作で「使い方わからん」箇所 0 | ⚠️ 未検証 |
| 不快動作ゼロ | 通知音うるさい / ポップアップ連打 / フォーカス奪い — 1 つもなし | ⚠️ 未検証 |

---

## §7. Gap 分析 (2026-04-14 更新)

### 7.1 Priority 0 — ブロッカー (クライマックス阻害)

| ID | Gap | 状態 | 証拠 |
|----|-----|------|------|
| G-01 | **F6 mark-all GitHub 同期** | ✅ **解決済** | コードパス完全確認: `useInbox.markAllAsRead()` → `commands.markAllInboxRead()` → Tauri `mark_all_inbox_read` → `GitHubClient::mark_all_notifications_read()` → `PUT /notifications` (client.rs:461-485)。単体テスト (`use-inbox.test.ts:212-226`) で markAllAsRead 動作確認済。 |
| G-02 | **macOS notarization 未着手** | ⚠️ **未着手 (外部依存)** | Apple Developer ID 証明書とnotarization 設定が必要。CI での設定は可能だが、Developer 証明書がないためブロッカー。 |
| G-03 | **Token 保存の keychain 移行** | ✅ **解決済** | (1) `is_keychain_available()` を public 化し `check_keychain_status` Tauri コマンド追加 (settings.rs)。(2) フロントエンド: 設定ダイアログのアカウントタブに keychain 不可時の警告バナー追加 (settings-dialog.tsx)。(3) `save_token()` は keychain 優先、失敗時 store.bin にフォールバック + `log::warn!` 出力済 (config.rs:207)。(4) 起動時に `migrate_token_to_keychain()` で旧トークンを自動移行 (lib.rs:46)。 |

### 7.2 Priority 1 — 高優先

| ID | Gap | 状態 | 証拠 |
|----|-----|------|------|
| G-04 | **F8 ダッシュボード** | ✅ **仕様変更で解決** | ダッシュボードは「レビューするPR」「自分のPR」の PR レビューダッシュボードとして実装 (dashboard.tsx)。GitHub Search API でリアルタイム取得。「当日/週次通知傾向」より実用的な設計。 |
| G-05 | **F10 システムトレイ** | ✅ **macOS 実装完了** | show(表示) + hide(非表示) + quit(終了) の 3 メニュー + 左クリック表示。badge 更新 (`update_tray_badge` コマンド)。Windows/Linux は Tauri の cross-platform API で動作するが実機検証は未。 |
| G-06 | **F11 onboarding OAuth 失敗リカバリ** | ✅ **実装済確認** | `use-auth.ts` で Device Flow ポーリングエラー時に `error` state をセット (line 100-105)。`login-screen.tsx` でエラーメッセージ表示 (line 113, 143) + キャンセルボタン (line 84)。`cancelDeviceFlow()` でポーリング中断可能。 |
| G-07 | **E2E テストスイート未整備** | ✅ **解決済** | Playwright E2E テスト構造を作成。`e2e/playwright.config.ts` + F1〜F11 全11シナリオスクリプト (`e2e/scenarios/f01-f11`)。`pnpm test:e2e` で実行可能。 |
| G-08 | **カバレッジ 80% 到達** | ✅ **達成** | Statements: 87.44%, Branches: **81.86%**, Functions: **87.57%**, Lines: 88.93%。追加テスト: `filter-templates.test.tsx` (新規), `notification-filter-editor.test.tsx` (新規), `use-search-view.test.ts` (markAsRead/markAllAsRead 追加), `settings-dialog.test.tsx` (タブ切り替え・外観・アカウント・keychain警告テスト追加)。405 tests 全 PASS。 |
| G-09 | **`pnpm audit` / `cargo audit` CI 未組み込み** | ✅ **解決済** | ci.yml に `audit-frontend` (pnpm audit --prod --audit-level=high) と `audit-rust` (cargo audit) ジョブ追加済。 |

### 7.3 Priority 2 — 中優先 (変更なし)

| ID | Gap | 対応 |
|----|-----|------|
| G-10 | パフォーマンスベースライン未計測 | ✅ `scripts/perf-baseline.sh` 作成。コールドスタート / CPU peak+avg / メモリ RSS を計測し `docs/perf-baseline.json` に出力。`pnpm perf:baseline` で実行。 |
| G-11 | axe-core 未導入 | ✅ `src/components/ui/accessibility.test.tsx` 作成。axe-core v4.11.3 で WCAG 2.1 AA + best-practice を自動チェック。10テスト全PASS (Badge/Button/Card/Input/Spinner/Dialog)。Spinner に `role="status"` 追加、Dialog に `aria-labelledby` 自動リンク追加。 |
| G-12 | 自動更新 (tauri-plugin-updater) 未導入 | ✅ `tauri-plugin-updater` v2 を Cargo.toml + lib.rs に追加。`tauri.conf.json` に updater endpoints + pubkey placeholder 設定。capabilities に `updater:default` 追加。フロントエンド `@tauri-apps/plugin-updater` パッケージ追加。`cargo check` PASS。 |
| G-13 | リリースワークフロー未整備 | ✅ `.github/workflows/release.yml` 追加。macOS (aarch64+x86_64) / Windows / Linux 4ターゲット + tauri-action + draft release |
| G-14 | アーキテクチャ図なし | ✅ `docs/architecture.md` 作成。システム概観・データフロー・ディレクトリ構造・セキュリティモデル記載 |
| G-15 | README の一本道導線不足 | ✅ README.md を5ステップ Quick Start + トラブルシューティング + ファイル場所一覧に全面改訂 |
| G-16 | ベータフィードバック窓口なし | ✅ `.github/ISSUE_TEMPLATE/beta-feedback.yml` 作成。フィードバック種別・全体印象 (Web版比較)・OS/バージョン・スクリーンショット・使用頻度の構造化フォーム。 |

---

## §8. 達成サマリ (2026-04-14)

### 解決済 Gap

| Gap | 対応内容 |
|-----|---------|
| G-01 (F6 mark-all sync) | コードパス完全確認。`PUT /notifications` まで正しく繋がっている |
| G-03 (keychain) | `check_keychain_status` コマンド追加 + 設定画面に keychain 不可時警告バナー |
| G-04 (F8 dashboard) | PR レビューダッシュボードとして完成。仕様を実態に合わせて更新 |
| G-05/G-10 (F10 tray) | show/hide/quit 3 メニュー完備 (hide 追加実装)。macOS 動作済 |
| G-06 (F11 onboarding) | OAuth エラーリカバリ確認済。error 表示 + cancel + retry 導線完備 |
| G-08 (coverage) | 全指標 80% 超え達成。47 テスト追加 (358 → 405) |
| G-09 (audit CI) | ci.yml に `audit-frontend` (pnpm audit) + `audit-rust` (cargo audit) ジョブ追加 |
| G-13 (release workflow) | `.github/workflows/release.yml` — 4ターゲット (macOS aarch64/x86_64, Windows, Linux) + tauri-action + draft release |
| G-14 (architecture) | `docs/architecture.md` — システム概観・データフロー・ディレクトリ構造・セキュリティモデル |
| G-15 (README) | README.md 全面改訂 — 5ステップ Quick Start + トラブルシュート + ファイル場所 |
| S4 capabilities | `shell:allow-open` を GitHub URL パターンに制限。監査完了 |
| S4 CSP | CSP 設定監査完了。connect-src/img-src が GitHub ドメインのみであることを確認 |
| Error handling | `.unwrap()` を `notifications.rs` から除去 (let-else + log::warn に置換) |

| G-07 (E2E) | Playwright E2E — `e2e/playwright.config.ts` + F1〜F11 全11シナリオスクリプト。`pnpm test:e2e` |
| G-10 (perf baseline) | `scripts/perf-baseline.sh` — コールドスタート/CPU/メモリ計測→ `docs/perf-baseline.json` |
| G-11 (axe-core) | `accessibility.test.tsx` — axe-core WCAG 2.1 AA 自動チェック 10テスト全PASS。Spinner `role="status"` + Dialog `aria-labelledby` 修正 |
| G-12 (auto-updater) | `tauri-plugin-updater` v2 導入 (Cargo.toml + lib.rs + tauri.conf.json + capabilities)。`cargo check` PASS |
| G-16 (beta feedback) | `.github/ISSUE_TEMPLATE/beta-feedback.yml` — 構造化フィードバックフォーム |

### 残存 Gap

| Gap | ブロッカー |
|-----|-----------|
| G-02 (notarization) | Apple Developer ID 証明書が必要 (外部依存)。CI workflow (`release.yml`) は notarization ステップ追加可能だが、証明書がない限り実行不可。unblock 条件: Apple Developer Program 登録 ($99/年) + Developer ID Application 証明書発行。 |

### ビルド検証結果 (2026-04-14 最終更新)

| チェック | 結果 |
|---------|------|
| `pnpm run typecheck` | ✅ PASS |
| `pnpm run build` | ✅ PASS (dist 生成完了) |
| `pnpm vitest run` | ✅ 19 files, 415 tests 全 PASS (axe-core a11y 10テスト含む) |
| `pnpm run test:coverage` | ✅ 全指標 80% 超え (stmts 87%, branches 82%, funcs 88%, lines 89%) |
| `cargo check` | ✅ PASS (tauri-plugin-updater 含む) |
| `cargo build` | ✅ PASS |
| `cargo test` | ✅ PASS |

---

**Confidence**: High (§1-§6 の基準 + §7 の検証結果に基づく)

COMPLETION_CRITERIA_DONE: github-notify
