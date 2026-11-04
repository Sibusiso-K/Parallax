import { describe, expect, it, vi } from 'vitest';
import { DEMO_EXTRACTION } from '../intake/fixture.js';
import { buildProfile } from '../profile/profile.js';
import { templatePaths } from '../paths/templates.js';
import { buildSnapshot, RequestGate, SnapshotRegistry } from '../scene/room-model.js';
import { fixtureAnswer } from './advisor.js';
import { speak, transcribe, voiceCapabilities, voiceConfig } from './voice.js';

const card = templatePaths(buildProfile(DEMO_EXTRACTION))[1]!;
const registry = new SnapshotRegistry();
const snap = registry.add(buildSnapshot({ sessionId: 'fixture', profileRevision: 2, simulationVersion: 1, pathId: 'B', pathName: card.name, path: card, case: 'likely' }));
const scope = { sessionId: 'fixture', profileRevision: 2, pathId: 'B' as const, snapshotKey: snap.key };
const signal = () => new AbortController().signal;

describe('server fixture boundary', () => {
  it('resolves the displayed and spoken text from the same claim', async () => {
    const result = fixtureAnswer(registry, scope, 'cash', 4);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answer.text).toContain(result.answer.claims[0]!.text);
    const synthesize = vi.fn(async (_text: string) => new Uint8Array([1]));
    const spoken = await speak({ stt: 'disabled', tts: 'adapter' }, result.answer, scope, { synthesize }, signal(), () => true);
    expect(spoken.ok).toBe(true);
    expect(synthesize).toHaveBeenCalledWith(result.answer.text, expect.any(AbortSignal));
  });
  it('rejects foreign scope, stale revision, unknown snapshot, invalid month and unknown intent', () => {
    expect(fixtureAnswer(registry, { ...scope, sessionId: 'other' }, 'cash', 4).ok).toBe(false);
    expect(fixtureAnswer(registry, { ...scope, pathId: 'A' }, 'cash', 4).ok).toBe(false);
    expect(fixtureAnswer(registry, { ...scope, profileRevision: 1 }, 'cash', 4).ok).toBe(false);
    expect(fixtureAnswer(registry, { ...scope, snapshotKey: 'unknown' }, 'cash', 4).ok).toBe(false);
    expect(fixtureAnswer(registry, scope, 'cash', 37).ok).toBe(false);
    expect(fixtureAnswer(registry, scope, 'other' as 'cash', 4).ok).toBe(false);
  });
  it('defaults off and does not present configuration as live verification', () => {
    expect(voiceCapabilities(voiceConfig({}))).toEqual({ stt: 'disabled', tts: 'disabled' });
    expect(voiceCapabilities(voiceConfig({ VOICE_STT_PROVIDER: 'adapter' })).stt).toBe('configured-unverified');
    expect(voiceConfig({ VOICE_STT_PROVIDER: 'meta' }).stt).toBe('disabled');
  });
  it('checks decoded duration and refuses disabled, oversized or unsupported audio', async () => {
    const adapter = { transcribe: vi.fn(async () => 'hello') };
    const inspector = { inspect: vi.fn(async () => ({ durationSeconds: 21 })) };
    expect((await transcribe({ stt: 'disabled', tts: 'disabled' }, new Uint8Array([1]), 'audio/wav', inspector, adapter, signal())).ok).toBe(false);
    expect((await transcribe({ stt: 'adapter', tts: 'disabled' }, new Uint8Array([1]), 'audio/wav', inspector, adapter, signal())).ok).toBe(false);
    expect((await transcribe({ stt: 'adapter', tts: 'disabled' }, new Uint8Array(2_000_001), 'audio/wav', inspector, adapter, signal())).ok).toBe(false);
    expect((await transcribe({ stt: 'adapter', tts: 'disabled' }, new Uint8Array([1]), 'audio/mp3', inspector, adapter, signal())).ok).toBe(false);
    expect(adapter.transcribe).not.toHaveBeenCalled();
  });
  it('drops an old speech result after an overlapping turn even if the adapter completes', async () => {
    const answer = fixtureAnswer(registry, scope, 'lowest');
    if (!answer.ok) throw new Error('fixture failed');
    const gate = new RequestGate();
    const ticket = gate.begin(scope.snapshotKey);
    let finish!: (value: Uint8Array) => void;
    const pending = speak({ stt: 'disabled', tts: 'adapter' }, answer.answer, scope, { synthesize: () => new Promise((resolve) => { finish = resolve; }) }, signal(), () => gate.isCurrent(ticket, scope.snapshotKey));
    gate.begin(scope.snapshotKey);
    finish(new Uint8Array([1]));
    expect(await pending).toEqual({ ok: false, reason: 'stale' });
  });
});
