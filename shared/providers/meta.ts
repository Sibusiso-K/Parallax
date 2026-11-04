import { z } from 'zod';

// Meta Model API client (ARCHITECTURE §12, FEATURES F19). Chat Completions over fetch, so nothing new to install.
// It owns the timeouts, the bounded retries, the failover chain and the one repair retry. Callers get a parsed value
// with a trace, or a ModelError whose kind says what to do. Billing and auth errors go to fixture mode.
// Spend control: nothing is sent unless META_MODEL_ENABLED is "true", and every reply is capped at MAX_TOKENS.

export const DEFAULT_BASE_URL = 'https://api.meta.ai/v1';
export const DEFAULT_MODELS = ['muse-spark-1.3', 'muse-spark-1.2'] as const;

const TIMEOUT_MS = 20_000; // first-token budget (ARCHITECTURE §12)
const DEADLINE_MS = 90_000; // no new attempt after this, so one call stays well inside the function time limit
const MAX_RETRY_AFTER_MS = 10_000;
// A hard cap on what one reply can cost. Muse Spark reasons before it answers, and the reasoning counts against this cap:
// at 1,024 a full intake spent it all on reasoning and came back with no text (finish_reason "length"). A two-figure
// test answer alone used about 300 reasoning tokens.
export const MAX_TOKENS = 8192;
// Copying figures and quotes out of a founder's story needs little reasoning. On a live 4 Nov test, "minimal" read the
// same fields and quotes as "low" in about 10 s instead of 18 s.
export const REASONING_EFFORT = 'minimal';

export type ErrorKind =
  | 'config' // bad settings: nothing was sent
  | 'auth' // 401: the key is wrong
  | 'billing' // 402 or 403: fixture mode (ARCHITECTURE §12)
  | 'request' // 400, 413 and other 4xx: our bug, not retried
  | 'notfound' // 404: try the next model in the chain
  | 'rate' // 429
  | 'overloaded' // 503
  | 'server' // 500, 502 and other 5xx
  | 'timeout' // 504, or no reply within the timeout
  | 'network' // the request never reached the API
  | 'schema'; // the reply was not the JSON we asked for, even after one repair

// Error kinds that stop the whole call at once instead of trying the next model.
const STOP_KINDS: ReadonlySet<ErrorKind> = new Set<ErrorKind>(['config', 'auth', 'billing', 'request']);

// How many tries one model gets for each kind of failure (the first try counts). Anything else gets one.
const TRIES: Partial<Record<ErrorKind, number>> = { rate: 3, server: 3, network: 3, overloaded: 2, timeout: 2 };

export class ModelError extends Error {
  readonly kind: ErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;
  /** The start of the API's own error reply (never the request), for diagnosing a refusal. The key is redacted. */
  detail?: string;
  /** Every model tried before giving up, in order, so a refusal by the first model is not hidden by the last. */
  attempts?: { model: string; kind: ErrorKind; status: number | null; detail: string | null }[];

  constructor(kind: ErrorKind, message: string, status?: number, retryAfterMs?: number) {
    super(message);
    this.name = 'ModelError';
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface MetaConfig {
  apiKey: string;
  baseUrl: string;
  models: readonly string[];
}

/**
 * Reads server-side settings. Null unless META_MODEL_ENABLED is "true" and a key is set, so a key on its own never
 * spends credits. Throws ModelError('config') for settings that cannot be right. The key never appears in an error.
 */
export function configFromEnv(env: Record<string, string | undefined>): MetaConfig | null {
  if (env.META_MODEL_ENABLED?.trim().toLowerCase() !== 'true') return null;
  const apiKey = env.META_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (env.META_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new ModelError('config', 'META_API_BASE_URL is not a URL');
  }
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new ModelError('config', 'META_API_BASE_URL must use https');
  }
  const models = env.META_MODELS
    ? env.META_MODELS.split(',').map((m) => m.trim()).filter(Boolean)
    : [...DEFAULT_MODELS];
  if (models.length === 0) throw new ModelError('config', 'META_MODELS lists no models');
  if (models.some((m) => m.endsWith('-contributor'))) {
    throw new ModelError('config', 'contributor models train on what we send them, so they are refused');
  }
  return { apiKey, baseUrl, models };
}

/** Same as configFromEnv, but a bad setting reads as "no model", so the app runs in fixture mode. */
export function modelConfigOrNull(env: Record<string, string | undefined>): MetaConfig | null {
  try {
    return configFromEnv(env);
  } catch {
    return null;
  }
}

// Network and clock, injected so the tests can script replies and skip real waiting.
export interface Deps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  random: () => number;
}

const liveDeps: Deps = {
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  random: () => Math.random(),
};

export interface JsonCall<S extends z.ZodType> {
  /** Name for the response format, for example "intake". */
  name: string;
  system: string;
  user: string;
  schema: S;
  timeoutMs?: number;
}

