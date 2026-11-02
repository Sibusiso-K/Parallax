import { DEMO_EXTRACTION } from '../../../shared/intake/fixture';
import { templatePaths } from '../../../shared/paths/templates';
import { buildProfile, type Profile } from '../../../shared/profile/profile';
import { editAssumption, type Edit, type PathInput } from '../../../shared/engine/simulate';
import { SnapshotRegistry, buildSnapshot, type PathLetter, type RoomSnapshot } from '../../../shared/scene/room-model';
import type { ToolContext } from '../../../shared/scene/tools';

// One rehearsal session: the synthetic demo founder, the three template paths from the existing engine, and a registry
// of every snapshot built so far. Snapshots are immutable and cached by (path, stress), so the same inputs are never
// recomputed and never half-updated. An edit to an assumption makes a NEW session revision; the registry is shared so
// earlier answers and evidence still resolve, but they are marked historical because their snapshot belongs to an older revision.

export const SYNTHETIC_WAGES_NOTE = 'Synthetic follow-up: R21,000 monthly wages (the demo story does not say; Parallax would ask).';

type PathEntry = { path: PathInput; name: string; summary: string };

export interface Session {
  readonly sessionId: string;
  readonly profile: Profile;
  readonly profileRevision: number;
  readonly simulationVersion: number;
  readonly paths: Readonly<Record<PathLetter, PathEntry>>;
  readonly registry: SnapshotRegistry;
  snapshotFor(pathId: PathLetter, stressed: boolean): RoomSnapshot;
  toolContext(): ToolContext;
  /** Edit one assumption on one path. Returns a new session revision, or the engine's refusal. */
  revise(pathId: PathLetter, assumptionId: string, edit: Edit): { ok: true; session: Session } | { ok: false; error: string };
}

function make(sessionId: string, profile: Profile, paths: Record<PathLetter, PathEntry>, registry: SnapshotRegistry, profileRevision: number): Session {
  const simulationVersion = profileRevision;
  const cache = new Map<string, RoomSnapshot>();
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
    revise(pathId, assumptionId, edit) {
      const entry = paths[pathId];
      const r = editAssumption(entry.path, assumptionId, edit);
      if (!r.ok) return r;
      const next = { ...paths, [pathId]: { ...entry, path: r.path } } as Record<PathLetter, PathEntry>;
      return { ok: true, session: make(sessionId, profile, next, registry, profileRevision + 1) };
    },
  };
  return session;
}

export function createSession(sessionId = 'demo'): Session {
  const profile = buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: SYNTHETIC_WAGES_NOTE } });
  const cards = templatePaths(profile);
  const paths = Object.fromEntries(cards.map((c) => [c.letter, { path: c as PathInput, name: c.name, summary: c.summary }])) as Record<PathLetter, PathEntry>;
  return make(sessionId, profile, paths, new SnapshotRegistry(), 1);
}
