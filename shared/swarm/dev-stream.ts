import type { ServerResponse } from 'node:http';

/** Vite integration helper. Its owner replaces the buffered res.end(arrayBuffer) with this call. */
export async function pipeWebResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.flushHeaders();
  if (!response.body) { res.end(); return; }
  const reader = response.body.getReader();
  const close = () => { void reader.cancel().catch(() => {}); };
  res.once('close', close);
  try {
    while (!res.destroyed) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!res.write(value) && !res.destroyed) await new Promise<void>(resolve => {
        const finish = () => { res.off('drain', finish); res.off('close', finish); resolve(); };
        res.once('drain', finish); res.once('close', finish);
      });
    }
    if (!res.destroyed) res.end();
  } finally { res.off('close', close); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
