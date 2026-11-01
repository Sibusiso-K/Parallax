import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { resolve } from 'node:path';

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
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
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
  plugins: [react(), tailwindcss(), devApi()],
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
    testTimeout: 60_000, // stress runs are slow by design; a test that hangs still fails within a minute
  },
});
