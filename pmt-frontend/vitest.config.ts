import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Mirror the tsconfig path alias `@/*` -> `./*`.
const root = fileURLToPath(new URL('.', import.meta.url))

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
    // Playwright e2e lives in e2e/ and must NOT be picked up by Vitest.
    // reference-notes/ holds the PMT files the mirror copy displaced, kept only
    // until the prune finishes. Their imports resolve against a tree that no
    // longer exists, so collecting them fails 52 tests that are not failures.
    exclude: [
      'e2e/**',
      'node_modules/**',
      '.next/**',
      'dist/**',
      'reference-notes/**',
    ],
    css: false,
  },
})
