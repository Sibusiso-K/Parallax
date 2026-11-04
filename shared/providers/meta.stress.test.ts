import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { chatJson, ModelError, type Deps, type MetaConfig } from './meta.js';
import { pick, rng } from '../testing/random.js';

// Stress test for the Meta client (F19): many calls at once, each meeting random failures on a scripted network. Every
// call must end in a value or a ModelError, within its request budget and its deadline, and the key must never leak.
const RUNS = Number(process.env.STRESS_RUNS ?? 400);
const KEY = 'test-key-not-real';
const cfg: MetaConfig = { apiKey: KEY, baseUrl: 'https://api.meta.ai/v1', models: ['muse-spark-1.3', 'muse-spark-1.2'] };
const schema = z.object({ ok: z.literal(true), n: z.number() });
const call = { name: 'probe', system: 'Reply with JSON only.', user: 'hello', schema };

// Two models, three tries each for the retryable failures, and one repair per model: at most 2 x (3 + 3) requests.
const MAX_REQUESTS = 12;
const DEADLINE_MS = 90_000;

type Outcome = { status: number; body?: unknown; retryAfter?: string } | 'network';
const OUTCOMES: Outcome[] = [
  { status: 200, body: { choices: [{ message: { content: JSON.stringify({ ok: true, n: 1 }) } }] } },
  { status: 200, body: { choices: [{ message: { content: 'not json at all' } }] } },
  { status: 200, body: { choices: [{ message: { content: JSON.stringify({ ok: false }) } }] } },
  { status: 429, retryAfter: '1' },
  { status: 500 },
  { status: 503 },
  { status: 504 },
  { status: 404 },
  { status: 402 },
  { status: 400 },
  'network',
];

// One call's world: every request draws a random outcome, and sleeping only moves a fake clock.
function scripted(r: () => number) {
  let requests = 0;
  let clock = 0;
  const deps: Deps = {
    fetch: async () => {
      requests++;
      const outcome = pick(r, OUTCOMES);
      if (outcome === 'network') throw new TypeError('fetch failed');
      const headers: Record<string, string> = outcome.retryAfter ? { 'retry-after': outcome.retryAfter } : {};
      return new Response(JSON.stringify(outcome.body ?? {}), { status: outcome.status, headers });
    },
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    random: r,
  };
  return { deps, requests: () => requests, clock: () => clock };
}

describe('Meta client under concurrent random failures', () => {
  it('ends every call in a value or a ModelError, within its budget and deadline, and never leaks the key', async () => {
    const r = rng(1);
    const worlds = Array.from({ length: RUNS }, () => scripted(r));
    const outcomes = await Promise.all(
      worlds.map((w) =>
        chatJson(cfg, call, w.deps).then(
          (res) => ({ ok: true as const, value: res.value }),
          (err: unknown) => ({ ok: false as const, err }),
        ),
      ),
    );
    for (const [i, out] of outcomes.entries()) {
      const w = worlds[i]!;
      expect(w.requests()).toBeLessThanOrEqual(MAX_REQUESTS);
      expect(w.clock()).toBeLessThanOrEqual(DEADLINE_MS);
      if (out.ok) expect(out.value).toEqual({ ok: true, n: 1 });
      else {
        expect(out.err).toBeInstanceOf(ModelError);
        expect((out.err as ModelError).message).not.toContain(KEY);
      }
    }
    expect(outcomes.some((o) => o.ok)).toBe(true); // the mix reaches success...
    expect(outcomes.some((o) => !o.ok)).toBe(true); // ...and failure
  });
});
