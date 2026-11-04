import { writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { modelConfigOrNull, type MetaConfig } from '../shared/providers/meta.js';
import { readWithModel } from '../shared/whatif/read.js';
import { checkIntake, checkRequest } from '../shared/intake/check.js';
import { answerAsFutureSelf, chatRequest } from '../shared/chat/future-self.js';
import { boardRequest, moderateBoard } from '../shared/chat/board.js';
import { planRequest, planWithModel, runPlan } from '../shared/agent/planner.js';
import { DEMO_EXTRACTION } from '../shared/intake/fixture.js';
import { templatePaths } from '../shared/paths/templates.js';
import { buildProfile } from '../shared/profile/profile.js';
import { figureTable } from '../shared/engine/analysis.js';

// The live evaluation: fixed cases against the real Muse Spark, each with a pass rule that does not depend on wording.
// It checks the guarantees the product makes (the right levers, contradictions caught, no figure a model made up, the
// agent's plans really meeting the goal) and writes the results to evals/RESULTS.md. Run: npm run eval:live.

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
    const story = (body: string) => body;
    const cases: [string, string, { key: string; label: string; value: string; quote: string }[], string | null][] = [
      [
        'consistent story',
        story('I run a bakery in Durban. We sell about R80k a month and rent is R12k a month. We have R60 000 in the bank.'),
        [
          { key: 'revenue', label: 'Sales a month', value: 'R80 000', quote: 'We sell about R80k a month' },
          { key: 'overheads', label: 'Rent and running costs a month', value: 'R12 000', quote: 'rent is R12k a month' },
        ],
        null,
      ],
      [
        'sales contradict',
        story('We sell about R80k a month. Rent is R12k a month. Honestly, most months sales are only around R45 000.'),
        [{ key: 'revenue', label: 'Sales a month', value: 'R80 000', quote: 'We sell about R80k a month' }],
        'revenue',
      ],
      [
        'yearly read as monthly',
        story('Our rent is R144 000 a year. We sell about R70k a month.'),
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
    const qs = ['When was cash tightest for you?', 'What would you warn me about?', 'Was it worth it?'];
    for (const q of qs) {
      it(`path B: ${q}`, async () => {
        const p = paths[1]!;
        const req = chatRequest.parse({ path: { id: p.id, letter: p.letter, name: p.name, summary: p.summary, startingCash: p.startingCash, assumptions: p.assumptions }, message: q });
        const { value, ms } = await timed(() => answerAsFutureSelf(c, req));
        // Every rand amount in the final text must be one of the engine's figures for this path.
        const table = figureTable(p);
        const engine = new Set(Object.values(table).map((v) => Math.round(Math.abs(v))));
        const amounts = [...value.text.matchAll(/R\s?([\d][\d ,]*)/g)].map((m) => Number(m[1]!.replace(/[ ,]/g, '')));
        const stray = amounts.filter((n) => !engine.has(n));
        const pass = stray.length === 0 && value.text.trim().length > 0;
        expect(record('Future self + guard', q, pass, `${amounts.length} amounts, ${stray.length} not from the engine; guard: ${value.checks.map((k) => k.type).join(', ') || 'clean'}`, ms)).toBe(true);
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

  it('planning agent uses tools and every plan meets the goal', async () => {
    const req = planRequest.parse({ kind: 'plan', floor: 20000, withLatePayment: true, monthlySales: 90000, paths });
    const { value, ms } = await timed(() => planWithModel(c, req));
    const pass = value.steps.length > 0 && value.found.every((f) => runPlan(req, f).meetsGoal);
    expect(
      record('Planning agent', 'floor R20 000, late payment', pass, `${value.steps.length} tool calls, ${value.calls} model calls, ${value.found.length} plans found (${value.found.map((f) => `${f.path} c${f.contractPercent} p${f.pricePercent}`).join('; ')})`, ms),
    ).toBe(true);
  });
});

afterAll(() => {
  if (!cfg || rows.length === 0) return;
  const passed = rows.filter((r) => r.pass).length;
  const lines = [
    '# Live evaluation of the Meta features',
    '',
    `Run on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC against ${cfg.models[0]}: **${passed} of ${rows.length} cases passed.**`,
    'Each case has a pass rule that does not depend on wording (see `evals/live.eval.ts`). Run it with `npm run eval:live`; it makes real, billed calls.',
    '',
    '| Feature | Case | Pass | Detail | Time |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.feature} | ${r.case.replace(/\|/g, '/')} | ${r.pass ? 'yes' : '**no**'} | ${r.detail.replace(/\|/g, '/')} | ${(r.ms / 1000).toFixed(1)} s |`),
    '',
  ];
  writeFileSync('evals/RESULTS.md', lines.join('\n'));
});
