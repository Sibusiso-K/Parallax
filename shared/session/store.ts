// Saved sessions in Supabase (table public.parallax_sessions, see supabase/migrations). Server-side only: the browser
// talks to /api/session and never sees the Supabase URL or key.
//
// Each browser holds a random device code. Only its SHA-256 is stored, and the code travels on every request as the
// x-parallax-device header, which row-level security checks: a request can read, write or delete only the row whose
// hash matches its own code. No new dependency: PostgREST over fetch.

export interface SessionConfig {
  url: string;
  key: string;
}

export interface SessionDeps {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
}

export class SessionError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SessionError';
    this.status = status;
  }
}

const TABLE = 'parallax_sessions';
const TIMEOUT_MS = 8_000;
/** The largest saved state the table accepts (its check constraint), in bytes of JSON. */
export const MAX_STATE_BYTES = 262_144;

/** A device code: 32 to 128 URL-safe characters. The browser makes one from 32 random bytes. */
export const DEVICE_CODE = /^[A-Za-z0-9_-]{32,128}$/;

/** Null unless both settings are present and the URL is https. A bad setting reads as "saving is off". */
export function sessionConfigOrNull(env: Record<string, string | undefined>): SessionConfig | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  try {
    if (new URL(url).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { url, key };
}

export async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const liveDeps: SessionDeps = { fetch: (url, init) => fetch(url, init) };

async function call(cfg: SessionConfig, code: string, path: string, init: RequestInit, deps: SessionDeps): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await deps.fetch(`${cfg.url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: cfg.key, 'x-parallax-device': code, 'content-type': 'application/json', ...(init.headers as Record<string, string>) },
      signal: controller.signal,
    });
    if (!res.ok) throw new SessionError(`the database answered ${res.status}`, res.status);
    return res;
  } catch (err) {
    if (err instanceof SessionError) throw err;
    throw new SessionError(controller.signal.aborted ? 'the database did not answer in time' : 'could not reach the database');
  } finally {
    clearTimeout(timer);
  }
}

export interface SavedSession {
  state: Record<string, unknown>;
  updatedAt: string;
}

/** The saved state for this device, or null when there is none. */
export async function loadSession(cfg: SessionConfig, code: string, deps: SessionDeps = liveDeps): Promise<SavedSession | null> {
  const hash = await hashCode(code);
  const res = await call(cfg, code, `${TABLE}?select=state,updated_at&token_hash=eq.${hash}`, { method: 'GET' }, deps);
  const rows = (await res.json()) as { state?: unknown; updated_at?: unknown }[] | null;
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row || typeof row.state !== 'object' || row.state === null || Array.isArray(row.state)) return null;
  return { state: row.state as Record<string, unknown>, updatedAt: String(row.updated_at ?? '') };
}

const short = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Saves (creates or replaces) this device's state. A few plain columns sit beside it for the dashboard. */
export async function saveSession(cfg: SessionConfig, code: string, state: Record<string, unknown>, deps: SessionDeps = liveDeps): Promise<void> {
  const hash = await hashCode(code);
  const fields = (state.fields ?? {}) as Record<string, unknown>;
  const body = {
    token_hash: hash,
    state,
    business: short(fields.business, 200),
    decision: short(fields.decision, 300),
    step: short(state.step, 20),
  };
  await call(
    cfg,
    code,
    `${TABLE}?on_conflict=token_hash`,
    { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) },
    deps,
  );
}

/** Erases this device's row. Erasing a row that is not there is not an error. */
export async function deleteSession(cfg: SessionConfig, code: string, deps: SessionDeps = liveDeps): Promise<void> {
  const hash = await hashCode(code);
  await call(cfg, code, `${TABLE}?token_hash=eq.${hash}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } }, deps);
}
