import za from '../defaults/za.json' with { type: 'json' };
import { detectDecision } from '../intake/decision.js';
import type { DecisionType, Extraction, FieldKey } from '../intake/schema.js';

// F5 "Your business, today": facts from the founder, defaults we filled in (marked assumed), and priorities.
// Every path and avatar reads from this one profile so they stay consistent.

export type MoneyKey =
  | 'revenue'
  | 'directCosts'
  | 'overheads'
  | 'payroll'
  | 'founderPay'
  | 'debtRepayments'
  | 'cash'
  | 'offerRevenue'
  | 'hireCost'
  | 'upfrontCost';

export interface Figure {
  low: number;
  base: number;
  high: number;
  source: 'you' | 'default';
}

export interface Setting {
  value: number;
  source: 'you' | 'default';
}

export interface Profile {
  decision: string;
  /** Null until the kind of decision is known: the intake asks for it rather than guessing (see templatePaths). */
  decisionType: DecisionType | null;
  business: string | null;
  location: string | null;
  riskComfort: 'low' | 'medium' | 'high' | null;
  goals: string[];
  money: Record<MoneyKey, Figure>;
  paymentDays: Setting;
  priceRisePercent: Setting;
}

type Range = { low: number; base: number; high: number };

/** The business today: what the founder is asked for, with za.json defaults when they do not know. */
const TODAY_KEYS = ['revenue', 'directCosts', 'overheads', 'payroll', 'founderPay', 'debtRepayments', 'cash'] as const;

// The founder's base is their "usually" figure if they gave one, else the middle of their range.
// Rounded to R50 only to pick a midpoint; displayed figures are not rounded here (REVIEW.md L2).
function baseOf(low: number, high: number, base?: number): number {
  if (base !== undefined && base >= low && base <= high) return base;
  // Never outside the range the founder gave: rounding a small range's midpoint can land below its bottom.
  return Math.min(high, Math.max(low, Math.round((low + high) / 2 / 50) * 50));
}

function figure(f: Extraction[MoneyKey], fallback: Range): Figure {
  return f ? { low: f.low, high: f.high, base: baseOf(f.low, f.high, f.base), source: 'you' } : { ...pick(fallback), source: 'default' };
}

const pick = (r: Range): Range => ({ low: r.low, base: r.base, high: r.high });
const times = (r: Range, k: Range): Range => ({
  low: Math.round(r.low * k.low),
  base: Math.round(r.base * k.base),
  high: Math.round(r.high * k.high),
});

export function buildProfile(ex: Extraction): Profile {
  const defaults: Record<(typeof TODAY_KEYS)[number], Range> = { ...za.monthly, cash: za.cash };
  const money = {} as Record<MoneyKey, Figure>;
  for (const key of TODAY_KEYS) money[key] = figure(ex[key], defaults[key]);
  const t = za.templates;
  // Template figures without a founder's number: the contract is sized from today's sales, the rest from za.json.
  money.offerRevenue = figure(ex.offerRevenue, times(money.revenue, t.contract.offerShareOfSales));
  money.hireCost = figure(ex.hireCost, t.hire.cost);
  money.upfrontCost = figure(ex.upfrontCost, t.contract.upfrontCost);
  const decision = ex.decision?.value ?? 'My business decision';
  return {
    decision,
    decisionType: ex.decisionType?.value ?? detectDecision(decision)?.value ?? null,
    business: ex.business?.value ?? null,
    location: ex.location?.value ?? null,
    riskComfort: ex.riskComfort?.value ?? null,
    goals: ex.goals?.value ?? [],
    money,
    paymentDays: ex.paymentDays ? { value: ex.paymentDays.value, source: 'you' } : { value: t.contract.paymentDays, source: 'default' },
    priceRisePercent: ex.priceRisePercent
      ? { value: ex.priceRisePercent.value, source: 'you' }
      : { value: t.pricing.risePercent, source: 'default' },
  };
}

/** The figures about the business today that are defaults, not the founder's own. */
export const assumedKeys = (p: Profile): FieldKey[] => TODAY_KEYS.filter((k) => p.money[k].source === 'default');
