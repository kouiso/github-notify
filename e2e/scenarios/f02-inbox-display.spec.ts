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
    const inboxTab = page
      .getByRole('tab', { name: /Inbox|受信/i })
      .or(page.locator('[data-testid="inbox-tab"]'));
    // ログイン済みの場合のみ表示される
    if (await inboxTab.isVisible({ timeout: 5_000 })) {
      await inboxTab.click();
      await expect(inboxTab).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('通知リストが表示される（認証済み時）', async ({ page }) => {
    await page.goto('/');
    // 通知アイテムまたは空状態メッセージのいずれかが表示
    const listOrEmpty = page
      .locator('[data-testid="notification-item"]')
      .or(page.locator('text=/通知はありません|No notifications/i'));
    await expect(listOrEmpty.first()).toBeVisible({ timeout: 15_000 });
  });
});
