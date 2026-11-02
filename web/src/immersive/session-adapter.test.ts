import { describe, expect, it } from 'vitest';
import { lowestCash } from '../../../shared/engine/analysis';
import { DEMO_EXTRACTION } from '../../../shared/intake/fixture';
import { SnapshotRegistry, type PathLetter } from '../../../shared/scene/room-model';
import { FIELD_DEFAULTS, mockApi } from '../lib/parallax-api';
import { pathFigures } from '../lib/stress';
import { applyPatch } from '../lib/store-patch';
import type { FieldKey, PathCard, Profile } from '../lib/types';
import { memoFooter } from './memo';
import { buildReplay } from './replay';
import { DEMO_SESSION_ID } from './session';
import { exploreSession, reviseCards } from './session-adapter';

const LETTERS: PathLetter[] = ['A', 'B', 'C'];
const TITLE = 'Take on a 12-month corporate lunch contract';

/**
 * The store's fields after the flow in the 2 Nov recording: the demo story read by intake, the decision type
 * chosen, and "I don't know" for staff wages, which leaves wages to the za.json default and marks them assumed.
 */
function recordedProfile(): Profile {
  const fields: Partial<Record<FieldKey, unknown>> = { decisionType: 'contract', payroll: FIELD_DEFAULTS.payroll };
  for (const [key, field] of Object.entries(DEMO_EXTRACTION) as [FieldKey, unknown][]) {
    if (field && typeof field === 'object' && 'low' in field) fields[key] = field;
    else if (field && typeof field === 'object' && 'value' in field) {
      const v = (field as { value: unknown }).value;
      fields[key] = Array.isArray(v) ? v.join(', ') : v;
    }
  }
  return { fields, assumed: ['payroll'] };
}

const cards = () => mockApi.paths(recordedProfile());
const cash = (rows: readonly { cash: number }[]) => rows.map((r) => r.cash);

function confirmed(paths: PathCard[], revision = 1, registry = new SnapshotRegistry()) {
  const r = exploreSession({ kind: 'confirmed', sessionId: 'decision-1', revision, title: TITLE, paths, selectedPath: 'B' }, registry);
  if (!r.ok) throw new Error(r.reason);
  return r.session;
}

describe('Explore session from a confirmed decision', () => {
  it("builds the room from the store's own path cards, not from a recomputed profile", async () => {
    const paths = await cards();
    const s = confirmed(paths);
    expect(s.mode).toBe('confirmed');
    expect(s.profile).toBeNull();
    expect(s.title).toBe(TITLE);
    for (const l of LETTERS) expect(s.paths[l].path).toBe(paths.find((p) => p.letter === l));
  });

  it("carries the founder's confirmed wages, not the demo's synthetic R21,000", async () => {
    const s = confirmed(await cards());
    const demo = exploreSession({ kind: 'demo' });
    if (!demo.ok) throw new Error(demo.reason);
    const wages = (p: { assumptions: readonly { label: string; base: number }[] }) => p.assumptions.find((a) => /staff wages/i.test(a.label))?.base;
    expect(wages(s.paths.B.path)).toBe(15000);
    expect(wages(demo.session.paths.B.path)).toBe(21000);
  });

  it('shows the same figures as the regular screens for identical inputs, baseline and late payment', async () => {
    const paths = await cards();
    const s = confirmed(paths);
    for (const card of paths) {
      const sim = mockApi.simulate(card);
      const base = s.snapshotFor(card.letter, false);
      expect(cash(base.baseline.rows)).toEqual(cash(sim.likely.rows));
      expect(base.baseline.lowest).toEqual(lowestCash(sim, 'likely'));
      const late = pathFigures(card).late;
      const stressed = s.snapshotFor(card.letter, true);
      expect([card.startingCash, ...cash(stressed.active.rows)]).toEqual(late.line);
      expect(stressed.active.lowest).toEqual(late.lowest);
      expect(stressed.active.firstShortfall).toBe(late.runsOut);
    }
  });

  it('reproduces what the live app showed for this profile (recording frame at 140 s)', async () => {
    const s = confirmed(await cards());
    // docs/immersive/execution-v1/evidence/recording-140s.png: "likely R695 000" at month 36; "Late payment: -R5 000 in month 4".
    expect(s.snapshotFor('B', false).baseline.rows[35]!.cash).toBe(695000);
    const late = s.snapshotFor('B', true).active;
    expect(late.lowest).toEqual({ cash: -5000, month: 4 });
    expect(late.firstShortfall).toBe(4);
  });
});

