import { describe, expect, it } from 'vitest';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import { buildProfile } from '../profile/profile.js';
import { templatePaths } from '../paths/templates.js';
import { resolveClaim, verifyClaims } from './claims.js';
import { RequestGate, SnapshotRegistry, buildSnapshot, canonicalJson, type PathLetter } from './room-model.js';
import { runTool, type ToolContext } from './tools.js';

// The synthetic caterer plus R21,000 wages: the same input the handoff's engine evidence used.
const profile = buildProfile({ ...DEMO_EXTRACTION, payroll: { low: 21000, high: 21000, quote: 'Synthetic follow-up: R21,000 monthly wages' } });
const cards = templatePaths(profile);
const byLetter = Object.fromEntries(cards.map((c) => [c.letter, { path: c, name: c.name }])) as Record<PathLetter, { path: (typeof cards)[number]; name: string }>;
const base = { sessionId: 's1', profileRevision: 1, simulationVersion: 1, case: 'likely' as const };
const snap = (id: PathLetter, stress?: { id: 'late-payment'; startMonth?: number }) =>
  buildSnapshot({ ...base, pathId: id, pathName: byLetter[id].name, path: byLetter[id].path, stress });

describe('room snapshot', () => {
  it('matches the engine evidence for B: baseline low R33,000 in month 2, delayed run out in month 4', () => {
    const b = snap('B');
    expect(b.baseline.lowest).toEqual({ cash: 33000, month: 2 });
    expect(b.baseline.rows[35]!.cash).toBe(479000);
    expect(b.active).toBe(b.baseline);
    const s = snap('B', { id: 'late-payment' });
    expect(s.ref.setback).toEqual({ id: 'late-payment', effectiveStartMonth: 3 });
    expect(s.active.lowest).toEqual({ cash: -29000, month: 4 });
    expect(s.active.firstShortfall).toBe(4);
    expect(s.baseline.lowest).toEqual({ cash: 33000, month: 2 });
    expect(s.terms.addedDelayMonths).toBe(2);
    expect(s.terms.stressRule).toBe('Receipts due in months 3 to 4 are held back, then paid in months 5 to 6.');
  });

  it('matches the evidence for C and A (the absolute stressed low, not the delta)', () => {
    const c = snap('C', { id: 'late-payment' });
    expect(c.baseline.lowest).toEqual({ cash: 87750, month: 1 });
    expect(c.active.lowest).toEqual({ cash: 23250, month: 3 });
    expect(c.active.firstShortfall).toBeNull();
    const a = snap('A', { id: 'late-payment' });
    expect(a.baseline.lowest).toEqual({ cash: 121500, month: 1 });
    expect(a.active.lowest).toEqual({ cash: 98100, month: 7 });
    expect(snap('A').baseline.rows[35]!.cash).toBe(174000);
  });

  it('is frozen, deterministic and keyed by its inputs', () => {
    const a = snap('B', { id: 'late-payment' });
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.active.rows)).toBe(true);
    expect(Object.isFrozen(a.active.rows[0])).toBe(true);
    expect(() => ((a.active.rows as unknown as { cash: number }[])[0]!.cash = 1)).toThrow();
    expect(snap('B', { id: 'late-payment' }).key).toBe(a.key);
    expect(snap('B').key).not.toBe(a.key);
    expect(snap('C', { id: 'late-payment' }).key).not.toBe(a.key);
    const edited = { ...byLetter.B.path, assumptions: byLetter.B.path.assumptions.map((x) => (x.id === 'B1' ? { ...x, base: x.base + 1 } : x)) };
    const e = buildSnapshot({ ...base, pathId: 'B', pathName: 'B', path: edited });
    expect(e.inputHash).not.toBe(snap('B').inputHash);
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });

  it('does not stack a stress on a stressed path, and rejects a bad start month', () => {
    const once = snap('B', { id: 'late-payment' });
    expect(once.assumptions.filter((x) => x.role === 'setback').length).toBe(2);
    expect(() => snap('B', { id: 'late-payment', startMonth: 99 })).toThrow(RangeError);
    expect(() => snap('B', { id: 'late-payment', startMonth: 0 })).toThrow(RangeError);
    expect(() => buildSnapshot({ ...base, pathId: 'B', pathName: 'B', path: byLetter.B.path, stress: { id: 'nope' as 'late-payment' } })).toThrow(RangeError);
  });
});

describe('stale-result gate', () => {
  it('rejects an old B answer after B -> C -> B', () => {
    const gate = new RequestGate();
    const b = snap('B').key;
    const c = snap('C').key;
    const first = gate.begin(b);
    gate.begin(c);
    const third = gate.begin(b);
    expect(gate.isCurrent(first, b)).toBe(false);
    expect(gate.isCurrent(third, b)).toBe(true);
    expect(gate.isCurrent(third, c)).toBe(false);
    gate.invalidate();
    expect(gate.isCurrent(third, b)).toBe(false);
  });
});