export interface Trace {
  /** The model that answered. */
  model: string;
  /** HTTP calls made across all models, repairs included. Each one can be billed. */
  calls: number;
  latencyMs: number;
  repaired: boolean;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** One structured call: the model must answer with JSON that passes the schema. Tries each model in turn. */
export async function chatJson<S extends z.ZodType>(
  cfg: MetaConfig,
  call: JsonCall<S>,
  deps: Deps = liveDeps,
): Promise<{ value: z.output<S>; trace: Trace }> {
  const started = deps.now();
  const deadline = started + DEADLINE_MS;
  const counter = { calls: 0 };
  const format = toJsonSchema(call.schema);
  const start: Message[] = [
    { role: 'system', content: call.system },
    { role: 'user', content: call.user },
  ];
  let last: ModelError | undefined;
  const attempts: NonNullable<ModelError['attempts']> = [];
  for (const model of cfg.models) {
    try {
      const out = await callModel(cfg, model, call, format, start, counter, deps, deadline);
      const trace = { model, calls: counter.calls, latencyMs: deps.now() - started, repaired: out.repaired };
      return { value: out.value, trace };
    } catch (err) {
      if (!(err instanceof ModelError)) throw err;
      last = err;
      attempts.push({ model, kind: err.kind, status: err.status ?? null, detail: err.detail ?? err.message });
      if (STOP_KINDS.has(err.kind) || deps.now() >= deadline) break;
    }
  }
  if (last) last.attempts = attempts;
  throw last ?? new ModelError('config', 'no model is configured');
}

async function callModel<S extends z.ZodType>(
  cfg: MetaConfig,
  model: string,
  call: JsonCall<S>,
  format: Record<string, unknown>,
  start: Message[],
  counter: { calls: number },
  deps: Deps,
  deadline: number,
): Promise<{ value: z.output<S>; repaired: boolean }> {
  let convo = start;
  let repaired = false;
  for (;;) {
    const content = await postWithRetry(cfg, model, call, format, convo, counter, deps, deadline);
    const parsed = parseReply(content, call.schema);
    if (parsed.ok) return { value: parsed.value, repaired };
    if (repaired) throw new ModelError('schema', 'the reply did not match the schema, even after one repair');
    repaired = true;
    const note = `That reply did not match the required schema (${parsed.issues}). Reply again with corrected JSON only.`;
    convo = [...convo, { role: 'assistant', content }, { role: 'user', content: note }];
  }
}

async function postWithRetry<S extends z.ZodType>(
  cfg: MetaConfig,
  model: string,
  call: JsonCall<S>,
  format: Record<string, unknown>,
  convo: Message[],
  counter: { calls: number },
  deps: Deps,
  deadline: number,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    counter.calls++;
    try {
      return await postOnce(cfg, model, call, format, convo, deps);
    } catch (err) {
      if (!(err instanceof ModelError)) throw err;
      if (attempt >= (TRIES[err.kind] ?? 1)) throw err;
      const wait = waitBefore(err, attempt, deps.random);
      if (deps.now() + wait >= deadline) throw err;
      await deps.sleep(wait);
    }
  }
}

// Backoff: 0.5 s, 1 s, 2 s and so on, plus up to 1 s of jitter. Retry-After is honoured up to MAX_RETRY_AFTER_MS.
// An overloaded service gets one quick retry, not the 60 s it asks for (ARCHITECTURE §12).
function waitBefore(err: ModelError, attempt: number, random: () => number): number {
  if (err.kind === 'overloaded') return 500;
  if (err.retryAfterMs !== undefined) return Math.min(err.retryAfterMs, MAX_RETRY_AFTER_MS);
  return 500 * 2 ** (attempt - 1) + Math.floor(random() * 1000);
}

async function postOnce<S extends z.ZodType>(
  cfg: MetaConfig,
  model: string,
  call: JsonCall<S>,
  format: Record<string, unknown>,
  convo: Message[],
  deps: Deps,
): Promise<string> {
  const timeoutMs = call.timeoutMs ?? TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const timedOut = () => new ModelError('timeout', `no reply within ${timeoutMs} ms`);
  try {
    let res: Response;
    try {
      res = await deps.fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: convo,
          temperature: 0,
          max_tokens: MAX_TOKENS,
          reasoning_effort: REASONING_EFFORT,
          response_format: { type: 'json_schema', json_schema: { name: call.name, schema: format, strict: false } },
        }),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) throw timedOut();
      throw new ModelError('network', 'could not reach the model API');
    }
    if (!res.ok) {
      const err = httpError(res);
      err.detail = (await res.text().catch(() => '')).slice(0, 240).split(cfg.apiKey).join('<key>');
      throw err;
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      if (controller.signal.aborted) throw timedOut();
      throw new ModelError('schema', 'the reply was not JSON');
    }
    const content = (data as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      const finish = (data as { choices?: { finish_reason?: unknown }[] }).choices?.[0]?.finish_reason;
      throw new ModelError('schema', finish === 'length' ? 'the reply ran out of tokens before any text' : 'the reply had no text');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function httpError(res: Response): ModelError {
  const status = res.status;
  const message = `the model API answered ${status}`;
  const header = res.headers.get('retry-after');
  const seconds = header !== null && /^\d+$/.test(header.trim()) ? Number(header) : undefined;
  if (status === 401) return new ModelError('auth', message, status);
  if (status === 402 || status === 403) return new ModelError('billing', message, status);
  if (status === 404) return new ModelError('notfound', message, status);
  if (status === 429) return new ModelError('rate', message, status, seconds === undefined ? undefined : seconds * 1000);
  if (status === 503) return new ModelError('overloaded', message, status);
  if (status === 504) return new ModelError('timeout', message, status);
  if (status >= 500) return new ModelError('server', message, status);
  return new ModelError('request', message, status);
}

type Parsed<T> = { ok: true; value: T } | { ok: false; issues: string };

function parseReply<S extends z.ZodType>(content: string, schema: S): Parsed<z.output<S>> {
  const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, issues: 'it was not JSON' };
  }
  const res = schema.safeParse(data);
  if (res.success) return { ok: true, value: res.data as z.output<S> };
  const issues = res.error.issues.slice(0, 5).map((i) => `${i.path.map(String).join('.') || 'reply'}: ${i.message}`);
  return { ok: false, issues: issues.join('; ') };
}

// Zod turns the schema into JSON Schema for response_format. The draft marker is dropped.
function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const out = { ...(z.toJSONSchema(schema) as Record<string, unknown>) };
  delete out.$schema;
  return out;
}
