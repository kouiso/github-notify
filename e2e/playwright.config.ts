import { defineConfig } from '@playwright/test';

/**
 * Tauri E2E テスト用 Playwright 設定
 *
 * Tauri アプリの WebView に接続してテストを実行する。
 * `tauri dev` が事前起動済みであること、または CI で `tauri build --debug` 後に
 * バイナリ起動 → WebDriver 接続する構成を想定。
 *
 * ローカル実行: TAURI_E2E_URL=http://127.0.0.1:5175 pnpm exec playwright test -c e2e/playwright.config.ts
 * CI 実行:      release バイナリ + WebDriver 経由（将来対応）
 */
export default defineConfig({
  testDir: './scenarios',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.TAURI_E2E_URL ?? 'http://127.0.0.1:5175',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'tauri-webview',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
