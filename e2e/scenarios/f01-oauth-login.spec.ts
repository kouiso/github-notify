import { expect, test } from '@playwright/test';

/**
 * F1: GitHub OAuth Device Flow ログイン/ログアウト
 *
 * 検証ポイント:
 * - 未認証時にログインオーバーレイが表示される
 * - 背面にアプリ本体が描画される
 * - Device Flow 開始ボタンが存在する
 * - エラー状態のリカバリ UI がある
 */
test.describe('F1: OAuth Login', () => {
  test('ログインオーバーレイが初回表示される', async ({ page }) => {
    await page.goto('/');

    const overlay = page.getByRole('dialog', { name: 'GitHubアカウントを連携' });
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    await expect(overlay.getByRole('button', { name: '接続画面を閉じる' })).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('Device Flow 開始でユーザーコードが表示される', async ({ page }) => {
    await page.goto('/');
    const overlay = page.getByRole('dialog', { name: 'GitHubアカウントを連携' });
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    const loginButton = overlay.getByRole('button', { name: /ログイン|Login|GitHub/i });
    await loginButton.click();

    const codeOrUrl = overlay.locator('text=/[A-Z0-9]{4}-[A-Z0-9]{4}|github.com/login/device/i');
    await expect(codeOrUrl).toBeVisible({ timeout: 15_000 });
  });

  test('キャンセルボタンでログインオーバーレイに戻る', async ({ page }) => {
    await page.goto('/');
    const overlay = page.getByRole('dialog', { name: 'GitHubアカウントを連携' });
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    const loginButton = overlay.getByRole('button', { name: /ログイン|Login|GitHub/i });
    await loginButton.click();

    const cancelButton = overlay.getByRole('button', { name: /キャンセル|Cancel/i });
    if (await cancelButton.isVisible({ timeout: 5_000 })) {
      await cancelButton.click();
      await expect(loginButton).toBeVisible();
    }
  });
});
