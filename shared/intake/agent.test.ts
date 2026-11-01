import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_BASE_URL, DEFAULT_MODELS, MAX_TOKENS } from '../providers/meta.js';
import { intakeExtractor } from './agent.js';

// The intake agent's model call, on a stubbed network: no request leaves the machine.
const KEY = 'test-key-not-real';
const cfg = { apiKey: KEY, baseUrl: DEFAULT_BASE_URL, models: [...DEFAULT_MODELS] };
const reply = (value: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe('the intake agent', () => {
  it('asks the first model for the intake fields, with the founder text, the schema and a token cap', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return reply({ revenue: { low: 75000, high: 105000, quote: 'R75k to R105k' } });
    });

    const out = await intakeExtractor(cfg)('We sell R75k to R105k a month.');

    expect(out).toEqual({ revenue: { low: 75000, high: 105000, quote: 'R75k to R105k' } });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe(`${DEFAULT_BASE_URL}/chat/completions`);
    const headers = seen[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(String(seen[0]!.init.body)) as { model: string; max_tokens: number; messages: { role: string; content: string }[] };
    expect(body.model).toBe('muse-spark-1.3');
    expect(body.max_tokens).toBeLessThanOrEqual(MAX_TOKENS);
    expect(body.messages[0]).toMatchObject({ role: 'system' });
    expect(body.messages[0]!.content).toMatch(/quote/);
    expect(body.messages.at(-1)).toMatchObject({ role: 'user', content: 'We sell R75k to R105k a month.' });
  });

  it('rejects when billing refuses the call, so the intake falls back to fixture mode', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 402 }));
    await expect(intakeExtractor(cfg)('anything')).rejects.toMatchObject({ kind: 'billing' });
  });
});
