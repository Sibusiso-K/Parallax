import { describe, expect, it } from 'vitest';
import { formatRand } from '../../../../shared/guard/figures';
import { createSession } from '../session';
import { buildReelPlan } from './reel-plan';

describe('snapshot-backed reel plan', () => {
  it('preserves snapshot identity, engine numbers and the shortfall warning', () => {
    const snapshot = createSession('reel-test').snapshotFor('B', true);
    const plan = buildReelPlan(snapshot, 4, 'contract');
    const money = formatRand;
    expect(plan.snapshotKey).toBe(snapshot.key);
    expect(plan.profileRevision).toBe(snapshot.ref.profileRevision);
    expect(plan.scenes[1]!.text).toContain(money(snapshot.active.rows[3]!.cash));
    expect(plan.scenes[1]!.text).toContain(money(snapshot.baseline.rows[3]!.cash));
    expect(plan.scenes[2]!.text).toContain('funding and survival are not modelled');
    expect(buildReelPlan(snapshot, 4, 'contract')).toEqual(plan);
  });
  it('rejects invalid months and invalid object ids', () => {
    const snapshot = createSession('reel-test').snapshotFor('B', false);
    expect(() => buildReelPlan(snapshot, 0, 'contract')).toThrow(RangeError);
    expect(() => buildReelPlan(snapshot, 1, 'other' as 'contract')).toThrow(RangeError);
  });
});
