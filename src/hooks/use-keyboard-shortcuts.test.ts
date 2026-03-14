import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxItem } from '@/types';

// @tauri-apps/plugin-shell の open をモック（テスト環境では実際にブラウザを開かない）
const mockOpen = vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined);
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (url: string) => mockOpen(url),
}));

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

// テスト用のダミー InboxItem を生成するファクトリ
function createItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: 'item-1',
    title: 'Test notification',
    url: 'https://github.com/owner/repo/issues/1',
    reason: 'mention',
    unread: true,
    updatedAt: '2024-01-01T00:00:00Z',
    repositoryFullName: 'owner/repo',
    repositoryUrl: 'https://github.com/owner/repo',
    type: 'Issue',
    ...overrides,
  };
}

// window に keydown イベントを発火するヘルパー
function fireKeyDown(key: string, target?: EventTarget) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  if (target) {
    Object.defineProperty(event, 'target', { value: target, writable: false });
  }
  window.dispatchEvent(event);
}

describe('useKeyboardShortcuts', () => {
  let items: InboxItem[];
  let setSelectedIndex: ReturnType<typeof vi.fn>;
  let onMarkAsRead: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    items = [createItem({ id: 'a' }), createItem({ id: 'b' }), createItem({ id: 'c' })];
    setSelectedIndex = vi.fn();
    onMarkAsRead = vi.fn();
  });

  // --- イベントリスナーの登録 ---
  describe('イベントリスナーの登録', () => {
    it('マウント時に window へ keydown リスナーが追加される', () => {
      const spy = vi.spyOn(window, 'addEventListener');
      renderHook(() =>
        useKeyboardShortcuts({
          items,
          selectedIndex: 0,
          setSelectedIndex,
          onMarkAsRead,
        }),
      );
      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('アンマウント時に keydown リスナーが除去される（クリーンアップ）', () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          items,
          selectedIndex: 0,
          setSelectedIndex,
          onMarkAsRead,
        }),
      );
      unmount();
      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  // --- 下移動: j / ArrowDown ---
  describe('下移動ショートカット (j / ArrowDown)', () => {
    it('j キーで selectedIndex が 1 つ増える', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('j');
      // selectedIndex=0 → min(1, 2) = 1
      expect(setSelectedIndex).toHaveBeenCalledWith(1);
    });

    it('ArrowDown キーで selectedIndex が 1 つ増える', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 1, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('ArrowDown');
      // selectedIndex=1 → min(2, 2) = 2
      expect(setSelectedIndex).toHaveBeenCalledWith(2);
    });

    it('リスト末尾では selectedIndex がそれ以上増えない', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 2, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('j');
      // selectedIndex=2 → min(3, 2) = 2（末尾でクランプ）
      expect(setSelectedIndex).toHaveBeenCalledWith(2);
    });
  });

  // --- 上移動: k / ArrowUp ---
  describe('上移動ショートカット (k / ArrowUp)', () => {
    it('k キーで selectedIndex が 1 つ減る', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 2, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('k');
      // selectedIndex=2 → max(1, 0) = 1
      expect(setSelectedIndex).toHaveBeenCalledWith(1);
    });

    it('ArrowUp キーで selectedIndex が 1 つ減る', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 1, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('ArrowUp');
      // selectedIndex=1 → max(0, 0) = 0
      expect(setSelectedIndex).toHaveBeenCalledWith(0);
    });

    it('リスト先頭では selectedIndex がそれ以上減らない', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('k');
      // selectedIndex=0 → max(-1, 0) = 0（先頭でクランプ）
      expect(setSelectedIndex).toHaveBeenCalledWith(0);
    });
  });

  // --- Enter: URLを開いて既読にする ---
  describe('Enter キー（URLを開いて既読化）', () => {
    it('Enter キーで選択中アイテムの URL が開かれる', async () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('Enter');
      // 非同期処理が落ち着くまで待機
      await vi.waitFor(() => {
        expect(mockOpen).toHaveBeenCalledWith('https://github.com/owner/repo/issues/1');
      });
    });

    it('Enter キーで未読アイテムの onMarkAsRead が呼ばれる', async () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('Enter');
      await vi.waitFor(() => {
        expect(onMarkAsRead).toHaveBeenCalledWith('a');
      });
    });

    it('既読アイテムでは Enter で onMarkAsRead が呼ばれない', async () => {
      items[0] = createItem({ id: 'a', unread: false });
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('Enter');
      await vi.waitFor(() => {
        expect(mockOpen).toHaveBeenCalled();
      });
      expect(onMarkAsRead).not.toHaveBeenCalled();
    });

    it('URL が null のアイテムでは open が呼ばれない', async () => {
      items[0] = createItem({ id: 'a', url: null });
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('Enter');
      // 少し待ってから open が呼ばれていないことを確認
      await new Promise((r) => setTimeout(r, 10));
      expect(mockOpen).not.toHaveBeenCalled();
    });

    it('selectedIndex が範囲外のとき Enter で何も起きない', async () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: -1, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('Enter');
      await new Promise((r) => setTimeout(r, 10));
      expect(mockOpen).not.toHaveBeenCalled();
      expect(onMarkAsRead).not.toHaveBeenCalled();
    });
  });

  // --- e キー: 既読にする ---
  describe('e キー（既読化）', () => {
    it('e キーで未読アイテムの onMarkAsRead が呼ばれる', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 1, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('e');
      expect(onMarkAsRead).toHaveBeenCalledWith('b');
    });

    it('e キーで既読アイテムの onMarkAsRead は呼ばれない', () => {
      items[0] = createItem({ id: 'a', unread: false });
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('e');
      expect(onMarkAsRead).not.toHaveBeenCalled();
    });

    it('selectedIndex が範囲外のとき e で何も起きない', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 10, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('e');
      expect(onMarkAsRead).not.toHaveBeenCalled();
    });
  });

  // --- g キー: 先頭へ移動 ---
  describe('g キー（先頭へ移動）', () => {
    it('g キーで selectedIndex が 0 になる', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 2, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('g');
      expect(setSelectedIndex).toHaveBeenCalledWith(0);
    });

    it('items が空のとき g キーで setSelectedIndex は呼ばれない', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items: [], selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('g');
      expect(setSelectedIndex).not.toHaveBeenCalled();
    });
  });

  // --- G キー: 末尾へ移動 ---
  describe('G キー（末尾へ移動）', () => {
    it('G キーで selectedIndex がリスト末尾になる', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('G');
      // items.length - 1 = 2
      expect(setSelectedIndex).toHaveBeenCalledWith(2);
    });

    it('items が空のとき G キーで setSelectedIndex は呼ばれない', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items: [], selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('G');
      expect(setSelectedIndex).not.toHaveBeenCalled();
    });
  });

  // --- input 要素フォーカス中は無視する ---
  describe('入力要素フォーカス中のキーイベント無視', () => {
    afterEach(() => {
      // DOM に追加した要素をクリーンアップ
      document.body.innerHTML = '';
    });

    it('HTMLInputElement がターゲットのときショートカットが動作しない', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      // target を input にしてイベントを dispatch する
      const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true });
      Object.defineProperty(event, 'target', { value: input, writable: false });
      window.dispatchEvent(event);

      expect(setSelectedIndex).not.toHaveBeenCalled();
    });

    it('HTMLTextAreaElement がターゲットのときショートカットが動作しない', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true });
      Object.defineProperty(event, 'target', { value: textarea, writable: false });
      window.dispatchEvent(event);

      expect(setSelectedIndex).not.toHaveBeenCalled();
    });

    it('HTMLSelectElement がターゲットのときショートカットが動作しない', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );

      const select = document.createElement('select');
      document.body.appendChild(select);
      select.focus();

      const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true });
      Object.defineProperty(event, 'target', { value: select, writable: false });
      window.dispatchEvent(event);

      expect(setSelectedIndex).not.toHaveBeenCalled();
    });
  });

  // --- 無関係なキーは無視する ---
  describe('未定義キーは無視する', () => {
    it('定義されていないキー (a) では何も起きない', () => {
      renderHook(() =>
        useKeyboardShortcuts({ items, selectedIndex: 0, setSelectedIndex, onMarkAsRead }),
      );
      fireKeyDown('a');
      expect(setSelectedIndex).not.toHaveBeenCalled();
      expect(onMarkAsRead).not.toHaveBeenCalled();
    });
  });
});
