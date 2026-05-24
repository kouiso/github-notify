import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

type AxeViolation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

const scan = async (page: Page, label: string) => {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) =>
    ['serious', 'critical'].includes(v.impact ?? ''),
  );
  const moderate = results.violations.filter((v) => v.impact === 'moderate');

  if (moderate.length > 0) {
    process.emitWarning(formatViolations(label, moderate));
  }

  expect(blocking, formatViolations(label, blocking)).toEqual([]);
};

const formatViolations = (label: string, violations: AxeViolation[]) =>
  JSON.stringify(
    {
      label,
      violations: violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        targets: v.nodes.map((node) => node.target),
      })),
    },
    null,
    2,
  );

const dismissOnboarding = async (page: Page) => {
  const startButton = page.getByRole('button', { name: 'はじめる' });
  if (await startButton.isVisible({ timeout: 5_000 })) {
    await startButton.click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
};

test.describe('F7: axe-core e2e a11y', () => {
  test('onboarding dialog has no serious or critical axe violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan(page, 'onboarding dialog');
  });

  test('dashboard has no serious or critical axe violations', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
    await scan(page, 'dashboard');
  });

  test('inbox has no serious or critical axe violations', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.getByText('受信トレイ', { exact: true }).click();
    await expect(
      page.getByText('Review requested: fix unread notification regression'),
    ).toBeVisible();
    await scan(page, 'inbox');
  });

  test('settings dialog tabs have no serious or critical axe violations', async ({ page }) => {
    await page.goto('/');
    await dismissOnboarding(page);
    await page.getByRole('button', { name: 'e2e-user' }).click();
    await expect(page.getByRole('dialog', { name: '設定' })).toBeVisible();

    for (const tabName of ['プロジェクト', 'フィルター', '外観', 'アカウント']) {
      await page.getByRole('button', { name: tabName, exact: true }).click();
      await scan(page, `settings dialog: ${tabName}`);
    }
  });
});
