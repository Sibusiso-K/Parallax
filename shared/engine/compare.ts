import { applySetback, lowestCash } from './analysis.js';
import { simulate, type Assumption, type PathInput } from './simulate.js';

// The futures side by side (the futures screen): each path's likely case reduced to three figures, which path is the
// safest by a fixed rule, and a "what if" lens that changes all three paths the same way so they stay comparable.
// Pure, like the engine: same paths and lens, same answer. Nothing here is written by a model.

/** One future in the likely case. */
export interface FutureSummary {
  id: string;
  /** The lowest cash over the run, and the month it happens. */
  lowest: { cash: number; month: number };
  /** The first month cash is below zero, or null if it never is. */
  runsOut: number | null;
  /** Cash at the end of the run. */
  endCash: number;
}

export function summarise(path: PathInput): FutureSummary {
  const sim = simulate(path);
  const rows = sim.likely.rows;
  return {
    id: path.id,
    lowest: lowestCash(sim, 'likely'),
    runsOut: sim.likely.shortfallMonths[0] ?? null,
    endCash: rows[rows.length - 1]?.cash ?? path.startingCash,
  };
}

/**
 * The safest future, by one rule: a future that never runs out of cash beats one that does; between two that never
 * run out, the higher lowest cash wins; between two that both run out, the later month wins, then the higher lowest
 * cash. Returns null when there is nothing to compare or the top two are level on every test.
 */
export function safest(list: readonly FutureSummary[]): string | null {
  if (list.length === 0) return null;
  const rank = (a: FutureSummary, b: FutureSummary): number => {
    if ((a.runsOut === null) !== (b.runsOut === null)) return a.runsOut === null ? -1 : 1;
    if (a.runsOut !== null && b.runsOut !== null && a.runsOut !== b.runsOut) return b.runsOut - a.runsOut;
    return b.lowest.cash - a.lowest.cash;
  };
  const sorted = [...list].sort(rank);
  if (sorted.length > 1 && rank(sorted[0]!, sorted[1]!) === 0) return null;
  return sorted[0]!.id;
}

/** A "what if" applied to every path alike. */
export interface Lens {
  /** A big client pays late (the late-payment setback from the library). */
  latePayment: boolean;
  /** The new contract's size against what was offered: 1 is as offered, 0.5 is half. Its direct costs move with it. */
  contractScale: number;
  /** Prices up (or down) by this percent at the same volume, from month 1. */
  pricePercent: number;
}

export const NO_LENS: Lens = { latePayment: false, contractScale: 1, pricePercent: 0 };

const scaled = (a: Assumption, k: number): Assumption => ({
  ...a,
  low: Math.round(a.low * k),
  base: Math.round(a.base * k),
  high: Math.round(a.high * k),
});

/**
 * The path seen through the lens. `monthlySales` is the founder's usual sales a month, which a price change acts on:
 * at the same volume, a price rise of p% adds p% of sales as gross profit (a fall takes it away).
 */
export function applyLens(path: PathInput, lens: Lens, monthlySales: number): PathInput {
  let out: PathInput = path;
  if (lens.contractScale !== 1) {
    const k = Math.max(0, lens.contractScale);
    out = { ...out, assumptions: out.assumptions.map((a) => (a.role === 'contract' || a.role === 'direct' ? scaled(a, k) : a)) };
  }
  const delta = Math.round((monthlySales * lens.pricePercent) / 100);
  if (delta !== 0) {
    const label = `Prices ${lens.pricePercent > 0 ? 'up' : 'down'} ${Math.abs(lens.pricePercent)}%, same volume`;
    const amount = Math.abs(delta);
    const line: Assumption = { id: 'what-if-price', label, kind: delta > 0 ? 'income' : 'cost', low: amount, base: amount, high: amount, role: 'other', source: 'you' };
    out = { ...out, assumptions: [...out.assumptions, line] };
  }
  if (lens.latePayment) out = applySetback(out, 'late-payment');
  return out;
}
