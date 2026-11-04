import { z } from 'zod';
import { fixtureAnswer, type ApprovedAnswer, type BoundScope } from './advisor.js';
import { speak, transcribe, type AudioInspector, type SttAdapter, type TtsAdapter, type VoiceConfig } from './voice.js';
import type { SnapshotRegistry } from '../scene/room-model.js';

// Host methods must use authenticated server state and a shared atomic store, not
// a snapshot key or an in-process map as a credential. See README.md.
export interface RequestContext { principalId: string; scope: BoundScope; generation: string }
export interface RouteHost {
  authenticate(request: Request): Promise<RequestContext | null>;
  registry(context: RequestContext): Promise<SnapshotRegistry>;
  current(context: RequestContext): Promise<boolean>;
  saveAnswer(context: RequestContext, answer: ApprovedAnswer, signal: AbortSignal): Promise<string | null>;
  loadAnswer(context: RequestContext, id: string): Promise<ApprovedAnswer | null>;
  inspector: AudioInspector | null;
  stt: SttAdapter | null;
  tts: TtsAdapter | null;
}
export interface RouteConfig { advisor: boolean; voice: VoiceConfig; timeoutMs: number }
export function routeConfig(env: Record<string, string | undefined>): RouteConfig {
  return { advisor: env.IMMERSIVE_ADVISOR_ENABLED === 'true', voice: { stt: env.VOICE_STT_PROVIDER === 'adapter' ? 'adapter' : 'disabled', tts: env.VOICE_TTS_PROVIDER === 'adapter' ? 'adapter' : 'disabled' }, timeoutMs: 10_000 };
}
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers });
const json = (body: unknown) => Response.json(body, { headers });
const answerSchema = z.object({ intent: z.enum(['cash', 'lowest', 'shortfall']), month: z.number().int().min(1).max(36).optional() }).strict().refine((v) => v.intent === 'cash' ? v.month !== undefined : v.month === undefined);
const speakSchema = z.object({ answerId: z.string().regex(/^[A-Za-z0-9_-]{20,128}$/) }).strict();
const MAX_JSON = 2048;
const MAX_AUDIO = 2_000_000;

async function bodyBytes(request: Request, max: number, signal: AbortSignal): Promise<Uint8Array | null> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > max)) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > max) { void reader.cancel(); return null; }
      chunks.push(part.value);
    }
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return all;
}
async function parseJson(request: Request, signal: AbortSignal): Promise<unknown> {
  const bytes = await bodyBytes(request, MAX_JSON, signal);
  if (!bytes) throw new RangeError('large');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
function validText(value: string): boolean {
  return value.length > 0 && value.length <= 4000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value);
}
async function deadline<T>(request: Request, ms: number, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let rejectAbort: (() => void) | undefined;
  const abort = () => { controller.abort(); rejectAbort?.(); };
  if (request.signal.aborted) abort();
  request.signal.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      new Promise<never>((_, reject) => { rejectAbort = () => reject(new Error('cancelled')); if (controller.signal.aborted) rejectAbort(); }),
      controller.signal.aborted ? Promise.reject(new Error('cancelled')) : task(controller.signal),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, ms); }),
    ]);
  } finally { if (timer) clearTimeout(timer); request.signal.removeEventListener('abort', abort); }
}
async function contextFor(request: Request, host: RouteHost): Promise<RequestContext | null> {
  const context = await host.authenticate(request);
  return context && await host.current(context) ? context : null;
}

