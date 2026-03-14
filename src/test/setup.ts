import '@testing-library/jest-dom/vitest';

// Tauri APIのモック
global.window = Object.create(window);
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {},
  writable: true,
});
