import za from '../defaults/za.json' with { type: 'json' };
import type { SetbackId } from '../engine/analysis.js';
import type { Assumption, PathInput } from '../engine/simulate.js';
import type { Figure, Profile } from '../profile/profile.js';

// Template paths for the three founder decisions (FEATURES.md F6, SCOPE.md §2): take on a big contract, make a hire,
// raise prices. Each gives three genuinely different paths. They load when the path-planner agent is not available,
// and are the fallback when it fails. Assumption IDs are stable per path (A1, B3 ...) so future selves can cite them.

export interface PathCard extends PathInput {
  letter: 'A' | 'B' | 'C';
  name: string;
  summary: string;
  /** One or two setbacks from the fixed library that stress this path (SCOPE §3). */
  setbacks: SetbackId[];
}

type Line = Omit<Assumption, 'id'>;
type Range = { low: number; base: number; high: number };

const pick = (f: Range): Range => ({ low: f.low, base: f.base, high: f.high });
const times = (f: Range, k: number): Range => ({ low: Math.round(f.low * k), base: Math.round(f.base * k), high: Math.round(f.high * k) });
const scale = (f: Range, k: Range): Range => ({
  low: Math.round(f.low * k.low),
  base: Math.round(f.base * k.base),
  high: Math.round(f.high * k.high),
});
const sourceOf = (...figures: Figure[]): Line['source'] => (figures.every((f) => f.source === 'you') ? 'you' : 'default');

/** Share of each rand of sales left after direct costs, from the founder's usual figures. */
export function grossMargin(p: Profile): number {
  const sales = p.money.revenue.base;
  if (sales <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - p.money.directCosts.base / sales));
}

/** Whole months between invoice and payment, counting a payment in the month it lands: 30 days is one, 60 is two. */
export const paymentLag = (days: number): number => Math.max(0, Math.ceil(days / 30));

// The business as it runs today. Sales are written as gross profit (sales minus direct costs at today's margin), so a
// bad month of sales also buys fewer ingredients: the bad case never pairs low sales with full direct costs.
function today(p: Profile): Line[] {
  const m = p.money;
  const lines: Line[] = [
    { label: 'Gross profit from current sales', kind: 'income', role: 'sales', ...times(m.revenue, grossMargin(p)), source: sourceOf(m.revenue, m.directCosts) },
    { label: 'Rent and running costs', kind: 'cost', role: 'overhead', ...pick(m.overheads), source: m.overheads.source },
    { label: 'Staff wages', kind: 'cost', role: 'payroll', ...pick(m.payroll), source: m.payroll.source },
    { label: 'Your own pay', kind: 'cost', role: 'founder', ...pick(m.founderPay), source: m.founderPay.source },
    { label: 'Debt repayments', kind: 'cost', role: 'debt', ...pick(m.debtRepayments), source: m.debtRepayments.source },
  ];
  return lines.filter(used);
}

/** A line that is zero in every case adds nothing but noise to the assumptions panel. */
const used = (l: Line) => l.high > 0;

function card(p: Profile, letter: PathCard['letter'], name: string, summary: string, lines: Line[], setbacks: SetbackId[]): PathCard {
  return {
    id: letter,
    letter,
    name,
    summary,
    startingCash: p.money.cash.base,
    assumptions: lines.filter(used).map((a, i) => ({ ...a, id: `${letter}${i + 1}` })),
    setbacks,
  };
}

// Decision 1: a client offers a contract that pays well but late, and needs extra staff and equipment.
function contractPaths(p: Profile): PathCard[] {
  const t = za.templates.contract;
  const m = p.money;
  const n = t.lengthMonths;
  const days = p.paymentDays.value;
  const saferDays = Math.min(days, t.saferPaymentDays);
  const work = { fromMonth: 1, toMonth: n };
  const paid = (d: number, label: string): Line => {
    const lag = paymentLag(d);
    return { label, kind: 'income', role: 'contract', ...pick(m.offerRevenue), source: m.offerRevenue.source, fromMonth: 1 + lag, toMonth: n + lag };
  };
  const direct: Line = { label: 'Direct costs of the contract work', kind: 'cost', role: 'direct', ...scale(m.offerRevenue, t.directShare), source: 'template', ...work };
  const staff: Line = { label: 'Extra staff for the contract', kind: 'cost', role: 'payroll', ...pick(m.hireCost), source: m.hireCost.source, ...work };
  const bought: Line = { label: 'Equipment for the contract, bought up front', kind: 'cost', role: 'equipment', ...pick(m.upfrontCost), source: m.upfrontCost.source, fromMonth: 1, toMonth: 1 };
  const rented: Line = { label: 'Equipment for the contract, rented', kind: 'cost', role: 'equipment', ...times(m.upfrontCost, t.equipmentRentShare), source: 'template', ...work };
  const safer = saferDays < days ? `Take it only if the client pays within ${saferDays} days, and rent the equipment instead of buying it.` : 'Take it, and rent the equipment instead of buying it.';
  return [
    card(p, 'A', 'Stay lean', 'Turn the contract down and keep running the business as it is.', today(p), ['lost-client', 'slow-season']),
    card(p, 'B', 'Take it as offered', `Take the ${n}-month contract now, paid ${days} days after each invoice.`,
      [...today(p), paid(days, `Contract income, paid ${days} days after each invoice`), direct, staff, bought], ['late-payment', 'equipment-breakdown']),
    card(p, 'C', 'Take it on safer terms', safer,
      [...today(p), paid(saferDays, `Contract income, paid ${saferDays} days after each invoice`), direct, staff, rented], ['late-payment', 'cost-rise']),
  ];
}

