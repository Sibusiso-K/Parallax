import { describe, expect, it, vi } from 'vitest';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import { buildProfile } from '../profile/profile.js';
import { templatePaths } from '../paths/templates.js';
import { buildSnapshot, SnapshotRegistry } from '../scene/room-model.js';
import { createRoutes, routeConfig, type RequestContext, type RouteHost } from './http.js';
import type { ApprovedAnswer } from './advisor.js';

const card = templatePaths(buildProfile(DEMO_EXTRACTION))[1]!;
const registry = new SnapshotRegistry();
const snap = registry.add(buildSnapshot({ sessionId: 'session-one', profileRevision: 1, simulationVersion: 1, pathId: 'B', pathName: card.name, path: card, case: 'likely' }));
const scope = { sessionId: 'session-one', profileRevision: 1, snapshotKey: snap.key, pathId: 'B' as const };
const ctx: RequestContext = { principalId: 'alice', scope, generation: 'one' };
const id = 'fixture-answer-id-1234567890';
const config = { advisor: true, voice: { stt: 'adapter' as const, tts: 'adapter' as const }, timeoutMs: 1000 };
function setup() {
  let generation = 'one';
  const saved = new Map<string, { owner: string; generation: string; answer: ApprovedAnswer }>();
  const synthesize = vi.fn(async (_text: string, _signal: AbortSignal) => new Uint8Array([1, 2]));
  const host: RouteHost = {
    authenticate: async (r) => r.headers.get('authorization') === 'test-alice' ? ctx : r.headers.get('authorization') === 'test-bob' ? { ...ctx, principalId: 'bob' } : null,
    current: async (c) => c.generation === generation,
    registry: async () => registry,
    saveAnswer: async (c, a) => { if (c.generation !== generation) return null; saved.set(id, { owner: c.principalId, generation: c.generation, answer: a }); return id; },
    loadAnswer: async (c, key) => { const a = saved.get(key); return a?.owner === c.principalId && a.generation === generation ? a.answer : null; },
    inspector: { inspect: async () => ({ durationSeconds: 1 }) },
    stt: { transcribe: async () => 'Editable transcript' },
    tts: { synthesize },
  };
  return { host, synthesize, invalidate: () => { generation = 'two'; } };
}
const request = (body: unknown, auth = 'test-alice') => new Request('http://local/test', { method: 'POST', headers: { 'content-type': 'application/json', authorization: auth }, body: JSON.stringify(body) });
const audio = () => new Request('http://local/test', { method: 'POST', headers: { 'content-type': 'audio/wav', authorization: 'test-alice' }, body: new Uint8Array([1]) });

describe('bounded immersive HTTP contracts', () => {
  it('is disabled by default even with credentials and a feature flag cannot create a host', async () => {
    const secret = 'secret-not-real';
    const routes = createRoutes(routeConfig({ META_API_KEY: secret, IMMERSIVE_ADVISOR_ENABLED: 'true', VOICE_TTS_PROVIDER: 'adapter' }), null);
    const responses = await Promise.all([routes.advisor(request({ intent: 'lowest' })), routes.speak(request({ answerId: id })), routes.transcribe(audio())]);
    for (const response of responses) { expect(response.status).toBe(503); expect(await response.text()).not.toContain(secret); }
    expect(routeConfig({}).advisor).toBe(false);
  });
  it('requires authentication, strict input, and returns ClaimRef text with no cache', async () => {
    const { host } = setup(); const routes = createRoutes(config, host);
    expect((await routes.advisor(request({ intent: 'cash', month: 4 }, 'none'))).status).toBe(401);
    expect((await routes.advisor(request({ intent: 'cash', month: 4, snapshotKey: 'forged' }))).status).toBe(400);
    expect((await routes.advisor(request({ intent: 'cash', month: 37 }))).status).toBe(400);
    const response = await routes.advisor(request({ intent: 'cash', month: 4 }));
    const data = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(data.mode).toBe('fixture'); expect(data.text).toContain(data.claims[0].text);
  });
  it('binds answer lookup to principal and speaks only stored approved text', async () => {
    const { host, synthesize } = setup(); const routes = createRoutes(config, host);
    const data = await (await routes.advisor(request({ intent: 'lowest' }))).json();
    expect((await routes.speak(request({ answerId: data.answerId }, 'test-bob'))).status).toBe(404);
    expect((await routes.speak(request({ answerId: data.answerId, text: 'R999999' }))).status).toBe(400);
    expect((await routes.speak(request({ answerId: data.answerId }))).status).toBe(200);
    expect(synthesize).toHaveBeenCalledWith(data.text, expect.any(AbortSignal));
  });
  it('refuses stale results after revision or overlapping request, even if speech resolves later', async () => {
    const { host, invalidate } = setup(); const routes = createRoutes(config, host);
    const data = await (await routes.advisor(request({ intent: 'lowest' }))).json();
    let finish!: (b: Uint8Array) => void;
    host.tts = { synthesize: () => new Promise((resolve) => { finish = resolve; }) };
    const pending = routes.speak(request({ answerId: data.answerId }));
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    invalidate(); finish(new Uint8Array([1]));
    expect((await pending).status).toBe(409);
  });
  it('validates transcript and body bounds, reports sanitized failures', async () => {
    const { host } = setup(); const routes = createRoutes(config, host);
    expect(await (await routes.transcribe(audio())).json()).toEqual({ ok: true, transcript: 'Editable transcript', requiresConfirmation: true });
    host.stt = { transcribe: async () => 'bad\u0000text' };
    expect((await routes.transcribe(audio())).status).toBe(400);
    expect((await routes.advisor(request({ intent: 'lowest', padding: 'x'.repeat(3000) }))).status).toBe(413);
    host.authenticate = async () => { throw new Error('secret-not-real'); };
    expect(await (await routes.advisor(request({ intent: 'lowest' }))).text()).not.toContain('secret-not-real');
  });
  it('times out an adapter which ignores cancellation', async () => {
    const { host } = setup(); host.stt = { transcribe: () => new Promise(() => {}) };
    expect((await createRoutes({ ...config, timeoutMs: 10 }, host).transcribe(audio())).status).toBe(503);
  });
  it('rejects an already aborted request without invoking the host', async () => {
    const { host } = setup(); const auth = vi.spyOn(host, 'authenticate');
    const controller = new AbortController(); controller.abort();
    const req = new Request('http://local/test', { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' }, body: '{}' });
    expect((await createRoutes(config, host).advisor(req)).status).toBe(503);
    expect(auth).not.toHaveBeenCalled();
  });
});
