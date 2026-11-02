import { formatRand } from '../guard/figures.js';
import { DEFAULT_MONTHS } from '../engine/simulate.js';
import type { RoomSnapshot, SnapshotRegistry } from './room-model.js';

// Typed claims (AGENT_TOOLS_AND_STACK.md "Figures and claims"): a claim names a snapshot, a scenario and a metric. Code
// resolves it against that exact snapshot and formats every number. The word "matched" means consistent with this
// simulation, not that the assumptions are true or the reasoning is financially sound.

export type Metric = 'cash_at_month' | 'net_at_month' | 'lowest_cash' | 'first_shortfall' | 'cash_at_end';

export interface ClaimRef {
  snapshotKey: string;
  scenario: 'baseline' | 'active';
  metric: Metric;
  month?: number;
}

export interface ResolvedClaim {
  ref: ClaimRef;
  /** The number behind the text, or null for "no shortfall". */
  value: number | null;
  unit: 'rand' | 'month' | 'none';
  /** What the DOM shows. Always produced by code. */
  text: string;
  label: string;
  scenarioLabel: string;
  month: number | null;
  qualification?: string;
  pathId: string;
}

export type ClaimResult = { ok: true; claim: ResolvedClaim } | { ok: false; reason: string };

const SHORTFALL_NOTE = 'Months after a shortfall continue the projection. The engine does not model whether a business keeps trading, or finds funding, after cash runs out.';

export function resolveClaim(registry: SnapshotRegistry, ref: ClaimRef): ClaimResult {
  const snap: RoomSnapshot | undefined = registry.get(ref.snapshotKey);
  if (!snap) return { ok: false, reason: 'unknown snapshot' };
  if (ref.scenario !== 'baseline' && ref.scenario !== 'active') return { ok: false, reason: 'unknown scenario' };
  const outcome = ref.scenario === 'baseline' ? snap.baseline : snap.active;
  const stressed = ref.scenario === 'active' && snap.ref.setback !== null;
  const scenarioLabel = stressed ? `Late payment from month ${snap.ref.setback!.effectiveStartMonth}` : 'Baseline';
  const base = { ref, scenarioLabel, pathId: snap.ref.pathId };
  const months = outcome.rows.length || DEFAULT_MONTHS;
  const needsMonth = ref.metric === 'cash_at_month' || ref.metric === 'net_at_month';
  if (needsMonth && !(Number.isInteger(ref.month) && ref.month! >= 1 && ref.month! <= months)) return { ok: false, reason: 'month out of range' };

  switch (ref.metric) {
    case 'cash_at_month': {
      const v = outcome.rows[ref.month! - 1]!.cash;
      const after = outcome.firstShortfall !== null && ref.month! > outcome.firstShortfall;
      return { ok: true, claim: { ...base, value: v, unit: 'rand', text: formatRand(v), label: `Cash at the end of month ${ref.month}`, month: ref.month!, ...(after ? { qualification: SHORTFALL_NOTE } : {}) } };
    }
    case 'net_at_month': {
      const v = outcome.rows[ref.month! - 1]!.net;
      return { ok: true, claim: { ...base, value: v, unit: 'rand', text: formatRand(v), label: `Net cash flow in month ${ref.month}`, month: ref.month! } };
    }
    case 'lowest_cash':
      return { ok: true, claim: { ...base, value: outcome.lowest.cash, unit: 'rand', text: formatRand(outcome.lowest.cash), label: `Lowest cash (month ${outcome.lowest.month})`, month: outcome.lowest.month } };
    case 'first_shortfall': {
      const m = outcome.firstShortfall;
      return {
        ok: true,
        claim: {
          ...base,
          value: m,
          unit: m === null ? 'none' : 'month',
          text: m === null ? `no shortfall within ${months} months` : `month ${m}`,
          label: 'Cash first runs out',
          month: m,
          ...(m !== null ? { qualification: SHORTFALL_NOTE } : {}),
        },
      };
    }
    case 'cash_at_end': {
      const v = outcome.rows[outcome.rows.length - 1]!.cash;
      return {
        ok: true,
        claim: { ...base, value: v, unit: 'rand', text: formatRand(v), label: `Cash at month ${outcome.rows.length}`, month: outcome.rows.length, ...(outcome.firstShortfall !== null ? { qualification: SHORTFALL_NOTE } : {}) },
      };
    }
    default:
      return { ok: false, reason: 'unknown metric' };
  }
}

export interface VerifiedClaims {
  ok: boolean;
  claims: ResolvedClaim[];
  failures: { ref: ClaimRef; reason: string }[];
}

/** All or nothing: one bad reference means the whole answer is withheld, never partly shown. */
export function verifyClaims(registry: SnapshotRegistry, refs: readonly ClaimRef[], allowedSnapshotKeys?: ReadonlySet<string>): VerifiedClaims {
  const claims: ResolvedClaim[] = [];
  const failures: { ref: ClaimRef; reason: string }[] = [];
  for (const ref of refs) {
    if (allowedSnapshotKeys && !allowedSnapshotKeys.has(ref.snapshotKey)) {
      failures.push({ ref, reason: 'snapshot not allowed for this answer' });
      continue;
    }
    const r = resolveClaim(registry, ref);
    if (r.ok) claims.push(r.claim);
    else failures.push({ ref, reason: r.reason });
  }
  return { ok: failures.length === 0, claims: failures.length === 0 ? claims : [], failures };
}
