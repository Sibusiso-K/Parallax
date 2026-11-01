// Simulation engine (ARCHITECTURE.md §7): a business's cash, month by month. Pure: same inputs, same figures.
// Not decided yet (REVIEW.md §4): the shortfall rule (M1), tax set-aside (M2) and rounding (L2).
// Until then cash may go negative and is flagged, and figures are not rounded here.

export type Kind = 'income' | 'cost';

// Where a value came from (FEATURES.md F8): the founder, a default, the path template or the model.
export type Source = 'you' | 'default' | 'template' | 'ai';

// What a line is for, so analysis.ts can find the sales, the contract, the fixed costs and so on.
// sales: gross profit from customers (sales minus direct costs); contract: money from a new contract when it is paid;
// direct: direct costs of new work; overhead, payroll, founder (the founder's own pay) and debt are the fixed costs.
export type Role =
  | 'sales'
  | 'contract'
  | 'direct'
  | 'overhead'
  | 'payroll'
  | 'founder'
  | 'debt'
  | 'equipment'
  | 'setback'
  | 'other';

export interface Assumption {
  id: string; // stable ID such as "A7", cited by the future-self agents
  label: string;
  kind: Kind;
  /** Monthly amount in rand. low <= base <= high. */
  low: number;
  base: number;
  high: number;
  source?: Source;
  role?: Role;
  /** First and last month (1-based, inclusive) the amount applies. Default: the whole run. */
  fromMonth?: number;
  toMonth?: number;
}

export interface PathInput {
  id: string;
  /** Cash in the business at the start, in rand. */
  startingCash: number;
  assumptions: Assumption[];
  months?: number;
}

export type Case = 'bad' | 'likely' | 'good';

export interface MonthRow {
  month: number; // 1-based
  income: number;
  costs: number;
  net: number;
  /** Cash in the business at the end of the month. */
  cash: number;
}

export interface CaseResult {
  rows: MonthRow[];
  shortfallMonths: number[];
}

export type Simulation = Record<Case, CaseResult>;

export const DEFAULT_MONTHS = 36;
const MAX_MONTHS = 600;

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
export function valueFor(a: Assumption, c: Case): number {
  if (c === 'likely') return a.base;
  const unfavourable = a.kind === 'income' ? a.low : a.high;
  const favourable = a.kind === 'income' ? a.high : a.low;
  return c === 'bad' ? unfavourable : favourable;
}

export const activeIn = (a: Assumption, month: number) =>
  month >= (a.fromMonth ?? 1) && month <= (a.toMonth ?? Number.POSITIVE_INFINITY);

function runCase(path: PathInput, c: Case, months: number): CaseResult {
  const rows: MonthRow[] = [];
  const shortfallMonths: number[] = [];
  let cash = path.startingCash;
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
    cash += net;
    rows.push({ month, income, costs, net, cash });
    if (cash < 0) shortfallMonths.push(month);
  }
  return { rows, shortfallMonths };
}

export type Edit = Pick<Assumption, 'low' | 'base' | 'high'>;

// F8: change one assumption's values. A valid edit becomes the person's own ("you");
// an invalid one is refused and the path is left as it was.
export function editAssumption<P extends PathInput>(
  path: P,
  id: string,
  values: Edit,
): { ok: true; path: P } | { ok: false; error: string } {
  const current = path.assumptions.find((a) => a.id === id);
  if (!current) return { ok: false, error: `${id}: no such assumption` };
  const next: Assumption = { ...current, ...values, source: 'you' };
  const problem = validateAssumption(next);
  if (problem) return { ok: false, error: problem.replace(`${id}: `, '') };
  return { ok: true, path: { ...path, assumptions: path.assumptions.map((a) => (a.id === id ? next : a)) } };
}

export function simulate(path: PathInput): Simulation {
  for (const a of path.assumptions) {
    const problem = validateAssumption(a);
    if (problem) throw new Error(problem);
  }
  if (!Number.isFinite(path.startingCash)) throw new Error('startingCash must be a number');
  const months = path.months ?? DEFAULT_MONTHS;
  if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) {
    throw new Error(`months must be a whole number from 1 to ${MAX_MONTHS}`);
  }
  return {
    bad: runCase(path, 'bad', months),
    likely: runCase(path, 'likely', months),
    good: runCase(path, 'good', months),
  };
}
