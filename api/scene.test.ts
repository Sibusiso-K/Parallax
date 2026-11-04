import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './scene.js';

// Offline: Muse Spark and Muse Image are one fetch stub that answers by URL.
const VARS = ['META_MODEL_ENABLED', 'META_API_KEY'] as const;
const named = (label: string) => ({ label, caption: `${label}.` });
const DRESSING = {
  title: 'The depot',
  places: { spawn: named('Yard'), offer: named('Contract'), intake: named('Fleet desk'), bridge: named('Payment gap'), memo: named('Memo desk') },
  objects: { contract: named('Contract'), pan: named('Fuel and tyres'), fridge: named('Two trucks'), intake_desk: named('Figures'), memo: named('Memo') },
  portrait: 'A truck depot at dawn.',
};
const post = (body: unknown) => POST(new Request('http://localhost/api/scene', { method: 'POST', body: JSON.stringify(body) }));
const on = () => {
  process.env.META_MODEL_ENABLED = 'true';
  process.env.META_API_KEY = 'test-key-not-real';
};

afterEach(() => {
  for (const k of VARS) delete process.env[k];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/scene', () => {
  it('answers mode "fixture" with no model configured, and calls nothing', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await (await post({ context: { business: 'Bakery' } })).json()).toEqual({ ok: true, mode: 'fixture' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the founder's dressing and portrait", async () => {
    on();
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('/images/generations')
        ? Response.json({ data: [{ b64_json: 'AAAA' }], output_format: 'webp' })
        : Response.json({ choices: [{ message: { content: JSON.stringify(DRESSING) } }] }),
    ));
    const res = await (await post({ context: { business: 'Logistics company', decisionType: 'contract' } })).json();
    expect(res).toMatchObject({ ok: true, mode: 'model', portrait: 'data:image/webp;base64,AAAA', models: { scene: 'muse-spark-1.3', portrait: 'muse-image-1.0' } });
    expect(res.dressing.objects.pan.label).toBe('Fuel and tyres');
  });

  it('still returns the dressing when the portrait fails', async () => {
    on();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.endsWith('/images/generations') ? new Response('{}', { status: 400 }) : Response.json({ choices: [{ message: { content: JSON.stringify(DRESSING) } }] }),
    ));
    const res = await (await post({ context: {} })).json();
    expect(res).toMatchObject({ ok: true, mode: 'model', portrait: null });
    expect(res.dressing.title).toBe('The depot');
  });

  it("still draws the founder's portrait from their business and place when the scene is refused", async () => {
    on();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prompts: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      if (!url.endsWith('/images/generations')) return Response.json({ error: { message: 'not found' } }, { status: 404 });
      prompts.push((JSON.parse(String(init.body)) as { prompt: string }).prompt);
      return Response.json({ data: [{ b64_json: 'AAAA' }], output_format: 'webp' });
    }));
    const res = await (await post({ context: { business: 'Hair salon', location: 'Soweto' } })).json();
    expect(res).toMatchObject({ ok: true, mode: 'model', dressing: null, portrait: 'data:image/webp;base64,AAAA' });
    expect(prompts[0]).toContain('Hair salon in Soweto');
    // The refusal is logged with the API's own reason, so it can be diagnosed.
    expect(warn.mock.calls.flat().join(' ')).toMatch(/"status":404.*not found/);
  });

  it('answers 502 when the scene fails, and 400 for a request it cannot read', async () => {
    on();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    expect((await post({ context: {} })).status).toBe(502);
    expect((await post({ context: { decisionType: 'lottery' } })).status).toBe(400);
  });
});
