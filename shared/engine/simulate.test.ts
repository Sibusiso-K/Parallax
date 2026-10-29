import { describe, expect, it } from 'vitest';
import { simulate, type PathInput } from './simulate';

// Fictional demo persona, Naledi (DEMO.md §1), Path A: stay and grow.
const stay: PathInput = {
  id: 'A',
  startingSavings: 35000,
  assumptions: [
    { id: 'A1', label: 'Take-home salary', kind: 'income', low: 19500, base: 19500, high: 19500 },
    { id: 'A2', label: 'Weekend catering profit', kind: 'income', low: 2500, base: 6000, high: 11000 },
    { id: 'A3', label: 'Essential expenses', kind: 'cost', low: 12000, base: 13000, high: 14500 },
    { id: 'A4', label: 'Support to Ma (non-negotiable)', kind: 'cost', low: 3000, base: 3000, high: 3000 },
    { id: 'A5', label: 'Store account repayment', kind: 'cost', low: 800, base: 800, high: 800 },
  ],
};

describe('simulate', () => {
  it('runs 36 monthly steps for each case', () => {
    const sim = simulate(stay);
    for (const c of ['bad', 'likely', 'good'] as const) {
      expect(sim[c].rows).toHaveLength(36);
      expect(sim[c].rows.at(-1)?.month).toBe(36);
    }
  });

  it('gives the same figures for the same inputs', () => {
    expect(simulate(stay)).toEqual(simulate(stay));
  });

  it('orders the cases bad <= likely <= good at the final month', () => {
    const sim = simulate(stay);
    const last = (c: 'bad' | 'likely' | 'good') => sim[c].rows.at(-1)!.savings;
    expect(last('bad')).toBeLessThanOrEqual(last('likely'));
    expect(last('likely')).toBeLessThanOrEqual(last('good'));
    // likely: 19,500 + 6,000 - 13,000 - 3,000 - 800 = 8,700 a month
    expect(last('likely')).toBe(35000 + 36 * 8700);
  });

  it('never cuts the non-negotiable payment, and flags shortfall months instead', () => {
    const noIncome: PathInput = {
      id: 'B',
      startingSavings: 0,
      assumptions: [
        { id: 'B1', label: 'Income', kind: 'income', low: 0, base: 0, high: 0 },
        { id: 'B2', label: 'Support to Ma', kind: 'cost', low: 3000, base: 3000, high: 3000 },
      ],
    };
    const sim = simulate(noIncome);
    expect(sim.likely.rows[0]?.costs).toBe(3000);
    expect(sim.likely.shortfallMonths).toHaveLength(36);
  });

  it('flags only the months once savings run out', () => {
    const thin: PathInput = {
      id: 'C',
      startingSavings: 2500,
      assumptions: [{ id: 'C1', label: 'Costs', kind: 'cost', low: 1000, base: 1000, high: 1000 }],
    };
    expect(simulate(thin).likely.shortfallMonths[0]).toBe(3);
  });

  it('rejects low above high, negatives and non-numbers', () => {
    const bad = (low: number, base: number, high: number): PathInput => ({
      id: 'X',
      startingSavings: 0,
      assumptions: [{ id: 'X1', label: 'x', kind: 'cost', low, base, high }],
    });
    expect(() => simulate(bad(5, 3, 4))).toThrow('low <= base <= high');
    expect(() => simulate(bad(-1, 0, 1))).toThrow('negative');
    expect(() => simulate(bad(Number.NaN, 0, 1))).toThrow('numbers');
  });
});
