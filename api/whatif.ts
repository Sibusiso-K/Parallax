import { guardPaidRoute } from '../shared/http/guard.js';
import { ModelError, modelConfigOrNull } from '../shared/providers/meta.js';
import { readWithModel, whatIfRequest } from '../shared/whatif/read.js';
import { planRequest, planWithModel } from '../shared/agent/planner.js';

// Vercel Function: POST /api/whatif. A what-if in the founder's own words, read by Muse Spark into lever positions for
// the futures screen (shared/whatif/read.ts). Only the words are sent, never a figure, and the engine reruns the futures
// in the browser. With no model configured it answers { mode: "fixture" } and the browser reads the words in code.
// The words are never stored or logged; only the kind of a failure is.

// The planner sends the three paths; a what-if's own text is capped at 300 characters by its schema.
const MAX_BODY_BYTES = 64 * 1024;
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  const cfg = modelConfigOrNull(process.env);
  if (!cfg) return json({ ok: true, mode: 'fixture' }, 200);
  const refused = guardPaidRoute(request, 'whatif');
  if (refused) return refused;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json({ ok: false, error: 'Keep the what-if short.' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'Keep the what-if short.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'Say a what-if, like “what if they pay late?”' }, 400);
  }
  // The planner agent ({ kind: "plan" }) shares this route and its guard, so the deployment gains no function.
  if (body && typeof body === 'object' && (body as { kind?: unknown }).kind === 'plan') {
    const plan = planRequest.safeParse(body);
    if (!plan.success) return json({ ok: false, error: 'The plan could not be read.' }, 400);
    try {
      return json({ ok: true, ...(await planWithModel(cfg, plan.data)) }, 200);
    } catch (err) {
      console.warn(JSON.stringify({ event: 'plan.failed', kind: err instanceof ModelError ? err.kind : 'unknown' }));
      return json({ ok: false, error: "The planner couldn't finish just now." }, 502);
    }
  }
  const req = whatIfRequest.safeParse(body);
  if (!req.success) return json({ ok: false, error: req.error.issues[0]?.message ?? 'That what-if could not be read.' }, 400);
  try {
    const { result, model, latencyMs } = await readWithModel(cfg, req.data.text);
    return json({ ok: true, mode: 'model', ...result, model, latencyMs }, 200);
  } catch (err) {
    console.warn(JSON.stringify({ event: 'whatif.failed', kind: err instanceof ModelError ? err.kind : 'unknown' }));
    return json({ ok: false, error: "Couldn't read that what-if just now." }, 502);
  }
}
