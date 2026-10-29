import { describe, expect, it } from 'vitest';
import { simulate, validateAssumption } from '../engine/simulate.js';
import { NALEDI_EXTRACTION } from '../intake/fixture.js';
import { buildProfile } from '../profile/profile.js';
import { templatePaths } from './templates.js';

const profile = buildProfile(NALEDI_EXTRACTION);

describe('buildProfile', () => {
  it('keeps the person\'s figures and marks filled-in defaults as assumed', () => {
    expect(profile.money.takeHome).toEqual({ low: 19500, base: 19500, high: 19500, source: 'you' });
    expect(profile.money.sideIncome).toMatchObject({ low: 2500, base: 6000, high: 11000, source: 'you' });
    expect(profile.money.savings.base).toBe(35000);
    // Naledi's fixture leaves essentials out, so it is an assumed default.
    expect(profile.money.essentialExpenses.source).toBe('default');
  });
});

describe('templatePaths', () => {
  const paths = templatePaths(profile);

  it('gives three valid paths with unique, stable IDs', () => {
    expect(paths.map((p) => p.letter)).toEqual(['A', 'B', 'C']);
    for (const p of paths) {
      for (const a of p.assumptions) expect(validateAssumption(a)).toBeNull();
      const ids = p.assumptions.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => id.startsWith(p.letter))).toBe(true);
    }
  });

  it('keeps family support in every month of every path', () => {
    for (const p of paths) {
      const rows = simulate(p).bad.rows;
      const support = p.assumptions.find((a) => a.label.startsWith('Support to family'))!;
      expect(support.base).toBe(3000);
      expect(support.fromMonth ?? 1).toBe(1);
      expect(support.toMonth).toBeUndefined();
      expect(rows).toHaveLength(36);
    }
  });

  it('stops the salary after the resign month on Go full-time', () => {
    const b = simulate(paths[1]!).likely.rows;
    expect(b[2]!.income).toBe(19500 + 6000); // month 3: salary and side profit
    expect(b[3]!.income).toBe(Math.round(6000 * 1.8)); // month 4: business only
  });
});
