import type { ApprovedAnswer, BoundScope } from './advisor.js';

// No built-in network client, credentials, audio storage or public endpoint.
// A host must implement authenticated adapters and bind scope to the current user.
export interface VoiceConfig { stt: 'disabled' | 'adapter'; tts: 'disabled' | 'adapter' }
export function voiceConfig(env: Record<string, string | undefined>): VoiceConfig {
  return { stt: env.VOICE_STT_PROVIDER === 'adapter' ? 'adapter' : 'disabled', tts: env.VOICE_TTS_PROVIDER === 'adapter' ? 'adapter' : 'disabled' };
}
export function voiceCapabilities(config: VoiceConfig) {
  return { stt: config.stt === 'adapter' ? 'configured-unverified' : 'disabled', tts: config.tts === 'adapter' ? 'configured-unverified' : 'disabled' } as const;
}
export interface AudioInspector { inspect(bytes: Uint8Array, mime: string, signal: AbortSignal): Promise<{ durationSeconds: number }> }
export interface SttAdapter { transcribe(bytes: Uint8Array, mime: string, signal: AbortSignal): Promise<string> }
export interface TtsAdapter { synthesize(text: string, signal: AbortSignal): Promise<Uint8Array> }
export type VoiceResult<T> = { ok: true; value: T } | { ok: false; reason: 'disabled' | 'invalid' | 'unavailable' | 'stale' };
const MAX_BYTES = 2_000_000;
const SUPPORTED = new Set(['audio/webm', 'audio/ogg', 'audio/wav']);

/** Inspector must decode the actual bytes, not trust the client duration or MIME. */
export async function transcribe(config: VoiceConfig, bytes: Uint8Array, mime: string, inspector: AudioInspector | null, adapter: SttAdapter | null, signal: AbortSignal): Promise<VoiceResult<string>> {
  if (config.stt !== 'adapter' || !inspector || !adapter) return { ok: false, reason: 'disabled' };
  if (!SUPPORTED.has(mime) || bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return { ok: false, reason: 'invalid' };
  try {
    const { durationSeconds } = await inspector.inspect(bytes, mime, signal);
    if (signal.aborted) return { ok: false, reason: 'stale' };
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 20) return { ok: false, reason: 'invalid' };
    const result = await adapter.transcribe(bytes, mime, signal);
    if (signal.aborted) return { ok: false, reason: 'stale' };
    if (typeof result !== 'string' || !result.trim() || result.length > 4000) return { ok: false, reason: 'invalid' };
    return { ok: true, value: result.trim() };
  } catch { return { ok: false, reason: signal.aborted ? 'stale' : 'unavailable' }; }
}

/** Answer must be loaded by the host from an authenticated, server-owned answer store. */
export async function speak(config: VoiceConfig, answer: ApprovedAnswer, scope: BoundScope, adapter: TtsAdapter | null, signal: AbortSignal, isCurrent: () => boolean): Promise<VoiceResult<Uint8Array>> {
  if (config.tts !== 'adapter' || !adapter) return { ok: false, reason: 'disabled' };
  if (answer.snapshotKey !== scope.snapshotKey || answer.profileRevision !== scope.profileRevision || !isCurrent() || signal.aborted) return { ok: false, reason: 'stale' };
  try {
    const audio = await adapter.synthesize(answer.text, signal);
    if (signal.aborted || !isCurrent()) return { ok: false, reason: 'stale' };
    if (!(audio instanceof Uint8Array) || !audio.length || audio.length > MAX_BYTES) return { ok: false, reason: 'invalid' };
    return { ok: true, value: audio };
  } catch { return { ok: false, reason: signal.aborted || !isCurrent() ? 'stale' : 'unavailable' }; }
}
