import za from '../defaults/za.json' with { type: 'json' };
import { SETBACK_IDS, applySetback, lowestCash, setbackMonth, type SetbackId } from '../engine/analysis.js';
import { DEFAULT_MONTHS, simulate, type Assumption, type Case, type MonthRow, type PathInput } from '../engine/simulate.js';

// The room's single source of truth (docs/immersive/BUILD-SPEC.md section 5): an immutable, versioned projection over the
// existing engine. It packages results; it does no financial arithmetic of its own. Geometry, readings, evidence, the
// advisor's claims and the replay all read one snapshot, so a scenario can never be half-updated or mixed with another.

export type PathLetter = 'A' | 'B' | 'C';
export const ENGINE_VERSION = 'engine-founder-pivot-1';

export interface StressRef {
  id: SetbackId;
  /** The month the stress actually starts: the engine's default when none was asked for. */
  effectiveStartMonth: number;
}

export interface ScenarioRef {
  sessionId: string;
  profileRevision: number;
  simulationVersion: number;
  engineVersion: string;
  pathId: PathLetter;
  case: Case;
  setback: StressRef | null;
}

export interface Outcome {
  readonly rows: readonly MonthRow[];
  /** Absolute lowest month-end cash (earliest month on a tie). Not the setbackImpact delta. */
  readonly lowest: { readonly cash: number; readonly month: number };
  readonly firstShortfall: number | null;
  readonly shortfallMonths: readonly number[];
}

export interface Terms {
  /** First month a contract payment lands, from the path's own contract line; null when the path has no contract. */
  readonly firstReceiptMonth: number | null;
  /** Whole months between invoice and payment (30 days is one). */
  readonly paymentLagMonths: number | null;
  readonly addedDelayMonths: number;
  /** The engine's exact stress rule in words, or null for the baseline. */
  readonly stressRule: string | null;
}

export interface RoomSnapshot {
  readonly key: string;
  readonly inputHash: string;
  readonly ref: Readonly<ScenarioRef>;
  readonly pathName: string;
  readonly baseline: Outcome;
  /** The scenario on screen: the baseline when there is no stress, otherwise the stressed run. */
  readonly active: Outcome;
  readonly terms: Terms;
  /** The assumptions the active run used, including any stress lines. */
  readonly assumptions: readonly Readonly<Assumption>[];
  /** The assumptions of the unstressed baseline run. Baseline evidence must cite these, never the stress lines. */
  readonly baselineAssumptions: readonly Readonly<Assumption>[];
}

