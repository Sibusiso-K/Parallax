// Saving the decision, so a reload or a return visit picks up where the founder left off.
//
// This browser gets a random device code (kept in localStorage). /api/session saves the decision in Parallax's
// database under that code's hash. When the server has no database, or cannot be reached, the copy is kept in this
// browser instead, so nothing is lost either way. Delete everything erases both and starts a new code.

const CODE_KEY = "parallax.device";
const LOCAL_KEY = "parallax.saved";

function storage(): Storage | null {
  try {
    const s = window.localStorage;
    s.getItem(CODE_KEY);
    return s;
  } catch {
    return null; // private mode, blocked storage, or no window (tests)
  }
}

let memoryCode: string | null = null;

function newCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** This browser's code, made on first use. Valid codes are 32 to 128 URL-safe characters (see shared/session). */
export function deviceCode(): string {
  const s = storage();
  const kept = s?.getItem(CODE_KEY) ?? memoryCode;
  if (kept && /^[A-Za-z0-9_-]{32,128}$/.test(kept)) return kept;
  const code = newCode();
  memoryCode = code;
  try {
    s?.setItem(CODE_KEY, code);
  } catch {
    /* storage full or blocked: the code lives for this tab only */
  }
  return code;
}

const headers = () => ({ "x-parallax-device": deviceCode() });

function readLocal(): Record<string, unknown> | null {
  try {
    const raw = storage()?.getItem(LOCAL_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function writeLocal(state: Record<string, unknown> | null) {
  try {
    if (state) storage()?.setItem(LOCAL_KEY, JSON.stringify(state));
    else storage()?.removeItem(LOCAL_KEY);
  } catch {
    /* nothing more to do: the server copy, or none */
  }
}

export type SaveMode = "saved" | "local";

/** The saved decision: from the database when it is on, else from this browser. Never throws. */
export async function loadSaved(): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch("/api/session", { headers: headers(), cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean; mode?: string; session?: { state?: unknown } | null } | null;
    if (data?.ok && data.mode === "saved") {
      const state = data.session?.state;
      if (state && typeof state === "object" && !Array.isArray(state)) return state as Record<string, unknown>;
      return readLocal(); // nothing on the server yet: an earlier offline copy may still be here
    }
  } catch {
    /* fall back to this browser's copy */
  }
  return readLocal();
}

/** Saves the decision. Answers where it went. Never throws. */
export async function saveState(state: Record<string, unknown>, opts: { keepalive?: boolean } = {}): Promise<SaveMode> {
  try {
    const body = JSON.stringify({ state });
    const res = await fetch("/api/session", {
      method: "PUT",
      headers: { ...headers(), "content-type": "application/json" },
      body,
      keepalive: opts.keepalive === true && body.length < 60_000,
    });
    const data = (await res.json()) as { ok?: boolean; mode?: string } | null;
    if (data?.ok && data.mode === "saved") {
      writeLocal(null); // the database holds it now; keep no second copy of the founder's figures here
      return "saved";
    }
  } catch {
    /* keep it here instead */
  }
  writeLocal(state);
  return "local";
}

/** Erases the saved decision everywhere and gives this browser a new code. Never throws. */
export async function eraseSaved(): Promise<void> {
  writeLocal(null);
  try {
    await fetch("/api/session", { method: "DELETE", headers: headers() });
  } catch {
    /* the server copy, if any, is unreachable now; the new code below can never reach it again */
  }
  memoryCode = null;
  try {
    storage()?.removeItem(CODE_KEY);
  } catch {
    /* ignore */
  }
}
