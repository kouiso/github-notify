import { expect, test } from '@playwright/test';

/**
 * F8: ダッシュボード — PRレビュー状況表示
 */
test.describe('F8: Dashboard', () => {
  test('ダッシュボードタブが選択可能', async ({ page }) => {
    await page.goto('/');
    const dashboardTab = page
      .getByRole('tab', { name: /ダッシュボード|Dashboard/i })
      .or(page.locator('[data-testid="dashboard-tab"]'));
    if (await dashboardTab.isVisible({ timeout: 5_000 })) {
      await dashboardTab.click();
      await expect(dashboardTab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('PRレビューセクションが表示される', async ({ page }) => {
    await page.goto('/');
    const dashboardTab = page
      .getByRole('tab', { name: /ダッシュボード|Dashboard/i })
      .or(page.locator('[data-testid="dashboard-tab"]'));
    if (await dashboardTab.isVisible({ timeout: 5_000 })) {
      await dashboardTab.click();
      const reviewSection = page.locator('text=/レビュー|Review|自分のPR|My PRs/i');
      await expect(reviewSection.first()).toBeVisible({ timeout: 10_000 });
    }
  });
});
