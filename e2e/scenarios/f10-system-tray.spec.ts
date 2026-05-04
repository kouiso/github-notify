import { test } from '@playwright/test';

/**
 * F10: システムトレイ — show / hide / quit
 *
 * システムトレイはネイティブ OS 機能のため Playwright WebView テストでは
 * 直接操作できない。Rust 側の tray setup コードで検証。
 * ここではスキップとして記録し、手動テスト or ネイティブ E2E ツールで対応。
 */
test.describe('F10: System Tray', () => {
  test('システムトレイはネイティブ層テスト（WebView E2E 対象外）', async () => {
    test.skip(
      true,
      'システムトレイ操作は Tauri ネイティブ層。lib.rs の setup コードで実装済み。手動検証対象',
    );
  });
});
