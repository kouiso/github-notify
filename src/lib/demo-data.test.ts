import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDemoInboxItems,
  createDemoSearchItems,
  DEMO_REPOSITORY_GROUPS,
  getDemoModeHref,
  isBrowserPreviewEnvironment,
  isDemoMode,
} from './demo-data';

function stubWindow(search: string, tauri = false, pathname = '/', hash = '') {
  vi.stubGlobal('window', {
    location: { hash, pathname, search },
    ...(tauri ? { __TAURI_INTERNALS__: {} } : {}),
  });
}

describe('demo-data', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('isDemoMode', () => {
    it('demo=1 のブラウザ環境では true を返す', () => {
      stubWindow('?demo=1');

      expect(isDemoMode()).toBe(true);
    });

    it('demo=1 以外のブラウザ環境では false を返す', () => {
      stubWindow('?demo=0');

      expect(isDemoMode()).toBe(false);
    });

    it('Tauri 環境では demo=1 でも false を返す', () => {
      stubWindow('?demo=1', true);

      expect(isDemoMode()).toBe(false);
    });

    it('window がない環境では false を返す', () => {
      vi.stubGlobal('window', undefined);

      expect(isDemoMode()).toBe(false);
    });
  });

  describe('isBrowserPreviewEnvironment', () => {
    it('ブラウザ環境では true を返す', () => {
      stubWindow('');

      expect(isBrowserPreviewEnvironment()).toBe(true);
    });

    it('Tauri 環境では false を返す', () => {
      stubWindow('', true);

      expect(isBrowserPreviewEnvironment()).toBe(false);
    });
  });

  describe('getDemoModeHref', () => {
    it('現在の query と hash を保って demo=1 を付与する', () => {
      stubWindow('?foo=bar&demo=0', false, '/preview', '#inbox');

      expect(getDemoModeHref()).toBe('/preview?foo=bar&demo=1#inbox');
    });

    it('window がない環境では demo query を返す', () => {
      vi.stubGlobal('window', undefined);

      expect(getDemoModeHref()).toBe('?demo=1');
    });
  });

  it('デモ用 repository group を提供する', () => {
    expect(DEMO_REPOSITORY_GROUPS).toHaveLength(2);
    expect(DEMO_REPOSITORY_GROUPS.map((group) => group.id)).toEqual(['project-a', 'project-b']);
    expect(DEMO_REPOSITORY_GROUPS[0].notifyReasons).toContain('review_requested');
    expect(DEMO_REPOSITORY_GROUPS[1].enableDesktopNotification).toBe(false);
  });

  it('デモ用 inbox item を新しい順の相対時刻で作成する', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-07T00:00:00.000Z').getTime());

    const items = createDemoInboxItems();

    expect(items).toHaveLength(5);
    expect(items.map((item) => item.id)).toEqual([
      'demo-review-1',
      'demo-mention-1',
      'demo-ci-1',
      'demo-assign-1',
      'demo-comment-1',
    ]);
    expect(items.map((item) => item.reason)).toEqual([
      'review_requested',
      'mention',
      'ci_activity',
      'assign',
      'comment',
    ]);
    expect(items[0].updatedAt).toBe('2026-05-06T23:52:00.000Z');
    expect(items[4].updatedAt).toBe('2026-05-06T21:50:00.000Z');
  });

  describe('createDemoSearchItems', () => {
    it('レビュー待ち query では demo-user 以外のPRを返す', () => {
      vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-07T00:00:00.000Z').getTime());

      const items = createDemoSearchItems('is:open is:pr review-requested:demo-user');

      expect(items.map((item) => item.id)).toEqual([
        'demo-search-review-1',
        'demo-search-review-2',
      ]);
      expect(items.every((item) => item.author?.login !== 'demo-user')).toBe(true);
    });

    it('自分のPR query では demo-user のPRを返す', () => {
      const items = createDemoSearchItems('is:open is:pr author:demo-user');

      expect(items.map((item) => item.id)).toEqual(['demo-search-mine-1', 'demo-search-mine-2']);
      expect(items.every((item) => item.author?.login === 'demo-user')).toBe(true);
    });

    it('repo と org の query scope を反映する', () => {
      const items = createDemoSearchItems(
        'is:open is:pr repo:kouiso/github-notify repo:kouiso/design-system org:kouiso',
      );

      expect(items.map((item) => `${item.repository.owner.login}/${item.repository.name}`)).toEqual(
        ['kouiso/github-notify', 'kouiso/design-system'],
      );
    });
  });
});
