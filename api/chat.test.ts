import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './chat.js';

// Offline: with no model the route says so (and the browser uses its scripted replies); with one, a stub answers.
const VARS = ['META_MODEL_ENABLED', 'META_API_KEY'] as const;
const path = {
  id: 'p-a',
  letter: 'A',
  name: 'Stay lean',
  summary: 'Say no and keep going.',
  startingCash: 120000,
  assumptions: [{ id: 'A1', label: 'Current sales', kind: 'income', low: 75000, base: 90000, high: 105000 }],
};
const post = (body: unknown) => POST(new Request('http://localhost/api/chat', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));

afterEach(() => {
  for (const k of VARS) delete process.env[k];
  vi.unstubAllGlobals();
});

describe('POST /api/chat', () => {
  it('answers mode "fixture" with no model configured, and sends nothing', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await (await post({ path, message: 'Hi' })).json()).toEqual({ ok: true, mode: 'fixture' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers through the model and the guard when one is configured', async () => {
    process.env.META_MODEL_ENABLED = 'true';
    process.env.META_API_KEY = 'test-key-not-real';
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify({ reply: 'We started with {{fig:p-a.start}} [A1].', cites: ['A1'] }) } }] })));
    const res = await (await post({ path, context: { business: 'Catering' }, message: 'How did we start?' })).json();
    expect(res).toMatchObject({ ok: true, mode: 'model', clean: true, model: 'muse-spark-1.3' });
    expect(res.text).toBe('We started with R120,000 [A1].');
    expect(res.citations).toEqual([{ id: 'A1', label: 'A1: current sales' }]);
  });

  it('refuses an empty question, a broken path and a body that is not JSON, with plain words', async () => {
    process.env.META_MODEL_ENABLED = 'true';
    process.env.META_API_KEY = 'test-key-not-real';
    vi.stubGlobal('fetch', vi.fn());
    const empty = await post({ path, message: '   ' });
    expect(empty.status).toBe(400);
    expect((await empty.json()).error).toBe('Ask your future self something.');
    expect((await post({ path: { ...path, assumptions: [] }, message: 'Hi' })).status).toBe(400);
    expect((await post('{nope')).status).toBe(400);
  });

  it('answers 502 when the model fails, and logs only the kind of failure', async () => {
    process.env.META_MODEL_ENABLED = 'true';
    process.env.META_API_KEY = 'test-key-not-real';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await post({ path, message: 'A private question' });
    expect(res.status).toBe(502);
    expect(warn.mock.calls.flat().join(' ')).toContain('"kind":"auth"');
    expect(warn.mock.calls.flat().join(' ')).not.toContain('private');
    warn.mockRestore();
  });
});
