import { intakeExtractor } from '../shared/intake/agent.js';
import { handleIntake } from '../shared/intake/handle.js';
import { guardPaidRoute } from '../shared/http/guard.js';
import { ModelError, modelConfigOrNull } from '../shared/providers/meta.js';
import { checkIntake, checkRequest } from '../shared/intake/check.js';

// Vercel Function: POST /api/intake. Model mode only when META_MODEL_ENABLED is "true" and a key is set (see
// shared/providers/meta.ts); fixture mode otherwise. The response says which mode answered.
// The text is capped at 4,000 characters, and JSON can take up to six bytes for one character (a \u escape), so the body
// cap is in bytes and allows for that. Answers hold a founder's figures, so they are never cached.
const MAX_BODY_BYTES = 32_000;

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

function tooLarge(): Response {
  return json({ ok: false, error: 'Request is too large. Keep your text under 4,000 characters.' }, 413);
}

export async function POST(request: Request): Promise<Response> {
  const cfg = modelConfigOrNull(process.env);
  if (cfg) {
    const refused = guardPaidRoute(request, 'intake');
    if (refused) return refused;
  }
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return tooLarge();
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return tooLarge();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'Send JSON: { "text": "..." }' }, 400);
  }
  // The self-check ({ check: true }) shares this route and its guard, so the deployment gains no function.
  if (body && typeof body === 'object' && (body as { check?: unknown }).check === true) {
    if (!cfg) return json({ ok: true, mode: 'fixture' }, 200);
    const req = checkRequest.safeParse(body);
    if (!req.success) return json({ ok: false, error: 'There was nothing to check.' }, 400);
    try {
      return json({ ok: true, mode: 'model', ...(await checkIntake(cfg, req.data)) }, 200);
    } catch (err) {
      console.warn(JSON.stringify({ event: 'intake.check.failed', kind: err instanceof ModelError ? err.kind : 'unknown' }));
      return json({ ok: false, error: "Couldn't double-check just now." }, 502);
    }
  }
  const result = await handleIntake(body, cfg ? intakeExtractor(cfg) : undefined);
  return json(result, result.ok ? 200 : 400);
}
