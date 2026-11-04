import { describe, expect, it } from 'vitest';
import { CASES, figureTable, setbackImpact } from './engine/analysis.js';
import { simulate, validateAssumption } from './engine/simulate.js';
import { guardText } from './guard/figures.js';
import { extraction, decisionTypes, goalOptions, riskLevels, type Extraction } from './intake/schema.js';
import { assumedKeys, buildProfile, type MoneyKey } from './profile/profile.js';
import { int, pick, rng } from './testing/random.js';
import { isMoneyField } from '../web/src/lib/format';
import { FIELD_DEFAULTS, MONEY_FIELDS, mockApi, toExtraction, toScreenFields } from '../web/src/lib/parallax-api';
import { pathFigures } from '../web/src/lib/stress';
import type { FieldKey, Profile } from '../web/src/lib/types';

// The chained backend on random but valid screen input: the founder's answers -> the screen mapping -> the profile ->
// three path cards -> 36 months of cash -> analysis -> the figure guard. Seeded, so a failure replays exactly; set
// STRESS_RUNS for a longer soak (STRESS_RUNS=5000 npm run stress). Every failure names the seed.
const SEED = 41;
const RUNS = Number(process.env.STRESS_RUNS ?? 2000);
const MONEY: MoneyKey[] = [
  'revenue',
  'directCosts',
  'overheads',
  'payroll',
  'founderPay',
  'debtRepayments',
  'cash',
  'offerRevenue',
  'hireCost',
  'upfrontCost',
];
const TODAY: MoneyKey[] = ['revenue', 'directCosts', 'overheads', 'payroll', 'founderPay', 'debtRepayments', 'cash'];
const SCALES = [0, 1, 50, 8_000, 200_000, 2_000_000, 1_000_000_000];

/** An answer a model could give, or the founder could type: a single value or a range, sometimes with a usual figure. */
function randomExtraction(r: () => number): Extraction {
  const money = () => {
    const scale = pick(r, SCALES);
    const low = int(r, 0, scale);
    const high = int(r, low, scale);
    return r() < 0.5 ? { low, high, quote: `R${low} to R${high}` } : { low, high, base: int(r, low, high), quote: `R${high}` };
  };
  const ex: Extraction = { decisionType: { value: pick(r, decisionTypes), quote: 'a decision' } };
  if (r() < 0.8) ex.decision = { value: 'Take on a contract', quote: 'a contract' };
  if (r() < 0.7) ex.business = { value: 'A small business', quote: 'a small business' };
  if (r() < 0.4) ex.location = { value: 'Johannesburg', quote: 'Johannesburg' };
  for (const key of MONEY) if (r() < 0.65) ex[key] = money();
  if (r() < 0.7) ex.riskComfort = { value: pick(r, riskLevels), quote: 'careful' };
  if (r() < 0.7) ex.goals = { value: [pick(r, goalOptions)], quote: 'cash' };
  if (r() < 0.6) ex.paymentDays = { value: int(r, 0, 400), quote: '60 days' };
  if (r() < 0.6) ex.priceRisePercent = { value: int(r, 0, 200), quote: '10%' };
  return ex;
}

/**
 * The state the screens hold once every follow-up is answered: the extracted fields, with every missing business figure
 * left to the "I don't know" defaults and marked assumed. That is the only way the screen lets the founder move on.
 */
function screenProfile(ex: Extraction, r: () => number): Profile {
  const screen = toScreenFields(ex);
  const fields: Partial<Record<FieldKey, unknown>> = { ...screen.fields };
  const assumed: FieldKey[] = [];
  for (const key of TODAY) {
    if (fields[key] !== undefined) continue;
    fields[key] = FIELD_DEFAULTS[key];
    assumed.push(key);
  }
  if (r() < 0.4) {
    fields.riskComfort = FIELD_DEFAULTS.riskComfort;
    fields.goals = FIELD_DEFAULTS.goals;
  }
  return { fields, assumed };
}

const check = (condition: boolean, label: string) => {
  if (!condition) throw new Error(`${label} (seed ${SEED})`);
};

