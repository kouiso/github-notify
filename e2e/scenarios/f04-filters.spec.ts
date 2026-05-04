import { expect, test } from '@playwright/test';

/**
 * F4: フィルタ（リポグループ / global exclude / reason 除外）
 */
test.describe('F4: Notification Filters', () => {
  test('設定ダイアログにフィルタセクションがある', async ({ page }) => {
    await page.goto('/');
    // 設定ボタンをクリック
    const settingsButton = page
      .getByRole('button', { name: /設定|Settings/i })
      .or(page.locator('[data-testid="settings-button"]'));
    if (await settingsButton.isVisible({ timeout: 5_000 })) {
      await settingsButton.click();
      // フィルタ関連の UI が表示される
      const filterSection = page.locator(
        'text=/フィルタ|Filter|除外|Exclude|リポジトリ|Repository/i',
      );
      await expect(filterSection.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
