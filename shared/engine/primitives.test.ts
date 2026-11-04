import { describe, expect, it } from 'vitest';
import { SETBACK_IDS, SETBACK_LABELS, fixedCosts, roleTotal } from './analysis.js';
import { DEFAULT_MONTHS, activeIn, valueFor, type Assumption, type PathInput } from './simulate.js';

// The small rules every figure is built from, tested on their own so a change shows up here first.
const income: Assumption = { id: 'I1', label: 'Gross profit', kind: 'income', low: 40, base: 50, high: 60 };
const cost: Assumption = { id: 'C1', label: 'Rent', kind: 'cost', low: 10, base: 12, high: 15 };

describe('valueFor: which end of a range each case uses', () => {
  it('takes the low end of income and the high end of cost in the bad case', () => {
    expect(valueFor(income, 'bad')).toBe(40);
    expect(valueFor(cost, 'bad')).toBe(15);
  });

  it('takes the high end of income and the low end of cost in the good case', () => {
    expect(valueFor(income, 'good')).toBe(60);
    expect(valueFor(cost, 'good')).toBe(10);
  });

  it('takes the base value in the likely case, for income and cost alike', () => {
    expect(valueFor(income, 'likely')).toBe(50);
    expect(valueFor(cost, 'likely')).toBe(12);
  });
});

describe('activeIn: month windows are inclusive, and open where not given', () => {
  it('applies to every month when no window is set', () => {
    expect([1, 17, 36].every((m) => activeIn(income, m))).toBe(true);
  });

  it('applies from fromMonth to toMonth, both included', () => {
    const window: Assumption = { ...income, fromMonth: 4, toMonth: 6 };
    expect([3, 4, 5, 6, 7].map((m) => activeIn(window, m))).toEqual([false, true, true, true, false]);
  });

  it('is open at the end when only fromMonth is set, and at the start when only toMonth is', () => {
    expect(activeIn({ ...income, fromMonth: 4 }, 3)).toBe(false);
    expect(activeIn({ ...income, fromMonth: 4 }, 36)).toBe(true);
    expect(activeIn({ ...income, toMonth: 2 }, 1)).toBe(true);
    expect(activeIn({ ...income, toMonth: 2 }, 3)).toBe(false);
  });
});

describe('DEFAULT_MONTHS', () => {
  it('is the 36-month horizon the docs promise', () => {
    expect(DEFAULT_MONTHS).toBe(36);
  });
});

describe('roleTotal and fixedCosts add up only the lines that apply', () => {
  const path: PathInput = {
    id: 'A',
    startingCash: 0,
    assumptions: [
      { ...income, id: 'A1', role: 'sales' },
      { ...cost, id: 'A2', role: 'overhead' },
      { ...cost, id: 'A3', role: 'payroll', low: 100, base: 200, high: 300 },
      { id: 'A4', label: 'Your own pay', kind: 'cost', low: 5, base: 5, high: 5, role: 'founder' },
      { id: 'A5', label: 'Van repayments', kind: 'cost', low: 7, base: 7, high: 7, role: 'debt', toMonth: 3 },
      { id: 'A6', label: 'Fridge', kind: 'cost', low: 9, base: 9, high: 9, role: 'equipment' },
    ],
  };

  it('sums a role for the month, in the case asked for', () => {
    expect(roleTotal(path, 'sales', 1, 'bad')).toBe(40);
    expect(roleTotal(path, 'payroll', 1, 'good')).toBe(100);
    expect(roleTotal(path, 'payroll', 1, 'bad')).toBe(300);
    expect(roleTotal(path, 'contract', 1, 'likely')).toBe(0);
  });

  it('counts the four fixed costs, and leaves equipment out of them', () => {
    // Likely: overhead 12 + payroll 200 + founder 5 + debt 7 = 224. The fridge (9) is not a fixed cost.
    expect(fixedCosts(path, 1, 'likely')).toBe(224);
  });

  it('drops a debt once its window has ended', () => {
    // Month 4: the van repayments stop after month 3, so 12 + 200 + 5 = 217.
    expect(fixedCosts(path, 4, 'likely')).toBe(217);
  });
});

describe('setback labels', () => {
  it('has a label for every setback, each saying what happens and by how much', () => {
    expect(Object.keys(SETBACK_LABELS).sort()).toEqual([...SETBACK_IDS].sort());
    for (const id of SETBACK_IDS) expect(SETBACK_LABELS[id], id).toMatch(/^[A-Z][^:]+: .+/);
  });
});
