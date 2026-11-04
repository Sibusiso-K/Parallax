import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_EXTRACTION, DEMO_TEXT } from '../shared/intake/fixture.js';
import { pick, rng } from '../shared/testing/random.js';
import { POST } from './intake.js';

// Stress test for POST /api/intake: many requests at once, good and bad, with the model switched on and its replies
// failing at random. The model is always a stub, so nothing leaves the machine. The route must never answer 500.
const RUNS = Number(process.env.STRESS_RUNS ?? 400);
const MODEL_VARS = ['META_MODEL_ENABLED', 'META_API_KEY', 'META_API_BASE_URL'] as const;

beforeEach(() => {
  for (const k of MODEL_VARS) delete process.env[k];
});
afterEach(() => {
  for (const k of MODEL_VARS) delete process.env[k];
  vi.unstubAllGlobals();
});

const post = (body: string) => POST(new Request('http://localhost/api/intake', { method: 'POST', body }));

describe('POST /api/intake under load', () => {
  it('answers every request with 200, 400 or 413, and never a 500', async () => {
    const r = rng(1);
    const bodies = Array.from({ length: RUNS }, (_, k) => {
      if (k % 5 === 0) return 'not json {';
      if (k % 5 === 1) return JSON.stringify({ text: 'x'.repeat(4001 + (k % 1000)) });
      if (k % 5 === 2) return JSON.stringify({ text: DEMO_TEXT });
      return JSON.stringify({ text: pick(r, ['I would like to think about it', '   ', 'Should I take the contract?', 'x'.repeat(9000)]) });
    });
    const responses = await Promise.all(bodies.map((b) => post(b)));
    const statuses = new Set(responses.map((res) => res.status));
    for (const s of statuses) expect([200, 400, 413]).toContain(s);
    expect(responses.filter((res) => res.status === 200).length).toBeGreaterThan(0);
  });

  it('keeps answering 200 with the model on and its replies failing at random', async () => {
    process.env.META_MODEL_ENABLED = 'true';
    process.env.META_API_KEY = 'test-key-not-real';
    const r = rng(2);
    // No 5xx in the mix: a 500 would make the client back off with real waits, which a stress run should not do.
    const replies = [
      () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(DEMO_EXTRACTION) } }] }), { status: 200 }),
      () => new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }), { status: 200 }),
      () => new Response('{}', { status: 402 }),
      () => new Response('{}', { status: 404 }),
    ];
    vi.stubGlobal('fetch', async () => pick(r, replies)());
    const responses = await Promise.all(Array.from({ length: Math.ceil(RUNS / 4) }, () => post(JSON.stringify({ text: DEMO_TEXT }))));
    for (const res of responses) expect(res.status).toBe(200);
    for (const res of responses) {
      const data = (await res.json()) as { ok: boolean; mode: string; fields: object };
      expect(data.ok).toBe(true);
      expect(['model', 'fixture']).toContain(data.mode);
      expect(Object.keys(data.fields).length).toBeGreaterThan(0); // the demo text always fills something
    }
  });

  it('refuses oversized bodies without parsing them', async () => {
    expect((await post('x'.repeat(50_000))).status).toBe(413);
  });
});