export interface SnapshotInput {
  sessionId: string;
  profileRevision: number;
  simulationVersion: number;
  pathId: PathLetter;
  pathName: string;
  path: PathInput;
  case: Case;
  stress?: { id: SetbackId; startMonth?: number } | null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

/** Canonical JSON: sorted keys, so the same inputs always hash the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(',')}}`;
}

/** FNV-1a, 32 bit: a cheap stable fingerprint of the inputs, not a security measure. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function outcome(rows: readonly MonthRow[], shortfallMonths: readonly number[], lowest: { cash: number; month: number }): Outcome {
  return { rows: rows.map((r) => ({ ...r })), lowest: { ...lowest }, firstShortfall: shortfallMonths[0] ?? null, shortfallMonths: [...shortfallMonths] };
}

/** The engine's late-payment rule, with the real numbers (see applySetback). */
export function lateStressRule(startMonth: number): string {
  const n = za.setbacks.latePaymentMonths;
  return `Receipts due in months ${startMonth} to ${startMonth + n - 1} are held back, then paid in months ${startMonth + n} to ${startMonth + 2 * n - 1}.`;
}

export function buildSnapshot(input: SnapshotInput): RoomSnapshot {
  const months = input.path.months ?? DEFAULT_MONTHS;
  let stressRef: StressRef | null = null;
  let activePath = input.path;
  if (input.stress) {
    const { id } = input.stress;
    if (!(SETBACK_IDS as readonly string[]).includes(id)) throw new RangeError(`Unknown stress: ${id}`);
    const start = input.stress.startMonth ?? setbackMonth(input.path, id);
    if (!Number.isInteger(start) || start < 1 || start > months) throw new RangeError(`Stress start month must be a whole number from 1 to ${months}`);
    stressRef = { id, effectiveStartMonth: start };
    activePath = applySetback(input.path, id, start);
  }

  const baseSim = simulate(input.path);
  const baseline = outcome(baseSim[input.case].rows, baseSim[input.case].shortfallMonths, lowestCash(baseSim, input.case));
  let active = baseline;
  if (stressRef) {
    const sim = simulate(activePath);
    active = outcome(sim[input.case].rows, sim[input.case].shortfallMonths, lowestCash(sim, input.case));
  }

  const contractMonths = input.path.assumptions.filter((a) => a.role === 'contract').map((a) => a.fromMonth ?? 1);
  const firstReceiptMonth = contractMonths.length > 0 ? Math.min(...contractMonths) : null;
  const terms: Terms = {
    firstReceiptMonth,
    paymentLagMonths: firstReceiptMonth === null ? null : firstReceiptMonth - 1,
    addedDelayMonths: stressRef?.id === 'late-payment' ? za.setbacks.latePaymentMonths : 0,
    stressRule: stressRef?.id === 'late-payment' ? lateStressRule(stressRef.effectiveStartMonth) : stressRef ? `Stress: ${stressRef.id}` : null,
  };

  const inputHash = fingerprint(
    canonicalJson({ startingCash: input.path.startingCash, months, assumptions: input.path.assumptions, case: input.case, stress: stressRef }),
  );
  const ref: ScenarioRef = {
    sessionId: input.sessionId,
    profileRevision: input.profileRevision,
    simulationVersion: input.simulationVersion,
    engineVersion: ENGINE_VERSION,
    pathId: input.pathId,
    case: input.case,
    setback: stressRef,
  };
  const key = [
    ref.sessionId,
    `r${ref.profileRevision}`,
    `v${ref.simulationVersion}`,
    ref.pathId,
    ref.case,
    stressRef ? `${stressRef.id}@${stressRef.effectiveStartMonth}` : 'baseline',
    inputHash,
  ].join('|');

  return deepFreeze({
    key,
    inputHash,
    ref,
    pathName: input.pathName,
    baseline,
    active,
    terms,
    assumptions: activePath.assumptions.map((a) => ({ ...a })),
    baselineAssumptions: input.path.assumptions.map((a) => ({ ...a })),
  });
}

/** Snapshots by key. A claim, a replay or a memo may only cite a snapshot that is registered here. */
export class SnapshotRegistry {
  private readonly map = new Map<string, RoomSnapshot>();
  add(s: RoomSnapshot): RoomSnapshot {
    this.map.set(s.key, s);
    return s;
  }
  get(key: string): RoomSnapshot | undefined {
    return this.map.get(key);
  }
  has(key: string): boolean {
    return this.map.has(key);
  }
}

export interface Ticket {
  readonly generation: number;
  readonly key: string;
}

/**
 * Protects against stale asynchronous work (B -> C -> B, double taps, a path switch while a reply is pending):
 * every relevant change starts a new generation, and a result is published only if its generation and its complete
 * snapshot key are still the current ones. Aborting is not enough, because aborted work can still resolve.
 */
export class RequestGate {
  private generation = 0;
  begin(snapshotKey: string): Ticket {
    this.generation += 1;
    return { generation: this.generation, key: snapshotKey };
  }
  /** Invalidate every pending ticket without starting new work (reset, navigation). */
  invalidate(): void {
    this.generation += 1;
  }
  isCurrent(ticket: Ticket, currentSnapshotKey: string): boolean {
    return ticket.generation === this.generation && ticket.key === currentSnapshotKey;
  }
}
