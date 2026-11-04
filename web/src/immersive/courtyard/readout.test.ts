import { describe, expect, it } from 'vitest';
import { resolveClaim } from '../../../../shared/scene/claims';
import { createSession } from '../session';
import { buildReadout } from './readout';

describe('what the objects in the room show', () => {
  const session = createSession('readout-test');
  const late = session.snapshotFor('B', true);

  it('says exactly what the panel says for the same snapshot and month', () => {
    const r = buildReadout(late, 4);
    const claim = (metric: 'cash_at_month' | 'lowest_cash' | 'cash_at_end', scenario: 'active' | 'baseline' = 'active') => {
      const out = resolveClaim(session.registry, { snapshotKey: late.key, scenario, metric, ...(metric === 'cash_at_month' ? { month: 4 } : {}) });
      if (!out.ok) throw new Error(out.reason);
      return out.claim.text;
    };
    expect(r.cash).toBe(claim('cash_at_month'));
    expect(r.baselineCash).toBe(claim('cash_at_month', 'baseline'));
    expect(r.lowest).toBe(claim('lowest_cash'));
    expect(r.end).toBe(claim('cash_at_end'));
    expect(r.below).toBe(late.active.rows[3]!.cash < 0);
    expect(r.shortfall).toBe(late.active.firstShortfall);
  });

  it('has no baseline line and no stress when the late payment is off', () => {
    const r = buildReadout(session.snapshotFor('B', false), 4);
    expect(r.baselineCash).toBeNull();
    expect(r.stressed).toBe(false);
  });

  it('never lists the stress lines as something the founder confirmed', () => {
    expect(buildReadout(late, 4).assumptions.some((a) => /late/i.test(a.label))).toBe(false);
  });

  it('gives the same readout every time', () => {
    expect(buildReadout(late, 7)).toEqual(buildReadout(late, 7));
  });
});
