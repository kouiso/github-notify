# 開発ガイド

## コマンド

### npm スクリプト

```bash
npm run dev              # Vite 開発サーバー起動（HMR 対応）
npm run build            # TypeScript コンパイル + Vite ビルド
npm run preview          # ビルド済みアプリをローカルプレビュー
npm run lint             # ESLint + Prettier チェック
npm run lint:fix         # ESLint 自動修正 + Prettier フォーマット
npm run format           # Prettier フォーマットのみ
npm run format:check     # Prettier フォーマットチェック
npm run tauri            # Tauri CLI プロキシ
npm run tauri dev        # Tauri 開発モード起動
npm run tauri build      # Tauri プロダクションビルド
```

### Rust ビルド

```bash
# デバッグビルド
cargo build -p github-notify

# リリースビルド（最適化）
cargo build -p github-notify -r
```

## プロジェクト構成

```
github-notify/
├── src/                          # React フロントエンド
│   ├── main.tsx                  # エントリーポイント
│   ├── App.tsx                   # ルートコンポーネント
│   ├── components/
│   │   ├── ui/                   # 汎用 UI コンポーネント
│   │   ├── auth/                 # 認証関連
│   │   ├── layout/               # レイアウト（サイドバー等）
│   │   ├── inbox/                # 受信トレイ
│   │   ├── notification/         # 通知一覧
│   │   ├── stream/               # ストリーム管理
│   │   └── settings/             # 設定ダイアログ
│   ├── hooks/                    # カスタムフック
│   ├── lib/
│   │   ├── tauri/commands.ts     # Tauri IPC コマンドラッパー
│   │   └── utils/cn.ts           # Tailwind クラス名ユーティリティ
│   └── types/                    # TypeScript 型定義
├── src-tauri/                    # Rust バックエンド
│   ├── src/
│   │   ├── main.rs               # Tauri エントリーポイント
│   │   ├── commands/             # IPC コマンドハンドラ
│   │   ├── github/               # GitHub API クライアント
│   │   ├── background/           # バックグラウンドポーリング
│   │   ├── storage/              # 永続化ストレージ
│   │   ├── audio.rs              # 通知音再生
│   │   └── error.rs              # エラー型定義
│   ├── Cargo.toml                # Rust 依存関係
│   ├── tauri.conf.json           # Tauri アプリ設定
│   └── resources/sounds/         # 通知サウンドファイル
├── prompt/                       # AI プロンプトシステム
│   ├── instructions/             # 指示ファイル
│   └── agents/                   # 専門エージェント定義
└── openspec/                     # Spec-driven 開発フレームワーク
```

## コーディング規約

- ディレクトリ・ファイル
  - コンポーネントファイルは kebab-case で命名（`login-screen.tsx`）
  - ユーティリティファイルは camelCase で命名（`commands.ts`）

- TypeScript
  - `any` 型は完全禁止
  - `as` 型アサーションは `as const` を除き禁止
  - 型ユーティリティ（`Omit`, `Pick`, `Partial` 等）を積極活用
  - アロー関数をデフォルトとして使用

- React
  - 関数コンポーネント（アロー関数）を使用
  - カスタムフックでロジックを分離
  - Props 型はコンポーネント名 + `Props` で命名

- Rust
  - `thiserror` でカスタムエラー型を定義
  - `anyhow` は Tauri コマンドハンドラのみで使用
  - 非同期処理は Tokio ランタイムを使用

## アーキテクチャ

### フロントエンド ↔ バックエンド通信

Tauri の IPC（Inter-Process Communication）でフロントエンドとRustバックエンドが通信する。

1. フロントエンド: `src/lib/tauri/commands.ts` で Tauri コマンドを呼び出し
2. バックエンド: `src-tauri/src/commands/` で IPC コマンドをハンドリング
3. GitHub API 通信は全て Rust 側で処理（`reqwest` + `rustls-tls`）

### バックグラウンドポーリング

`src-tauri/src/background/polling.rs` で GitHub 通知を定期的にポーリングする。
新しい通知がある場合、フロントエンドにイベントを発火し、通知音を再生する。

## Git フック

Husky + lint-staged で pre-commit フックを実行：

- `*.{js,jsx,ts,tsx}` → ESLint 自動修正 + Prettier フォーマット
- `*.{json,md,yml,yaml}` → Prettier フォーマット
- `*.css` → Prettier フォーマット

## Debugger

### フロントエンド

1. ブラウザの DevTools を使用（`npm run dev` で起動時）
2. React Query Devtools でクエリ状態を確認

### Rust バックエンド

1. `src-tauri/src/` 内で `log::info!`, `log::error!` 等でログ出力
2. Tauri のログプラグイン（`tauri-plugin-log`）でファイルに保存
3. VS Code の Rust Analyzer + CodeLLDB でブレークポイントデバッグ