describe('claims', () => {
  const registry = new SnapshotRegistry();
  const s = registry.add(snap('B', { id: 'late-payment' }));

  it('resolves figures from the right scenario and formats them in code', () => {
    const low = resolveClaim(registry, { snapshotKey: s.key, scenario: 'active', metric: 'lowest_cash' });
    expect(low.ok && low.claim.text).toBe('-R29,000');
    expect(low.ok && low.claim.scenarioLabel).toBe('Late payment from month 3');
    const base = resolveClaim(registry, { snapshotKey: s.key, scenario: 'baseline', metric: 'lowest_cash' });
    expect(base.ok && base.claim.text).toBe('R33,000');
    expect(base.ok && base.claim.scenarioLabel).toBe('Baseline');
    const out = resolveClaim(registry, { snapshotKey: s.key, scenario: 'active', metric: 'first_shortfall' });
    expect(out.ok && out.claim.text).toBe('month 4');
    expect(out.ok && out.claim.qualification).toMatch(/does not model/);
  });

  it('qualifies later months and says "no shortfall" when there is none', () => {
    const end = resolveClaim(registry, { snapshotKey: s.key, scenario: 'active', metric: 'cash_at_end' });
    expect(end.ok && end.claim.qualification).toBeTruthy();
    const c = registry.add(snap('C', { id: 'late-payment' }));
    const none = resolveClaim(registry, { snapshotKey: c.key, scenario: 'active', metric: 'first_shortfall' });
    expect(none.ok && none.claim.text).toBe('no shortfall within 36 months');
    expect(none.ok && none.claim.qualification).toBeUndefined();
  });

  it('fails closed: unknown snapshot, bad month, unknown metric, disallowed snapshot', () => {
    expect(resolveClaim(registry, { snapshotKey: 'nope', scenario: 'active', metric: 'lowest_cash' }).ok).toBe(false);
    expect(resolveClaim(registry, { snapshotKey: s.key, scenario: 'active', metric: 'cash_at_month', month: 37 }).ok).toBe(false);
    expect(resolveClaim(registry, { snapshotKey: s.key, scenario: 'active', metric: 'cash_at_month' }).ok).toBe(false);
    expect(resolveClaim(registry, { snapshotKey: s.key, scenario: 'active', metric: 'made_up' as 'lowest_cash' }).ok).toBe(false);
    const good = { snapshotKey: s.key, scenario: 'active' as const, metric: 'lowest_cash' as const };
    const bad = { ...good, metric: 'cash_at_month' as const, month: 0 };
    const v = verifyClaims(registry, [good, bad]);
    expect(v.ok).toBe(false);
    expect(v.claims).toEqual([]);
    expect(verifyClaims(registry, [good], new Set(['other'])).ok).toBe(false);
    expect(verifyClaims(registry, [good], new Set([s.key])).ok).toBe(true);
  });
});

describe('tools', () => {
  const registry = new SnapshotRegistry();
  const start = registry.add(snap('B'));
  const ctx: ToolContext = { sessionId: 's1', profileRevision: 1, simulationVersion: 1, paths: byLetter, registry, now: () => 0 };
  const scope = { pathId: 'B' as const, case: 'likely' as const, snapshotKey: start.key };

  it('run_stress runs the real engine, registers the snapshot and returns claim references, not numbers', () => {
    const r = runTool(ctx, scope, { name: 'run_stress', args: { setbackId: 'late-payment' } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(registry.has(r.snapshot.key)).toBe(true);
    expect(r.snapshot.active.firstShortfall).toBe(4);
    expect(r.claimRefs.map((c) => c.metric)).toEqual(['lowest_cash', 'lowest_cash', 'first_shortfall']);
    expect(r.trace.ok).toBe(true);
    expect(r.trace.detail).toMatch(/Ran the engine with late-payment from month 3 on path B/);
  });

  it('refuses model-supplied scope, unknown tools and bad arguments (injection)', () => {
    for (const args of [{ setbackId: 'late-payment', pathId: 'C' }, { setbackId: 'late-payment', case: 'good' }, { setbackId: 'rm -rf' }, { setbackId: 'late-payment', startMonth: 99 }, 'late-payment']) {
      const r = runTool(ctx, scope, { name: 'run_stress', args });
      expect(r.ok, JSON.stringify(args)).toBe(false);
      expect(r.trace.ok).toBe(false);
    }
    expect(runTool(ctx, scope, { name: 'send_email', args: {} }).ok).toBe(false);
    expect(runTool(ctx, { ...scope, pathId: 'C' }, { name: 'inspect_month', args: { month: 4 } }).ok).toBe(false);
    expect(runTool(ctx, { ...scope, snapshotKey: 'nope' }, { name: 'inspect_month', args: { month: 4 } }).ok).toBe(false);
  });

  it('inspect_month reads the current snapshot and nothing else', () => {
    const r = runTool(ctx, scope, { name: 'inspect_month', args: { month: 4 } });
    expect(r.ok && r.snapshot.key).toBe(start.key);
    expect(runTool(ctx, scope, { name: 'inspect_month', args: { month: 0 } }).ok).toBe(false);
  });
});
