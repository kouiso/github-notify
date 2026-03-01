# ONBOARDING

チームにジョインしてデスクトップアプリを起動するところまで

## prerequisite

セットアップとその後の開発に必要な依存をインストール

- Machine: MacOS or Windows or Linux
- [Rust](https://www.rust-lang.org/tools/install): 1.77.2 以上（rustup 経由でインストール）
- NodeJS: LTS 推奨（16 以上）
- npm: Node.js に付属

<details>
<summary>Tauri の OS 別依存パッケージ</summary>

Tauri はネイティブ WebView を使用するため、OS ごとに追加パッケージが必要です。

**macOS:**
```bash
xcode-select --install
```

**Windows:**
- Microsoft Visual Studio C++ Build Tools
- WebView2（Windows 10/11 には標準搭載）

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

詳細は [Tauri 公式ドキュメント](https://v2.tauri.app/start/prerequisites/) を参照

</details>

## セットアップ

### ステップ 1: 依存パッケージのインストール

```bash
npm install
```

### ステップ 2: 開発サーバーの起動

フロントエンド（Vite）+ Tauri を同時に起動します：

```bash
npm run tauri dev
```

- フロントエンド: `http://localhost:5173`
- デスクトップウィンドウが自動的に開きます（1200x800）

### 便利なコマンド

```bash
# フロントエンドのみ起動（ブラウザ確認用）
npm run dev

# プロダクションビルド
npm run build

# Tauri アプリのビルド（インストーラー生成）
npm run tauri build

# コード品質チェック
npm run lint

# コード自動修正 + フォーマット
npm run lint:fix
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| **フロントエンド** | React 19 + TypeScript 5.9 + Vite 7 |
| **バックエンド** | Rust + Tauri 2.9 |
| **スタイリング** | Tailwind CSS 4 |
| **フォーム** | React Hook Form + Zod |
| **状態管理** | TanStack React Query |
| **コード品質** | ESLint 9 + Prettier + Husky |

## 定義

- **Tauri 設定**: `src-tauri/tauri.conf.json`
  - ウィンドウサイズ、CSP、ビルドフック等の設定
- **API 仕様**: GitHub GraphQL/REST API を使用
  - 通知取得、認証フローはRust側で処理
