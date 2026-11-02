import { describe, expect, it } from 'vitest';
import { applySetback, drivers, figureTable, latePaidFromMonth, lowestCash, milestones, runwayMonths, setbackImpact, setbackMonth, worstSetback } from './analysis.js';
import { simulate } from './simulate.js';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import { templatePaths } from '../paths/templates.js';
import { buildProfile } from '../profile/profile.js';

// The demo founder (DEMO.md section 1) on the three contract paths, with R21,000 of wages given as the follow-up answer.
// Worked out by hand in the comments: sales R75,000-R105,000 (usually R90,000) at a 60% margin give gross profit of
// R45,000 / R54,000 / R63,000; fixed costs are R16,000 + R21,000 + R12,000 + R3,500 = R52,500; cash starts at R120,000.
// The contract pays R60,000 a month for 12 months; its direct costs are R21,000 / R24,000 / R30,000 (35-50% of it).
const founder = buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: '21k' } });
const paths = templatePaths(founder);
const [lean, offered, safer] = [paths[0]!, paths[1]!, paths[2]!];
const at = (path: typeof lean, c: 'bad' | 'likely' | 'good', id: string) =>
  milestones(path, simulate(path))[c].find((m) => m.id === id)!.month;

describe('runway', () => {
  it('pays the month-1 costs from cash: R120,000 over R52,500 is two whole months', () => {
    expect(runwayMonths(lean)).toBe(2);
  });

  it('counts equipment bought up front as a month-1 cost: R120,000 over R110,000 is one month', () => {
    expect(runwayMonths(offered)).toBe(1);
  });
});

describe('the contract as offered', () => {
  it('dips while it waits 60 days for the first payment, then climbs', () => {
    // Month 1: R1,500 - R24,000 - R8,500 - R25,000 = -R56,000. Month 2: -R31,000. Months 3-12: +R29,000.
    const rows = simulate(offered).likely.rows;
    expect(rows.slice(0, 3).map((r) => r.cash)).toEqual([64000, 33000, 62000]);
    expect(lowestCash(simulate(offered), 'likely')).toEqual({ cash: 33000, month: 2 });
    expect(rows[11]!.cash).toBe(323000);
  });

  it('gets back to the starting cash in month 5', () => {
    expect(at(offered, 'likely', 'back-to-start')).toBe(5);
    expect(at(lean, 'likely', 'back-to-start')).toBeNull(); // never dips below the start
  });
});

describe('milestones', () => {
  it('reaches a three-month cash buffer in month 25 when likely on Stay lean, never when bad', () => {
    // Three months of fixed costs is R157,500. Likely adds R1,500 a month: R120,000 + 25 x R1,500 = R157,500.
    expect(at(lean, 'likely', 'cash-buffer-3-months')).toBe(25);
    expect(at(lean, 'bad', 'cash-buffer-3-months')).toBeNull();
  });

  it('runs out of cash in month 17 on Stay lean, bad case', () => {
    // Bad case: R45,000 - R52,500 = -R7,500 a month; R120,000 lasts 16 months.
    expect(at(lean, 'bad', 'cash-runs-out')).toBe(17);
    expect(at(lean, 'likely', 'cash-runs-out')).toBeNull();
  });

  it('has no debt-cleared month when the van repayments have no end date', () => {
    expect(at(lean, 'likely', 'debt-cleared')).toBeNull();
  });
});

describe('drivers', () => {
  it('ranks gross profit, then the contract direct costs, and drops lines that do not move the result', () => {
    const d = drivers(offered);
    expect(d.map((x) => x.id)).toEqual(['B1', 'B7']);
    expect(d[0]!.swing).toBe(648000); // (R63,000 - R45,000) x 36 months
    expect(d[1]!.swing).toBe(108000); // (R30,000 - R21,000) x 12 months
  });
});

describe('setbacks', () => {
  it('times a late payment at the first contract payment', () => {
    expect(setbackMonth(offered, 'late-payment')).toBe(3);
    expect(setbackMonth(safer, 'late-payment')).toBe(2);
    expect(setbackMonth(lean, 'late-payment')).toBe(6); // no contract: the default month
  });

  it('runs the contract as offered out of cash in month 4 if the client pays two months late', () => {
    // Months 3-4 lose R60,000 each: R33,000 + R29,000 - R60,000 = R2,000, then -R29,000.
    const impact = setbackImpact(offered, 'late-payment');
    expect(impact).toMatchObject({ lowest: -62000, end: 0, runsOutMonth: 4 });
    expect(worstSetback(offered).id).toBe('late-payment');
  });

  it('keeps the safer terms above zero through the same late payment', () => {
    // Paid at 30 days, cash is R87,750 after month 1; the late payment takes it to R23,250 in month 3.
    expect(setbackImpact(safer, 'late-payment')).toMatchObject({ lowest: -64500, end: 0, runsOutMonth: null });
  });

  it('sizes a lost client from the gross profit it takes away: 30% of R54,000 for three months', () => {
    expect(setbackImpact(lean, 'lost-client').end).toBe(-48600);
    expect(worstSetback(lean).id).toBe('lost-client');
  });

  it('adds stress lines and leaves the original path untouched', () => {
    const broken = applySetback(lean, 'equipment-breakdown');
    expect(broken.assumptions).toHaveLength(lean.assumptions.length + 1);
    expect(broken.assumptions.at(-1)).toMatchObject({ id: 'A6', role: 'setback', source: 'template', base: 15000 });
    const late = applySetback(offered, 'late-payment');
    expect(late.assumptions.slice(-2).map((a) => [a.kind, a.fromMonth, a.toMonth])).toEqual([
      ['cost', 3, 4],
      ['income', 5, 6],
    ]);
    expect(latePaidFromMonth(offered)).toBe(5);
    expect(latePaidFromMonth(lean)).toBe(8); // no contract: the default month 6, then the two late months
    expect(lean.assumptions).toHaveLength(5);
  });

  it('gives each path one or two setbacks from the library', () => {
    for (const p of paths) {
      expect(p.setbacks.length).toBeGreaterThanOrEqual(1);
      expect(p.setbacks.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('figure table', () => {
  it('holds the numbers the guard may quote, all finite', () => {
    const t = figureTable(offered);
    expect(t['B.start']).toBe(120000);
    expect(t['B.cash.m12.likely']).toBe(323000);
    expect(t['B.cash.m36.likely']).toBe(479000); // R446,000 after month 14, then 22 x R1,500
    expect(t['B.lowest.likely']).toBe(33000);
    expect(t['B.lowestMonth.likely']).toBe(2);
    expect(t['B.runway']).toBe(1);
    expect(t['B.driver.B1']).toBe(648000);
    expect(t['B.setback.late-payment.lowest']).toBe(-62000);
    expect(t['B.setback.late-payment.runsOut']).toBe(4);
    expect(t['B.setback.late-payment.paidFromMonth']).toBe(5);
    expect(t['B.milestone.back-to-start.likely']).toBe(5);
    expect(t['B.B6.base']).toBe(60000);
    expect(Object.values(t).every(Number.isFinite)).toBe(true);
  });

  it('shows the safer terms ending a little higher, with a much higher low point', () => {
    const t = figureTable(safer);
    expect(t['C.lowest.likely']).toBe(87750);
    expect(t['C.cash.m36.likely']).toBe(489000);
  });
});
