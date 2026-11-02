import { DEMO_EXTRACTION } from '../../../shared/intake/fixture';
import { templatePaths } from '../../../shared/paths/templates';
import { buildProfile, type Profile } from '../../../shared/profile/profile';
import type { PathInput } from '../../../shared/engine/simulate';
import { SnapshotRegistry, buildSnapshot, type PathLetter, type RoomSnapshot } from '../../../shared/scene/room-model';
import type { ToolContext } from '../../../shared/scene/tools';

// One rehearsal session: the synthetic demo founder, the three template paths from the existing engine, and a registry
// of every snapshot built so far. Snapshots are immutable and cached by (path, stress), so the same inputs are never
// recomputed and never half-updated.

export const SYNTHETIC_WAGES_NOTE = 'Synthetic follow-up: R21,000 monthly wages (the demo story does not say; Parallax would ask).';

export interface Session {
  readonly sessionId: string;
  readonly profile: Profile;
  readonly profileRevision: number;
  readonly simulationVersion: number;
  readonly paths: Readonly<Record<PathLetter, { path: PathInput; name: string; summary: string }>>;
  readonly registry: SnapshotRegistry;
  snapshotFor(pathId: PathLetter, stressed: boolean): RoomSnapshot;
  toolContext(): ToolContext;
}

export function createSession(sessionId = 'demo'): Session {
  const profile = buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: SYNTHETIC_WAGES_NOTE } });
  const cards = templatePaths(profile);
  const paths = Object.fromEntries(cards.map((c) => [c.letter, { path: c as PathInput, name: c.name, summary: c.summary }])) as Session['paths'];
  const registry = new SnapshotRegistry();
  const cache = new Map<string, RoomSnapshot>();
  const profileRevision = 1;
  const simulationVersion = 1;

  const session: Session = {
    sessionId,
    profile,
    profileRevision,
    simulationVersion,
    paths,
    registry,
    snapshotFor(pathId, stressed) {
      const k = `${pathId}:${stressed ? 'late' : 'base'}`;
      const hit = cache.get(k);
      if (hit) return hit;
      const entry = paths[pathId];
      const snap = registry.add(
        buildSnapshot({
          sessionId,
          profileRevision,
          simulationVersion,
          pathId,
          pathName: entry.name,
          path: entry.path,
          case: 'likely',
          stress: stressed ? { id: 'late-payment' } : null,
        }),
      );
      cache.set(k, snap);
      return snap;
    },
    toolContext() {
      return { sessionId, profileRevision, simulationVersion, paths, registry };
    },
  };
  return session;
}
