import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './advisor.js';
import { DEMO_EXTRACTION } from '../shared/intake/fixture.js';
import { templatePaths } from '../shared/paths/templates.js';
import { buildProfile } from '../shared/profile/profile.js';
import { advisorFigures, checkAdvisorText } from '../shared/scene/advisor-model.js';
import { buildSnapshot } from '../shared/scene/room-model.js';
import type { PathInput } from '../shared/engine/simulate.js';

// Offline: a stub stands in for the model, so these prove what happens to its words, not what it would say.
const VARS = ['META_MODEL_ENABLED', 'META_API_KEY'] as const;
const profile = buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: 'test' } });
const card = templatePaths(profile).find((c) => c.letter === 'B')!;
const path = { id: card.id, letter: card.letter, name: card.name, summary: card.summary, startingCash: card.startingCash, assumptions: card.assumptions };
const post = (body: unknown) => POST(new Request('http://localhost/api/advisor', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }));
const modelSays = (reply: unknown) => {
  process.env.META_MODEL_ENABLED = 'true';
  process.env.META_API_KEY = 'test-key-not-real';
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] })));
};
const ask = { question: 'Why is this month tight?', month: 2, stressed: false, object: null, path };
const snapshot = (stressed: boolean) => buildSnapshot({ sessionId: 's', profileRevision: 1, simulationVersion: 1, pathId: 'B', pathName: card.name, path: card as PathInput, case: 'likely', stress: stressed ? { id: 'late-payment' } : null });
const textOf = (segments: { text: string }[]) => segments.map((s) => s.text).join('');

afterEach(() => {
  for (const k of VARS) delete process.env[k];
  vi.unstubAllGlobals();
});

describe('POST /api/advisor', () => {
  it('answers mode "fixture" with no model configured, and sends nothing', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await (await post(ask)).json()).toEqual({ ok: true, mode: 'fixture' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fills every figure from the engine and returns it as a checkable segment', async () => {
    const cash = snapshot(false).baseline.rows[1]!.cash;
    modelSays({ reply: 'At the end of month 2 you would hold {{fig:B.room.baseline.cash.m2}}. The first payment is still on its way.', actions: [{ type: 'show_month', month: 3 }], followups: ['What if they pay late?'] });
    const res = await (await post(ask)).json();
    expect(res).toMatchObject({ ok: true, mode: 'model', dropped: 0, model: 'muse-spark-1.3' });
    const figure = res.segments.find((s: { kind: string }) => s.kind === 'figure');
    expect(figure).toMatchObject({ scenario: 'baseline', metric: 'cash_at_month', month: 2 });
    expect(figure.text).toBe(`R${cash.toLocaleString('en-US')}`);
    expect(res.actions).toEqual([{ type: 'show_month', month: 3 }]);
    expect(res.followups).toEqual(['What if they pay late?']);
  });

  it('drops a sentence that types its own amount, and keeps the rest', async () => {
    modelSays({ reply: 'You would end the year with R999,999. Cash is thin until the first payment lands.' });
    const res = await (await post(ask)).json();
    expect(res.dropped).toBe(1);
    expect(textOf(res.segments)).toBe('Cash is thin until the first payment lands.');
    expect(JSON.stringify(res)).not.toContain('999');
  });

  it('answers with nothing rather than show an answer it cannot back', async () => {
    modelSays({ reply: 'You will definitely have R50,000 by month 19.' });
    const res = await (await post(ask)).json();
    expect(res).toMatchObject({ ok: true, mode: 'model', segments: [], dropped: 1 });
  });

  it('refuses an empty question and a body that is not JSON, in plain words', async () => {
    modelSays({ reply: 'Hello.' });
    expect((await post({ ...ask, question: '  ' })).status).toBe(400);
    expect(await (await post('not json')).json()).toEqual({ ok: false, error: 'Ask the advisor something.' });
  });

  it('fails plainly when the model cannot answer, and leaks nothing about why', async () => {
    process.env.META_MODEL_ENABLED = 'true';
    process.env.META_API_KEY = 'test-key-not-real';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await post(ask);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, error: "The advisor couldn't answer just now. Please ask again." });
  });
});

describe('checkAdvisorText', () => {
  const months = [1, 2, 3, 12, 36];
  const { table, figures } = advisorFigures('B', snapshot(true), months);
  const check = (raw: string, userNumbers: number[] = []) => checkAdvisorText(raw, { letter: 'B', table, figures, months, userNumbers });

  it('keeps a month on the list and drops one that is not', () => {
    expect(check('Things ease in month 3.').dropped).toBe(0);
    expect(check('Things ease in month 19.').dropped).toBe(1);
  });

  it('drops a placeholder it was not given: another path, another month, or an invention', () => {
    expect(check('Cash is {{fig:A.room.baseline.cash.m2}}.').dropped).toBe(1);
    expect(check('Cash is {{fig:B.room.baseline.cash.m19}}.').dropped).toBe(1);
    expect(check('Cash is {{fig:B.made.up}}.').dropped).toBe(1);
  });

  it('drops words for amounts, percentages and promises', () => {
    expect(check('You would be down about fifty thousand rand.').dropped).toBe(1);
    expect(check('Margins fall by 12%.').dropped).toBe(1);
    expect(check('This is guaranteed to work.').dropped).toBe(1);
  });

  it('lets a number the founder typed be said back', () => {
    expect(check('You said you would need 7 fridges.', [7]).dropped).toBe(0);
  });

  it('gives the same result every time', () => {
    const raw = 'In month 2 you hold {{fig:B.room.active.cash.m2}}. Then it eases.';
    expect(check(raw)).toEqual(check(raw));
    expect(check(raw).segments.filter((s) => s.kind === 'figure')).toHaveLength(1);
  });
});
