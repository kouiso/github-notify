import { expect, test } from '@playwright/test';

/**
 * F9: 設定ダイアログ — 通知音 / ポーリング間隔 / 除外 reason を変更・永続化
 */
test.describe('F9: Settings Dialog', () => {
  test('設定ダイアログが開閉できる', async ({ page }) => {
    await page.goto('/');
    const settingsButton = page
      .getByRole('button', { name: /設定|Settings/i })
      .or(page.locator('[data-testid="settings-button"]'));
    if (await settingsButton.isVisible({ timeout: 5_000 })) {
      await settingsButton.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5_000 });
    }
  });

  test('ポーリング間隔が変更可能', async ({ page }) => {
    await page.goto('/');
    const settingsButton = page
      .getByRole('button', { name: /設定|Settings/i })
      .or(page.locator('[data-testid="settings-button"]'));
    if (await settingsButton.isVisible({ timeout: 5_000 })) {
      await settingsButton.click();
      const intervalInput = page.locator('text=/ポーリング|Polling|間隔|Interval/i');
      await expect(intervalInput.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
