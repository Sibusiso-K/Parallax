import za from '../defaults/za.json' with { type: 'json' };
import {
  DEFAULT_MONTHS,
  activeIn,
  simulate,
  valueFor,
  type Assumption,
  type Case,
  type PathInput,
  type Role,
  type Simulation,
} from './simulate.js';

// Analysis on top of the three runs (F7, ARCHITECTURE section 7): runway, milestones, the biggest drivers, the setback
// library applied as stress tests, and the figure table that the figure guard (F11) checks text against.
// Pure, like the engine: same path, same numbers. Figures are not rounded here (REVIEW L2 is still open).

export const CASES: readonly Case[] = ['bad', 'likely', 'good'];

const monthCount = (path: PathInput): number => path.months ?? DEFAULT_MONTHS;

/** What the lines with one role add up to in one month, in one case. */
export function roleTotal(path: PathInput, role: Role, month: number, c: Case): number {
  let total = 0;
  for (const a of path.assumptions) {
    if (a.role === role && activeIn(a, month)) total += valueFor(a, c);
  }
  return total;
}

const FIXED: Role[] = ['overhead', 'payroll', 'founder', 'debt'];

/** Rent and running costs, wages, the founder's pay and debt repayments in one month: what must be paid regardless. */
export function fixedCosts(path: PathInput, month: number, c: Case): number {
  return FIXED.reduce((sum, role) => sum + roleTotal(path, role, month, c), 0);
}

/** Whole months the starting cash would pay the month-1 costs with no money coming in (likely case). Null if there are no costs. */
export function runwayMonths(path: PathInput): number | null {
  let costs = 0;
  for (const a of path.assumptions) {
    if (a.kind === 'cost' && activeIn(a, 1)) costs += a.base;
  }
  if (costs === 0) return null;
  return Math.max(0, Math.floor(path.startingCash / costs));
}

/** The lowest month-end cash in one case, and the first month it happens. */
export function lowestCash(sim: Simulation, c: Case): { cash: number; month: number } {
  let low = sim[c].rows[0]!;
  for (const r of sim[c].rows) if (r.cash < low.cash) low = r;
  return { cash: low.cash, month: low.month };
}

export type MilestoneId = 'cash-buffer-3-months' | 'cash-runs-out' | 'back-to-start' | 'debt-cleared';

export interface Milestone {
  id: MilestoneId;
  label: string;
  /** First month the milestone holds in this case, or null if it never does. */
  month: number | null;
}

const MILESTONE_LABELS: Record<MilestoneId, string> = {
  'cash-buffer-3-months': 'Cash covers three months of fixed costs',
  'cash-runs-out': 'Cash runs out',
  'back-to-start': 'Cash back to where it started, after dipping below it',
  'debt-cleared': 'Debt repayments end',
};

/** Derived in code, never narrated (SCOPE section 3). */
export function milestones(path: PathInput, sim: Simulation): Record<Case, Milestone[]> {
  const debtEnds = path.assumptions.filter((a) => a.role === 'debt').map((a) => a.toMonth);
  const debtEnd =
    debtEnds.length > 0 && debtEnds.every((m) => m !== undefined) ? Math.max(...(debtEnds as number[])) + 1 : null;
  const out = {} as Record<Case, Milestone[]>;
  for (const c of CASES) {
    const rows = sim[c].rows;
    const buffer = rows.find((r) => {
      const fixed = fixedCosts(path, r.month, c);
      return fixed > 0 && r.cash >= 3 * fixed;
    });
    const dip = rows.findIndex((r) => r.cash < path.startingCash);
    const back = dip === -1 ? undefined : rows.slice(dip).find((r) => r.cash >= path.startingCash);
    out[c] = [
      { id: 'cash-buffer-3-months', label: MILESTONE_LABELS['cash-buffer-3-months'], month: buffer?.month ?? null },
      { id: 'cash-runs-out', label: MILESTONE_LABELS['cash-runs-out'], month: sim[c].shortfallMonths[0] ?? null },
      { id: 'back-to-start', label: MILESTONE_LABELS['back-to-start'], month: back?.month ?? null },
      {
        id: 'debt-cleared',
        label: MILESTONE_LABELS['debt-cleared'],
        month: debtEnd !== null && debtEnd <= monthCount(path) ? debtEnd : null,
      },
    ];
  }
  return out;
}

