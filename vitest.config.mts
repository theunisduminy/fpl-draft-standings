import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Tests run in Node, not a browser: what is worth testing here is the scoring
 * layer, which is pure and has no DOM. Adding jsdom for components is a
 * separate decision, not a default.
 *
 * The `@/` alias has to be repeated here — Vitest does not read
 * `tsconfig.json` paths — so keep it in step with `tsconfig.json`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
