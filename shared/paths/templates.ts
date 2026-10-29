import za from '../defaults/za.json' with { type: 'json' };
import type { Assumption, PathInput } from '../engine/simulate.js';
import type { Profile } from '../profile/profile.js';

// Template paths for decision 1 (FEATURES.md F6): A Stay and grow, B Go full-time, C Qualify up.
// These load when the path-planner agent is not available, and are the fallback when it fails.
// Assumption IDs are stable per path (A1, B3 ...) so future selves can cite them.

export interface PathCard extends PathInput {
  letter: 'A' | 'B' | 'C';
  name: string;
  summary: string;
}

type Common = Omit<Assumption, 'id'>;

function common(p: Profile): Common[] {
  const m = p.money;
  return [
    { label: 'Essential expenses', kind: 'cost', ...pick(m.essentialExpenses), source: m.essentialExpenses.source },
    { label: 'Support to family (never cut without you)', kind: 'cost', ...pick(m.familySupportMonthly), source: m.familySupportMonthly.source },
    { label: 'Debt repayments', kind: 'cost', ...pick(m.debtRepayments), source: m.debtRepayments.source },
  ];
}

const pick = (f: { low: number; base: number; high: number }) => ({ low: f.low, base: f.base, high: f.high });
const scale = (f: { low: number; base: number; high: number }, k: { low: number; base: number; high: number }) => ({
  low: Math.round(f.low * k.low),
  base: Math.round(f.base * k.base),
  high: Math.round(f.high * k.high),
});

function withIds(letter: string, list: Common[]): Assumption[] {
  return list.map((a, i) => ({ ...a, id: `${letter}${i + 1}` }));
}

export function templatePaths(p: Profile): PathCard[] {
  const m = p.money;
  const salary: Common = { label: 'Take-home salary', kind: 'income', ...pick(m.takeHome), source: m.takeHome.source };
  const side: Common = { label: 'Side business profit', kind: 'income', ...pick(m.sideIncome), source: m.sideIncome.source };
  const ft = za.templates.goFullTime;
  const q = za.templates.qualifyUp;
  const savings = m.savings.base;

  const stay: PathCard = {
    id: 'A',
    letter: 'A',
    name: 'Stay and grow',
    summary: 'Keep the job and keep the side business going on weekends.',
    startingSavings: savings,
    assumptions: withIds('A', [salary, side, ...common(p)]),
  };

  const fullTime: PathCard = {
    id: 'B',
    letter: 'B',
    name: 'Go full-time',
    summary: `Resign after month ${ft.resignMonth} and run the business full-time.`,
    startingSavings: savings,
    assumptions: withIds('B', [
      { ...salary, toMonth: ft.resignMonth },
      { ...side, toMonth: ft.resignMonth },
      {
        label: 'Full-time business profit',
        kind: 'income',
        ...scale(m.sideIncome, ft.profitMultiple),
        source: 'template',
        fromMonth: ft.resignMonth + 1,
      },
      ...common(p),
    ]),
  };

  const qualify: PathCard = {
    id: 'C',
    letter: 'C',
    name: 'Qualify up',
    summary: `Study part-time for ${q.studyMonths} months, then earn more in the same field.`,
    startingSavings: savings,
    assumptions: withIds('C', [
      salary,
      { ...side, ...scale(m.sideIncome, q.sideIncomeWhileStudying), source: 'template', toMonth: q.studyMonths, label: 'Side business profit while studying' },
      { ...side, fromMonth: q.studyMonths + 1 },
      { label: 'Course fees', kind: 'cost', ...q.courseCostMonthly, source: 'template', toMonth: q.studyMonths },
      { label: 'Raise after qualifying', kind: 'income', ...scale(m.takeHome, q.raiseAfter), source: 'template', fromMonth: q.studyMonths + 1 },
      ...common(p),
    ]),
  };

  return [stay, fullTime, qualify];
}
