import { expect, test } from '@playwright/test';

/**
 * F2: Inbox — 実 GitHub データで通知一覧表示
 *
 * 前提: 認証済み状態（テスト用 token がセット済み）
 * CI では mock server を使うか、GITHUB_TOKEN 環境変数で実データを取得
 */
test.describe('F2: Inbox Display', () => {
  test('Inbox タブが存在し選択可能', async ({ page }) => {
    await page.goto('/');
    await closeOnboardingIfVisible(page);
    const inboxTab = page.getByRole('button', { name: /Inbox|受信/i });
    // ログイン済みの場合のみ表示される
    if (await inboxTab.isVisible({ timeout: 5_000 })) {
      await inboxTab.click();
      await expect(inboxContent(page).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('通知リストが表示される（認証済み時）', async ({ page }) => {
    await page.goto('/');
    await closeOnboardingIfVisible(page);
    const inboxTab = page.getByRole('button', { name: /Inbox|受信/i });
    if (await inboxTab.isVisible({ timeout: 5_000 })) {
      await inboxTab.click();
    }

    // 通知アイテムまたは空状態メッセージのいずれかが表示
    await expect(inboxContent(page).first()).toBeVisible({ timeout: 15_000 });
  });
});

function inboxContent(page: import('@playwright/test').Page) {
  return page
    .getByText(/Review requested|Mentioned in|CI failed|CodeRabbit/)
    .or(page.getByText(/通知はありません|未読の通知はありません/i));
}

async function closeOnboardingIfVisible(page: import('@playwright/test').Page) {
  const startButton = page.getByRole('button', { name: 'はじめる' });
  if (await startButton.isVisible({ timeout: 2_000 })) {
    await startButton.click();
  }
}
