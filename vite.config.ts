import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { resolve } from 'node:path';
import { pipeWebResponse } from './shared/swarm/dev-stream';

// Local dev only: serve /api/* from the same handlers Vercel runs, so `npm run dev` works without the Vercel CLI.
function devApi(): Plugin {
  return {
    name: 'parallax-dev-api',
    apply: 'serve',
    configResolved(config) {
      // Tests never load .env files, so no test can pick up a real key.
      if (config.mode === 'test') return;
      // Vite keeps .env values out of process.env, but the /api handlers read their keys from there.
      // Load the project-root env files here, and never overwrite a value that is already set.
      for (const [key, value] of Object.entries(loadEnv(config.mode, process.cwd(), ''))) {
        process.env[key] ??= value;
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const route = req.url?.match(/^\/api\/([a-z-]+)/)?.[1];
        if (!route) return next();
        try {
          const mod = (await server.ssrLoadModule(resolve(process.cwd(), 'api', `${route}.ts`))) as Record<string, (r: Request) => Response | Promise<Response>>;
          const handler = mod[req.method ?? 'GET'];
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const response = await handler(
            new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers as HeadersInit, body }),
          );
          await pipeWebResponse(response, res);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

// The React app lives in /web; /api holds Vercel Functions; /shared runs on both sides.
export default defineConfig({
  root: 'web',
  plugins: [react(), devApi()],
  resolve: { alias: { '@': resolve(process.cwd(), 'web/src') } },
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  test: {
    root: '.',
    include: ['shared/**/*.test.ts', 'web/**/*.test.ts', 'api/**/*.test.ts'],
    setupFiles: ['shared/testing/offline.ts'],
    // A normal test that hangs fails within a minute. A deliberate stress run (STRESS_RUNS set) scales with its run count:
    // 50,000 engine runs take about a minute on their own, and longer under load.
    testTimeout: process.env.STRESS_RUNS ? 900_000 : 60_000,
  },
});
