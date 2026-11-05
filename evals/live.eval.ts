import { mkdirSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { modelConfigOrNull, type MetaConfig } from '../shared/providers/meta.js';
import { readWithModel } from '../shared/whatif/read.js';
import { checkIntake, checkRequest } from '../shared/intake/check.js';
import { answerAsFutureSelf, chatRequest } from '../shared/chat/future-self.js';
import { boardRequest, moderateBoard } from '../shared/chat/board.js';
import { planRequest, planWithModel, runPlan, tradeoffOf } from '../shared/agent/planner.js';
import { amountsIn, missingAmounts } from '../shared/guard/amounts.js';
import { DEMO_EXTRACTION } from '../shared/intake/fixture.js';
import { templatePaths } from '../shared/paths/templates.js';
import { buildProfile } from '../shared/profile/profile.js';
import { figureTable } from '../shared/engine/analysis.js';

// The live evaluation: fixed cases against the real Muse Spark, each with a pass rule that does not depend on wording.
// It checks the guarantees the product makes (the right levers, contradictions caught, no rand amount a model made up,
// the agent's plans really meeting the goal and saying what they cost). Each run is saved to evals/runs/ as its own file;
// evals/summarise.mjs combines them into evals/RESULTS.md. Run: npm run eval:live, then npm run eval:summary.

const cfg = modelConfigOrNull(process.env);
const run = cfg ? describe : describe.skip;
const rows: { feature: string; case: string; pass: boolean; detail: string; ms: number }[] = [];
const paths = templatePaths(buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: '21k' } }));
const timed = async <T>(fn: () => Promise<T>) => {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
};
const record = (feature: string, name: string, pass: boolean, detail: string, ms: number) => {
  rows.push({ feature, case: name, pass, detail, ms });
  return pass;
};

