import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules', 'dist', 'e2e/**'],
    server: {
      deps: {
        // axe-core は評価時に `window` と `this` を参照する CJS IIFE のため、Vite の ESM 変換を避ける。
        external: ['axe-core'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
        'src/types/**',
        'src/lib/tauri/commands.ts',
        'src/**/index.ts',
        'src/main.tsx',
      ],
      // Branch coverage stays at the permanent 80% target. Follow-up #31 tracks
      // deeper settings-dialog and use-inbox coverage hardening without lowering it.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
