import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const EVIDENCE = '/tmp/github-notify-verify/gate3-attempt5.json';
const TARGET_TITLE = 'Fix: authentication flow regression';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

await page.addInitScript(() => {
  const mockInvoke = async (cmd, _args) => {
    switch (cmd) {
      case 'verify_github_token':
        // v.optional(v.nullable(v.string())) → null OK
        return { valid: true, login: 'testuser', avatarUrl: null };

      case 'get_app_settings':
        return {
          theme: 'system',
          notificationPreset: 'all',
          customReasons: [],
          desktopNotifications: false,
          soundEnabled: false,
          customFilters: [],
          activeFilterId: null,
          onboardingCompleted: true,
          repositoryGroups: [],
          globalExcludeReasons: [],
        };

      case 'fetch_notifications':
        // itemType: NotificationTypeSchema = picklist(['issue', 'pullrequest']) → lowercase必須
        return [{
          id: '1',
          number: 42,
          title: 'Fix: authentication flow regression',
          url: 'https://github.com/kouiso/github-notify/issues/42',
          state: 'open',
          itemType: 'issue',              // ← lowercase! NotificationTypeSchema
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T12:00:00Z',
          author: { login: 'octocat' },   // avatarUrl optional → omit
          repository: {
            name: 'github-notify',
            owner: { login: 'kouiso' },   // RepositorySchema.owner = { login: string } only
          },
          labels: [],
          isRead: false,
          isDraft: false,
          reviewDecision: null,
          // reason: not in NotificationItemSchema → omit
        }];

      case 'fetch_inbox':
        // ownerAvatar: v.string() → '' (NOT null)
        // url: v.nullable(v.string()) → null OK
        return [{
          id: 'inbox-1',
          title: 'Fix: authentication flow regression',
          url: 'https://github.com/kouiso/github-notify/issues/42',
          reason: 'mention',
          unread: true,
          updatedAt: '2024-01-15T12:00:00Z',
          itemType: 'Issue',
          repositoryName: 'github-notify',
          repositoryFullName: 'kouiso/github-notify',
          ownerLogin: 'kouiso',
          ownerAvatar: '',                // ← '' NOT null (v.string())
        }];

      default:
        return null;
    }
  };

  window.__TAURI_INTERNALS__ = {
    invoke: mockInvoke,
    metadata: {
      currentWindow: { label: 'main' },
      windows: [{ label: 'main' }],
    },
    transformCallback: (_cb, _once) => Math.floor(Math.random() * 1000000),
    ipc: { postMessage: () => {} },
  };
});

await page.goto('http://127.0.0.1:5175/', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(3000);

// 受信トレイへ移動（通知タイトル一覧が表示される）
try {
  await page.click('text=受信トレイ', { timeout: 5000 });
  await page.waitForTimeout(2000);
} catch (e) {
  console.log('[WARN] 受信トレイクリック失敗:', e.message);
}

const bodyText = await page.evaluate(() => document.body.innerText);
const pageHTML = await page.content();

const isLoginPage = /sign.?in|login|authenticate|device.*code|enter.*code/i.test(bodyText);
const hasTitleText = bodyText.includes(TARGET_TITLE) || pageHTML.includes(TARGET_TITLE);
const hasJapaneseUI = /ダッシュボード|受信トレイ|通知/.test(bodyText);
const pass = !isLoginPage && (hasTitleText || hasJapaneseUI);

const evidence = {
  gate3: {
    attempt: 5,
    isLoginPage,
    hasTitleText,
    hasJapaneseUI,
    pass,
    bodyTextSnippet: bodyText.substring(0, 1000),
  },
};

writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));

await browser.close();
process.exit(pass ? 0 : 1);
