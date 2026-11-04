import { describe, expect, it } from 'vitest';
import { formatFigure, guardText } from '../guard/figures.js';
import { CASES, SETBACK_IDS, drivers, figureTable, milestones, runwayMonths, setbackImpact, worstSetback } from './analysis.js';
import { DEFAULT_MONTHS, simulate, type PathInput } from './simulate.js';

// The engine at the edges the intake can produce: no money, no sales, costs above sales, negative starting cash, a
// single-value range, a narrow range, a very wide range and a billion rand. The same invariants must hold for all of
// them: 36 rows per case, every figure finite, the cash recurrence exact, and bad <= likely <= good in every month.

const money = (low: number, base: number, high: number) => ({ low, base, high });

function path(over: Partial<PathInput> = {}): PathInput {
  return {
    id: 'E',
    startingCash: 0,
    assumptions: [
      { id: 'E1', label: 'Gross profit from current sales', kind: 'income', role: 'sales', ...money(0, 0, 0) },
      { id: 'E2', label: 'Staff wages', kind: 'cost', role: 'payroll', ...money(0, 0, 0) },
    ],
    ...over,
  };
}

function expectInvariants(p: PathInput) {
  const sim = simulate(p);
  for (const c of CASES) {
    expect(sim[c].rows).toHaveLength(DEFAULT_MONTHS);
    expect(sim[c].rows.map((r) => r.month)).toEqual(Array.from({ length: DEFAULT_MONTHS }, (_, i) => i + 1));
    let cash = p.startingCash;
    for (const row of sim[c].rows) {
      for (const v of [row.income, row.costs, row.net, row.cash]) expect(Number.isFinite(v), `${p.id} ${c} month ${row.month}`).toBe(true);
      cash += row.net;
      expect(row.net).toBe(row.income - row.costs);
      expect(row.cash).toBe(cash);
    }
    expect(sim[c].shortfallMonths).toEqual(sim[c].rows.filter((r) => r.cash < 0).map((r) => r.month));
  }
  sim.bad.rows.forEach((row, i) => {
    expect(row.cash).toBeLessThanOrEqual(sim.likely.rows[i]!.cash);
    expect(sim.likely.rows[i]!.cash).toBeLessThanOrEqual(sim.good.rows[i]!.cash);
  });
  // Same inputs, same figures: every screen and the 3D room key their work to this.
  expect(simulate(p)).toEqual(sim);
  return sim;
}

