import { afterEach, describe, expect, it } from 'vitest';
import { POST } from './whatif.js';
import { resetGuard } from '../shared/http/guard.js';
import { readWithModel } from '../shared/whatif/read.js';
import type { Deps, MetaConfig } from '../shared/providers/meta.js';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request('https://parallax.example/api/whatif', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

afterEach(() => {
  delete process.env.META_MODEL_ENABLED;
  delete process.env.META_API_KEY;
  resetGuard();
});

describe('POST /api/whatif', () => {
  it('answers fixture with no model, so the browser reads the words in code', async () => {
    const res = await post({ text: 'what if they pay late?' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, mode: 'fixture' });
  });

  it('refuses a call from another site once a model is connected', async () => {
    process.env.META_MODEL_ENABLED = 'true';
    process.env.META_API_KEY = 'test-key-not-real';
    const res = await post({ text: 'what if they pay late?' }, { origin: 'https://evil.example', host: 'parallax.example' });
    expect(res.status).toBe(403);
  });

  it('turns away bad JSON and an empty what-if before any model call', async () => {
    process.env.META_MODEL_ENABLED = 'true';
    process.env.META_API_KEY = 'test-key-not-real';
    expect((await post('{nope')).status).toBe(400);
    expect((await post({ text: '' })).status).toBe(400);
    expect((await post({ text: 'x'.repeat(5000) })).status).toBe(413);
  });
});

describe('reading with the model', () => {
  it('sends only the words, and snaps the reply onto the sliders', async () => {
    let sent = '';
    const deps: Deps = {
      fetch: async (_url, init) => {
        sent = String(init.body);
        const reply = { latePayment: true, contractPercent: null, pricePercent: 12, outOfScope: false };
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
      sleep: async () => {},
      now: () => 0,
      random: () => 0,
    };
    const cfg = { apiKey: 'k', baseUrl: 'https://model.example/v1', models: ['muse-spark-1.3'] } as unknown as MetaConfig;
    const { result } = await readWithModel(cfg, 'what if they pay late and prices go up 12%?', deps);
    expect(result.changes).toEqual({ latePayment: true, pricePercent: 10 });
    expect(sent).toContain('what if they pay late');
    expect(sent).not.toMatch(/startingCash|R\s?\d{2,}/);
  });
});
