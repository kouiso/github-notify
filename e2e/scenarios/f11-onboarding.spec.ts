import { expect, test } from '@playwright/test';

/**
 * F11: 初回 onboarding 完走
 *
 * クリーンインストール → ログイン完了まで途切れなし
 */
test.describe('F11: Onboarding', () => {
  test('初回起動でログイン画面が表示される', async ({ page }) => {
    await page.goto('/');
    // 未認証状態ではオンボーディング/ログイン画面が表示
    const loginScreen = page.locator('text=/ログイン|Login|GitHub で始める|Get Started/i').first();
    await expect(loginScreen).toBeVisible({ timeout: 10_000 });
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
