import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Local dev only: serve /api/* from the same handlers Vercel runs, so `npm run dev` works without the Vercel CLI.
function devApi(): Plugin {
  return {
    name: 'parallax-dev-api',
    apply: 'serve',
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
  plugins: [react(), devApi()],
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  test: {
    root: '.',
    include: ['shared/**/*.test.ts', 'web/**/*.test.ts', 'api/**/*.test.ts'],
  },
});
