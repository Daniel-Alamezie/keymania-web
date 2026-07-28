import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest needs the `@/` alias spelled out; Next.js reads it from tsconfig, but
 * the test runner does not.
 *
 * It has never been needed until now purely by accident: every `@/…` import in
 * tested code happened to be `import type`, which TypeScript erases, so nothing
 * survived to be resolved at runtime. The first value import from `@/models`
 * turned that latent gap into "Cannot find package '@/models/character'" —
 * which reads like a missing dependency rather than a missing alias, and would
 * have cost somebody an afternoon.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
