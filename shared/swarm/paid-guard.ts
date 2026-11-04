import { clientKey, guardPaidRoute as sharedGuard, WINDOW_MS } from '../http/guard.js';

const hits = new Map<string, { start: number; count: number }>();
export const SWARM_LIMIT = 12;
/** Reuses the shared origin/quota guard without editing another worker's file. One hit per complete swarm. */
export function guardPaidRoute(request: Request, route: 'swarm', now = Date.now()): Response | null {
  const denied = sharedGuard(request, 'advisor', now);
  if (denied) return denied;
  const visitor = clientKey(request);
  if (!visitor) return null;
  const key = `${route}:${visitor}`;
  if (hits.size >= 5000) { for (const [id, hit] of hits) if (now - hit.start >= WINDOW_MS) hits.delete(id); }
  if (hits.size >= 5000 && !hits.has(key)) return Response.json({ error: 'Review capacity reached. Please try later.' }, { status: 429, headers: { 'retry-after': '60', 'cache-control': 'no-store' } });
  let hit = hits.get(key);
  if (!hit || now - hit.start >= WINDOW_MS) { hit = { start: now, count: 0 }; hits.set(key, hit); }
  hit.count++;
  if (hit.count <= SWARM_LIMIT) return null;
  return Response.json({ error: 'Please wait before starting another review.' }, { status: 429, headers: { 'retry-after': String(Math.max(1, Math.ceil((hit.start + WINDOW_MS - now) / 1000))), 'cache-control': 'no-store' } });
}
