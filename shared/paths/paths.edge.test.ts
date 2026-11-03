import { describe, expect, it } from 'vitest';
import { validateAssumption, simulate } from '../engine/simulate.js';
import type { Extraction } from '../intake/schema.js';
import { buildProfile } from '../profile/profile.js';
import { templatePaths } from './templates.js';

// The three path templates at the edges. A card the screens render must always have three letters, one to three
// assumptions with an id, a label and a source, and figures the engine accepts.

const money = (v: number) => ({ low: v, high: v, base: v, quote: String(v) });
const range = (low: number, high: number, base?: number) => ({ low, high, ...(base === undefined ? {} : { base }), quote: `${low} to ${high}` });

function answered(over: Partial<Extraction> = {}): Extraction {
  return {
    decisionType: { value: 'contract', quote: 'contract' },
    decision: { value: 'Take the contract', quote: 'take the contract' },
    revenue: range(75_000, 105_000, 90_000),
    directCosts: money(36_000),
    overheads: money(16_000),
    payroll: money(21_000),
    founderPay: money(12_000),
    debtRepayments: money(3_500),
    cash: money(120_000),
    ...over,
  };
}

function expectCardsSane(cards: ReturnType<typeof templatePaths>) {
  expect(cards.map((c) => c.letter)).toEqual(['A', 'B', 'C']);
  for (const card of cards) {
    expect(card.id).toBe(card.letter);
    expect(card.name.length).toBeGreaterThan(0);
    expect(card.summary.length).toBeGreaterThan(0);
    expect(Number.isFinite(card.startingCash)).toBe(true);
    expect(card.assumptions.length).toBeGreaterThan(0);
    const ids = card.assumptions.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith(card.letter))).toBe(true);
    for (const a of card.assumptions) {
      expect(a.id, card.letter).toMatch(/^[ABC]\d+$/);
      expect(a.label.length).toBeGreaterThan(0);
      expect(['you', 'default', 'template']).toContain(a.source);
      expect(validateAssumption(a), `${card.letter}${a.id}`).toBeNull();
    }
    expect(simulate(card)[card.letter === 'A' ? 'bad' : 'likely'].rows).toHaveLength(36);
  }
}

describe('the three decision types', () => {
  for (const type of ['contract', 'hire', 'pricing'] as const) {
    it(`builds valid ${type} cards from the same founder figures`, () => {
      const cards = templatePaths(buildProfile(answered({ decisionType: { value: type, quote: type } })));
      expectCardsSane(cards);
      expect(new Set(cards.map((c) => c.name)).size).toBe(3);
    });
  }

  it('throws a plain error, not undefined, for a kind of decision it has no template for', () => {
    const profile = buildProfile({ decisionType: { value: 'merger', quote: 'merger' } } as unknown as Extraction);
    expect(() => templatePaths(profile)).toThrow('No paths for this kind of decision: merger');
  });
});

describe('path cards at the edges', () => {
  it('keeps a single-value founder range and a range where low equals high exactly as given', () => {
    const cards = templatePaths(buildProfile(answered({ revenue: range(8000, 8000), directCosts: money(0), cash: money(0), offerRevenue: money(8000) })));
    expect(cards.every((c) => c.startingCash === 0)).toBe(true);
    expect(cards[1]!.assumptions.find((a) => a.role === 'contract')).toMatchObject({ low: 8000, base: 8000, high: 8000 });
    expectCardsSane(cards);
  });

  it('builds zero-sales and costs-above-sales cards without dropping every line', () => {
    const zero = templatePaths(buildProfile(answered({ revenue: money(0), directCosts: money(0), cash: money(0) })));
    expectCardsSane(zero);
    const loss = templatePaths(buildProfile(answered({ revenue: money(10_000), directCosts: money(15_000) })));
    expectCardsSane(loss);
    expect(loss[0]!.assumptions.some((a) => a.role === 'sales')).toBe(false); // zero gross profit adds only noise
    expect(loss[0]!.assumptions.some((a) => a.kind === 'cost')).toBe(true);
  });

  it('keeps billion-rand figures finite on every path and case', () => {
    const cards = templatePaths(buildProfile(answered({ revenue: money(1_000_000_000), cash: money(1_000_000_000), offerRevenue: money(1_000_000_000), hireCost: money(100_000), upfrontCost: money(2_000_000) })));
    expectCardsSane(cards);
    for (const card of cards) {
      const sim = simulate(card);
      for (const c of ['bad', 'likely', 'good'] as const) {
        for (const row of sim[c].rows) expect(Number.isFinite(row.cash)).toBe(true);
      }
    }
  });

  it('marks a path that came entirely from defaults, and one that came from the founder', () => {
    const fromDefaults = templatePaths(buildProfile({ decisionType: { value: 'hire', quote: 'hire' } }));
    expect(fromDefaults[0]!.assumptions.every((a) => a.source === 'default' || a.source === 'template')).toBe(true);
    const fromFounder = templatePaths(buildProfile(answered({ decisionType: { value: 'hire', quote: 'hire' } })));
    expect(fromFounder[0]!.assumptions.some((a) => a.source === 'you')).toBe(true);
  });

  it('gives the same cards twice for the same profile', () => {
    const profile = buildProfile(answered());
    expect(templatePaths(profile)).toEqual(templatePaths(profile));
  });
});
