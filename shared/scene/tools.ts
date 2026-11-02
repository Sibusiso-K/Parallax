import { z } from 'zod';
import { SETBACK_IDS } from '../engine/analysis.js';
import type { Case, PathInput } from '../engine/simulate.js';
import type { ClaimRef } from './claims.js';
import { buildSnapshot, type PathLetter, type RoomSnapshot, type SnapshotRegistry } from './room-model.js';

// The advisor's tools (AGENT_TOOLS_AND_STACK.md Part A). Each is a thin wrapper over code that already exists.
// Session, path, case and version come from the trusted scope, never from the model's arguments: the schemas are strict,
// so an argument such as pathId or case is rejected rather than ignored. A trace line exists only for a call that ran.

export interface ToolContext {
  sessionId: string;
  profileRevision: number;
  simulationVersion: number;
  paths: Readonly<Record<PathLetter, { path: PathInput; name: string }>>;
  registry: SnapshotRegistry;
  /** Injectable clock so traces are testable; defaults to performance.now. */
  now?: () => number;
}

export interface ToolScope {
  pathId: PathLetter;
  case: Case;
  /** The snapshot the founder is looking at. */
  snapshotKey: string;
}

export interface TraceLine {
  tool: string;
  ok: boolean;
  ms: number;
  /** What actually happened, in plain words. Never a claim about a model. */
  detail: string;
  snapshotKey: string | null;
}

export type ToolOutcome =
  | { ok: true; tool: 'inspect_month' | 'run_stress'; snapshot: RoomSnapshot; claimRefs: ClaimRef[]; trace: TraceLine }
  | { ok: false; error: string; trace: TraceLine };

const inspectArgs = z.object({ month: z.number().int().min(1).max(36) }).strict();
const stressArgs = z.object({ setbackId: z.enum(SETBACK_IDS), startMonth: z.number().int().min(1).max(36).optional() }).strict();

export function runTool(ctx: ToolContext, scope: ToolScope, call: { name: string; args: unknown }): ToolOutcome {
  const now = ctx.now ?? (() => performance.now());
  const t0 = now();
  const fail = (error: string): ToolOutcome => ({ ok: false, error, trace: { tool: call.name, ok: false, ms: Math.round(now() - t0), detail: error, snapshotKey: null } });
  const current = ctx.registry.get(scope.snapshotKey);
  if (!current) return fail('unknown snapshot');
  if (current.ref.pathId !== scope.pathId || current.ref.case !== scope.case) return fail('scope does not match the snapshot');
  const entry = ctx.paths[scope.pathId];

  if (call.name === 'inspect_month') {
    const a = inspectArgs.safeParse(call.args);
    if (!a.success) return fail('invalid arguments');
    const refs: ClaimRef[] = (['cash_at_month', 'net_at_month'] as const).map((metric) => ({ snapshotKey: current.key, scenario: 'active', metric, month: a.data.month }));
    return { ok: true, tool: 'inspect_month', snapshot: current, claimRefs: refs, trace: { tool: 'inspect_month', ok: true, ms: Math.round(now() - t0), detail: `Read month ${a.data.month} of the current snapshot`, snapshotKey: current.key } };
  }

  if (call.name === 'run_stress') {
    const a = stressArgs.safeParse(call.args);
    if (!a.success) return fail('invalid arguments');
    // Always from the unstressed path: a stress is never stacked on one that is already applied.
    let snap: RoomSnapshot;
    try {
      snap = ctx.registry.add(
        buildSnapshot({
          sessionId: ctx.sessionId,
          profileRevision: ctx.profileRevision,
          simulationVersion: ctx.simulationVersion,
          pathId: scope.pathId,
          pathName: entry.name,
          path: entry.path,
          case: scope.case,
          stress: { id: a.data.setbackId, startMonth: a.data.startMonth },
        }),
      );
    } catch (e) {
      return fail(e instanceof RangeError ? e.message : 'could not run the stress');
    }
    const refs: ClaimRef[] = [
      { snapshotKey: snap.key, scenario: 'baseline', metric: 'lowest_cash' },
      { snapshotKey: snap.key, scenario: 'active', metric: 'lowest_cash' },
      { snapshotKey: snap.key, scenario: 'active', metric: 'first_shortfall' },
    ];
    return {
      ok: true,
      tool: 'run_stress',
      snapshot: snap,
      claimRefs: refs,
      trace: { tool: 'run_stress', ok: true, ms: Math.round(now() - t0), detail: `Ran the engine with ${a.data.setbackId} from month ${snap.ref.setback!.effectiveStartMonth} on path ${scope.pathId}`, snapshotKey: snap.key },
    };
  }
  return fail('unknown tool');
}
