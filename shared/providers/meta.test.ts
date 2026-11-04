import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { chatJson, configFromEnv, ModelError, modelConfigOrNull, type Deps, type MetaConfig } from './meta.js';

// Every test here runs on a scripted network and clock: no request leaves the machine and no test waits for real.
const KEY = 'test-key-not-real';
const cfg: MetaConfig = { apiKey: KEY, baseUrl: 'https://api.meta.ai/v1', models: ['muse-spark-1.3', 'muse-spark-1.2'] };
const schema = z.object({ ok: z.literal(true), n: z.number() });
const call = { name: 'probe', system: 'Reply with JSON only.', user: 'hello', schema, timeoutMs: 50 };
const HAPPY = { ok: true, n: 3 };

type Reply = { status: number; body?: unknown; retryAfter?: string };
type Step = Reply | 'network' | 'hang';

const good = (value: unknown): Reply => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify(value) } }] } });
const text = (content: string): Reply => ({ status: 200, body: { choices: [{ message: { content } }] } });

// Each request takes the next scripted step; sleeping moves the clock forward instead of waiting.
function world(steps: Step[], start = 0, slowMs = 0) {
  const queue = [...steps];
  const sent: { url: string; model: string; auth: string | undefined; body: { max_tokens?: number; messages: unknown[] } }[] = [];
  let clock = start;
  const deps: Deps = {
    fetch: (url, init) => {
      const body = JSON.parse(String(init.body)) as { model: string; max_tokens?: number; messages: unknown[] };
      const headers = init.headers as Record<string, string>;
      sent.push({ url, model: body.model, auth: headers.authorization, body });
      clock += slowMs;
      const step = queue.shift();
      if (step === undefined) return Promise.resolve(new Response('{}', { status: 500 }));
      if (step === 'network') return Promise.reject(new TypeError('fetch failed'));
      if (step === 'hang') {
        return new Promise<Response>((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      }
      const outHeaders: Record<string, string> = step.retryAfter ? { 'retry-after': step.retryAfter } : {};
      return Promise.resolve(new Response(JSON.stringify(step.body ?? {}), { status: step.status, headers: outHeaders }));
    },
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    random: () => 0,
  };
  return { deps, sent, clock: () => clock };
}

describe('chatJson', () => {
  it('returns the parsed value and a trace from the first model, sent as a capped bearer request', async () => {
    const w = world([good(HAPPY)]);
    const { value, trace } = await chatJson(cfg, call, w.deps);
    expect(value).toEqual(HAPPY);
    expect(trace).toMatchObject({ model: 'muse-spark-1.3', calls: 1, repaired: false });
    expect(w.sent[0]).toMatchObject({
      url: 'https://api.meta.ai/v1/chat/completions',
      auth: `Bearer ${KEY}`,
      body: { max_tokens: 8192, reasoning_effort: 'minimal' },
    });
  });

  it('keeps every model attempt on the error, so a first refusal is not hidden by the last', async () => {
    const w = world([{ status: 503 }, { status: 503 }, { status: 404, body: { error: { code: 'model_not_found' } } }]);
    const err = (await chatJson(cfg, call, w.deps).catch((e: unknown) => e)) as ModelError;
    expect(err.kind).toBe('notfound');
    expect(err.attempts?.map((a) => [a.model, a.kind, a.status])).toEqual([
      ['muse-spark-1.3', 'overloaded', 503],
      ['muse-spark-1.2', 'notfound', 404],
    ]);
    expect(err.attempts?.[1]?.detail).toContain('model_not_found');
  });

  it('says when a reply ran out of tokens before any text, then tries the next model', async () => {
    const spent: Reply = { status: 200, body: { choices: [{ finish_reason: 'length', message: { content: null } }] } };
    const w = world([spent, spent]);
    await expect(chatJson(cfg, call, w.deps)).rejects.toMatchObject({ kind: 'schema', message: 'the reply ran out of tokens before any text' });
    expect(w.sent.map((s) => s.model)).toEqual(['muse-spark-1.3', 'muse-spark-1.2']);
  });

  it('accepts a reply wrapped in a code fence', async () => {
    const { value } = await chatJson(cfg, call, world([text('```json\n{"ok":true,"n":1}\n```')]).deps);
    expect(value).toEqual({ ok: true, n: 1 });
  });

  it('repairs one bad reply and says so', async () => {
    const w = world([text('not json'), good(HAPPY)]);
    const { trace } = await chatJson(cfg, call, w.deps);
    expect(trace).toMatchObject({ calls: 2, repaired: true });
    expect(w.sent[1]!.body.messages).toHaveLength(4); // system, user, the bad reply, the repair request
  });

  it('fails over to the next model after a second bad reply', async () => {
    const { trace } = await chatJson(cfg, call, world([text('no'), text('still no'), good(HAPPY)]).deps);
    expect(trace).toMatchObject({ model: 'muse-spark-1.2', calls: 3, repaired: false });
  });

  it('retries a rate limit after the Retry-After wait', async () => {
    const w = world([{ status: 429, retryAfter: '2' }, good(HAPPY)]);
    const { trace } = await chatJson(cfg, call, w.deps);
    expect(trace.calls).toBe(2);
    expect(w.clock()).toBe(2000);
  });

  it('retries a server error up to three times, then fails over', async () => {
    const { trace } = await chatJson(cfg, call, world([{ status: 500 }, { status: 502 }, { status: 500 }, good(HAPPY)]).deps);
    expect(trace).toMatchObject({ model: 'muse-spark-1.2', calls: 4 });
  });

  it('gives an overloaded service one quick retry, then fails over', async () => {
    const w = world([{ status: 503 }, { status: 503 }, good(HAPPY)]);
    const { trace } = await chatJson(cfg, call, w.deps);
    expect(trace.calls).toBe(3);
    expect(w.clock()).toBe(500);
  });

  it('retries a timeout once, then fails over', async () => {
    const { trace } = await chatJson(cfg, call, world(['hang', 'hang', good(HAPPY)]).deps);
    expect(trace).toMatchObject({ model: 'muse-spark-1.2', calls: 3 });
  });

  it('retries a dropped connection, then fails over', async () => {
    const { trace } = await chatJson(cfg, call, world(['network', 'network', 'network', good(HAPPY)]).deps);
    expect(trace.calls).toBe(4);
  });

  it('moves past a model that is not found', async () => {
    const { trace } = await chatJson(cfg, call, world([{ status: 404 }, good(HAPPY)]).deps);
    expect(trace.model).toBe('muse-spark-1.2');
  });

  it('stops at once on billing, auth or a bad request, and never fails over', async () => {
    for (const status of [402, 403, 401, 400]) {
      const w = world([{ status }, good(HAPPY)]);
      await expect(chatJson(cfg, call, w.deps)).rejects.toBeInstanceOf(ModelError);
      expect(w.sent).toHaveLength(1);
    }
  });

  it('reports billing as its own kind, and the key never appears in the error', async () => {
    const err = (await chatJson(cfg, call, world([{ status: 402 }]).deps).catch((e: unknown) => e)) as ModelError;
    expect(err.kind).toBe('billing');
    expect(err.message).not.toContain(KEY);
  });

  it('does not start a new attempt once the deadline has passed', async () => {
    const w = world([{ status: 500 }, good(HAPPY)], 0, 95_000); // the first request alone runs past the deadline
    await expect(chatJson(cfg, call, w.deps)).rejects.toMatchObject({ kind: 'server' });
    expect(w.sent).toHaveLength(1);
  });
});

describe('configFromEnv', () => {
  const on = { META_MODEL_ENABLED: 'true', META_API_KEY: KEY };
  const messageOf = (env: Record<string, string | undefined>) => {
    try {
      configFromEnv(env);
      return '';
    } catch (e) {
      return (e as Error).message;
    }
  };

  it('sends nothing unless the model switch is on and a key is set', () => {
    expect(configFromEnv({ META_API_KEY: KEY })).toBeNull();
    expect(configFromEnv({ META_MODEL_ENABLED: 'false', META_API_KEY: KEY })).toBeNull();
    expect(configFromEnv({ META_MODEL_ENABLED: 'true' })).toBeNull();
  });

  it('uses the Meta address and the default model chain', () => {
    expect(configFromEnv(on)).toEqual({ apiKey: KEY, baseUrl: 'https://api.meta.ai/v1', models: ['muse-spark-1.3', 'muse-spark-1.2'] });
  });

  it('allows a local test address over http, and nothing else over http', () => {
    expect(configFromEnv({ ...on, META_API_BASE_URL: 'http://127.0.0.1:5999/v1/' })?.baseUrl).toBe('http://127.0.0.1:5999/v1');
    expect(messageOf({ ...on, META_API_BASE_URL: 'http://example.com/v1' })).toContain('https');
  });

  it('refuses contributor models and unreadable addresses, and never echoes the key', () => {
    expect(messageOf({ ...on, META_MODELS: 'muse-spark-1.3-contributor' })).toContain('contributor');
    expect(messageOf({ ...on, META_API_BASE_URL: 'not a url' })).toContain('not a URL');
    expect(messageOf({ ...on, META_API_BASE_URL: 'ftp://x.example' })).toContain('https');
    expect(messageOf({ ...on, META_API_BASE_URL: 'not a url' })).not.toContain(KEY);
  });

  it('reads a bad setting as no model in the app path', () => {
    expect(modelConfigOrNull({ ...on, META_API_BASE_URL: 'http://example.com' })).toBeNull();
  });
});
