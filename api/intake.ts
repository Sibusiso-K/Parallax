import { intakeExtractor } from '../shared/intake/agent.js';
import { handleIntake } from '../shared/intake/handle.js';
import { modelConfigOrNull } from '../shared/providers/meta.js';

// Vercel Function: POST /api/intake. Model mode only when META_MODEL_ENABLED is "true" and a key is set (see
// shared/providers/meta.ts); fixture mode otherwise. The response says which mode answered.
const MAX_BODY_CHARS = 8_000; // intake text is capped at 4,000 characters; the rest is JSON overhead

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) {
    return Response.json({ ok: false, error: 'Request is too large. Keep your text under 4,000 characters.' }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, error: 'Send JSON: { "text": "..." }' }, { status: 400 });
  }
  const cfg = modelConfigOrNull(process.env);
  const result = await handleIntake(body, cfg ? intakeExtractor(cfg) : undefined);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
