import { answerAsFutureSelf, chatRequest } from '../shared/chat/future-self.js';
import { guardPaidRoute } from '../shared/http/guard.js';
import { ModelError, modelConfigOrNull } from '../shared/providers/meta.js';

// Vercel Function: POST /api/chat. One question to the founder's future self on one path, answered by Muse Spark and
// passed through the figure guard. With no model configured it answers { mode: "fixture" } and the browser uses its
// scripted replies. Questions and answers are never stored or logged; only the kind of a failure is.

const MAX_BODY_BYTES = 64 * 1024;
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(request: Request): Promise<Response> {
  const cfg = modelConfigOrNull(process.env);
  if (!cfg) return json({ ok: true, mode: 'fixture' }, 200);
  const refused = guardPaidRoute(request, 'chat');
  if (refused) return refused;
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json({ ok: false, error: 'That conversation is too long to send.' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: 'That conversation is too long to send.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'Ask your future self something.' }, 400);
  }
  const req = chatRequest.safeParse(body);
  if (!req.success) {
    const issue = req.error.issues[0];
    const friendly = issue?.path[0] === 'message' && (issue.code === 'too_small' || issue.code === 'too_big');
    return json({ ok: false, error: friendly ? issue.message : 'That path could not be read. Please go back to the paths and try again.' }, 400);
  }
  try {
    const answer = await answerAsFutureSelf(cfg, req.data);
    return json({ ok: true, mode: 'model', ...answer }, 200);
  } catch (err) {
    console.warn(JSON.stringify({ event: 'chat.failed', kind: err instanceof ModelError ? err.kind : 'unknown' }));
    return json({ ok: false, error: "Your future self couldn't answer just now. Please ask again." }, 502);
  }
}
