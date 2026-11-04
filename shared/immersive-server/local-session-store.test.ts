import { describe, expect, it } from 'vitest';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import { buildProfile } from '../profile/profile.js';
import { templatePaths } from '../paths/templates.js';
import { buildSnapshot } from '../scene/room-model.js';
import { LocalVoiceSessionStore } from './local-session-store.js';

const card = templatePaths(buildProfile(DEMO_EXTRACTION))[1]!;
const snapshot = buildSnapshot({ sessionId: 'fixture', profileRevision: 1, simulationVersion: 1, pathId: 'B', pathName: card.name, path: card, case: 'likely' });
describe('local SQLite voice session prototype', () => {
  it('isolates bearers, recomputes claims, and invalidates on turn advance and revoke', () => {
    let now = 10_000; const store = new LocalVoiceSessionStore(() => now);
    try {
      const a = store.create(snapshot, 60_000); const b = store.create(snapshot, 60_000);
      const issued = store.issueAnswer(a.token, a.generation, 'cash', 4, new AbortController().signal)!;
      expect(issued.answer.text).toContain(issued.answer.claims[0]!.text);
      expect(store.loadAnswer(a.token, a.generation, issued.id)?.text).toBe(issued.answer.text);
      expect(store.loadAnswer(b.token, b.generation, issued.id)).toBeNull();
      const next = store.advance(a.token, a.generation)!;
      expect(store.advance(a.token, a.generation)).toBeNull();
      expect(store.loadAnswer(a.token, a.generation, issued.id)).toBeNull();
      expect(store.loadAnswer(a.token, next, issued.id)).toBeNull();
      const newer = store.issueAnswer(a.token, next, 'lowest', undefined, new AbortController().signal)!;
      expect(store.revoke(a.token)).toBe(true);
      expect(store.loadAnswer(a.token, next, newer.id)).toBeNull();
      expect(store.revoke(a.token)).toBe(false);
      now += 60_000; store.purge();
      expect(store.advance(b.token, b.generation)).toBeNull();
    } finally { store.close(); }
  });
  it('rejects invalid scope inputs, stale or aborted writes and expires answers independently', () => {
    let now = 1; const store = new LocalVoiceSessionStore(() => now);
    try {
      expect(() => store.create(snapshot, 0)).toThrow();
      const s = store.create(snapshot, 600_000); const controller = new AbortController(); controller.abort();
      expect(store.issueAnswer(s.token, s.generation, 'cash', 4, controller.signal)).toBeNull();
      expect(store.issueAnswer(s.token, 'stale', 'cash', 4, new AbortController().signal)).toBeNull();
      expect(store.issueAnswer(s.token, s.generation, 'cash', 37, new AbortController().signal)).toBeNull();
      expect(store.issueAnswer(s.token, s.generation, 'fake' as 'cash', 4, new AbortController().signal)).toBeNull();
      const answer = store.issueAnswer(s.token, s.generation, 'lowest', undefined, new AbortController().signal)!;
      now += 300_000;
      expect(store.loadAnswer(s.token, s.generation, answer.id)).toBeNull();
      expect(store.advance(s.token, s.generation)).not.toBeNull();
    } finally { store.close(); }
  });
});