export interface Driver {
  id: string;
  label: string;
  /** How far the likely-case cash at the end moves between the line's unfavourable and favourable ends, in rand. */
  swing: number;
}

const endLikely = (p: PathInput): number => simulate(p).likely.rows.at(-1)!.cash;

/** The lines that move the likely-case end cash most. Each line is swung to its ends while the rest stay at base. */
export function drivers(path: PathInput, top = 3): Driver[] {
  const out: Driver[] = path.assumptions.map((a: Assumption) => {
    const unfavourable = a.kind === 'income' ? a.low : a.high;
    const favourable = a.kind === 'income' ? a.high : a.low;
    const fixedAt = (v: number) =>
      endLikely({ ...path, assumptions: path.assumptions.map((x) => (x.id === a.id ? { ...x, low: v, base: v, high: v } : x)) });
    return { id: a.id, label: a.label, swing: Math.abs(fixedAt(favourable) - fixedAt(unfavourable)) };
  });
  return out
    .filter((d) => d.swing > 0)
    .sort((x, y) => y.swing - x.swing || (x.id < y.id ? -1 : 1))
    .slice(0, top);
}

export const SETBACK_IDS = ['late-payment', 'lost-client', 'slow-season', 'equipment-breakdown', 'cost-rise'] as const;
export type SetbackId = (typeof SETBACK_IDS)[number];

const s = za.setbacks;
export const SETBACK_LABELS: Record<SetbackId, string> = {
  'late-payment': `Late payment: a big client pays ${s.latePaymentMonths} months late, then catches up`,
  'lost-client': `Lost client: your biggest customer stops buying for ${s.lostClientMonths} months`,
  'slow-season': `Slow season: gross profit drops ${Math.round(s.slowSeasonShare * 100)}% for ${s.slowSeasonMonths} months`,
  'equipment-breakdown': 'Equipment breakdown: one repair bill',
  'cost-rise': `Cost rise: rent and running costs go up ${Math.round(s.costRisePercent * 100)}% from then on`,
};

/** When a setback hits by default: a late payment hits the first contract payment, if the path has one. */
export function setbackMonth(path: PathInput, id: SetbackId): number {
  if (id === 'late-payment') {
    const firstPaid = path.assumptions.filter((a) => a.role === 'contract').map((a) => a.fromMonth ?? 1);
    if (firstPaid.length > 0) return Math.min(...firstPaid);
  }
  return s.defaultMonth;
}

/**
 * Applies one setback as a stress test: extra lines, timed from `month` and sized from the path itself (the gross
 * profit or contract money it holds back) or from the placeholder amounts in za.json. Money held back is written as a
 * cost of the same size, so every amount stays non-negative, as the engine requires. A late payment adds two lines:
 * the money held back, then the same money paid late. Setback sizes are whole rand, so shares of sales leave no fractions.
 */
export function applySetback(path: PathInput, id: SetbackId, month: number = setbackMonth(path, id)): PathInput {
  const span = (from: number, months: number) => ({ fromMonth: from, toMonth: from + months - 1 });
  const lines: Omit<Assumption, 'id'>[] = [];
  const line = (kind: Assumption['kind'], amount: number, timing: { fromMonth: number; toMonth?: number }, label = SETBACK_LABELS[id]) => {
    const v = Math.round(amount);
    lines.push({ label, kind, low: v, base: v, high: v, role: 'setback', source: 'template', ...timing });
  };
  const sales = roleTotal(path, 'sales', month, 'likely');
  switch (id) {
    case 'late-payment': {
      const contract = roleTotal(path, 'contract', month, 'likely');
      const held = contract > 0 ? contract : s.bigClientShare * sales;
      line('cost', held, span(month, s.latePaymentMonths), `${SETBACK_LABELS[id]} (held back)`);
      line('income', held, span(month + s.latePaymentMonths, s.latePaymentMonths), `${SETBACK_LABELS[id]} (paid late)`);
      break;
    }
    case 'lost-client':
      line('cost', s.bigClientShare * sales, span(month, s.lostClientMonths));
      break;
    case 'slow-season':
      line('cost', s.slowSeasonShare * sales, span(month, s.slowSeasonMonths));
      break;
    case 'equipment-breakdown':
      line('cost', s.equipmentRepair, span(month, 1));
      break;
    case 'cost-rise':
      line('cost', s.costRisePercent * roleTotal(path, 'overhead', month, 'likely'), { fromMonth: month });
      break;
  }
  const n = path.assumptions.length;
  return { ...path, assumptions: [...path.assumptions, ...lines.map((l, i) => ({ ...l, id: `${path.id}${n + i + 1}` }))] };
}

