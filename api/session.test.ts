import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, PUT } from './session.js';
import { hashCode, sessionConfigOrNull } from '../shared/session/store.js';

// Offline: the database is a fetch stub that answers like PostgREST and records every request.
const CODE = 'a'.repeat(43);
const OTHER = 'b'.repeat(43);
const VARS = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const;

type Seen = { url: string; method: string; headers: Record<string, string>; body?: string };
function database() {
  const rows = new Map<string, unknown>();
  const seen: Seen[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    seen.push({ url, method: init.method ?? 'GET', headers, body: init.body as string | undefined });
    // Row-level security, as the migration writes it: only the row whose hash matches the header's code.
    const own = await hashCode(headers['x-parallax-device'] ?? '');
    const asked = new URL(url).searchParams.get('token_hash')?.replace(/^eq\./, '');
    if (init.method === 'GET') return Response.json(asked === own && rows.has(own) ? [{ state: rows.get(own), updated_at: 'now' }] : []);
    if (init.method === 'DELETE') {
      if (asked === own) rows.delete(own);
      return new Response(null, { status: 204 });
    }
    const body = JSON.parse(String(init.body)) as { token_hash: string; state: unknown };
    if (body.token_hash !== own) return Response.json({ message: 'new row violates row-level security policy' }, { status: 403 });
    rows.set(own, body.state);
    return new Response(null, { status: 201 });
  }));
  return { rows, seen };
}

const req = (method: string, code: string | null, body?: unknown) =>
  new Request('http://localhost/api/session', {
    method,
    headers: { ...(code ? { 'x-parallax-device': code } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_not_real';
});
afterEach(() => {
  for (const k of VARS) delete process.env[k];
  vi.unstubAllGlobals();
});

describe('/api/session', () => {
  it('answers mode "off" and calls nothing when no database is configured', async () => {
    for (const k of VARS) delete process.env[k];
    const { seen } = database();
    for (const r of [GET(req('GET', CODE)), PUT(req('PUT', CODE, { state: {} })), DELETE(req('DELETE', CODE))]) {
      expect(await (await r).json()).toEqual({ ok: true, mode: 'off' });
    }
    expect(seen).toHaveLength(0);
  });

  it('saves, loads and erases one browser\'s decision, and never shows it to another', async () => {
    const { rows } = database();
    const state = { step: 'paths', story: 'We run a bakery.', fields: { business: 'Bakery', decision: 'Take the hotel contract' } };
    expect(await (await PUT(req('PUT', CODE, { state }))).json()).toEqual({ ok: true, mode: 'saved' });
    expect(rows.size).toBe(1);
    expect((await (await GET(req('GET', CODE))).json()).session.state).toEqual(state);
    expect((await (await GET(req('GET', OTHER))).json()).session).toBeNull();
    await DELETE(req('DELETE', OTHER));
    expect(rows.size).toBe(1);
    await DELETE(req('DELETE', CODE));
    expect(rows.size).toBe(0);
  });

  it('stores only the hash of the code, sends the code as the row-level security header, and never the key in a URL', async () => {
    const { seen } = database();
    await PUT(req('PUT', CODE, { state: { step: 'heard', fields: { business: 'Bakery' } } }));
    const put = seen[0]!;
    const body = JSON.parse(put.body!) as Record<string, unknown>;
    expect(body.token_hash).toBe(await hashCode(CODE));
    expect(put.body).not.toContain(CODE);
    expect(body).toMatchObject({ business: 'Bakery', step: 'heard', decision: null });
    expect(put.headers['x-parallax-device']).toBe(CODE);
    expect(put.url).not.toContain('sb_publishable');
    expect(put.url).toContain('on_conflict=token_hash');
  });

  it('refuses a missing or malformed code, a non-object state and an over-size save', async () => {
    database();
    expect((await GET(req('GET', null))).status).toBe(400);
    expect((await GET(req('GET', 'short'))).status).toBe(400);
    expect((await GET(req('GET', 'x'.repeat(31) + '!'))).status).toBe(400);
    expect((await PUT(req('PUT', CODE, { state: [1, 2] }))).status).toBe(400);
    expect((await PUT(req('PUT', CODE, '{not json'))).status).toBe(400);
    expect((await PUT(req('PUT', CODE, { state: { story: 'x'.repeat(300_000) } }))).status).toBe(413);
  });

  it('answers 502 with a calm message when the database fails, and logs no contents', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'boom' }, { status: 500 })));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await PUT(req('PUT', CODE, { state: { story: 'private story' } }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/still here/);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('private story');
    warn.mockRestore();
  });
});

describe('sessionConfigOrNull', () => {
  it('needs both settings and an https URL', () => {
    expect(sessionConfigOrNull({})).toBeNull();
    expect(sessionConfigOrNull({ SUPABASE_URL: 'https://x.supabase.co' })).toBeNull();
    expect(sessionConfigOrNull({ SUPABASE_URL: 'http://x.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull();
    expect(sessionConfigOrNull({ SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_PUBLISHABLE_KEY: ' k ' })).toEqual({ url: 'https://x.supabase.co', key: 'k' });
  });
});
