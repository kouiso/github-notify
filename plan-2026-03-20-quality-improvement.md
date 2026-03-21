# 品質改善計画 — Phase 2 + Phase 5

作成日: 2026-03-20
ステータス: 未着手

## Phase 2: God Component 分割

### 2-1: inbox-list.tsx (869行)
**分割先:**
- `src/components/inbox/inbox-filter.tsx` — フィルタリングUI
- `src/components/inbox/inbox-item.tsx` — 個別通知アイテム (React.memo適用)
- `src/components/inbox/inbox-empty-state.tsx` — 空状態表示
- `src/components/inbox/inbox-list.tsx` — コンテナ (分割後200行以下)

### 2-2: settings-dialog.tsx (857行)
**分割先:**
- `src/components/settings/settings-general.tsx` — 一般設定タブ
- `src/components/settings/settings-notification.tsx` — 通知設定タブ
- `src/components/settings/settings-account.tsx` — アカウントタブ
- `src/components/settings/settings-dialog.tsx` — ダイアログシェル

### 2-3: dashboard.tsx (647行)
**分割先:**
- `src/components/dashboard/dashboard-stat-card.tsx` — 統計カード
- `src/components/dashboard/dashboard-pr-list.tsx` — PR一覧
- `src/components/dashboard/dashboard-repo-filter.tsx` — リポジトリフィルタ
- `src/components/dashboard/dashboard.tsx` — レイアウトコンテナ

### 2-4: sidebar.tsx (602行)
**分割先:**
- `src/components/layout/sidebar-nav-item.tsx` — ナビゲーションアイテム
- `src/components/layout/sidebar-filter-list.tsx` — フィルタリスト
- `src/components/layout/sidebar.tsx` — サイドバーコンテナ

### 2-5: use-inbox.ts (332行 → 分割後)
**分割先:**
- `src/hooks/use-inbox-fetch.ts` — データ取得・キャッシュ
- `src/hooks/use-inbox-notification.ts` — デスクトップ通知
- `src/hooks/use-inbox-polling.ts` — バックグラウンドポーリング
- `src/hooks/use-inbox.ts` — 統合フック (各サブフックを組み合わせ)

### 分割時の注意事項
- 分割前にスナップショットテスト追加
- 分割後に全既存テストがパスすることを確認
- Props interfaceは各コンポーネントファイル内で定義
- 分割後の各ファイルは300行以下を目標

---

## Phase 5: IPC 型安全化

### 5-1: valibot 導入 (バンドルサイズ重視)
```bash
npm install valibot
```
- Zodより軽量 (tree-shakeable)
- TypeScript first

### 5-2: IPC 応答スキーマ定義
**対象ファイル:** `src/lib/tauri/commands.ts`

各Tauri command の戻り値に対応するvalibotスキーマを定義:
```typescript
import * as v from 'valibot';

const InboxItemSchema = v.object({
  id: v.string(),
  title: v.string(),
  unread: v.boolean(),
  repositoryFullName: v.string(),
  reason: v.string(),
  // ...
});

// invoke結果をparse
const data = v.parse(v.array(InboxItemSchema), rawData);
```

### 5-3: エラー型統一
- Rust側の `AppError` enum とTS側のエラー型を対応付け
- discriminated union で型安全なエラーハンドリング

---

## Phase 1-1: トークンをOS Keychainへ移行 (Rust側変更)

### 概要
`tauri-plugin-store` の平文保存から `keyring` クレートへの移行

### 手順
1. `Cargo.toml` に `keyring = "3"` 追加
2. `src-tauri/src/storage/config.rs` のトークン読み書きをkeyring経由に変更
3. マイグレーション処理: 旧store読み取り → keychain書き込み → 旧store削除
4. Tauri capabilitiesの更新は不要（keyringはネイティブAPI直接呼び出し）

### リスク
- macOS: Keychain Access の権限ダイアログが表示される
- Linux: `libsecret` の存在が前提
- CI: headless環境ではkeyringが使えないため、テストではmock必要

---

## Phase 4-2〜4-5: アクセシビリティ・パフォーマンス

### セマンティックHTML
- `src/App.tsx`: ルートを`<main>`で囲む
- `src/components/layout/sidebar.tsx`: `<nav>` + `<aside>`
- `src/components/inbox/inbox-list.tsx`: `<section>` + `<article>`

### React.memo
- Phase 2で分割した `inbox-item.tsx` に適用
- `sidebar-nav-item.tsx` に適用

### React.lazy
- `SettingsDialog` と `Dashboard` をlazy load
- `Suspense` fallbackにスケルトンUI

---

## 優先度

| Phase | 優先度 | 理由 |
|-------|--------|------|
| Phase 2 (分割) | HIGH | 保守性の根幹。現状のGod Componentはバグの温床 |
| Phase 5 (IPC型安全) | HIGH | ランタイムエラーの防止。Rust↔TS境界が無防備 |
| Phase 1-1 (Keychain) | MEDIUM | セキュリティ改善だが、デスクトップアプリなのでリスクは限定的 |
| Phase 4 (a11y/perf) | MEDIUM | UX改善。段階的に進められる |
