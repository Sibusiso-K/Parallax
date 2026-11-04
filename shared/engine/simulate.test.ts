import { describe, expect, it } from 'vitest';
import { editAssumption, simulate, type PathInput } from './simulate.js';

// The fictional demo founder (DEMO.md §1), Path A: stay lean. A meal-prep and catering business with R120,000 in the bank.
const lean: PathInput = {
  id: 'A',
  startingCash: 120000,
  assumptions: [
    { id: 'A1', label: 'Gross profit from current sales', kind: 'income', low: 45000, base: 54000, high: 63000 },
    { id: 'A2', label: 'Rent and running costs', kind: 'cost', low: 16000, base: 16000, high: 16000 },
    { id: 'A3', label: 'Staff wages', kind: 'cost', low: 21000, base: 21000, high: 21000 },
    { id: 'A4', label: 'Your own pay', kind: 'cost', low: 12000, base: 12000, high: 12000 },
    { id: 'A5', label: 'Debt repayments', kind: 'cost', low: 3500, base: 3500, high: 3500 },
  ],
};

describe('simulate', () => {
  it('runs 36 monthly steps for each case', () => {
    const sim = simulate(lean);
    for (const c of ['bad', 'likely', 'good'] as const) {
      expect(sim[c].rows).toHaveLength(36);
      expect(sim[c].rows.at(-1)?.month).toBe(36);
    }
  });

  it('gives the same figures for the same inputs', () => {
    expect(simulate(lean)).toEqual(simulate(lean));
  });

  it('orders the cases bad <= likely <= good at the final month', () => {
    const sim = simulate(lean);
    const last = (c: 'bad' | 'likely' | 'good') => sim[c].rows.at(-1)!.cash;
    expect(last('bad')).toBeLessThanOrEqual(last('likely'));
    expect(last('likely')).toBeLessThanOrEqual(last('good'));
    // likely: 54,000 - 16,000 - 21,000 - 12,000 - 3,500 = 1,500 a month
    expect(last('likely')).toBe(120000 + 36 * 1500);
  });

  it('keeps paying fixed costs when nothing comes in, and flags shortfall months instead', () => {
    const noSales: PathInput = {
      id: 'B',
      startingCash: 0,
      assumptions: [
        { id: 'B1', label: 'Gross profit', kind: 'income', low: 0, base: 0, high: 0 },
        { id: 'B2', label: 'Staff wages', kind: 'cost', low: 3000, base: 3000, high: 3000 },
      ],
    };
    const sim = simulate(noSales);
    expect(sim.likely.rows[0]?.costs).toBe(3000);
    expect(sim.likely.shortfallMonths).toHaveLength(36);
  });

  it('flags only the months once cash runs out', () => {
    const thin: PathInput = {
      id: 'C',
      startingCash: 2500,
      assumptions: [{ id: 'C1', label: 'Costs', kind: 'cost', low: 1000, base: 1000, high: 1000 }],
    };
    expect(simulate(thin).likely.shortfallMonths[0]).toBe(3);
  });

  it('applies an amount only inside its month window, so late payment arrives late', () => {
    const contract: PathInput = {
      id: 'B',
      startingCash: 0,
      assumptions: [
        { id: 'B1', label: 'Contract income, paid 60 days after each invoice', kind: 'income', low: 1000, base: 1000, high: 1000, fromMonth: 3, toMonth: 4 },
        { id: 'B2', label: 'Direct costs of the contract work', kind: 'cost', low: 400, base: 400, high: 400, fromMonth: 1, toMonth: 2 },
      ],
      months: 4,
    };
    const rows = simulate(contract).likely.rows;
    expect(rows.map((r) => r.net)).toEqual([-400, -400, 1000, 1000]);
    expect(() =>
      simulate({ ...contract, assumptions: [{ ...contract.assumptions[0]!, fromMonth: 5, toMonth: 2 }] }),
    ).toThrow('fromMonth');
  });

  it('edits one assumption, marks it as yours and re-runs', () => {
    const res = editAssumption(lean, 'A1', { low: 50000, base: 60000, high: 70000 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.path.assumptions.find((a) => a.id === 'A1')).toMatchObject({ base: 60000, source: 'you' });
    expect(lean.assumptions.find((a) => a.id === 'A1')?.base).toBe(54000); // original untouched
    expect(simulate(res.path).likely.rows.at(-1)!.cash).toBe(120000 + 36 * 7500);
  });

  it('refuses an invalid edit and an unknown ID', () => {
    expect(editAssumption(lean, 'A1', { low: 70000, base: 60000, high: 80000 })).toEqual({
      ok: false,
      error: 'needs low <= base <= high',
    });
    expect(editAssumption(lean, 'A99', { low: 1, base: 1, high: 1 })).toMatchObject({ ok: false });
  });

  it('rejects low above high, negatives and non-numbers', () => {
    const bad = (low: number, base: number, high: number): PathInput => ({
      id: 'X',
      startingCash: 0,
      assumptions: [{ id: 'X1', label: 'x', kind: 'cost', low, base, high }],
    });
    expect(() => simulate(bad(5, 3, 4))).toThrow('low <= base <= high');
    expect(() => simulate(bad(-1, 0, 1))).toThrow('negative');
    expect(() => simulate(bad(Number.NaN, 0, 1))).toThrow('numbers');
  });
});
