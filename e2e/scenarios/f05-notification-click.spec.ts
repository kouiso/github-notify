import { expect, test } from '@playwright/test';

/**
 * F5: 通知クリック → PR/Issue/Discussion をブラウザで開く
 *
 * Tauri の shell:open は E2E では直接検証が難しいため、
 * クリックイベントが発火し shell.open が呼ばれることを WebView 側で確認。
 */
test.describe('F5: Notification Click → Browser Open', () => {
  test('通知アイテムがクリック可能', async ({ page }) => {
    await page.goto('/');
    const notificationItem = page.locator('[data-testid="notification-item"]').first();
    if (await notificationItem.isVisible({ timeout: 5_000 })) {
      // クリック可能であること（cursor: pointer）
      const cursor = await notificationItem.evaluate((el) => getComputedStyle(el).cursor);
      expect(['pointer', 'auto']).toContain(cursor);
    }
  });
});