describe('the whole chain on random screen answers', () => {
  it('keeps every figure finite, every card valid and every screen shape intact', async () => {
    const r = rng(SEED);
    for (let k = 0; k < RUNS; k++) {
      const label = `seed ${SEED} run ${k}`;
      const ex = randomExtraction(r);
      expect(extraction.safeParse(ex).success, label).toBe(true);
      const profile = screenProfile(ex, r);
      const built = buildProfile(toExtraction(profile));
      expect(built.decisionType, label).not.toBeNull();

      for (const key of Object.keys(built.money) as MoneyKey[]) {
        const f = built.money[key];
        check(Number.isFinite(f.low) && Number.isFinite(f.base) && Number.isFinite(f.high), `${label}: ${key} finite`);
        check(f.low <= f.base && f.base <= f.high, `${label}: ${key} ordered`);
      }
      expect(assumedKeys(built).sort(), label).toEqual(profile.assumed.sort());
      expect(Number.isFinite(built.paymentDays.value), label).toBe(true);
      expect(Number.isFinite(built.priceRisePercent.value), label).toBe(true);

      // The screen shapes survive the round trip back into intake fields.
      for (const key of MONEY_FIELDS) {
        const v = profile.fields[key];
        if (v === undefined) continue;
        check(isMoneyField(v) && Number.isFinite(v.low) && Number.isFinite(v.high), `${label}: ${key} screen shape`);
      }

      const cards = await mockApi.paths(profile);
      expect(cards.map((c) => c.letter), label).toEqual(['A', 'B', 'C']);
      for (const card of cards) {
        check(Number.isFinite(card.startingCash), `${label}: ${card.letter} starting cash`);
        for (const a of card.assumptions) {
          check(a.id.length > 0 && a.label.length > 0, `${label}: ${card.letter}${a.id} labelled`);
          check(a.source === 'you' || a.source === 'default' || a.source === 'template', `${label}: ${card.letter}${a.id} sourced`);
          check(validateAssumption(a) === null, `${label}: ${card.letter}${a.id} valid`);
        }
        const sim = simulate(card);
        for (const c of CASES) {
          check(sim[c].rows.length === 36, `${label}: ${card.letter} ${c} 36 rows`);
          let cash = card.startingCash;
          for (const row of sim[c].rows) {
            check([row.income, row.costs, row.net, row.cash].every(Number.isFinite), `${label}: ${card.letter} ${c} finite`);
            cash += row.net;
            check(row.cash === cash, `${label}: ${card.letter} ${c} cash`);
          }
          check(
            JSON.stringify(sim[c].shortfallMonths) === JSON.stringify(sim[c].rows.filter((x) => x.cash < 0).map((x) => x.month)),
            `${label}: ${card.letter} ${c} shortfalls`,
          );
        }
        sim.bad.rows.forEach((row, i) => {
          check(row.cash <= sim.likely.rows[i]!.cash, `${label}: ${card.letter} bad<=likely`);
          check(sim.likely.rows[i]!.cash <= sim.good.rows[i]!.cash, `${label}: ${card.letter} likely<=good`);
        });
        check(JSON.stringify(simulate(card)) === JSON.stringify(sim), `${label}: ${card.letter} repeatable`);

        // Analysis and the guard are the expensive part; a tenth of the runs is enough to catch a unit bug.
        if (k % 10 === 0) {
          const table = figureTable(card);
          for (const [key, value] of Object.entries(table)) check(Number.isFinite(value), `${label}: ${key} finite`);
          for (const id of ['late-payment', 'lost-client', 'slow-season', 'equipment-breakdown', 'cost-rise'] as const) {
            check(Number.isFinite(setbackImpact(card, id).lowest), `${label}: ${card.letter} ${id} impact`);
          }
          const g = guardText(`Ends at {{fig:${card.letter}.cash.m36.likely}} and R9,999,999.`, { pathId: card.letter, table });
          check(!g.text.includes('9,999,999') && !g.text.includes('{{'), `${label}: ${card.letter} guard`);
        }
        if (k % 20 === 0) {
          const figures = pathFigures(card);
          check([figures.bad, figures.likely, figures.good].every((s) => s.length === 37 && s.every(Number.isFinite)), `${label}: ${card.letter} series`);
          check(figures.setbacks.length === 5, `${label}: ${card.letter} setbacks`);
        }
      }
    }
  });
});