describe('one revision across both surfaces', () => {
  it('an edit in the assumptions panel starts a new revision and the room recomputes from it', async () => {
    const paths = await cards();
    const registry = new SnapshotRegistry();
    const before = confirmed(paths, 1, registry).snapshotFor('B', false);
    const fridge = paths.find((p) => p.letter === 'B')!.assumptions.find((a) => /equipment/i.test(a.label))!;
    // The panel's own update (AssumptionRow.save): the line becomes the founder's.
    const edited = paths.map((p) =>
      p.letter !== 'B' ? p : { ...p, assumptions: p.assumptions.map((a) => (a.id === fridge.id ? { ...a, low: 45000, base: 45000, high: 45000, source: 'you' as const } : a)) },
    );
    const store = applyPatch({ paths, revision: 1, step: 'explore' }, { paths: edited });
    expect(store.revision).toBe(2);
    const after = confirmed(store.paths, store.revision, registry).snapshotFor('B', false);
    expect(after.ref.profileRevision).toBe(2);
    expect(after.key).not.toBe(before.key);
    expect(cash(after.baseline.rows)).toEqual(cash(mockApi.simulate(store.paths.find((p) => p.letter === 'B')!).likely.rows));
    expect(after.baseline.lowest.cash).toBeLessThan(before.baseline.lowest.cash);
    expect(registry.get(before.key)?.ref.profileRevision).toBe(1);
  });

  it('an edit in the room goes through the store, with the engine refusing invalid values', async () => {
    const paths = await cards();
    const fridge = paths.find((p) => p.letter === 'B')!.assumptions.find((a) => /equipment/i.test(a.label))!;
    const r = reviseCards(paths, 'B', fridge.id, { low: 45000, base: 45000, high: 45000 });
    if (!r.ok) throw new Error(r.error);
    expect(r.paths.find((p) => p.letter === 'A')).toBe(paths.find((p) => p.letter === 'A'));
    expect(r.paths.find((p) => p.letter === 'C')).toBe(paths.find((p) => p.letter === 'C'));
    const line = r.paths.find((p) => p.letter === 'B')!.assumptions.find((a) => a.id === fridge.id)!;
    expect(line).toMatchObject({ low: 45000, base: 45000, high: 45000, source: 'you' });
    const room = confirmed(r.paths, 2).snapshotFor('B', true);
    expect([r.paths.find((p) => p.letter === 'B')!.startingCash, ...cash(room.active.rows)]).toEqual(pathFigures(r.paths.find((p) => p.letter === 'B')!).late.line);
    expect(reviseCards(paths, 'B', fridge.id, { low: 10, base: 5, high: 20 }).ok).toBe(false);
    expect(reviseCards(paths, 'B', 'no-such-line', { low: 1, base: 1, high: 1 }).ok).toBe(false);
  });

  it('only a change to the path cards moves the revision; leaving and re-entering keeps the selection', async () => {
    const paths = await cards();
    const inExplore = { paths, revision: 3, step: 'explore', active: 'C', explore: { stressed: { A: false, B: true, C: false }, month: 7 } };
    const left = applyPatch(inExplore, { step: 'compare' });
    const back = applyPatch(left, { step: 'explore' });
    expect(back.revision).toBe(3);
    expect(back.active).toBe('C');
    expect(back.explore).toBe(inExplore.explore);
    expect(applyPatch(back, {})).toBe(back);
    expect(applyPatch(back, { paths }).revision).toBe(3);
  });

  it('replay and memo wording follow the session, not the demo story', async () => {
    const s = confirmed(await cards());
    expect(buildReplay(s).shots[0]!.line.startsWith(TITLE)).toBe(true);
    expect(buildReplay(s).shots[0]!.line).not.toMatch(/Ayanda/);
    expect(memoFooter(s)).not.toMatch(/fictional/i);
    const demo = exploreSession({ kind: 'demo' });
    if (!demo.ok) throw new Error(demo.reason);
    expect(memoFooter(demo.session)).toMatch(/fictional/i);
  });
});

describe('the demo founder stays separate', () => {
  it('refuses an incomplete or mislabelled confirmed decision instead of falling back to the demo', async () => {
    const paths = await cards();
    const base = { kind: 'confirmed' as const, sessionId: 'decision-1', revision: 1, title: TITLE, paths, selectedPath: 'B' as const };
    expect(exploreSession({ ...base, sessionId: DEMO_SESSION_ID }).ok).toBe(false);
    expect(exploreSession({ ...base, sessionId: '' }).ok).toBe(false);
    expect(exploreSession({ ...base, revision: 0 }).ok).toBe(false);
    expect(exploreSession({ ...base, revision: 1.5 }).ok).toBe(false);
    expect(exploreSession({ ...base, paths: paths.filter((p) => p.letter !== 'C') }).ok).toBe(false);
    expect(exploreSession({ ...base, paths: [] }).ok).toBe(false);
  });

  it('never shares ids, keys, registries or inputs with a confirmed decision', async () => {
    const paths = await cards();
    const before = JSON.stringify(paths);
    const registry = new SnapshotRegistry();
    const s = confirmed(paths, 1, registry);
    const demo = exploreSession({ kind: 'demo' });
    if (!demo.ok) throw new Error(demo.reason);
    expect(demo.session.mode).toBe('demo');
    expect(demo.session.sessionId).toBe(DEMO_SESSION_ID);
    expect(demo.session.registry).not.toBe(registry);
    for (const l of LETTERS) {
      for (const stressed of [false, true]) {
        const mine = s.snapshotFor(l, stressed);
        const theirs = demo.session.snapshotFor(l, stressed);
        expect(mine.key.startsWith('decision-1|')).toBe(true);
        expect(theirs.key.startsWith('demo|')).toBe(true);
        expect(registry.has(theirs.key)).toBe(false);
      }
    }
    expect(JSON.stringify(paths)).toBe(before);
  });
});