// Decision 2: take someone on. A new person costs from month 1 and brings in extra gross profit after a ramp-up.
function hirePaths(p: Profile): PathCard[] {
  const t = za.templates.hire;
  const hire = p.money.hireCost;
  const from = t.rampMonths + 1;
  const extra = scale(hire, t.upliftMultiple);
  const partTime: Line[] = [
    { label: `Part-time help (months 1 to ${t.partTimeMonths})`, kind: 'cost', role: 'payroll', ...times(hire, t.partTimeShare), source: 'template', toMonth: t.partTimeMonths },
    { label: `Same person, full-time from month ${t.partTimeMonths + 1}`, kind: 'cost', role: 'payroll', ...pick(hire), source: hire.source, fromMonth: t.partTimeMonths + 1 },
    { label: `Extra gross profit, full-time (from month ${t.partTimeMonths + 1})`, kind: 'income', role: 'sales', ...extra, source: 'template', fromMonth: t.partTimeMonths + 1 },
  ];
  if (from <= t.partTimeMonths) {
    partTime.splice(1, 0, {
      label: `Extra gross profit, part-time (months ${from} to ${t.partTimeMonths})`,
      kind: 'income',
      role: 'sales',
      ...times(extra, t.partTimeShare),
      source: 'template',
      fromMonth: from,
      toMonth: t.partTimeMonths,
    });
  }
  return [
    card(p, 'A', 'Stay as you are', 'Keep the team as it is and carry the extra work yourself.', today(p), ['slow-season', 'lost-client']),
    card(p, 'B', 'Hire now', `Hire someone full-time now; they bring in extra sales from month ${from}.`, [
      ...today(p),
      { label: 'New hire', kind: 'cost', role: 'payroll', ...pick(hire), source: hire.source },
      { label: `Extra gross profit the hire brings in (from month ${from})`, kind: 'income', role: 'sales', ...extra, source: 'template', fromMonth: from },
    ], ['slow-season', 'cost-rise']),
    card(p, 'C', 'Start part-time', `Bring someone in part-time for ${t.partTimeMonths} months, then full-time if it works.`, [...today(p), ...partTime], ['slow-season', 'lost-client']),
  ];
}

// Decision 3: raise prices. Gross profit at new prices = sales x (1 - share of sales lost) x (rise + today's margin):
// the customers who stay pay more, and the ones who leave take their direct costs with them. The bad case pairs low
// sales with the most customers lost.
function pricingPaths(p: Profile): PathCard[] {
  const t = za.templates.pricing;
  const r = p.money.revenue;
  const margin = grossMargin(p);
  const lines = today(p);
  const sales = lines.find((l) => l.role === 'sales');
  const others = lines.filter((l) => l.role !== 'sales');
  const atPrice = (rise: number, lost: Range): Range => ({
    low: Math.round(r.low * (1 - lost.high) * (rise + margin)),
    base: Math.round(r.base * (1 - lost.base) * (rise + margin)),
    high: Math.round(r.high * (1 - lost.low) * (rise + margin)),
  });
  const raise = (pct: number, lost: Range): Line[] => {
    const newPrices: Line = { label: `Gross profit at prices ${pct}% higher (from month 2)`, kind: 'income', role: 'sales', ...atPrice(pct / 100, lost), source: 'template', fromMonth: 2 };
    const before: Line[] = sales ? [{ ...sales, label: `${sales.label} (month 1)`, toMonth: 1 }] : [];
    return [...before, newPrices, ...others];
  };
  const pct = p.priceRisePercent.value;
  const half = pct / 2;
  return [
    card(p, 'A', 'Keep prices', 'Keep prices where they are.', today(p), ['slow-season', 'cost-rise']),
    card(p, 'B', `Raise prices ${pct}%`, `Raise prices by ${pct}% from month 2; some customers may leave.`, raise(pct, t.churn), ['lost-client', 'cost-rise']),
    card(p, 'C', `Raise prices ${half}%`, `Raise prices by ${half}% from month 2, so fewer customers leave.`, raise(half, t.smallChurn), ['lost-client', 'slow-season']),
  ];
}

export function templatePaths(p: Profile): PathCard[] {
  switch (p.decisionType) {
    case 'contract':
      return contractPaths(p);
    case 'hire':
      return hirePaths(p);
    case 'pricing':
      return pricingPaths(p);
  }
}
