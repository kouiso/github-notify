# CI の共通入口

`task ci:fast` はフロントエンドの lint、型検査、coverage 付きテスト、ビルドを実行する。
`task ci` は authenticated a11y、Rust の全検査、両依存監査も実行する。
各検査の失敗は後続の成功で上書きしない。

GitHub の各ジョブは同じ `scripts/ci.sh` の対象モードを呼び出す。
ジョブ名、matrix、必要な OS ライブラリ、暗号化ファイルの解除は維持する。
Rust ビルドの Debug/Release 条件も変更しない。
フロントエンドの依存は CI と同じ pnpm 固定ファイルで取得する。

`.mise.toml` の Node、pnpm、Rust を用意する。
full CI には Playwright Chromium、cargo-audit、OS ライブラリも必要になる。
Rust の検査前には既存の手順でソースを解除した状態にする。
共通入口は鍵の作成、置換、保存先の変更を行わない。

検査集合と故障伝播は次の契約検査で確認できる。

```bash
bash scripts/test-ci-contract.sh
```

この契約検査は pnpm と cargo の代替を使う。
実際のアプリ、Rust、a11y の成功証跡とは区別する。