/** Factory enables offline contract testing. Default exported routes have no host. */
export function createRoutes(config: RouteConfig, host: RouteHost | null) {
  return {
    async advisor(request: Request): Promise<Response> {
      if (!config.advisor || !host) return fail(503, 'advisor_unavailable');
      try {
        return await deadline(request, config.timeoutMs, async (signal) => {
          const ctx = await contextFor(request, host);
          if (!ctx) return fail(401, 'unauthorized');
          if (signal.aborted) return fail(409, 'stale');
          if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return fail(415, 'unsupported_content_type');
          const input = answerSchema.safeParse(await parseJson(request, signal));
          if (!input.success) return fail(400, 'invalid_request');
          const registry = await host.registry(ctx);
          const result = fixtureAnswer(registry, ctx.scope, input.data.intent, input.data.month);
          if (!result.ok) return fail(409, 'unavailable_scope');
          if (signal.aborted || !await host.current(ctx)) return fail(409, 'stale');
          // Host must atomically check current generation and bind ID to principal + scope.
          const id = await host.saveAnswer(ctx, result.answer, signal);
          if (!id || !/^[A-Za-z0-9_-]{20,128}$/.test(id) || signal.aborted || !await host.current(ctx)) return fail(409, 'stale');
          return json({ ok: true, answerId: id, mode: 'fixture', text: result.answer.text, claims: result.answer.claims });
        });
      } catch (e) { return e instanceof RangeError ? fail(413, 'too_large') : e instanceof SyntaxError || e instanceof TypeError ? fail(400, 'invalid_request') : fail(503, 'advisor_unavailable'); }
    },
    async transcribe(request: Request): Promise<Response> {
      if (config.voice.stt !== 'adapter' || !host || !host.inspector || !host.stt) return fail(503, 'transcription_unavailable');
      try {
        return await deadline(request, config.timeoutMs, async (signal) => {
          const ctx = await contextFor(request, host);
          if (!ctx) return fail(401, 'unauthorized');
          if (signal.aborted) return fail(409, 'stale');
          const mime = request.headers.get('content-type')?.toLowerCase().split(';')[0]?.trim() ?? '';
          if (!['audio/webm', 'audio/ogg', 'audio/wav'].includes(mime)) return fail(415, 'unsupported_content_type');
          const bytes = await bodyBytes(request, MAX_AUDIO, signal);
          if (!bytes) return fail(413, 'too_large');
          const result = await transcribe(config.voice, bytes, mime, host.inspector, host.stt, signal);
          if (signal.aborted || !await host.current(ctx)) return fail(409, 'stale');
          if (!result.ok) return fail(result.reason === 'invalid' ? 400 : 503, 'transcription_unavailable');
          if (!validText(result.value)) return fail(400, 'invalid_transcript');
          return json({ ok: true, transcript: result.value, requiresConfirmation: true });
        });
      } catch { return fail(503, 'transcription_unavailable'); }
    },
    async speak(request: Request): Promise<Response> {
      if (config.voice.tts !== 'adapter' || !host || !host.tts) return fail(503, 'speech_unavailable');
      try {
        return await deadline(request, config.timeoutMs, async (signal) => {
          const ctx = await contextFor(request, host);
          if (!ctx) return fail(401, 'unauthorized');
          if (signal.aborted) return fail(409, 'stale');
          if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return fail(415, 'unsupported_content_type');
          const input = speakSchema.safeParse(await parseJson(request, signal));
          if (!input.success) return fail(400, 'invalid_request');
          const answer = await host.loadAnswer(ctx, input.data.answerId);
          if (!answer || !validText(answer.text)) return fail(404, 'answer_unavailable');
          if (signal.aborted || !await host.current(ctx)) return fail(409, 'stale');
          // The async authority is checked before and after synthesis; signal handles deadline.
          const result = await speak(config.voice, answer, ctx.scope, host.tts, signal, () => !signal.aborted);
          if (signal.aborted || !await host.current(ctx)) return fail(409, 'stale');
          if (!result.ok) return fail(503, 'speech_unavailable');
          return new Response(new Uint8Array(result.value), { headers: { ...headers, 'Content-Type': 'application/octet-stream' } });
        });
      } catch (e) { return e instanceof RangeError ? fail(413, 'too_large') : e instanceof SyntaxError || e instanceof TypeError ? fail(400, 'invalid_request') : fail(503, 'speech_unavailable'); }
    },
  };
}
