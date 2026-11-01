import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The React app lives in /web; /api holds Vercel Functions; /shared runs on both sides.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  test: {
    root: '.',
    include: ['shared/**/*.test.ts', 'web/**/*.test.ts', 'api/**/*.test.ts'],
  },
});
