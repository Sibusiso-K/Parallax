import { describe, expect, it } from 'vitest';
import { CASES, SETBACK_IDS, drivers, figureTable, milestones, runwayMonths, setbackImpact, worstSetback } from './engine/analysis.js';
import { simulate } from './engine/simulate.js';
import { decisionTypes, extraction, goalOptions, riskLevels, type Extraction } from './intake/schema.js';
import { templatePaths } from './paths/templates.js';
import { buildProfile } from './profile/profile.js';
import { int, pick, rng } from './testing/random.js';

// Stress test for the whole path from a founder's answers to the figures on screen: answers -> profile -> decision
// templates -> engine -> analysis. Seeded, so any failure replays. For a longer soak set STRESS_RUNS, for example:
// STRESS_RUNS=5000 npm run stress
const RUNS = Number(process.env.STRESS_RUNS ?? 400);
const MONEY_KEYS = [
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
] as const;

// A random answer that the intake schema accepts: ranges in order, goals 1 to 3 long, and every field with its quote.
// The scale runs from zero to millions of rand, so zero sales, zero cash and very large figures all get tried.
function randomAnswers(r: () => number): Extraction {
  const scale = pick(r, [0, 1, 50, 5_000, 200_000, 2_000_000]);
  const money = (): Extraction['revenue'] => {
    const low = int(r, 0, scale);
    const high = int(r, low, scale);
    return r() < 0.5 ? { low, high, quote: `R${high}` } : { low, high, base: int(r, low, high), quote: `R${high}` };
  };
  const answers: Extraction = {};
  if (r() < 0.85) answers.decisionType = { value: pick(r, decisionTypes), quote: 'a decision' };
  if (r() < 0.7) answers.decision = { value: 'Take on a contract', quote: 'Take on a contract' };
  if (r() < 0.6) answers.riskComfort = { value: pick(r, riskLevels), quote: 'careful' };
  if (r() < 0.6) answers.goals = { value: [pick(r, goalOptions)], quote: 'cash' };
  for (const key of MONEY_KEYS) if (r() < 0.8) answers[key] = money();
  if (r() < 0.6) answers.paymentDays = { value: int(r, 0, 400), quote: '60 days' };
  if (r() < 0.6) answers.priceRisePercent = { value: int(r, 0, 200), quote: '10%' };
  return answers;
}

describe('answers to paths to figures, end to end, on random answers', () => {
  it('builds paths and figures from any valid answer, with no throw and every figure finite', () => {
    const r = rng(11);
    for (let k = 0; k < RUNS; k++) {
      const answers = randomAnswers(r);
      expect(extraction.safeParse(answers).success, JSON.stringify(answers)).toBe(true);
      const profile = buildProfile(answers);
      if (profile.decisionType === null) {
        expect(() => templatePaths(profile)).toThrow('kind of decision');
        continue;
      }
      for (const path of templatePaths(profile)) {
        const sim = simulate(path);
        for (const c of CASES) for (const row of sim[c].rows) expect(Number.isFinite(row.cash), `${path.id} ${c}`).toBe(true);
        for (const [key, value] of Object.entries(figureTable(path))) expect(Number.isFinite(value), key).toBe(true);
        for (const id of SETBACK_IDS) expect(Number.isFinite(setbackImpact(path, id).lowest), id).toBe(true);
        expect(() => worstSetback(path)).not.toThrow();
        expect(() => drivers(path)).not.toThrow();
        expect(() => milestones(path, sim)).not.toThrow();
        expect(() => runwayMonths(path)).not.toThrow();
      }
    }
  });
});
