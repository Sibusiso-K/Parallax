import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NALEDI_EXTRACTION, NALEDI_TEXT } from '../shared/intake/fixture.js';
import { GET } from './health.js';
import { POST } from './intake.js';

// Offline: the model path only ever meets a fetch stub, and the blocked-network guard catches anything else.
const KEY = 'test-key-not-real';
const MODEL_VARS = ['META_MODEL_ENABLED', 'META_API_KEY', 'META_API_BASE_URL'] as const;

beforeEach(() => {
  for (const k of MODEL_VARS) delete process.env[k]; // no test starts with a model configured
});
afterEach(() => {
  for (const k of MODEL_VARS) delete process.env[k];
  vi.unstubAllGlobals();
});

const req = (body: unknown) =>
  new Request('http://localhost/api/intake', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const reply = (value: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }), { status: 200 });
const turnOnModel = () => {
  process.env.META_MODEL_ENABLED = 'true';
  process.env.META_API_KEY = KEY;
};

describe('POST /api/intake, fixture mode', () => {
  it('fills the demo story with no model configured, and finds no issues in it', async () => {
    const res = await POST(req({ text: NALEDI_TEXT }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, mode: 'fixture', missing: ['essentialExpenses'], issues: [] });
  });

  it('answers 400 for bad JSON, empty text and the wrong type', async () => {
    expect((await POST(req('{not json'))).status).toBe(400);
    expect((await POST(req({ text: '   ' }))).status).toBe(400);
    expect((await POST(req({ text: 42 }))).status).toBe(400);
  });

  it('answers 413 for a body far over the limit', async () => {
    expect((await POST(req('x'.repeat(9_000)))).status).toBe(413);
  });
});

describe('POST /api/intake, model mode', () => {
  it('stays in fixture mode while the model switch is off, even with a key set', async () => {
    process.env.META_API_KEY = KEY;
    const fetchStub = vi.fn(async () => reply(NALEDI_EXTRACTION));
    vi.stubGlobal('fetch', fetchStub);
    expect(await (await POST(req({ text: NALEDI_TEXT }))).json()).toMatchObject({ mode: 'fixture' });
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('asks the model when switched on, with the key only in the request header', async () => {
    turnOnModel();
    const seen: { url: string; auth: string | undefined }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen.push({ url, auth: (init.headers as Record<string, string>).authorization });
      return reply(NALEDI_EXTRACTION);
    });
    const data = await (await POST(req({ text: NALEDI_TEXT }))).json();
    expect(data).toMatchObject({ mode: 'model', fields: { savings: { low: 30000, high: 40000 } } });
    expect(seen).toEqual([{ url: 'https://api.meta.ai/v1/chat/completions', auth: `Bearer ${KEY}` }]);
  });

  it('falls back to the fixture when billing refuses the call, and keeps the text', async () => {
    turnOnModel();
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 402 }));
    const res = await POST(req({ text: NALEDI_TEXT }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ mode: 'fixture', notice: expect.any(String) });
    expect(data.fields.takeHome).toBeDefined();
  });
});

describe('GET /api/health', () => {
  it('reports what is configured, and never the key', async () => {
    turnOnModel();
    const text = await GET().text();
    expect(JSON.parse(text)).toMatchObject({ ok: true, metaKeyConfigured: true, modelEnabled: true, modelReady: true });
    expect(text).not.toContain(KEY);
  });

  it('reports the model as not ready when nothing is set', async () => {
    expect(await GET().json()).toMatchObject({ metaKeyConfigured: false, modelEnabled: false, modelReady: false });
  });
});
