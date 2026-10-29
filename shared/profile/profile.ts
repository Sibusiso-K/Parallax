import za from '../defaults/za.json' with { type: 'json' };
import type { Extraction, FieldKey } from '../intake/schema.js';

// F5 "You, today": facts from the person, defaults we filled in (marked assumed), and priorities.
// Every path and avatar reads from this one profile so they stay consistent.

export type MoneyKey = 'takeHome' | 'sideIncome' | 'essentialExpenses' | 'familySupportMonthly' | 'debtRepayments' | 'savings';

export interface Figure {
  low: number;
  base: number;
  high: number;
  source: 'you' | 'default';
}

export interface Profile {
  decision: string;
  ageBand: string | null;
  province: string | null;
  riskComfort: 'low' | 'medium' | 'high' | null;
  goals: string[];
  money: Record<MoneyKey, Figure>;
}

const defaults: Record<MoneyKey, { low: number; base: number; high: number }> = {
  ...za.monthly,
  savings: za.savings,
};

const moneyKeys: MoneyKey[] = ['takeHome', 'sideIncome', 'essentialExpenses', 'familySupportMonthly', 'debtRepayments', 'savings'];

// The person's base is their "usually" figure if they gave one, else the middle of their range.
// Rounded to R50 only to pick a midpoint; displayed figures are not rounded here (REVIEW.md L2).
function baseOf(low: number, high: number, base?: number): number {
  if (base !== undefined && base >= low && base <= high) return base;
  return Math.round((low + high) / 2 / 50) * 50;
}

export function buildProfile(ex: Extraction): Profile {
  const money = {} as Record<MoneyKey, Figure>;
  for (const key of moneyKeys) {
    const f = ex[key];
    money[key] = f
      ? { low: f.low, high: f.high, base: baseOf(f.low, f.high, f.base), source: 'you' }
      : { ...defaults[key], source: 'default' };
  }
  return {
    decision: ex.decision?.value ?? 'My decision',
    ageBand: ex.ageBand?.value ?? null,
    province: ex.province?.value ?? null,
    riskComfort: ex.riskComfort?.value ?? null,
    goals: ex.goals?.value ?? [],
    money,
  };
}

export const assumedKeys = (p: Profile): FieldKey[] => moneyKeys.filter((k) => p.money[k].source === 'default');
