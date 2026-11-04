import { advisorRequest, answerAsAdvisor } from '../shared/scene/advisor-model.js';
import { ModelError, modelConfigOrNull } from '../shared/providers/meta.js';

// Vercel Function: POST /api/advisor. One question to the advisor in the 3D room, answered by Muse Spark and checked
// sentence by sentence (shared/scene/advisor-model.ts). With no model configured it answers { mode: "fixture" } and the
// room uses its authored answers. Questions and answers are never stored or logged; only the kind of a failure is.

const MAX_BODY_BYTES = 64 * 1024;
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  const cfg = modelConfigOrNull(process.env);
  if (!cfg) return json({ ok: true, mode: 'fixture' }, 200);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json({ ok: false, error: 'That question is too long to send.' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'That question is too long to send.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'Ask the advisor something.' }, 400);
  }
  const req = advisorRequest.safeParse(body);
  if (!req.success) {
    const issue = req.error.issues[0];
    const friendly = issue?.path[0] === 'question' && (issue.code === 'too_small' || issue.code === 'too_big');
    return json({ ok: false, error: friendly ? issue.message : 'That question could not be read. Please try again.' }, 400);
  }
  try {
    const answer = await answerAsAdvisor(cfg, req.data);
    return json({ ok: true, mode: 'model', ...answer }, 200);
  } catch (err) {
    console.warn(JSON.stringify({ event: 'advisor.failed', kind: err instanceof ModelError ? err.kind : 'unknown' }));
    return json({ ok: false, error: "The advisor couldn't answer just now. Please ask again." }, 502);
  }
}
