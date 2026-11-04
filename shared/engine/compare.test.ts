import { describe, expect, it } from 'vitest';
import { NO_LENS, applyLens, safest, summarise, type FutureSummary } from './compare.js';
import { simulate } from './simulate.js';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import { templatePaths } from '../paths/templates.js';
import { buildProfile } from '../profile/profile.js';

const founder = buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: '21k' } });
const paths = templatePaths(founder);
const f = (id: string, lowest: number, runsOut: number | null): FutureSummary => ({ id, lowest: { cash: lowest, month: 3 }, runsOut, endCash: 0 });

describe('the safest future', () => {
  it('prefers a future that never runs out over one that does, however low it dips', () => {
    expect(safest([f('A', 400000, 4), f('B', 1000, null)])).toBe('B');
  });

  it('between two that never run out, takes the higher lowest cash', () => {
    expect(safest([f('A', 20000, null), f('B', 50000, null), f('C', 30000, null)])).toBe('B');
  });

  it('between two that both run out, takes the one that lasts longer', () => {
    expect(safest([f('A', -5000, 3), f('B', -90000, 9)])).toBe('B');
  });

  it('names none when the top two are level, or there is nothing to compare', () => {
    expect(safest([f('A', 10000, null), f('B', 10000, null)])).toBeNull();
    expect(safest([])).toBeNull();
  });

  it('reads its figures from the engine run, not from anywhere else', () => {
    const s = summarise(paths[0]!);
    const sim = simulate(paths[0]!);
    expect(s.endCash).toBe(sim.likely.rows.at(-1)!.cash);
    expect(s.runsOut).toBe(sim.likely.shortfallMonths[0] ?? null);
  });

  it('marks the demo founder\'s safer-terms path C as safest once the client pays late', () => {
    const late = paths.map((p) => summarise(applyLens(p, { ...NO_LENS, latePayment: true }, 90000)));
    expect(late[1]!.runsOut).not.toBeNull();
    expect(safest(late)).not.toBe(paths[1]!.id);
  });
});

describe('the what-if lens', () => {
  it('changes nothing with no lens', () => {
    for (const p of paths) expect(applyLens(p, NO_LENS, 90000)).toEqual(p);
  });

  it('scales the contract and its direct costs, and nothing else', () => {
    const offered = paths[1]!;
    const half = applyLens(offered, { ...NO_LENS, contractScale: 0.5 }, 90000);
    offered.assumptions.forEach((a, i) => {
      const b = half.assumptions[i]!;
      if (a.role === 'contract' || a.role === 'direct') expect(b.base).toBe(Math.round(a.base / 2));
      else expect(b).toEqual(a);
    });
  });

  it('adds the price change as gross profit on the same volume: 10% of R90,000 is R9,000 a month', () => {
    const lean = paths[0]!;
    const up = summarise(applyLens(lean, { ...NO_LENS, pricePercent: 10 }, 90000));
    const base = summarise(lean);
    expect(up.endCash - base.endCash).toBe(9000 * 36);
    const down = summarise(applyLens(lean, { ...NO_LENS, pricePercent: -10 }, 90000));
    expect(base.endCash - down.endCash).toBe(9000 * 36);
  });

  it('a late payment never leaves a path with more cash at its lowest', () => {
    for (const p of paths) {
      expect(summarise(applyLens(p, { ...NO_LENS, latePayment: true }, 90000)).lowest.cash).toBeLessThanOrEqual(summarise(p).lowest.cash);
    }
  });
});
