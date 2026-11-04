import { DEVICE_CODE, MAX_STATE_BYTES, SessionError, deleteSession, loadSession, saveSession, sessionConfigOrNull } from '../shared/session/store.js';

// Vercel Function: /api/session. GET loads, PUT saves and DELETE erases the decision saved for one browser.
// The browser identifies itself with its own random device code in the x-parallax-device header; the database stores
// only the code's hash and lets each request reach only its own row. With no database configured, every call answers
// { mode: "off" } and the browser keeps its copy to itself. Contents are never logged; only the kind of a failure is.

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const off = () => json({ ok: true, mode: 'off' }, 200);
const badCode = () => json({ ok: false, error: 'This browser has no valid save code.' }, 400);

function codeOf(request: Request): string | null {
  const code = request.headers.get('x-parallax-device')?.trim() ?? '';
  return DEVICE_CODE.test(code) ? code : null;
}

function failed(err: unknown, what: string): Response {
  console.warn(JSON.stringify({ event: `session.${what}.failed`, status: err instanceof SessionError ? (err.status ?? null) : null }));
  return json({ ok: false, error: "We couldn't reach the saved copy. Your work is still here in this tab." }, 502);
}

export async function GET(request: Request): Promise<Response> {
  const cfg = sessionConfigOrNull(process.env);
  if (!cfg) return off();
  const code = codeOf(request);
  if (!code) return badCode();
  try {
    const saved = await loadSession(cfg, code);
    return json({ ok: true, mode: 'saved', session: saved }, 200);
  } catch (err) {
    return failed(err, 'load');
  }
}

export async function PUT(request: Request): Promise<Response> {
  const cfg = sessionConfigOrNull(process.env);
  if (!cfg) return off();
  const code = codeOf(request);
  if (!code) return badCode();
  const tooBig = () => json({ ok: false, error: 'That decision is too large to save.' }, 413);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_STATE_BYTES + 1024) return tooBig();
  const text = await request.text();
  if (text.length > MAX_STATE_BYTES + 1024) return tooBig();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: 'The save was not readable.' }, 400);
  }
  const state = (body as { state?: unknown } | null)?.state;
  if (typeof state !== 'object' || state === null || Array.isArray(state)) return json({ ok: false, error: 'The save was not readable.' }, 400);
  if (JSON.stringify(state).length > MAX_STATE_BYTES) return tooBig();
  try {
    await saveSession(cfg, code, state as Record<string, unknown>);
    return json({ ok: true, mode: 'saved' }, 200);
  } catch (err) {
    return failed(err, 'save');
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const cfg = sessionConfigOrNull(process.env);
  if (!cfg) return off();
  const code = codeOf(request);
  if (!code) return badCode();
  try {
    await deleteSession(cfg, code);
    return json({ ok: true, mode: 'erased' }, 200);
  } catch (err) {
    return failed(err, 'delete');
  }
}
