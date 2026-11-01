import { describe, expect, it } from 'vitest';
import { simulate, validateAssumption } from '../engine/simulate.js';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import type { Extraction } from '../intake/schema.js';
import { buildProfile } from '../profile/profile.js';
import { grossMargin, paymentLag, templatePaths } from './templates.js';

const money = (v: number) => ({ low: v, high: v, quote: String(v) });
const answered: Extraction = { ...DEMO_EXTRACTION, payroll: money(21000) };
const as = (value: 'contract' | 'hire' | 'pricing'): Extraction => ({ ...answered, decisionType: { value, quote: value } });

describe('buildProfile', () => {
  const profile = buildProfile(DEMO_EXTRACTION);

  it("keeps the founder's figures and marks filled-in defaults as assumed", () => {
    expect(profile.money.revenue).toEqual({ low: 75000, base: 90000, high: 105000, source: 'you' });
    expect(profile.money.cash).toEqual({ low: 120000, base: 120000, high: 120000, source: 'you' });
    expect(profile.paymentDays).toEqual({ value: 60, source: 'you' });
    // The demo story leaves wages out, so they are an assumed default until the follow-up is answered.
    expect(profile.money.payroll.source).toBe('default');
  });

  it('reads the kind of decision from the decision itself when no field gives it', () => {
    expect(profile.decisionType).toBe('contract');
    expect(buildProfile({}).decisionType).toBe('contract');
  });

  it('sizes a contract the founder did not price from today\'s sales, and marks it assumed', () => {
    const { offerRevenue, ...rest } = DEMO_EXTRACTION;
    void offerRevenue;
    expect(buildProfile(rest).money.offerRevenue).toEqual({ low: 22500, base: 45000, high: 73500, source: 'default' });
  });
});

describe('gross margin and payment lag', () => {
  it('takes the margin from usual sales and direct costs, and never goes below zero', () => {
    expect(grossMargin(buildProfile(answered))).toBeCloseTo(0.6, 10);
    expect(grossMargin(buildProfile({ revenue: money(10000), directCosts: money(15000) }))).toBe(0);
    expect(grossMargin(buildProfile({ revenue: money(0), directCosts: money(0) }))).toBe(0);
  });

  it('counts a payment in the month it lands', () => {
    expect([0, 15, 30, 31, 45, 60, 90].map(paymentLag)).toEqual([0, 1, 1, 2, 2, 2, 3]);
  });
});

describe('templatePaths', () => {
  for (const type of ['contract', 'hire', 'pricing'] as const) {
    it(`gives three valid ${type} paths with unique, stable IDs and whole-run windows`, () => {
      const paths = templatePaths(buildProfile(as(type)));
      expect(paths.map((p) => p.letter)).toEqual(['A', 'B', 'C']);
      expect(new Set(paths.map((p) => p.name)).size).toBe(3);
      for (const p of paths) {
        expect(p.startingCash).toBe(120000);
        for (const a of p.assumptions) expect(validateAssumption(a)).toBeNull();
        const ids = p.assumptions.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.every((id) => id.startsWith(p.letter))).toBe(true);
        expect(simulate(p).bad.rows).toHaveLength(36);
      }
    });
  }

  it('writes sales as gross profit, so a bad month of sales never carries full direct costs', () => {
    const [lean] = templatePaths(buildProfile(answered));
    expect(lean!.assumptions[0]).toMatchObject({ label: 'Gross profit from current sales', low: 45000, base: 54000, high: 63000 });
    expect(lean!.assumptions.some((a) => a.role === 'direct')).toBe(false);
  });

  it('pays the contract as offered from month 3 and on safer terms from month 2, while its costs start in month 1', () => {
    const [, offered, safer] = templatePaths(buildProfile(answered));
    const income = (p: typeof offered) => p!.assumptions.find((a) => a.role === 'contract')!;
    expect(income(offered)).toMatchObject({ fromMonth: 3, toMonth: 14, base: 60000 });
    expect(income(safer)).toMatchObject({ fromMonth: 2, toMonth: 13 });
    expect(offered!.assumptions.find((a) => a.role === 'direct')).toMatchObject({ fromMonth: 1, toMonth: 12, low: 21000, high: 30000 });
    expect(offered!.assumptions.find((a) => a.role === 'equipment')).toMatchObject({ base: 25000, fromMonth: 1, toMonth: 1 });
    expect(safer!.assumptions.find((a) => a.role === 'equipment')).toMatchObject({ base: 1250, fromMonth: 1, toMonth: 12 });
  });

  it('keeps the safer path the same as offered when the client already pays within 30 days', () => {
    const quick = buildProfile({ ...answered, paymentDays: { value: 30, quote: '30 days' } });
    const [, offered, safer] = templatePaths(quick);
    expect(offered!.assumptions.find((a) => a.role === 'contract')!.fromMonth).toBe(2);
    expect(safer!.assumptions.find((a) => a.role === 'contract')!.fromMonth).toBe(2);
    expect(safer!.summary).toBe('Take it, and rent the equipment instead of buying it.');
  });

  it('starts a hire costing from month 1 and bringing in gross profit only after the ramp-up', () => {
    const [, now, partTime] = templatePaths(buildProfile(as('hire')));
    const rows = simulate(now!).likely.rows;
    expect(rows[0]!.income).toBe(54000); // month 1: today's gross profit only
    expect(rows[3]!.income).toBe(54000 + 10200); // month 4: plus 1.2 x R8,500
    expect(partTime!.assumptions.filter((a) => a.role === 'payroll' && a.label !== 'Staff wages').map((a) => [a.base, a.fromMonth, a.toMonth])).toEqual([
      [4250, undefined, 6],
      [8500, 7, undefined],
    ]);
  });

  it('moves gross profit to the new prices from month 2, losing customers in the bad case', () => {
    const [keep, raise] = templatePaths(buildProfile(as('pricing')));
    expect(raise!.name).toBe('Raise prices 10%');
    const rows = simulate(raise!).likely.rows;
    expect(rows[0]!.income).toBe(54000);
    expect(rows[1]!.income).toBe(Math.round(90000 * 0.95 * 0.7)); // 5% of sales lost, the rest at a 70-point margin
    // Bad case: low sales and 15% lost, which earns less than keeping prices.
    expect(simulate(raise!).bad.rows[1]!.income).toBeLessThan(simulate(keep!).bad.rows[1]!.income);
  });
});
