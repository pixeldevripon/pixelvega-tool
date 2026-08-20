import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Mirror the tsconfig path alias `@/*` -> `./*`.
//
// `.mts` rather than `.ts`: this file is ESM, and Vite's native config loader
// (which becomes the default in a future major) treats a `.ts` config as
// CommonJS and warns on every run.
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^@\//, replacement: root }],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    // Playwright specs live in e2e/ and must NOT be picked up by Vitest.
    exclude: ['e2e/**', 'node_modules/**', '.next/**', 'dist/**'],
    css: false,
  },
});
