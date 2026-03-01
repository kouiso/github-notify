import '@testing-library/jest-dom/vitest';

// Mock Tauri API
global.window = Object.create(window);
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {},
  writable: true,
});
