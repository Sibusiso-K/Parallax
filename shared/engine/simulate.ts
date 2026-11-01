// Simulation engine, first slice (ARCHITECTURE.md §7). Pure: same inputs, same figures.
// Not decided yet (REVIEW.md §4): the shortfall rule (M1), tax set-aside (M2) and rounding (L2).
// Until then savings may go negative and are flagged, and figures are not rounded here.

export type Kind = 'income' | 'cost';

// Where a value came from (FEATURES.md F8): the person, a default, the path template or the model.
export type Source = 'you' | 'default' | 'template' | 'ai';

export interface Assumption {
  id: string; // stable ID such as "A7", cited by the future-self agents
  label: string;
  kind: Kind;
  /** Monthly amount in rand. low <= base <= high. */
  low: number;
  base: number;
  high: number;
  source?: Source;
  /** First and last month (1-based, inclusive) the amount applies. Default: the whole run. */
  fromMonth?: number;
  toMonth?: number;
}

export interface PathInput {
  id: string;
  startingSavings: number;
  assumptions: Assumption[];
  months?: number;
}

export type Case = 'bad' | 'likely' | 'good';

export interface MonthRow {
  month: number; // 1-based
  income: number;
  costs: number;
  net: number;
  savings: number;
}

export interface CaseResult {
  rows: MonthRow[];
  shortfallMonths: number[];
}

export type Simulation = Record<Case, CaseResult>;

export const DEFAULT_MONTHS = 36;

export function validateAssumption(a: Assumption): string | null {
  for (const v of [a.low, a.base, a.high]) {
    if (!Number.isFinite(v)) return `${a.id}: values must be numbers`;
    if (v < 0) return `${a.id}: values cannot be negative`;
  }
  if (!(a.low <= a.base && a.base <= a.high)) return `${a.id}: needs low <= base <= high`;
  if (a.fromMonth !== undefined && a.toMonth !== undefined && a.fromMonth > a.toMonth) {
    return `${a.id}: fromMonth is after toMonth`;
  }
  return null;
}

// Bad case takes every assumption at its unfavourable end (low income, high cost); good case the reverse.
function valueFor(a: Assumption, c: Case): number {
  if (c === 'likely') return a.base;
  const unfavourable = a.kind === 'income' ? a.low : a.high;
  const favourable = a.kind === 'income' ? a.high : a.low;
  return c === 'bad' ? unfavourable : favourable;
}

const activeIn = (a: Assumption, month: number) =>
  month >= (a.fromMonth ?? 1) && month <= (a.toMonth ?? Number.POSITIVE_INFINITY);

function runCase(path: PathInput, c: Case, months: number): CaseResult {
  const rows: MonthRow[] = [];
  const shortfallMonths: number[] = [];
  let savings = path.startingSavings;
  for (let month = 1; month <= months; month++) {
    let income = 0;
    let costs = 0;
    for (const a of path.assumptions) {
      if (!activeIn(a, month)) continue;
      const v = valueFor(a, c);
      if (a.kind === 'income') income += v;
      else costs += v;
    }
    const net = income - costs;
    savings += net;
    rows.push({ month, income, costs, net, savings });
    if (savings < 0) shortfallMonths.push(month);
  }
  return { rows, shortfallMonths };
}

export function simulate(path: PathInput): Simulation {
  for (const a of path.assumptions) {
    const problem = validateAssumption(a);
    if (problem) throw new Error(problem);
  }
  if (!Number.isFinite(path.startingSavings)) throw new Error('startingSavings must be a number');
  const months = path.months ?? DEFAULT_MONTHS;
  return {
    bad: runCase(path, 'bad', months),
    likely: runCase(path, 'likely', months),
    good: runCase(path, 'good', months),
  };
}
