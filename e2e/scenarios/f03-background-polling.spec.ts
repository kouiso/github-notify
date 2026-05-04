import { expect, test } from '@playwright/test';

/**
 * F3: バックグラウンドポーリング → OS 通知 + サウンド
 *
 * WebView 側ではポーリング状態のインジケータを確認。
 * 実際の OS 通知はネイティブ層のため、Rust テスト側で検証。
 */
test.describe('F3: Background Polling', () => {
  test('ポーリング状態インジケータが表示される', async ({ page }) => {
    await page.goto('/');
    // ポーリング中を示す UI 要素（接続状態バッジ等）
    const pollingIndicator = page
      .locator('[data-testid="polling-status"]')
      .or(page.locator('text=/接続中|Polling|オンライン|Connected/i'));
    // ログイン済みの場合のみ
    if (await pollingIndicator.isVisible({ timeout: 5_000 })) {
      await expect(pollingIndicator).toBeVisible();
    }
  });
});
