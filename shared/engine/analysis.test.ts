import { describe, expect, it } from 'vitest';
import { applySetback, drivers, figureTable, milestones, runwayMonths, setbackExposure, worstSetback } from './analysis.js';
import { simulate } from './simulate.js';
import { NALEDI_EXTRACTION } from '../intake/fixture.js';
import { templatePaths } from '../paths/templates.js';
import { buildProfile } from '../profile/profile.js';

// Naledi (DEMO.md section 1) on the three template paths. The expected figures are worked out by hand in the comments:
// essentials default to R11,000 (za.json), family support R3,000, store account R800, savings R35,000, salary R19,500,
// side business R6,000 likely (R2,500 bad, R11,000 good).
const paths = templatePaths(buildProfile(NALEDI_EXTRACTION));
const [stay, fullTime, qualify] = [paths[0]!, paths[1]!, paths[2]!];

describe('runway', () => {
  it('pays the month-1 costs from savings: R35,000 over R14,800 is two whole months', () => {
    expect(runwayMonths(stay)).toBe(2);
  });
});

describe('milestones', () => {
  const at = (path: typeof stay, c: 'bad' | 'likely' | 'good', id: string) =>
    milestones(path, simulate(path))[c].find((m) => m.id === id)!.month;

  it('reaches the three-month emergency fund in month 1 when likely, month 4 when bad', () => {
    // Bad case: essentials R15,000, so the fund needs R45,000. Savings are R38,200, R41,400, R44,600, then R47,800.
    expect(at(stay, 'likely', 'emergency-3-months')).toBe(1);
    expect(at(stay, 'bad', 'emergency-3-months')).toBe(4);
    expect(at(stay, 'good', 'emergency-3-months')).toBe(1);
  });

  it('never says the business matches the old salary on Stay and grow', () => {
    expect(at(stay, 'likely', 'business-matches-salary')).toBeNull();
  });

  it('runs savings out in month 20 on Go full-time, likely case', () => {
    // Months 1-3 add R10,700. From month 4 the business pays R10,800 against R14,800 of costs: minus R4,000 a month.
    // Savings reach R67,100 in month 3 and go negative in month 20.
    expect(at(fullTime, 'likely', 'savings-run-out')).toBe(20);
    expect(at(qualify, 'bad', 'savings-run-out')).toBeNull();
  });

  it('has no debt-cleared month when the store account has no end date', () => {
    expect(at(stay, 'likely', 'debt-cleared')).toBeNull();
  });
});

describe('drivers', () => {
  it('ranks side income, then essentials, and drops lines that do not move the result', () => {
    const d = drivers(stay);
    expect(d.map((x) => x.id)).toEqual(['A2', 'A3']);
    expect(d[0]!.swing).toBe(306000); // (R11,000 - R2,500) x 36 months
    expect(d[1]!.swing).toBe(252000); // (R15,000 - R8,000) x 36 months
  });
});

describe('setbacks', () => {
  it('costs the income gap most on Stay and grow: two months of salary, R39,000', () => {
    const worst = worstSetback(stay);
    expect(worst.id).toBe('income-gap');
    expect(worst.exposure).toBe(-39000);
  });

  it('sizes a lost client from the business income it takes away: three months of R6,000', () => {
    expect(setbackExposure(stay, 'lost-client')).toBe(-18000);
  });

  it('rent increase costs 10% of essentials from month 6 to month 36', () => {
    expect(setbackExposure(stay, 'rent-increase')).toBeCloseTo(-34100, 6); // 31 months x R1,100
  });

  it('adds one stress line per setback and leaves the original path untouched', () => {
    const stressed = applySetback(stay, 'car-breakdown');
    expect(stressed.assumptions).toHaveLength(stay.assumptions.length + 1);
    expect(stressed.assumptions.at(-1)).toMatchObject({ id: 'A6', role: 'setback', source: 'template', base: 4000 });
    expect(stay.assumptions).toHaveLength(5);
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
    const t = figureTable(stay);
    expect(t['A.start']).toBe(35000);
    expect(t['A.savings.m12.likely']).toBe(163400); // 35,000 + 12 x R10,700
    expect(t['A.savings.m36.likely']).toBe(420200); // 35,000 + 36 x R10,700
    expect(t['A.runway']).toBe(2);
    expect(t['A.driver.A2']).toBe(306000);
    expect(t['A.setback.income-gap']).toBe(-39000);
    expect(t['A.milestone.emergency-3-months.likely']).toBe(1);
    expect(t['A.A2.high']).toBe(11000);
    expect(Object.values(t).every(Number.isFinite)).toBe(true);
  });

  it('shows Qualify up saving less while studying, then more after the raise', () => {
    // Studying: R22,500 in, R16,300 out (essentials, family, store account, course fees): R6,200 a month.
    // After month 18: salary R19,500 + raise R3,900 + side R6,000 in, R14,800 out: R14,600 a month.
    const t = figureTable(qualify);
    expect(t['C.savings.m12.likely']).toBe(109400); // 35,000 + 12 x R6,200
    expect(t['C.savings.m36.likely']).toBe(409400); // 35,000 + 18 x R6,200 + 18 x R14,600
  });
});
