import { resolveClaim, type ClaimRef, type ResolvedClaim } from '../../../shared/scene/claims';
import type { PathLetter } from '../../../shared/scene/room-model';
import type { Session } from './session';

// The 15-second replay (BUILD-SPEC section 9): a deterministic camera and caption track over FROZEN snapshots, played in
// the browser. It is not exported video. Editing the profile later marks a replay "historical" instead of relabelling it.

export type CameraStation = 'contract' | 'bridge' | 'marker' | 'memo';

export interface Shot {
  id: string;
  title: string;
  durationMs: number;
  pathId: PathLetter;
  stressed: boolean;
  month: number;
  station: CameraStation;
  snapshotKey: string;
  /** Plain words written in code from the engine's own labels, not model output. */
  line: string;
  claimRefs: ClaimRef[];
}

export interface Replay {
  readonly shots: readonly Shot[];
  readonly totalMs: number;
  readonly profileRevision: number;
  readonly simulationVersion: number;
  readonly createdAt: string;
}

export function buildReplay(session: Session, now: () => Date = () => new Date()): Replay {
  const b0 = session.snapshotFor('B', false);
  const b1 = session.snapshotFor('B', true);
  const c1 = session.snapshotFor('C', true);
  const first = b1.active.firstShortfall;
  const shots: Shot[] = [
    { id: 'offer', title: 'The offer', durationMs: 3000, pathId: 'B', stressed: false, month: 1, station: 'contract', snapshotKey: b0.key,
      line: 'Should Ayanda take the 12-month corporate lunch contract? The client pays 60 days after each invoice.', claimRefs: [] },
    { id: 'b-baseline', title: 'B: take it as offered', durationMs: 4000, pathId: 'B', stressed: false, month: b0.baseline.lowest.month, station: 'bridge', snapshotKey: b0.key,
      line: 'Baseline: the lowest cash on this path.', claimRefs: [{ snapshotKey: b0.key, scenario: 'baseline', metric: 'lowest_cash' }] },
    { id: 'b-late', title: 'B: the client pays late', durationMs: 3000, pathId: 'B', stressed: true, month: first ?? b1.active.lowest.month, station: 'marker', snapshotKey: b1.key,
      line: `${b1.terms.stressRule ?? ''} Cash first runs out in:`, claimRefs: [{ snapshotKey: b1.key, scenario: 'active', metric: 'first_shortfall' }] },
    { id: 'c-late', title: 'C: same rule, safer terms', durationMs: 3000, pathId: 'C', stressed: true, month: c1.active.lowest.month, station: 'bridge', snapshotKey: c1.key,
      line: 'The same late-payment rule on path C. The lowest cash is:', claimRefs: [{ snapshotKey: c1.key, scenario: 'active', metric: 'lowest_cash' }, { snapshotKey: c1.key, scenario: 'active', metric: 'first_shortfall' }] },
    { id: 'decision', title: 'Your call', durationMs: 2000, pathId: 'C', stressed: false, month: 1, station: 'memo', snapshotKey: session.snapshotFor('C', false).key,
      line: 'Which would you choose? Write it in your own words. One possible future, not a prediction.', claimRefs: [] },
  ];
  return Object.freeze({
    shots: Object.freeze(shots.map((s) => Object.freeze(s))),
    totalMs: shots.reduce((t, s) => t + s.durationMs, 0),
    profileRevision: session.profileRevision,
    simulationVersion: session.simulationVersion,
    createdAt: now().toISOString(),
  });
}

export function resolveShot(session: Session, shot: Shot): ResolvedClaim[] {
  const out: ResolvedClaim[] = [];
  for (const ref of shot.claimRefs) {
    const r = resolveClaim(session.registry, ref);
    if (r.ok) out.push(r.claim);
  }
  return out;
}

export function isOutdated(replay: Replay, session: Session): boolean {
  return replay.profileRevision !== session.profileRevision || replay.simulationVersion !== session.simulationVersion;
}

/** The shot playing at time t (clamped), and how far into it. */
export function shotAt(replay: Replay, tMs: number): { index: number; shot: Shot; intoMs: number } {
  const t = Math.max(0, Math.min(tMs, replay.totalMs - 1));
  let acc = 0;
  for (let i = 0; i < replay.shots.length; i++) {
    const s = replay.shots[i]!;
    if (t < acc + s.durationMs) return { index: i, shot: s, intoMs: t - acc };
    acc += s.durationMs;
  }
  const last = replay.shots.length - 1;
  return { index: last, shot: replay.shots[last]!, intoMs: replay.shots[last]!.durationMs };
}

export function shotStart(replay: Replay, index: number): number {
  let acc = 0;
  for (let i = 0; i < index; i++) acc += replay.shots[i]!.durationMs;
  return acc;
}
