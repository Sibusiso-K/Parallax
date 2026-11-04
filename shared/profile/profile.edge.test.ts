import { describe, expect, it } from 'vitest';
import { extraction, type Extraction } from '../intake/schema.js';
import { buildProfile, assumedKeys, type Profile } from './profile.js';

// buildProfile at the edges: nothing given, zero and huge figures, single-value and very wide ranges, costs above
// sales. Every figure it hands to the paths must be finite, ordered, and marked as the founder's or a default.

const range = (low: number, high: number, base?: number) => (base === undefined ? { low, high, quote: `R${low} to R${high}` } : { low, high, base, quote: `R${base}` });

function expectFiguresSane(p: Profile) {
  for (const [key, f] of Object.entries(p.money)) {
    expect(Number.isFinite(f.low), key).toBe(true);
    expect(Number.isFinite(f.base), key).toBe(true);
    expect(Number.isFinite(f.high), key).toBe(true);
    expect(f.low, key).toBeLessThanOrEqual(f.base);
    expect(f.base, key).toBeLessThanOrEqual(f.high);
    expect(['you', 'default'], key).toContain(f.source);
  }
  for (const s of [p.paymentDays, p.priceRisePercent]) {
    expect(Number.isFinite(s.value)).toBe(true);
    expect(['you', 'default']).toContain(s.source);
  }
}

describe('buildProfile: what the founder did not say', () => {
  it('fills every business figure from za.json and marks it as a default', () => {
    const p = buildProfile({});
    expect(assumedKeys(p)).toEqual(['revenue', 'directCosts', 'overheads', 'payroll', 'founderPay', 'debtRepayments', 'cash']);
    expect(p.money.revenue).toMatchObject({ low: 30000, base: 60000, high: 90000, source: 'default' });
    expect(p.paymentDays).toEqual({ value: 30, source: 'default' });
    expect(p.priceRisePercent).toEqual({ value: 10, source: 'default' });
    expectFiguresSane(p);
  });

  it('keeps an empty decision kind empty and an empty business null', () => {
    const p = buildProfile({});
    expect(p.decisionType).toBeNull();
    expect(p.business).toBeNull();
    expect(p.location).toBeNull();
    expect(p.riskComfort).toBeNull();
    expect(p.goals).toEqual([]);
  });

  it('sizes a contract the founder did not price from their own sales, and marks it a default', () => {
    const p = buildProfile({ revenue: range(100_000, 200_000, 150_000) });
    expect(p.money.offerRevenue).toMatchObject({ low: 30_000, base: 75_000, high: 140_000, source: 'default' });
    expectFiguresSane(p);
  });
});

describe('buildProfile: zero, narrow, wide and huge figures', () => {
  it('accepts zero cash and zero sales as the founder\'s own figures', () => {
    const p = buildProfile({ cash: range(0, 0), revenue: range(0, 0), directCosts: range(0, 0) });
    expect(p.money.cash).toEqual({ low: 0, base: 0, high: 0, source: 'you' });
    expect(p.money.revenue).toEqual({ low: 0, base: 0, high: 0, source: 'you' });
    expect(assumedKeys(p)).not.toContain('cash');
    expectFiguresSane(p);
  });

  it('keeps costs above sales as given; it is the engine\'s job to show the loss, not the profile\'s to hide it', () => {
    const p = buildProfile({ revenue: range(10_000, 10_000), directCosts: range(15_000, 15_000) });
    expect(p.money.directCosts).toMatchObject({ low: 15_000, high: 15_000, source: 'you' });
    expectFiguresSane(p);
  });

  it('keeps a single-value range, a narrow range and a wide range ordered', () => {
    const single = buildProfile({ revenue: range(8000, 8000) });
    expect(single.money.revenue).toEqual({ low: 8000, base: 8000, high: 8000, source: 'you' });
    const narrow = buildProfile({ revenue: range(2010, 2020) });
    expect(narrow.money.revenue.base).toBeGreaterThanOrEqual(2010);
    expect(narrow.money.revenue.base).toBeLessThanOrEqual(2020);
    const wide = buildProfile({ revenue: range(0, 1_000_000_000) });
    expect(wide.money.revenue.base).toBeGreaterThanOrEqual(0);
    expect(wide.money.revenue.base).toBeLessThanOrEqual(1_000_000_000);
    for (const p of [single, narrow, wide]) expectFiguresSane(p);
  });

  it('keeps a billion rand finite everywhere, including the figures derived from it', () => {
    const p = buildProfile({ revenue: range(1_000_000_000, 1_000_000_000), cash: range(1_000_000_000, 1_000_000_000) });
    expect(p.money.revenue.base).toBe(1_000_000_000);
    expect(p.money.offerRevenue.high).toBe(700_000_000);
    expectFiguresSane(p);
  });

  it('refuses a negative figure at the schema, before it can reach the engine', () => {
    const negative: Extraction = { cash: { low: -1, high: -1, quote: '-1' } };
    expect(extraction.safeParse(negative).success).toBe(false);
    expect(extraction.safeParse({ cash: { low: 0, high: 1, quote: 'R1' } }).success).toBe(true);
  });

  it('gives the same profile twice for the same answers', () => {
    const ex: Extraction = { decisionType: { value: 'hire', quote: 'hire' }, revenue: range(0, 1_000_000_000), cash: range(0, 0) };
    expect(buildProfile(ex)).toEqual(buildProfile(ex));
  });
});