run('live evaluation of the Meta features', () => {
  const c = cfg as MetaConfig;

  describe('what-if in words', () => {
    const cases: [string, Record<string, unknown>, boolean][] = [
      ['What if the client pays two months late?', { latePayment: true }, false],
      ['what if I raise my prices by 10 percent', { pricePercent: 10 }, false],
      ['What if the contract is only half the size and they pay late', { contractScale: 0.5, latePayment: true }, false],
      ['what if we cut prices 5% to win more customers', { pricePercent: -5 }, false],
      ['what if I take out a bank loan', {}, true],
    ];
    for (const [text, want, scope] of cases) {
      it(text, async () => {
        const { value, ms } = await timed(() => readWithModel(c, text));
        const got = value.result.changes as Record<string, unknown>;
        const pass = Object.entries(want).every(([k, v]) => got[k] === v) && Object.keys(got).every((k) => k in want) && value.result.outOfScope === scope;
        expect(record('What-if', text, pass, `got ${JSON.stringify(got)}${value.result.outOfScope ? ' (out of scope)' : ''}`, ms)).toBe(true);
      });
    }
  });

  describe('intake self-check', () => {
    const cases: [string, string, { key: string; label: string; value: string; quote: string }[], string | null][] = [
      [
        'consistent story',
        'I run a bakery in Durban. We sell about R80k a month and rent is R12k a month. We have R60 000 in the bank.',
        [
          { key: 'revenue', label: 'Sales a month', value: 'R80 000', quote: 'We sell about R80k a month' },
          { key: 'overheads', label: 'Rent and running costs a month', value: 'R12 000', quote: 'rent is R12k a month' },
        ],
        null,
      ],
      [
        'sales contradict',
        'We sell about R80k a month. Rent is R12k a month. Honestly, most months sales are only around R45 000.',
        [{ key: 'revenue', label: 'Sales a month', value: 'R80 000', quote: 'We sell about R80k a month' }],
        'revenue',
      ],
      [
        'yearly read as monthly',
        'Our rent is R144 000 a year. We sell about R70k a month.',
        [
          { key: 'overheads', label: 'Rent and running costs a month', value: 'R144 000', quote: 'Our rent is R144 000 a year' },
          { key: 'revenue', label: 'Sales a month', value: 'R70 000', quote: 'We sell about R70k a month' },
        ],
        'overheads',
      ],
    ];
    for (const [name, text, fields, flag] of cases) {
      it(name, async () => {
        const { value, ms } = await timed(() => checkIntake(c, checkRequest.parse({ check: true, text, fields })));
        const flagged = value.notes.map((n) => n.field);
        const pass = flag === null ? flagged.length === 0 : flagged.includes(flag);
        expect(record('Self-check', name, pass, flagged.length ? `flagged ${flagged.join(', ')}` : 'nothing flagged', ms)).toBe(true);
      });
    }
  });

  describe('future self and the figure guard', () => {
    // Each question names the engine figures a good answer must state. A pass needs all of them, within a rand of
    // rounding, and no rand amount in the reply that the engine did not compute for this path. The engine keys are
    // checked by shared/chat/coverage.test.ts, so this check cannot pass by checking nothing.
    const p = paths[1]!;
    const table = figureTable(p);
    const rand = (key: string) => Math.round(Math.abs(table[`${p.id}.${key}`] ?? NaN));
    const qs: { q: string; need: string[] }[] = [
      {
        q: 'Walk me through how cash moved: where was the lowest point, and where did it end at month 36?',
        need: ['lowest.likely', 'cash.m36.likely'],
      },
      {
        q: 'When was cash tightest for you, how much was left at that point, and what was cash at month 36?',
        need: ['lowest.likely', 'cash.m36.likely'],
      },
      {
        q: 'What were the cash figures at month 12 and at month 36 in the likely case?',
        need: ['cash.m12.likely', 'cash.m36.likely'],
      },
    ];
    for (const { q, need } of qs) {
      it(`path B: ${q}`, async () => {
        const req = chatRequest.parse({ path: { id: p.id, letter: p.letter, name: p.name, summary: p.summary, startingCash: p.startingCash, assumptions: p.assumptions }, message: q });
        const { value, ms } = await timed(() => answerAsFutureSelf(c, req));
        const engine = new Set(Object.values(table).map((v) => Math.round(Math.abs(v))));
        const amounts = amountsIn(value.text);
        const stray = amounts.filter((n) => !engine.has(n));
        const expected = need.map(rand);
        const missing = missingAmounts(value.text, expected);
        const pass = missing.length === 0 && stray.length === 0 && amounts.length >= 2;
        const guard = value.checks.map((k) => k.type).join(', ') || 'clean';
        expect(
          record('Future self + guard', q, pass, `states ${expected.length - missing.length} of ${expected.length} asked figures; ${stray.length} not from the engine; ${amounts.length} amounts; guard: ${guard}`, ms),
        ).toBe(true);
      });
    }
  });

  it('board moderator states no figures', async () => {
    const replies = [
      { letter: 'A' as const, name: paths[0]!.name, text: 'Cash never ran out, but growth was slow and I missed the bigger work.' },
      { letter: 'B' as const, name: paths[1]!.name, text: 'The months the client paid late nearly broke us; the equipment cost hurt.' },
      { letter: 'C' as const, name: paths[2]!.name, text: 'Renting the equipment and agreeing terms first kept a cushion.' },
    ];
    const { value, ms } = await timed(() => moderateBoard(c, boardRequest.parse({ kind: 'board', question: 'What would you each warn me about?', replies })));
    const lines = [...value.agree, ...value.differ, value.ask];
    const pass = lines.every((l) => !/\d/.test(l)) && value.agree.length + value.differ.length > 0;
    expect(record('Board moderator', 'warn me', pass, `${value.agree.length} agree, ${value.differ.length} differ, ${value.dropped} dropped for digits`, ms)).toBe(true);
  });

  it('planning agent uses tools, every plan meets the goal, and each plan says what it costs', async () => {
    const req = planRequest.parse({ kind: 'plan', floor: 20000, withLatePayment: true, monthlySales: 90000, paths });
    const { value, ms } = await timed(() => planWithModel(c, req));
    const reran = value.found.every((f) => runPlan(req, f).meetsGoal);
    const costed = value.found.every((f) => tradeoffOf(f).length > 0);
    const pass = value.steps.length > 0 && value.found.length > 0 && reran && costed;
    const listed = value.found.map((f) => `${f.path} c${f.contractPercent} p${f.pricePercent}`).join('; ');
    expect(
      record('Planning agent', 'floor R20 000, late payment', pass, `${value.steps.length} tool calls, ${value.calls} model calls, ${value.found.length} plans (${listed})`, ms),
    ).toBe(true);
  });
});

afterAll(() => {
  if (!cfg || rows.length === 0) return;
  mkdirSync('evals/runs', { recursive: true });
  const at = new Date().toISOString();
  const file = `evals/runs/${at.replace(/[:.]/g, '-')}.json`;
  writeFileSync(file, JSON.stringify({ at, model: cfg.models[0], rows }, null, 2) + '\n');
});
