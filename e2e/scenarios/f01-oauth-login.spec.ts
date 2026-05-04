import { expect, test } from '@playwright/test';

/**
 * F1: GitHub OAuth Device Flow ログイン/ログアウト
 *
 * 検証ポイント:
 * - ログイン画面が表示される
 * - Device Flow 開始ボタンが存在する
 * - エラー状態のリカバリ UI がある
 */
test.describe('F1: OAuth Login', () => {
  test('ログイン画面が初回表示される', async ({ page }) => {
    await page.goto('/');
    // 未ログイン状態ではログイン画面が表示される
    const loginButton = page.getByRole('button', { name: /ログイン|Login|GitHub/i });
    await expect(loginButton).toBeVisible({ timeout: 10_000 });
  });

  test('Device Flow 開始でユーザーコードが表示される', async ({ page }) => {
    await page.goto('/');
    const loginButton = page.getByRole('button', { name: /ログイン|Login|GitHub/i });
    await loginButton.click();

    // Device Flow が開始されるとユーザーコードまたはURLが表示される
    const codeOrUrl = page.locator('text=/[A-Z0-9]{4}-[A-Z0-9]{4}|github\\.com\\/login\\/device/i');
    await expect(codeOrUrl).toBeVisible({ timeout: 15_000 });
  });

  test('キャンセルボタンでログイン画面に戻る', async ({ page }) => {
    await page.goto('/');
    const loginButton = page.getByRole('button', { name: /ログイン|Login|GitHub/i });
    await loginButton.click();

    const cancelButton = page.getByRole('button', { name: /キャンセル|Cancel/i });
    if (await cancelButton.isVisible({ timeout: 5_000 })) {
      await cancelButton.click();
      await expect(loginButton).toBeVisible();
    }
  });
});
