import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkWav, encodeWav, SAMPLE_RATE } from '../shared/voice/wav.js';
import { transcribeResponseSchema } from '../shared/voice/contract.js';
import { int, pick, rng } from '../shared/testing/random.js';
import { POST } from './transcribe.js';

// Stress test for POST /api/transcribe: many requests at once with good, damaged and random bodies, with the speech
// model on and its replies failing at random. The model is always a stub. The route must never answer 500, and every
// answer must pass the contract. The WAV check must never throw, whatever bytes it is given.
const RUNS = Number(process.env.STRESS_RUNS ?? 400);
const VARS = ['META_VOICE_ENABLED', 'META_API_KEY'] as const;
beforeEach(() => VARS.forEach((k) => delete process.env[k]));
afterEach(() => {
  VARS.forEach((k) => delete process.env[k]);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const post = (body: Uint8Array) => POST(new Request('http://localhost/api/transcribe', { method: 'POST', body: body as BodyInit }));

describe('POST /api/transcribe under load', () => {
  it('answers 200, 400, 413 or 502 and nothing else, in demo mode and with the model failing at random', async () => {
    const r = rng(3);
    const good = encodeWav(new Int16Array(SAMPLE_RATE));
    const bodies = Array.from({ length: RUNS }, () => {
      const kind = int(r, 0, 4);
      if (kind === 0) return good;
      if (kind === 1) return good.slice(0, int(r, 0, good.length - 1));
      if (kind === 2) return Uint8Array.from({ length: int(r, 0, 3000) }, () => int(r, 0, 255));
      if (kind === 3) return good.map((b, i) => (i < 44 && r() < 0.2 ? int(r, 0, 255) : b));
      return encodeWav(new Int16Array(int(r, 0, SAMPLE_RATE * 70)));
    });
    const allowed = [200, 400, 413, 502];
    for (const live of [false, true]) {
      if (live) {
        process.env.META_VOICE_ENABLED = 'true';
        process.env.META_API_KEY = 'test-key-not-real';
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        // No 429 or 5xx in the mix: those make the client back off with real waits, which a stress run should not do.
        const replies = [
          () => new Response(JSON.stringify({ transcript: 'hello there' }), { status: 200 }),
          () => new Response(JSON.stringify({ transcript: '' }), { status: 200 }),
          () => new Response('{}', { status: 402 }),
          () => new Response('{}', { status: 400 }),
          () => new Response('garbage', { status: 200 }),
        ];
        vi.stubGlobal('fetch', async () => pick(r, replies)());
      }
      const responses = await Promise.all(bodies.map(post));
      for (const res of responses) {
        expect(allowed).toContain(res.status);
        expect(transcribeResponseSchema.safeParse(await res.json()).success).toBe(true);
      }
      expect(responses.some((res) => res.status === 200)).toBe(true);
    }
  });

  it('never throws when checking random bytes or randomly damaged headers', () => {
    const r = rng(4);
    const good = encodeWav(new Int16Array(800));
    for (let k = 0; k < RUNS * 10; k++) {
      const bytes = k % 2 === 0 ? Uint8Array.from({ length: int(r, 0, 200) }, () => int(r, 0, 255)) : good.map((b, i) => (i < 60 && r() < 0.3 ? int(r, 0, 255) : b));
      expect(() => checkWav(bytes)).not.toThrow();
    }
  });
});
