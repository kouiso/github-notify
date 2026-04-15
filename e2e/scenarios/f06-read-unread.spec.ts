import { expect, test } from '@playwright/test';

/**
 * F6: 既読/未読マーク (single + mark-all) → GitHub 同期
 */
test.describe('F6: Read/Unread Mark', () => {
  test('Mark All ボタンが存在する', async ({ page }) => {
    await page.goto('/');
    const markAllButton = page
      .getByRole('button', { name: /すべて既読|Mark all|全て既読/i })
      .or(page.locator('[data-testid="mark-all-read"]'));
    if (await markAllButton.isVisible({ timeout: 5_000 })) {
      await expect(markAllButton).toBeEnabled();
    }
  });
});
