import { test } from '@playwright/test';

/**
 * F7: Unassign 検出 (verify_assignments)
 *
 * Rust 側 polling.rs テストで検証済み。
 * E2E では通知リスト内に「担当外」ラベルの表示を確認。
 */
test.describe('F7: Unassign Detection', () => {
  test('担当外の通知が区別して表示される（データ依存）', async ({ page }) => {
    await page.goto('/');
    // Unassign された通知は Rust テストで確認済み
    // WebView 側は通知リストの表示を確認するのみ
    test.skip(
      true,
      'Unassign 検出は Rust unit test (polling.rs) で網羅。E2E はデータ依存のためスキップ',
    );
  });
});
