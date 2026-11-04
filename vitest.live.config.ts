import { defineConfig } from 'vitest/config';

// The live evaluation of Parallax's Meta features (evals/live.eval.ts). It makes real, billed Muse Spark calls, so it
// is never part of `npm test` or CI: it runs only through `npm run eval:live`, with META_MODEL_ENABLED=true and a key.
export default defineConfig({
  test: {
    root: '.',
    include: ['evals/**/*.eval.ts'],
    testTimeout: 300_000,
    fileParallelism: false,
  },
});
