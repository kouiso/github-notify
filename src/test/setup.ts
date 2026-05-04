import '@testing-library/jest-dom/vitest';

// Tauri APIのモック
global.window = Object.create(window);
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {},
  writable: true,
});

// jsdom 環境では window.crypto が prototype 経由で globalThis.crypto の getter を呼ぶが、
// this が jsdom window proxy になるため ERR_INVALID_THIS が発生する。
// axe-core (axe.js:11649) が `window.crypto` をモジュール評価時に参照するため、
// createRequire で読み込む前に own property として定義して修正する。
if (typeof globalThis.crypto !== 'undefined' && typeof window !== 'undefined') {
  try {
    void window.crypto; // own property として動作するか確認（アクセスのみ）
  } catch {
    Object.defineProperty(window, 'crypto', {
      value: globalThis.crypto,
      writable: false,
      configurable: true,
      enumerable: true,
    });
  }
}
