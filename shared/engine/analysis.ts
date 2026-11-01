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

/** Whole months the starting savings would pay the month-1 costs with no income (likely case). Null if there are no costs. */
export function runwayMonths(path: PathInput): number | null {
  let costs = 0;
  for (const a of path.assumptions) {
    if (a.kind === 'cost' && activeIn(a, 1)) costs += a.base;
  }
  if (costs === 0) return null;
  return Math.max(0, Math.floor(path.startingSavings / costs));
}

export type MilestoneId = 'emergency-3-months' | 'business-matches-salary' | 'savings-run-out' | 'debt-cleared';

export interface Milestone {
  id: MilestoneId;
  label: string;
  /** First month the milestone holds in this case, or null if it never does. */
  month: number | null;
}

const MILESTONE_LABELS: Record<MilestoneId, string> = {
  'emergency-3-months': 'Emergency fund covers three months of essentials',
  'business-matches-salary': 'Business pays what the old salary paid',
  'savings-run-out': 'Savings run out',
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
    const salary = roleTotal(path, 'salary', 1, c);
    const fund = rows.find((r) => {
      const essentials = roleTotal(path, 'essential', r.month, c);
      return essentials > 0 && r.savings >= 3 * essentials;
    });
    const business = salary > 0 ? rows.find((r) => roleTotal(path, 'business', r.month, c) >= salary) : undefined;
    out[c] = [
      { id: 'emergency-3-months', label: MILESTONE_LABELS['emergency-3-months'], month: fund?.month ?? null },
      { id: 'business-matches-salary', label: MILESTONE_LABELS['business-matches-salary'], month: business?.month ?? null },
      { id: 'savings-run-out', label: MILESTONE_LABELS['savings-run-out'], month: sim[c].shortfallMonths[0] ?? null },
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
  /** How far the likely-case end savings move between the line's unfavourable and favourable ends, in rand. */
  swing: number;
}

const endLikely = (p: PathInput): number => simulate(p).likely.rows.at(-1)!.savings;

/** The lines that move the likely-case end savings most. Each line is swung to its ends while the rest stay at base. */
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

export const SETBACK_IDS = ['lost-client', 'car-breakdown', 'income-gap', 'family-emergency', 'rent-increase'] as const;
export type SetbackId = (typeof SETBACK_IDS)[number];

export const SETBACK_LABELS: Record<SetbackId, string> = {
  'lost-client': 'Lost client: business income stops for a few months',
  'car-breakdown': 'Car breakdown: one repair bill',
  'income-gap': 'Income gap: salary stops for a couple of months',
  'family-emergency': 'Family emergency: one extra payment',
  'rent-increase': 'Rent increase: essential costs go up from then on',
};

/**
 * Applies one setback as a stress test: an extra cost line, timed from `month` and sized from the path itself
 * (the income it takes away) or from the placeholder amounts in za.json. Lost income is written as a cost of the
 * same size, so every amount stays non-negative, as the engine requires.
 */
export function applySetback(path: PathInput, id: SetbackId, month: number = za.setbacks.defaultMonth): PathInput {
  const s = za.setbacks;
  const span = (months: number) => ({ fromMonth: month, toMonth: month + months - 1 });
  let amount = 0;
  let timing: { fromMonth?: number; toMonth?: number } = {};
  switch (id) {
    case 'lost-client':
      amount = roleTotal(path, 'business', month, 'likely');
      timing = span(s.lostClientMonths);
      break;
    case 'income-gap':
      amount = roleTotal(path, 'salary', month, 'likely');
      timing = span(s.incomeGapMonths);
      break;
    case 'car-breakdown':
      amount = s.carBreakdown;
      timing = span(1);
      break;
    case 'family-emergency':
      amount = s.familyEmergency;
      timing = span(1);
      break;
    case 'rent-increase':
      amount = s.rentIncreasePercent * roleTotal(path, 'essential', month, 'likely');
      timing = { fromMonth: month };
      break;
  }
  const line: Assumption = {
    id: `${path.id}${path.assumptions.length + 1}`,
    label: SETBACK_LABELS[id],
    kind: 'cost',
    low: amount,
    base: amount,
    high: amount,
    role: 'setback',
    source: 'template',
    ...timing,
  };
  return { ...path, assumptions: [...path.assumptions, line] };
}

/** Change in likely-case end savings when one setback hits. Negative means money lost. */
export function setbackExposure(path: PathInput, id: SetbackId, month?: number): number {
  return endLikely(applySetback(path, id, month)) - endLikely(path);
}

/** The setback that costs the most: "the setback to watch" (FEATURES F16) and the compare view (F14). */
export function worstSetback(path: PathInput, month?: number): { id: SetbackId; label: string; exposure: number } {
  let worst: { id: SetbackId; label: string; exposure: number } | undefined;
  for (const id of SETBACK_IDS) {
    const exposure = setbackExposure(path, id, month);
    if (!worst || exposure < worst.exposure) worst = { id, label: SETBACK_LABELS[id], exposure };
  }
  return worst!;
}

/**
 * Every number the figure guard may quote, under the keys the chat's placeholders will use.
 * Keys: <path>.start, <path>.savings.m12.<case>, <path>.savings.m36.<case>, <path>.income.m1.<case>,
 * <path>.costs.m1.<case>, <path>.worst.<case>, <path>.worstMonth.<case>, <path>.milestone.<id>.<case>,
 * <path>.runway, <path>.driver.<assumptionId>, <path>.setback.<setbackId>, <path>.<assumptionId>.<low|base|high>.
 * <case> is bad, likely or good. Milestones with no month are left out.
 */
export function figureTable(path: PathInput): Record<string, number> {
  const sim = simulate(path);
  const ms = milestones(path, sim);
  const out: Record<string, number> = { [`${path.id}.start`]: path.startingSavings };
  for (const c of CASES) {
    const rows = sim[c].rows;
    for (const m of [12, 36]) {
      if (m <= rows.length) out[`${path.id}.savings.m${m}.${c}`] = rows[m - 1]!.savings;
    }
    out[`${path.id}.income.m1.${c}`] = rows[0]!.income;
    out[`${path.id}.costs.m1.${c}`] = rows[0]!.costs;
    let worst = rows[0]!;
    for (const r of rows) if (r.savings < worst.savings) worst = r;
    out[`${path.id}.worst.${c}`] = worst.savings;
    out[`${path.id}.worstMonth.${c}`] = worst.month;
    for (const mi of ms[c]) if (mi.month !== null) out[`${path.id}.milestone.${mi.id}.${c}`] = mi.month;
  }
  const runway = runwayMonths(path);
  if (runway !== null) out[`${path.id}.runway`] = runway;
  for (const d of drivers(path)) out[`${path.id}.driver.${d.id}`] = d.swing;
  for (const id of SETBACK_IDS) out[`${path.id}.setback.${id}`] = setbackExposure(path, id);
  for (const a of path.assumptions) {
    out[`${path.id}.${a.id}.low`] = a.low;
    out[`${path.id}.${a.id}.base`] = a.base;
    out[`${path.id}.${a.id}.high`] = a.high;
  }
  return out;
}