function expectAnalysisSane(p: PathInput) {
  const sim = simulate(p);
  expect(() => milestones(p, sim)).not.toThrow();
  expect(() => drivers(p)).not.toThrow();
  expect(() => runwayMonths(p)).not.toThrow();
  expect(() => worstSetback(p)).not.toThrow();
  for (const id of SETBACK_IDS) {
    const impact = setbackImpact(p, id);
    expect(Number.isFinite(impact.lowest), id).toBe(true);
    expect(Number.isFinite(impact.end), id).toBe(true);
  }
  const table = figureTable(p);
  for (const [key, value] of Object.entries(table)) {
    expect(Number.isFinite(value), key).toBe(true);
    // Every number in the table must have a unit the guard can print; a month printed as rand is the bug this covers.
    expect(formatFigure(key, value), key).not.toMatch(/^undefined|NaN|Infinity/);
  }
  if (table[`${p.id}.setback.late-payment.paidFromMonth`] !== undefined) {
    expect(formatFigure(`${p.id}.setback.late-payment.paidFromMonth`, table[`${p.id}.setback.late-payment.paidFromMonth`]!)).toMatch(/^month \d+$/);
  }
  const guarded = guardText(`Cash ends at {{fig:${p.id}.cash.m36.likely}} and the late payment comes back in {{fig:${p.id}.setback.late-payment.paidFromMonth}}.`, {
    pathId: p.id,
    table,
    allowedIds: p.assumptions.map((a) => a.id),
  });
  expect(guarded.text).not.toMatch(/\{\{|Rmonth/);
  return table;
}

describe('simulate at the edges', () => {
  it('runs with no sales, no cash and costs above sales, and flags every negative month', () => {
    const sim = expectInvariants(
      path({
        startingCash: 0,
        assumptions: [
          { id: 'E1', label: 'Gross profit from current sales', kind: 'income', role: 'sales', ...money(0, 0, 0) },
          { id: 'E2', label: 'Staff wages', kind: 'cost', role: 'payroll', ...money(12000, 15000, 18000) },
        ],
      }),
    );
    expect(sim.likely.rows[0]!.cash).toBe(-15000);
    expect(sim.likely.shortfallMonths[0]).toBe(1);
    expect(sim.likely.rows[11]!.cash).toBe(-180000);
  });

  it('starts below zero when the founder has more debt than cash', () => {
    const sim = expectInvariants(path({ startingCash: -25_000, assumptions: [{ id: 'E1', label: 'Sales', kind: 'income', role: 'sales', ...money(1000, 1000, 1000) }] }));
    expect(sim.likely.rows[0]!.cash).toBe(-24_000);
    expect(sim.likely.shortfallMonths[0]).toBe(1);
  });

  it('treats a single value and a range where low equals high the same', () => {
    const single = expectInvariants(path({ assumptions: [{ id: 'E1', label: 'Sales', kind: 'income', role: 'sales', ...money(8000, 8000, 8000) }] }));
    const equal = expectInvariants(path({ assumptions: [{ id: 'E1', label: 'Sales', kind: 'income', role: 'sales', ...money(8000, 8000, 8000) }] }));
    expect(single).toEqual(equal);
    expect(single.bad.rows[0]!.income).toBe(8000);
    expect(single.good.rows[0]!.income).toBe(8000);
  });

  it('keeps a very narrow range ordered, so the bad case never equals the good one by accident', () => {
    const sim = expectInvariants(path({ assumptions: [{ id: 'E1', label: 'Sales', kind: 'income', role: 'sales', ...money(8000, 8000, 8001) }] }));
    expect(sim.bad.rows[0]!.income).toBe(8000);
    expect(sim.likely.rows[0]!.income).toBe(8000);
    expect(sim.good.rows[0]!.income).toBe(8001);
  });

  it('runs a very wide range and a billion rand without losing precision or order', () => {
    const wide = expectInvariants(path({ assumptions: [{ id: 'E1', label: 'Sales', kind: 'income', role: 'sales', ...money(0, 500_000_000, 1_000_000_000) }] }));
    expect(wide.good.rows.at(-1)!.cash).toBe(36_000_000_000);
    const huge = expectInvariants(path({ startingCash: 1_000_000_000, assumptions: [{ id: 'E1', label: 'Sales', kind: 'income', role: 'sales', ...money(1_000_000_000, 1_000_000_000, 1_000_000_000) }] }));
    expect(huge.likely.rows.at(-1)!.cash).toBe(37_000_000_000);
  });

  it('keeps analysis finite and the guard printable on every edge path', () => {
    for (const p of [
      path(),
      path({ startingCash: -25_000 }),
      path({ assumptions: [{ id: 'E1', label: 'Sales', kind: 'income', role: 'sales', ...money(0, 0, 1_000_000_000) }] }),
      path({ assumptions: [{ id: 'E1', label: 'Rent', kind: 'cost', role: 'overhead', ...money(1_000_000_000, 1_000_000_000, 1_000_000_000) }] }),
      path({ startingCash: 120_000, assumptions: [
        { id: 'E1', label: 'Gross profit', kind: 'income', role: 'sales', ...money(45_000, 54_000, 63_000) },
        { id: 'E2', label: 'Rent', kind: 'cost', role: 'overhead', ...money(16_000, 16_000, 16_000) },
      ] }),
    ]) {
      expectAnalysisSane(p);
    }
  });

  it('omits runway when there are no month-1 costs, instead of dividing by zero', () => {
    expect(runwayMonths(path())).toBeNull();
    const table = figureTable(path());
    expect(table['E.runway']).toBeUndefined();
    expect(Object.values(table).every(Number.isFinite)).toBe(true);
  });

  it('gives a whole-number runway and never a negative one', () => {
    expect(runwayMonths(path({ startingCash: 120_000, assumptions: [{ id: 'E1', label: 'Rent', kind: 'cost', role: 'overhead', ...money(52_500, 52_500, 52_500) }] }))).toBe(2);
    expect(runwayMonths(path({ startingCash: -1, assumptions: [{ id: 'E1', label: 'Rent', kind: 'cost', role: 'overhead', ...money(100, 100, 100) }] }))).toBe(0);
  });
});
