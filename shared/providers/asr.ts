import { ModelError, type Deps } from './meta.js';

// Meta Voice Transcribe client (docs/ARCHITECTURE.md §10): POST {base}/asr/transcribe, multipart with a JSON "request"
// part and a WAV "audio" part. Same rules as the text client: nothing is sent unless the voice switch is on, the key
// never appears in an error, every wait is bounded, and a failure ends in a ModelError that says what to do.
// The voice switch is separate from the text model's, because it sends the founder's recorded voice.

export const DEFAULT_ASR_MODEL = 'muse-voice-transcribe-1.0';
const TIMEOUT_MS = 25_000;
const DEADLINE_MS = 40_000;
const TRIES: Partial<Record<ModelError['kind'], number>> = { rate: 3, server: 2, network: 2, timeout: 1 };

export interface VoiceConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function voiceConfigFromEnv(env: Record<string, string | undefined>): VoiceConfig | null {
  if (env.META_VOICE_ENABLED?.trim().toLowerCase() !== 'true') return null;
  const apiKey = env.META_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (env.META_API_BASE_URL?.trim() || 'https://api.meta.ai/v1').replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new ModelError('config', 'META_API_BASE_URL is not a URL');
  }
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new ModelError('config', 'META_API_BASE_URL must use https');
  const model = env.META_ASR_MODEL?.trim() || DEFAULT_ASR_MODEL;
  if (model.endsWith('-contributor')) throw new ModelError('config', 'contributor models train on what we send them, so they are refused');
  return { apiKey, baseUrl, model };
}

/** A bad setting reads as "voice is off", so the app runs in demo mode. */
export function voiceConfigOrNull(env: Record<string, string | undefined>): VoiceConfig | null {
  try {
    return voiceConfigFromEnv(env);
  } catch {
    return null;
  }
}

const liveDeps: Deps = {
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  random: () => Math.random(),
};

function httpError(res: Response): ModelError {
  const s = res.status;
  const message = `the speech API answered ${s}`;
  const header = res.headers.get('retry-after');
  const seconds = header !== null && /^\d+$/.test(header.trim()) ? Number(header) : undefined;
  if (s === 401) return new ModelError('auth', message, s);
  if (s === 402 || s === 403) return new ModelError('billing', message, s);
  if (s === 429) return new ModelError('rate', message, s, seconds === undefined ? undefined : seconds * 1000);
  if (s >= 500) return new ModelError('server', message, s);
  return new ModelError('request', message, s);
}

async function postOnce(cfg: VoiceConfig, wav: Uint8Array, deps: Deps): Promise<{ transcript: string; audioDurationMs?: number }> {
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify({ mode: 'PUSH_TO_TALK', model: cfg.model, audioEncoding: 'WAV' })], { type: 'application/json' }));
  form.append('audio', new Blob([wav as BlobPart], { type: 'audio/wav' }), 'speech.wav');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await deps.fetch(`${cfg.baseUrl}/asr/transcribe`, {
        method: 'POST',
        headers: { authorization: `Bearer ${cfg.apiKey}`, accept: 'application/json' },
        body: form,
        signal: controller.signal,
      });
    } catch {
      throw controller.signal.aborted ? new ModelError('timeout', `no reply within ${TIMEOUT_MS} ms`) : new ModelError('network', 'could not reach the speech API');
    }
    if (!res.ok) throw httpError(res);
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new ModelError('schema', 'the reply was not JSON');
    }
    const { transcript, audioDurationMs } = (data ?? {}) as { transcript?: unknown; audioDurationMs?: unknown };
    if (typeof transcript !== 'string') throw new ModelError('schema', 'the reply had no transcript');
    return { transcript: transcript.trim(), audioDurationMs: typeof audioDurationMs === 'number' ? audioDurationMs : undefined };
  } finally {
    clearTimeout(timer);
  }
}

/** Sends one checked WAV recording to Meta and returns what was said. Throws only ModelError. */
export async function transcribeWav(cfg: VoiceConfig, wav: Uint8Array, deps: Deps = liveDeps): Promise<{ transcript: string; audioDurationMs?: number }> {
  const deadline = deps.now() + DEADLINE_MS;
  for (let attempt = 1; ; attempt++) {
    try {
      return await postOnce(cfg, wav, deps);
    } catch (err) {
      if (!(err instanceof ModelError)) throw new ModelError('network', 'the speech call failed');
      if (attempt >= (TRIES[err.kind] ?? 1)) throw err;
      const wait = err.retryAfterMs !== undefined ? Math.min(err.retryAfterMs, 10_000) : 500 * 2 ** (attempt - 1) + Math.floor(deps.random() * 500);
      if (deps.now() + wait >= deadline) throw err;
      await deps.sleep(wait);
    }
  }
}
