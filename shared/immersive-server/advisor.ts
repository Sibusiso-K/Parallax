import { verifyClaims, type ClaimRef, type ResolvedClaim } from '../scene/claims.js';
import type { PathLetter, SnapshotRegistry } from '../scene/room-model.js';

// Server-only building block. The host must derive this scope from authenticated,
// current server state, never from a request body or the snapshot fingerprint alone.
export interface BoundScope {
  sessionId: string;
  profileRevision: number;
  snapshotKey: string;
  pathId: PathLetter;
}
export type FixtureIntent = 'cash' | 'lowest' | 'shortfall';
export interface ApprovedAnswer {
  readonly mode: 'fixture';
  readonly snapshotKey: string;
  readonly profileRevision: number;
  readonly claims: readonly ResolvedClaim[];
  readonly text: string;
}
export type AdvisorResult = { ok: true; answer: ApprovedAnswer } | { ok: false; reason: 'scope' | 'input' | 'claim' };

/** All visible and spoken figures come from ClaimRef; no model prose is accepted. */
export function fixtureAnswer(registry: SnapshotRegistry, scope: BoundScope, intent: FixtureIntent, month?: number): AdvisorResult {
  const snap = registry.get(scope.snapshotKey);
  if (!snap || snap.ref.sessionId !== scope.sessionId || snap.ref.profileRevision !== scope.profileRevision || snap.ref.pathId !== scope.pathId) return { ok: false, reason: 'scope' };
  if (!['cash', 'lowest', 'shortfall'].includes(intent)) return { ok: false, reason: 'input' };
  const metric = intent === 'cash' ? 'cash_at_month' : intent === 'lowest' ? 'lowest_cash' : 'first_shortfall';
  const ref: ClaimRef = { snapshotKey: scope.snapshotKey, scenario: 'active', metric, ...(intent === 'cash' ? { month } : {}) };
  const checked = verifyClaims(registry, [ref], new Set([scope.snapshotKey]));
  if (!checked.ok || !checked.claims[0]) return { ok: false, reason: 'claim' };
  const claim = checked.claims[0];
  const text = `${claim.label}: ${claim.text}. ${claim.qualification ?? ''}`.trim();
  return { ok: true, answer: { mode: 'fixture', snapshotKey: scope.snapshotKey, profileRevision: scope.profileRevision, claims: checked.claims, text } };
}
