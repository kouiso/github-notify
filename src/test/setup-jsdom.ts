/**
 * jsdom 環境専用セットアップ
 *
 * jsdom の window オブジェクトは Node.js の globalThis とは別オブジェクト。
 * window.crypto は prototype 経由で globalThis.crypto の getter を呼ぶが、
 * this が jsdom の window proxy になるため ERR_INVALID_THIS が発生する。
 *
 * axe-core の CJS IIFE (axe.js:11649) が `var _crypto = window.crypto` を
 * モジュール評価時に実行するため、createRequire で読み込む前に
 * window.crypto を own property として定義する必要がある。
 */
import '@testing-library/jest-dom/vitest';

// Tauri API のモック
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {},
  writable: true,
  configurable: true,
});

// jsdom の window.crypto を修正
// Node.js の globalThis.crypto を window の own property として定義することで
// axe-core が window.crypto にアクセスしても ERR_INVALID_THIS を回避できる
if (typeof globalThis.crypto !== 'undefined') {
  Object.defineProperty(window, 'crypto', {
    value: globalThis.crypto,
    writable: false,
    configurable: true,
    enumerable: true,
  });
}
