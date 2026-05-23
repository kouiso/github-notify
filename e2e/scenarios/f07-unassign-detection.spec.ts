import { expect, test } from '@playwright/test';
import { installTauriMock } from '../fixtures/tauri-mock';
import { E2E_APP_SETTINGS, UNASSIGN_DETECTION_FIXTURE } from '../fixtures/unassign-detection';

/**
 * F7: Unassign 検出 (verify_assignments)
 *
 * Rust 側は wiremock unit test で GitHub API の assignees と既読化を検証する。
 * E2E ではその検証済み結果を Tauri IPC fixture として流し、担当外通知が UI に残らないことを確認する。
 */
test.describe('F7: Unassign Detection', () => {
  test('担当外になった assign 通知は受信トレイに表示されない', async ({ page }) => {
    await installTauriMock(page, {
      verify_github_token: {
        valid: true,
        login: UNASSIGN_DETECTION_FIXTURE.viewer,
        avatarUrl: null,
      },
      get_app_settings: E2E_APP_SETTINGS,
      fetch_inbox: UNASSIGN_DETECTION_FIXTURE.inboxAfterVerification,
      update_tray_badge: null,
    });

    await page.goto('/');
    await page.getByRole('button', { name: /受信トレイ/ }).click();

    await expect(page.getByText('Still assigned issue remains visible')).toBeVisible();
    await expect(
      page.getByText('Mention notification is not part of unassign filtering'),
    ).toBeVisible();
    await expect(page.getByText(UNASSIGN_DETECTION_FIXTURE.removedTitle)).toHaveCount(0);
  });
});