export interface SetbackImpact {
  id: SetbackId;
  label: string;
  /** Change in the lowest likely-case month-end cash. Zero or negative: how much closer the business gets to empty. */
  lowest: number;
  /** Change in likely-case cash at the end of the run. Zero or negative. */
  end: number;
  /** First month cash goes below zero with the setback, likely case; null if it never does. */
  runsOutMonth: number | null;
}

/** What one setback does to the likely case. A business dies when cash runs out, so the lowest point leads. */
export function setbackImpact(path: PathInput, id: SetbackId, month?: number): SetbackImpact {
  const before = simulate(path);
  const after = simulate(applySetback(path, id, month));
  return {
    id,
    label: SETBACK_LABELS[id],
    lowest: lowestCash(after, 'likely').cash - lowestCash(before, 'likely').cash,
    end: after.likely.rows.at(-1)!.cash - before.likely.rows.at(-1)!.cash,
    runsOutMonth: after.likely.shortfallMonths[0] ?? null,
  };
}

/** The setback that pushes cash lowest: "the setback to watch" (FEATURES F16) and the compare view (F14). */
export function worstSetback(path: PathInput): SetbackImpact {
  let worst: SetbackImpact | undefined;
  for (const id of SETBACK_IDS) {
    const impact = setbackImpact(path, id);
    if (!worst || impact.lowest < worst.lowest || (impact.lowest === worst.lowest && impact.end < worst.end)) worst = impact;
  }
  return worst!;
}

/**
 * Every number the figure guard may quote, under the keys the chat's placeholders will use.
 * Keys: <path>.start, <path>.cash.m12.<case>, <path>.cash.m36.<case>, <path>.income.m1.<case>, <path>.costs.m1.<case>,
 * <path>.lowest.<case>, <path>.lowestMonth.<case>, <path>.milestone.<id>.<case>, <path>.runway,
 * <path>.driver.<assumptionId>, <path>.setback.<setbackId>.lowest, <path>.setback.<setbackId>.end,
 * <path>.setback.<setbackId>.runsOut (only when it does), <path>.<assumptionId>.<low|base|high>.
 * <case> is bad, likely or good. Milestones with no month are left out.
 */
export function figureTable(path: PathInput): Record<string, number> {
  const sim = simulate(path);
  const ms = milestones(path, sim);
  const out: Record<string, number> = { [`${path.id}.start`]: path.startingCash };
  for (const c of CASES) {
    const rows = sim[c].rows;
    for (const m of [12, 36]) {
      if (m <= rows.length) out[`${path.id}.cash.m${m}.${c}`] = rows[m - 1]!.cash;
    }
    out[`${path.id}.income.m1.${c}`] = rows[0]!.income;
    out[`${path.id}.costs.m1.${c}`] = rows[0]!.costs;
    const low = lowestCash(sim, c);
    out[`${path.id}.lowest.${c}`] = low.cash;
    out[`${path.id}.lowestMonth.${c}`] = low.month;
    for (const mi of ms[c]) if (mi.month !== null) out[`${path.id}.milestone.${mi.id}.${c}`] = mi.month;
  }
  const runway = runwayMonths(path);
  if (runway !== null) out[`${path.id}.runway`] = runway;
  for (const d of drivers(path)) out[`${path.id}.driver.${d.id}`] = d.swing;
  for (const id of SETBACK_IDS) {
    const impact = setbackImpact(path, id);
    out[`${path.id}.setback.${id}.lowest`] = impact.lowest;
    out[`${path.id}.setback.${id}.end`] = impact.end;
    if (impact.runsOutMonth !== null) out[`${path.id}.setback.${id}.runsOut`] = impact.runsOutMonth;
  }
  for (const a of path.assumptions) {
    out[`${path.id}.${a.id}.low`] = a.low;
    out[`${path.id}.${a.id}.base`] = a.base;
    out[`${path.id}.${a.id}.high`] = a.high;
  }
  return out;
}
