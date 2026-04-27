import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';

const SCREENSHOT_PATH = '/tmp/github-notify-verify/ui-playwright-inject.png';
const TARGET_TITLE = 'Fix: authentication flow regression';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

await page.addInitScript(() => {
  const mockInvoke = async (cmd, _args) => {
    switch (cmd) {
      case 'verify_github_token':
        return { valid: true, login: 'testuser', avatarUrl: null };
      case 'get_app_settings':
        return {
          theme: 'system', notificationPreset: 'all',
          customReasons: [], desktopNotifications: false, soundEnabled: false,
          customFilters: [], activeFilterId: null,
          onboardingCompleted: true,
          repositoryGroups: [], globalExcludeReasons: [],
        };
      case 'fetch_notifications':
        return [{
          id: '1', number: 42,
          title: 'Fix: authentication flow regression',
          url: 'https://github.com/kouiso/github-notify/issues/42',
          state: 'open', itemType: 'issue',
          createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T12:00:00Z',
          author: { login: 'octocat', avatarUrl: null },
          repository: { name: 'github-notify', owner: { login: 'kouiso' } },
          labels: [], isRead: false, isDraft: false, reviewDecision: null,
        }];
      case 'fetch_inbox':
        return [{
          id: 'inbox-1', title: 'Fix: authentication flow regression',
          url: 'https://github.com/kouiso/github-notify/issues/42',
          reason: 'mention', unread: true, updatedAt: '2024-01-15T12:00:00Z',
          itemType: 'issue', repositoryName: 'github-notify',
          repositoryFullName: 'kouiso/github-notify',
          ownerLogin: 'kouiso',
          ownerAvatar: 'https://avatars.githubusercontent.com/u/1?v=4',
        }];
      default:
        return null;
    }
  };
  window.__TAURI_INTERNALS__ = {
    invoke: mockInvoke,
    metadata: { currentWindow: { label: 'main' }, windows: [{ label: 'main' }] },
    transformCallback: (_cb, _once) => {
      const id = Math.floor(Math.random() * 1000000);
      return id;
    },
    ipc: { postMessage: () => {} },
  };
  console.log('[TAURI MOCK] __TAURI_INTERNALS__ injected');
});

console.log('Navigating to http://127.0.0.1:5175/ ...');
await page.goto('http://127.0.0.1:5175/', { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(3000);

const bodyText = await page.evaluate(() => document.body.innerText);
console.log('--- PAGE TEXT (first 500 chars) ---');
console.log(bodyText.substring(0, 500));

await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
console.log(`Screenshot saved: ${SCREENSHOT_PATH}`);

const isLoginPage = /sign.?in|login|authenticate|device.*code|enter.*code/i.test(bodyText);
const hasTitleText = bodyText.includes(TARGET_TITLE);
const hasNotifText = /notification|inbox|dashboard/i.test(bodyText);

console.log(`isLoginPage: ${isLoginPage}`);
console.log(`hasTitleText: ${hasTitleText}`);
console.log(`hasNotifText: ${hasNotifText}`);

const pass = !isLoginPage && (hasTitleText || hasNotifText);
console.log(pass ? '✅ GATE 3 PASS' : '❌ GATE 3 FAIL');

writeFileSync('/tmp/github-notify-verify/gate3-attempt4.json', JSON.stringify({
  gate3: {
    attempt: 4, approach: 'playwright-addInitScript-tauri-mock',
    screenshotPath: SCREENSHOT_PATH, isLoginPage, hasTitleText, hasNotifText,
    bodyTextSnippet: bodyText.substring(0, 500),
    pass
  }
}, null, 2));

await browser.close();
process.exit(pass ? 0 : 1);
