import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    environmentMatchGlobs: [['src/components/ui/accessibility.test.tsx', 'jsdom']],
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules', 'dist', 'e2e/**'],
    server: {
      deps: {
        // axe-core is a CJS IIFE that references `window` and `this` at evaluation time.
        // Excluding from Vite's ESM transform keeps it as raw CJS so Node.js wraps it
        // properly. The test file uses createRequire() inside each test body, ensuring
        // jsdom has already populated globalThis.window before require() executes.
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
