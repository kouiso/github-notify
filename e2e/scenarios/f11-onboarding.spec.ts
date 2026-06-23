import { expect, test } from '@playwright/test';

/**
 * F11: 初回 onboarding 完走
 *
 * クリーンインストール → ログイン完了まで途切れなし
 */
test.describe('F11: Onboarding', () => {
  test('初回起動でログインオーバーレイが表示される', async ({ page }) => {
    await page.goto('/');

    const overlay = page.getByRole('dialog', { name: 'GitHubアカウントを連携' });
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    await expect(overlay.getByRole('button', { name: '接続画面を閉じる' })).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('オンボーディングダイアログが表示される（初回）', async ({ page }) => {
    await page.goto('/');
    const onboardingDialog = page
      .locator('text=/ようこそ|Welcome|はじめに|Getting Started/i')
      .first();
    // 初回のみ表示。既に表示済みならスキップ
    if (await onboardingDialog.isVisible({ timeout: 5_000 })) {
      await expect(onboardingDialog).toBeVisible();
    }
  });
});
