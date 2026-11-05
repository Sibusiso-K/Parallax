// A guard for the routes that spend Meta credits: intake, chat, advisor, scene, transcribe and whatif. It runs only when a model
// is connected, so demo mode and the tests are unaffected. Two checks:
//   1. A browser call from another site is refused. Browsers always send Origin on a POST, and it must match this host.
//      A script outside a browser can leave Origin out, so this stops other sites, not determined callers.
//   2. Each visitor (by the address Vercel forwards) gets a burst allowance per route per ten minutes. The count lives in
//      the memory of one warm function instance, so it is a brake on loops and floods, not a global quota.
// The real ceiling on spend is the spend limit on the Meta billing page.

export type PaidRoute = 'intake' | 'chat' | 'advisor' | 'scene' | 'transcribe' | 'whatif' | 'swarm' | 'world' | 'document';

export const WINDOW_MS = 10 * 60_000;

/** Calls per visitor per route per window. Generous for one founder; a scene is the dearest call, so it gets the fewest. */
export const LIMITS: Readonly<Record<PaidRoute, number>> = { intake: 20, scene: 10, chat: 40, advisor: 40, transcribe: 15, whatif: 40, swarm: 12, world: 60, document: 12 };

const MAX_TRACKED = 5_000;
const hits = new Map<string, { start: number; count: number }>();

const refuse = (status: number, error: string, headers: Record<string, string> = {}) =>
  Response.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store', ...headers } });

/** The visitor's address as the platform forwards it, or null when there is none (local dev and tests). */
export function clientKey(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || null;
}

/** True when a browser on another site made this call. No Origin at all is a same-origin or non-browser call. */
export function isCrossSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (origin === null) return request.headers.get('sec-fetch-site') === 'cross-site';
  let from: string;
  try {
    from = new URL(origin).host; // the literal "null" origin of a sandboxed frame throws here, and is refused
  } catch {
    return true;
  }
  const own = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host;
  return from.toLowerCase() !== own.toLowerCase();
}

function prune(now: number): void {
  for (const [key, entry] of hits) if (now - entry.start >= WINDOW_MS) hits.delete(key);
  if (hits.size >= MAX_TRACKED) hits.clear();
}

/** A refusal to send instead of calling the model, or null to go ahead. */
export function guardPaidRoute(request: Request, route: PaidRoute, now: number = Date.now()): Response | null {
  if (isCrossSite(request)) return refuse(403, 'This service only answers the Parallax app itself.');
  const visitor = clientKey(request);
  if (!visitor) return null;
  const key = `${route}:${visitor}`;
  let entry = hits.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) {
    if (!entry && hits.size >= MAX_TRACKED) prune(now);
    entry = { start: now, count: 0 };
    hits.set(key, entry);
  }
  entry.count += 1;
  if (entry.count <= LIMITS[route]) return null;
  const retryAfter = Math.max(1, Math.ceil((entry.start + WINDOW_MS - now) / 1000));
  return refuse(429, 'Too many requests from this device just now. Please wait a few minutes and try again.', { 'retry-after': String(retryAfter) });
}

/** Tests only: forget every count. */
export function resetGuard(): void {
  hits.clear();
}
